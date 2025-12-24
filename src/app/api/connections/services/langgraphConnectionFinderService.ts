import { z } from 'zod';
import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { extractFirstJSON } from '../utils/extractFirstJson';
import { Connection } from '@/lib/firestoreHelpers';
import { ConnectionAspects } from '../utils/utils';
import { ConnectionPreferences } from '@/components/ui/ConnectionPreferencesSelector';

// -------------------------
// Prompt building
// -------------------------

const SHARED_SYSTEM_PROMPT = `You are a strict JSON generator.
Return ONLY valid JSON that matches the schema in the user message.
Do not invent facts. If missing/unknown, use null, empty arrays, or "unknown".
No extra keys. No extra text.`;

// -------------------------
// Logging (opt-in)
// -------------------------

// Always-on structured logs for debugging.
// NOTE: We keep raw previews opt-in to avoid leaking resume/page text into logs.
const DEBUG_GRAPH = true;
const DEBUG_GRAPH_SHOW_RAW_PREVIEW =
  process.env.DEBUG_CONNECTION_GRAPH_SHOW_RAW_PREVIEW === '1';

function logDebug(message: string, data?: Record<string, unknown>) {
  if (!DEBUG_GRAPH) return;
  if (data) console.log(`[connections:graph] ${message}`, data);
  else console.log(`[connections:graph] ${message}`);
}

function logWarn(message: string, data?: Record<string, unknown>) {
  if (data) console.warn(`[connections:graph] ${message}`, data);
  else console.warn(`[connections:graph] ${message}`);
}

function logError(
  message: string,
  err?: unknown,
  data?: Record<string, unknown>
) {
  const errorInfo =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { error: String(err) };
  if (data)
    console.error(`[connections:graph] ${message}`, { ...data, ...errorInfo });
  else console.error(`[connections:graph] ${message}`, errorInfo);
}

function safeLen(s: string | null | undefined) {
  return typeof s === 'string' ? s.length : 0;
}

function safePreview(s: string, n = 180) {
  // Avoid dumping user resume or full page text into logs.
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function buildStep1Prompt(backgroundInfo: string) {
  return `Step 1 — Anchor extractor (from resume/background)

Purpose: pull only explicit match anchors.

Extract ONLY explicitly stated entities from the background text.
No inference, no guessing, no normalization beyond trimming whitespace.
Return JSON ONLY matching this schema:

{
  "companies": ["string"],
  "institutions": ["string"],
  "organizations": ["string"],
  "projects": ["string"],
  "locations": ["string"],
  "keywords": ["string"]
}

Background text:
${backgroundInfo}`;
}

function buildStep2Prompt(goalTitle: string, educationLevel: string) {
  return `Step 2 — Goal decomposer

Purpose: turn goal into target roles + what help they need.

Given the candidate's goal and education level, output target roles, target companies, and the specific help they need.
Return JSON ONLY:

{
  "field": "tech|finance|law|medicine|unknown",
  "target_companies": ["string"],
  "target_roles": ["string"],
  "help_needed": ["string"],
  "seniority_targets": {
    "near_peer": "string",
    "senior": "string"
  }
}

Inputs:
{
  "goalTitle": "${goalTitle}",
  "education_level": "${educationLevel}"
}`;
}

function buildStep3Prompt(anchorsJson: unknown, goalJson: unknown) {
  return `Step 3 — Search query planner (people + programs)

Purpose: generate queries that are forced to include exact anchors.

Create search queries to find (1) people and (2) programs.
Queries MUST include at least one anchor from companies/institutions/organizations/projects.
Return JSON ONLY:

{
  "person_queries": ["string"],
  "program_queries": ["string"],
  "required_anchor_terms": ["string"],
  "exclude_terms": ["string"],
  "notes": ["string"]
}

Inputs:
{
  "anchors": ${JSON.stringify(anchorsJson)},
  "goal": ${JSON.stringify(goalJson)}
}`;
}

function buildStep4Prompt(url: string, pageText: string) {
  return `Step 4 — Candidate parser (from retrieved page text)

Purpose: take a page snippet (LinkedIn/alumni page/program page) and extract structured candidate info + evidence text.

Extract structured info from the provided page text. Do not guess.
Include evidence snippets copied from the page text (short fragments).
Return JSON ONLY, matching ONE of these schemas:

Person schema:
{
  "type": "person",
  "name": "string|null",
  "current_role": "string|null",
  "company": "string|null",
  "education": ["string"],
  "past_companies": ["string"],
  "organizations": ["string"],
  "projects": ["string"],
  "verified_profile_url": "string",
  "evidence_snippets": ["string"]
}

Program schema:
{
  "type": "program",
  "name": "string|null",
  "organization": "string|null",
  "program_type": "string|null",
  "website_url": "string",
  "eligibility": ["string"],
  "evidence_snippets": ["string"]
}

Inputs:
{
  "url": "${url}",
  "page_text": ${JSON.stringify(pageText)}
}`;
}

function buildStep6Prompt(goalJson: unknown, candidateJson: unknown) {
  return `Step 6 — Goal alignment writer (no new facts)

Purpose: explain how they help with the goal, using only known info.

Write goal alignment based ONLY on the provided goal + candidate fields.
Do not invent access, referrals, or hiring authority unless the candidate role strongly implies it (e.g., "Engineering Manager").
Return JSON ONLY:

{
  "goal_alignment": "string",
  "alignment_tags": ["string"],
  "confidence": 0.0-1.0
}

Inputs:
{
  "goal": ${JSON.stringify(goalJson)},
  "candidate": ${JSON.stringify(candidateJson)}
}`;
}

function buildStep7Prompt(
  candidateJson: unknown,
  goalJson: unknown,
  educationLevel: string
) {
  return `Step 7 — Accessibility filter (reachability)

Purpose: avoid celebrities / unrealistic execs; keep reachable people.

Rate whether this person/program is realistically reachable.
Prefer mid-level and near-peer people; avoid extremely senior executives/public figures.
Return JSON ONLY:

{
  "keep": true|false,
  "accessibility_score": 0.0-1.0,
  "reasons": ["string"]
}

Inputs:
{
  "candidate": ${JSON.stringify(candidateJson)},
  "goal": ${JSON.stringify(goalJson)},
  "education_level": "${educationLevel}"
}`;
}

function buildStep8Prompt(candidatesArrayJson: unknown, goalJson: unknown) {
  return `Step 8 — Role balance selector (near-peer + senior)

Purpose: ensure you have at least one near-peer + one senior/manager.

Select a final list that includes:
- at least one near-peer (one step ahead educationally/career-wise)
- at least one senior/managerial person

Return JSON ONLY:

{
  "selected": [/* candidate objects from Inputs.candidates */],
  "coverage": {
    "has_near_peer": true|false,
    "has_senior": true|false
  },
  "missing": ["near_peer", "senior"],
  "selection_rationale": ["string"]
}

Inputs:
{
  "candidates": ${JSON.stringify(candidatesArrayJson)},
  "goal": ${JSON.stringify(goalJson)}
}`;
}

// -------------------------
// Schemas
// -------------------------

const Step1Schema = z.object({
  companies: z.array(z.string()),
  institutions: z.array(z.string()),
  organizations: z.array(z.string()),
  projects: z.array(z.string()),
  locations: z.array(z.string()),
  keywords: z.array(z.string()),
});

const Step2Schema = z.object({
  field: z.enum(['tech', 'finance', 'law', 'medicine', 'unknown']),
  target_companies: z.array(z.string()),
  target_roles: z.array(z.string()),
  help_needed: z.array(z.string()),
  seniority_targets: z.object({
    near_peer: z.string(),
    senior: z.string(),
  }),
});

const Step3Schema = z.object({
  person_queries: z.array(z.string()),
  program_queries: z.array(z.string()),
  required_anchor_terms: z.array(z.string()),
  exclude_terms: z.array(z.string()),
  notes: z.array(z.string()),
});

const PersonCandidateSchema = z.object({
  type: z.literal('person'),
  name: z.string().nullable(),
  current_role: z.string().nullable(),
  company: z.string().nullable(),
  education: z.array(z.string()),
  past_companies: z.array(z.string()),
  organizations: z.array(z.string()),
  projects: z.array(z.string()),
  verified_profile_url: z.string(),
  evidence_snippets: z.array(z.string()),
});

const ProgramCandidateSchema = z.object({
  type: z.literal('program'),
  name: z.string().nullable(),
  organization: z.string().nullable(),
  program_type: z.string().nullable(),
  website_url: z.string(),
  eligibility: z.array(z.string()),
  evidence_snippets: z.array(z.string()),
});

const CandidateSchema = z.union([
  PersonCandidateSchema,
  ProgramCandidateSchema,
]);
type Candidate = z.infer<typeof CandidateSchema>;

const Step6Schema = z.object({
  goal_alignment: z.string(),
  alignment_tags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const Step7Schema = z.object({
  keep: z.boolean(),
  accessibility_score: z.number().min(0).max(1),
  reasons: z.array(z.string()),
});

const Step8Schema = z.object({
  selected: z.array(CandidateSchema),
  coverage: z.object({
    has_near_peer: z.boolean(),
    has_senior: z.boolean(),
  }),
  missing: z.array(z.enum(['near_peer', 'senior'])),
  selection_rationale: z.array(z.string()),
});

// -------------------------
// Utilities
// -------------------------

function coerceEducationLevel(raw: string | null | undefined): string {
  if (!raw) return 'unknown';
  return raw;
}

function coerceEducationLevelForOutput(
  raw: string | null | undefined
): Connection['education_level'] {
  // NOTE: app-level schema only allows these three. We avoid inventing; if unknown, default null.
  if (!raw) return null;
  if (raw === 'undergraduate') return 'undergraduate';
  if (raw === 'graduate') return 'graduate';
  if (raw === 'postgraduate') return 'postgraduate';
  if (raw === 'high_school') return 'undergraduate';
  return null;
}

function unwrapConnectionAspects(input: unknown): ConnectionAspects | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;

  // Common shape: { education: ..., work_experience: ... }
  if ('education' in obj && 'work_experience' in obj)
    return obj as unknown as ConnectionAspects;

  // Wrapped shape: { connection_aspects: { education: ..., work_experience: ... } }
  const nested = obj.connection_aspects;
  if (nested && typeof nested === 'object') {
    const nestedObj = nested as Record<string, unknown>;
    if ('education' in nestedObj && 'work_experience' in nestedObj)
      return nestedObj as unknown as ConnectionAspects;
  }
  return null;
}

function uniqStrings(xs: string[]) {
  return Array.from(new Set(xs.map((s) => s.trim()).filter(Boolean)));
}

function normalizeForExactMatch(s: string) {
  return s.trim().toLowerCase();
}

function computeDirectMatches(
  anchors: z.infer<typeof Step1Schema>,
  candidate: Candidate
) {
  const matches: {
    direct_matches: string[];
    match_category: Array<
      'company' | 'institution' | 'organization' | 'project'
    >;
  } = { direct_matches: [], match_category: [] };

  const anchorCompanies = new Map(
    anchors.companies.map((s) => [normalizeForExactMatch(s), s])
  );
  const anchorInstitutions = new Map(
    anchors.institutions.map((s) => [normalizeForExactMatch(s), s])
  );
  const anchorOrgs = new Map(
    anchors.organizations.map((s) => [normalizeForExactMatch(s), s])
  );
  const anchorProjects = new Map(
    anchors.projects.map((s) => [normalizeForExactMatch(s), s])
  );

  const add = (
    cat: 'company' | 'institution' | 'organization' | 'project',
    raw: string
  ) => {
    if (!matches.direct_matches.includes(raw)) matches.direct_matches.push(raw);
    if (!matches.match_category.includes(cat)) matches.match_category.push(cat);
  };

  if (candidate.type === 'person') {
    const candidateCompanies = uniqStrings([
      ...(candidate.company ? [candidate.company] : []),
      ...candidate.past_companies,
    ]);
    for (const c of candidateCompanies) {
      const hit = anchorCompanies.get(normalizeForExactMatch(c));
      if (hit) add('company', hit);
    }
    for (const edu of candidate.education) {
      const hit = anchorInstitutions.get(normalizeForExactMatch(edu));
      if (hit) add('institution', hit);
    }
    for (const org of candidate.organizations) {
      const hit = anchorOrgs.get(normalizeForExactMatch(org));
      if (hit) add('organization', hit);
    }
    for (const p of candidate.projects) {
      const hit = anchorProjects.get(normalizeForExactMatch(p));
      if (hit) add('project', hit);
    }
  } else {
    // Program: only compare name/org/type? Direct match rules: company/institution/org/project.
    if (candidate.organization) {
      const hit = anchorOrgs.get(
        normalizeForExactMatch(candidate.organization)
      );
      if (hit) add('organization', hit);
      const hitCompany = anchorCompanies.get(
        normalizeForExactMatch(candidate.organization)
      );
      if (hitCompany) add('company', hitCompany);
      const hitInst = anchorInstitutions.get(
        normalizeForExactMatch(candidate.organization)
      );
      if (hitInst) add('institution', hitInst);
    }
    if (candidate.name) {
      const hitProject = anchorProjects.get(
        normalizeForExactMatch(candidate.name)
      );
      if (hitProject) add('project', hitProject);
      const hitOrg = anchorOrgs.get(normalizeForExactMatch(candidate.name));
      if (hitOrg) add('organization', hitOrg);
      const hitCompany = anchorCompanies.get(
        normalizeForExactMatch(candidate.name)
      );
      if (hitCompany) add('company', hitCompany);
      const hitInst = anchorInstitutions.get(
        normalizeForExactMatch(candidate.name)
      );
      if (hitInst) add('institution', hitInst);
    }
  }

  return matches;
}

function safeParseJson<T>(raw: string, schema: z.ZodSchema<T>): T {
  const extracted = extractFirstJSON(raw) ?? raw;
  const parsed = JSON.parse(extracted);
  return schema.parse(parsed);
}

// -------------------------
// Retrieval
// -------------------------

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

async function webSearch(
  query: string,
  maxResults = 10
): Promise<SearchResult[]> {
  const key = process.env.NEXT_PUBLIC_AVES_API_KEY;
  if (!key) {
    logWarn('Missing NEXT_PUBLIC_AVES_API_KEY; webSearch returns empty', {
      query,
    });
    return [];
  }

  const url = `https://api.avesapi.com/search?apikey=${encodeURIComponent(
    key
  )}&type=web&query=${encodeURIComponent(
    query
  )}&google_domain=google.com&gl=us&hl=en&device=desktop&output=json&num=${maxResults}`;

  let resp: Response;
  try {
    resp = await fetch(url);
  } catch (err) {
    logError('webSearch fetch failed', err, { query });
    return [];
  }
  if (!resp.ok) {
    logWarn('webSearch non-OK response', { query, status: resp.status });
    return [];
  }

  let data: unknown;
  try {
    data = (await resp.json()) as unknown;
  } catch (err) {
    logError('webSearch JSON parse failed', err, { query });
    return [];
  }
  const obj =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  const itemsCandidate =
    obj.organic_results ??
    obj.organic ??
    obj.results ??
    obj.items ??
    (obj.data && typeof obj.data === 'object'
      ? (obj.data as Record<string, unknown>).results
      : undefined);

  const items = Array.isArray(itemsCandidate) ? itemsCandidate : [];

  const out: SearchResult[] = [];
  for (const it of items) {
    const rec =
      it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
    const link = rec.link ?? rec.url ?? rec.href;
    if (!link || typeof link !== 'string' || !link.startsWith('http')) continue;
    out.push({
      title: String(rec.title ?? ''),
      url: link,
      snippet: String(rec.snippet ?? rec.description ?? rec.content ?? ''),
    });
  }
  logDebug('webSearch results', { query, count: out.length });
  return out.slice(0, maxResults);
}

async function fetchPageText(url: string, maxChars = 8000): Promise<string> {
  // Best-effort; many sites (e.g. LinkedIn) will block.
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!resp.ok) {
      logDebug('fetchPageText non-OK', { url, status: resp.status });
      return '';
    }
    const html = await resp.text();
    // quick & cheap tag strip
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, maxChars);
  } catch {
    logDebug('fetchPageText failed (likely blocked)', { url });
    return '';
  }
}

// -------------------------
// Graph state
// -------------------------

type CandidateRecord = {
  candidate: Candidate;
  directMatches: {
    direct_matches: string[];
    match_category: Array<
      'company' | 'institution' | 'organization' | 'project'
    >;
  };
  alignment: z.infer<typeof Step6Schema> | null;
  accessibility: z.infer<typeof Step7Schema> | null;
  sourceUrl: string;
  searchQuery: string;
};

const GraphStateSchema = z.object({
  // inputs
  goalTitle: z.string(),
  educationLevel: z.string(),
  backgroundInfo: z.string(),
  preferences: z.object({
    connections: z.boolean(),
    programs: z.boolean(),
  }),

  // derived
  anchors: Step1Schema.nullable(),
  goal: Step2Schema.nullable(),
  queries: Step3Schema.nullable(),

  // loop control
  iteration: z.number(),
  maxIterations: z.number(),
  maxQueriesPerIteration: z.number(),
  maxUrlsPerQuery: z.number(),

  // pools
  candidates: z.array(z.any()), // CandidateRecord[] (kept untyped in Zod for simplicity)
  selectedCandidates: z.array(CandidateSchema),
});

type GraphState = z.infer<typeof GraphStateSchema>;

// -------------------------
// Main build function
// -------------------------

export type LangGraphFinderParams = {
  goalTitle: string;
  rawResumeText: string;
  connectionAspects: unknown;
  preferences?: ConnectionPreferences;
  maxIterations?: number;
  maxQueriesPerIteration?: number;
  maxUrlsPerQuery?: number;
};

export async function findConnectionsWithLangGraph(
  params: LangGraphFinderParams
): Promise<Connection[]> {
  const aspects = unwrapConnectionAspects(params.connectionAspects);
  const educationLevel = coerceEducationLevel(
    aspects?.education?.current_level
  );

  logDebug('LangGraph start', {
    goalTitle: params.goalTitle,
    educationLevel,
    preferences: params.preferences ?? { connections: true, programs: true },
    rawResumeTextLen: safeLen(params.rawResumeText),
    maxIterations: params.maxIterations ?? 2,
    maxQueriesPerIteration: params.maxQueriesPerIteration ?? 6,
    maxUrlsPerQuery: params.maxUrlsPerQuery ?? 6,
  });

  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    temperature: 0,
  });

  const anchorNode = async (state: GraphState) => {
    try {
      logDebug('Step1 anchorNode input', {
        backgroundInfoLen: safeLen(state.backgroundInfo),
      });
      const prompt = buildStep1Prompt(state.backgroundInfo);
      const resp = await model.invoke([
        new SystemMessage(SHARED_SYSTEM_PROMPT),
        new HumanMessage(prompt),
      ]);
      const raw = String(resp.content ?? '');
      const parsed = safeParseJson(raw, Step1Schema);
      logDebug('Step1 anchors parsed', {
        companies: parsed.companies.length,
        institutions: parsed.institutions.length,
        organizations: parsed.organizations.length,
        projects: parsed.projects.length,
        locations: parsed.locations.length,
        keywords: parsed.keywords.length,
        rawPreview: DEBUG_GRAPH_SHOW_RAW_PREVIEW ? safePreview(raw) : undefined,
      });
      return { anchors: parsed };
    } catch (err) {
      logError('Step1 anchorNode failed', err);
      throw err;
    }
  };

  const goalNode = async (state: GraphState) => {
    try {
      logDebug('Step2 goalNode input', {
        goalTitle: state.goalTitle,
        educationLevel: state.educationLevel,
      });
      const prompt = buildStep2Prompt(state.goalTitle, state.educationLevel);
      const resp = await model.invoke([
        new SystemMessage(SHARED_SYSTEM_PROMPT),
        new HumanMessage(prompt),
      ]);
      const raw = String(resp.content ?? '');
      const parsed = safeParseJson(raw, Step2Schema);
      logDebug('Step2 goal parsed', {
        field: parsed.field,
        target_companies: parsed.target_companies.length,
        target_roles: parsed.target_roles.length,
        help_needed: parsed.help_needed.length,
        rawPreview: DEBUG_GRAPH_SHOW_RAW_PREVIEW ? safePreview(raw) : undefined,
      });
      return { goal: parsed };
    } catch (err) {
      logError('Step2 goalNode failed', err);
      throw err;
    }
  };

  const planQueriesNode = async (state: GraphState) => {
    try {
      logDebug('Step3 planQueries input', {
        haveAnchors: !!state.anchors,
        haveGoal: !!state.goal,
        iteration: state.iteration,
      });
      const prompt = buildStep3Prompt(state.anchors, state.goal);
      const resp = await model.invoke([
        new SystemMessage(SHARED_SYSTEM_PROMPT),
        new HumanMessage(prompt),
      ]);
      const raw = String(resp.content ?? '');
      const parsed = safeParseJson(raw, Step3Schema);

      // Respect UI preferences: optionally drop one query type.
      const person_queries = state.preferences.connections
        ? parsed.person_queries
        : [];
      const program_queries = state.preferences.programs
        ? parsed.program_queries
        : [];
      logDebug('Step3 queries parsed', {
        person_queries: person_queries.length,
        program_queries: program_queries.length,
        required_anchor_terms: parsed.required_anchor_terms.length,
        exclude_terms: parsed.exclude_terms.length,
        rawPreview: DEBUG_GRAPH_SHOW_RAW_PREVIEW ? safePreview(raw) : undefined,
      });
      return {
        queries: { ...parsed, person_queries, program_queries },
        iteration: state.iteration + 1,
      };
    } catch (err) {
      logError('Step3 planQueriesNode failed', err);
      throw err;
    }
  };

  const retrieveAndFilterNode = async (state: GraphState) => {
    if (!state.anchors || !state.goal || !state.queries) return {};

    const existingByUrl = new Set<string>(
      (state.candidates as CandidateRecord[]).map((c) =>
        c.candidate.type === 'person'
          ? c.candidate.verified_profile_url
          : c.candidate.website_url
      )
    );

    const newRecords: CandidateRecord[] = [];
    const queries = [
      ...state.queries.person_queries.slice(0, state.maxQueriesPerIteration),
      ...state.queries.program_queries.slice(0, state.maxQueriesPerIteration),
    ];

    logDebug('Retrieve loop start', {
      iteration: state.iteration,
      queries: queries.length,
      existingCandidates: (state.candidates as CandidateRecord[]).length,
      maxUrlsPerQuery: state.maxUrlsPerQuery,
    });

    for (const q of queries) {
      logDebug('Retrieve query', { q });
      const results = await webSearch(q, state.maxUrlsPerQuery);
      logDebug('Retrieve query results', { q, results: results.length });
      for (const r of results.slice(0, state.maxUrlsPerQuery)) {
        if (existingByUrl.has(r.url)) continue;

        const fetched = await fetchPageText(r.url);
        const pageText = [r.title, r.snippet, fetched]
          .filter(Boolean)
          .join('\n')
          .slice(0, 12000);

        // Step 4 parse candidate
        const step4Prompt = buildStep4Prompt(r.url, pageText);
        let candidate: Candidate;
        try {
          const step4Resp = await model.invoke([
            new SystemMessage(SHARED_SYSTEM_PROMPT),
            new HumanMessage(step4Prompt),
          ]);
          const raw = String(step4Resp.content ?? '');
          candidate = safeParseJson(raw, CandidateSchema);
          logDebug('Step4 candidate parsed', {
            url: r.url,
            type: candidate.type,
            name: candidate.name ?? null,
            rawPreview: DEBUG_GRAPH_SHOW_RAW_PREVIEW
              ? safePreview(raw)
              : undefined,
          });
        } catch (err) {
          logWarn('Step4 candidate parse failed; skipping URL', {
            url: r.url,
            q,
          });
          logError('Step4 parse error detail', err, { url: r.url });
          continue; // fail closed
        }

        // Ensure the "verified" URL field is present (we treat search URL as best-effort verified URL)
        if (candidate.type === 'person') {
          candidate = {
            ...candidate,
            verified_profile_url: candidate.verified_profile_url || r.url,
          };
        } else {
          candidate = {
            ...candidate,
            website_url: candidate.website_url || r.url,
          };
        }

        const directMatches = computeDirectMatches(state.anchors, candidate);
        const validDirectMatch = directMatches.direct_matches.length > 0;
        logDebug('Step5 direct-match gate', {
          url: r.url,
          q,
          validDirectMatch,
          direct_matches: directMatches.direct_matches,
          match_category: directMatches.match_category,
        });

        // Strict gate: only proceed to alignment/accessibility if direct match passes.
        if (!validDirectMatch) {
          newRecords.push({
            candidate,
            directMatches,
            alignment: null,
            accessibility: null,
            sourceUrl: r.url,
            searchQuery: q,
          });
          existingByUrl.add(r.url);
          continue;
        }

        // Step 6 alignment
        const step6Prompt = buildStep6Prompt(state.goal, candidate);
        let alignment: z.infer<typeof Step6Schema> | null = null;
        try {
          const step6Resp = await model.invoke([
            new SystemMessage(SHARED_SYSTEM_PROMPT),
            new HumanMessage(step6Prompt),
          ]);
          const raw = String(step6Resp.content ?? '');
          alignment = safeParseJson(raw, Step6Schema);
          logDebug('Step6 alignment parsed', {
            url: r.url,
            confidence: alignment.confidence,
            tags: alignment.alignment_tags.length,
            rawPreview: DEBUG_GRAPH_SHOW_RAW_PREVIEW
              ? safePreview(raw)
              : undefined,
          });
        } catch {
          logWarn(
            'Step6 alignment parse failed; continuing without alignment',
            {
              url: r.url,
            }
          );
          alignment = null;
        }

        // Step 7 accessibility
        const step7Prompt = buildStep7Prompt(
          candidate,
          state.goal,
          state.educationLevel
        );
        let accessibility: z.infer<typeof Step7Schema> | null = null;
        try {
          const step7Resp = await model.invoke([
            new SystemMessage(SHARED_SYSTEM_PROMPT),
            new HumanMessage(step7Prompt),
          ]);
          const raw = String(step7Resp.content ?? '');
          accessibility = safeParseJson(raw, Step7Schema);
          logDebug('Step7 accessibility parsed', {
            url: r.url,
            keep: accessibility.keep,
            score: accessibility.accessibility_score,
            reasons: accessibility.reasons.length,
            rawPreview: DEBUG_GRAPH_SHOW_RAW_PREVIEW
              ? safePreview(raw)
              : undefined,
          });
        } catch {
          logWarn('Step7 accessibility parse failed; default keep=false', {
            url: r.url,
          });
          accessibility = null;
        }

        logDebug('Candidate decision', {
          url: r.url,
          keep: accessibility?.keep ?? false,
          directMatch: true,
          type: candidate.type,
          name: candidate.name ?? null,
        });

        newRecords.push({
          candidate,
          directMatches,
          alignment,
          accessibility,
          sourceUrl: r.url,
          searchQuery: q,
        });
        existingByUrl.add(r.url);

        // Stop early if we already have enough kept direct matches.
        const keptDirect = [
          ...(state.candidates as CandidateRecord[]),
          ...newRecords,
        ].filter(
          (cr) =>
            cr.directMatches.direct_matches.length > 0 && cr.accessibility?.keep
        );
        logDebug('Kept direct-match count', { count: keptDirect.length });
        if (keptDirect.length >= 8) break;
      }
    }

    logDebug('Retrieve loop end', {
      totalCandidates:
        (state.candidates as CandidateRecord[]).length + newRecords.length,
      added: newRecords.length,
    });
    return {
      candidates: [...(state.candidates as CandidateRecord[]), ...newRecords],
    };
  };

  const balanceNode = async (state: GraphState) => {
    logDebug('Balance step start', {
      candidates: (state.candidates as CandidateRecord[]).length,
      preferences: state.preferences,
    });
    const keptDirect = (state.candidates as CandidateRecord[])
      .filter(
        (cr) =>
          cr.directMatches.direct_matches.length > 0 && cr.accessibility?.keep
      )
      .map((cr) => cr.candidate);

    logDebug('Balance keptDirect', { keptDirect: keptDirect.length });

    // If user only wants programs, skip near-peer/senior enforcement and just select up to 5 programs.
    if (state.preferences.programs && !state.preferences.connections) {
      return {
        selectedCandidates: keptDirect
          .filter((c) => c.type === 'program')
          .slice(0, 5),
      };
    }

    const step8Prompt = buildStep8Prompt(keptDirect, state.goal);
    const resp = await model.invoke([
      new SystemMessage(SHARED_SYSTEM_PROMPT),
      new HumanMessage(step8Prompt),
    ]);
    let parsed: z.infer<typeof Step8Schema>;
    try {
      const raw = String(resp.content ?? '');
      parsed = safeParseJson(raw, Step8Schema);
      logDebug('Step8 selection parsed', {
        selected: parsed.selected.length,
        has_near_peer: parsed.coverage.has_near_peer,
        has_senior: parsed.coverage.has_senior,
        missing: parsed.missing,
        rawPreview: DEBUG_GRAPH_SHOW_RAW_PREVIEW ? safePreview(raw) : undefined,
      });
    } catch {
      const raw = String(resp.content ?? '');
      logWarn(
        'Step8 selection parse failed; fallback to first 5 direct matches',
        {
          rawPreview: DEBUG_GRAPH_SHOW_RAW_PREVIEW
            ? safePreview(raw)
            : undefined,
        }
      );
      // fallback: just take first 5 direct matches
      return { selectedCandidates: keptDirect.slice(0, 5) };
    }

    return { selectedCandidates: parsed.selected.slice(0, 5) };
  };

  const shouldLoop = (state: GraphState) => {
    const keptDirect = (state.candidates as CandidateRecord[]).filter(
      (cr) =>
        cr.directMatches.direct_matches.length > 0 && cr.accessibility?.keep
    );
    const enough = keptDirect.length >= 5;
    logDebug('Loop decision', {
      iteration: state.iteration,
      keptDirect: keptDirect.length,
      enough,
      maxIterations: state.maxIterations,
    });
    if (enough) return 'balance';
    if (state.iteration >= state.maxIterations) return 'balance';
    return 'planQueries';
  };

  // LangGraph's TS overloads are strict; keep the runtime Zod schema and cast for compilation.
  const app = new StateGraph(GraphStateSchema as any)
    .addNode('anchor', anchorNode)
    .addNode('goalStep', goalNode)
    .addNode('planQueries', planQueriesNode)
    .addNode('retrieve', retrieveAndFilterNode)
    .addNode('balance', balanceNode)
    .addEdge(START, 'anchor')
    .addEdge('anchor', 'goalStep')
    .addEdge('goalStep', 'planQueries')
    .addEdge('planQueries', 'retrieve')
    .addConditionalEdges('retrieve', shouldLoop, ['planQueries', 'balance'])
    .addEdge('balance', END)
    .compile();

  let finalState: any;
  try {
    finalState = await app.invoke({
      goalTitle: params.goalTitle,
      educationLevel,
      backgroundInfo: params.rawResumeText,
      preferences: {
        connections: params.preferences?.connections ?? true,
        programs: params.preferences?.programs ?? true,
      },
      anchors: null,
      goal: null,
      queries: null,
      iteration: 0,
      maxIterations: params.maxIterations ?? 2,
      maxQueriesPerIteration: params.maxQueriesPerIteration ?? 6,
      maxUrlsPerQuery: params.maxUrlsPerQuery ?? 6,
      candidates: [],
      selectedCandidates: [],
    });
    logDebug('Graph invoke complete', {
      candidates: (finalState.candidates as any[])?.length ?? 0,
      selectedCandidates: (finalState.selectedCandidates as any[])?.length ?? 0,
    });
  } catch (err) {
    logError('Graph invoke failed', err, {
      goalTitle: params.goalTitle,
      educationLevel,
      rawResumeTextLen: safeLen(params.rawResumeText),
    });
    throw err;
  }

  const candidateRecords = finalState.candidates as CandidateRecord[];
  const selected = finalState.selectedCandidates as Candidate[];

  logDebug('Output assembly start', {
    selected: selected.length,
    candidateRecords: candidateRecords.length,
  });

  const selectedSet = new Set(
    selected.map((c) =>
      c.type === 'person' ? c.verified_profile_url : c.website_url
    )
  );

  const selectedRecords = candidateRecords.filter((cr) =>
    selectedSet.has(
      cr.candidate.type === 'person'
        ? cr.candidate.verified_profile_url
        : cr.candidate.website_url
    )
  );

  const outputEducationLevel = coerceEducationLevelForOutput(educationLevel);

  const connections: Connection[] = [];
  for (const rec of selectedRecords) {
    const c = rec.candidate;
    if (c.type === 'person') {
      if (!c.name || !c.current_role || !c.verified_profile_url) continue;
      connections.push({
        id: `temp-person-${c.name}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`.toLowerCase(),
        type: 'person',
        name: c.name,
        current_role: c.current_role,
        company: c.company ?? null,
        verified_profile_url: c.verified_profile_url,
        website_url: null,
        education_level: outputEducationLevel,
        direct_matches: rec.directMatches.direct_matches,
        goal_alignment: rec.alignment?.goal_alignment ?? null,
        shared_background_points: rec.directMatches.direct_matches,
        additional_factors: [
          ...(rec.alignment?.alignment_tags ?? []),
          ...(rec.accessibility?.reasons ?? []),
        ],
        source: rec.sourceUrl,
      });
    } else {
      if (!c.name || !c.website_url) continue;
      connections.push({
        id: `temp-program-${c.name}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`.toLowerCase(),
        type: 'program',
        name: c.name,
        organization: c.organization ?? null,
        program_type: c.program_type ?? null,
        website_url: c.website_url,
        verified_profile_url: null,
        how_this_helps: null,
        direct_matches: rec.directMatches.direct_matches,
        goal_alignment: rec.alignment?.goal_alignment ?? null,
        shared_background_points: rec.directMatches.direct_matches,
        additional_factors: [
          ...(rec.alignment?.alignment_tags ?? []),
          ...(rec.accessibility?.reasons ?? []),
        ],
        source: rec.sourceUrl,
      });
    }
    if (connections.length >= 5) break;
  }

  // Fallback: if too few direct-match connections, include reachable, aligned non-direct candidates.
  if (connections.length < 5) {
    logWarn('Applying fallback selection (insufficient direct matches)', {
      directMatchCount: connections.length,
    });
    const nonDirect = candidateRecords
      .filter(
        (cr) =>
          cr.directMatches.direct_matches.length === 0 && cr.accessibility?.keep
      )
      .sort((a, b) => {
        const sa =
          (a.alignment?.confidence ?? 0) * 0.5 +
          (a.accessibility?.accessibility_score ?? 0) * 0.5;
        const sb =
          (b.alignment?.confidence ?? 0) * 0.5 +
          (b.accessibility?.accessibility_score ?? 0) * 0.5;
        return sb - sa;
      });
    for (const rec of nonDirect) {
      if (connections.length >= 5) break;
      const c = rec.candidate;
      if (c.type === 'person') {
        if (!c.name || !c.current_role || !c.verified_profile_url) continue;
        connections.push({
          id: `temp-person-${c.name}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`.toLowerCase(),
          type: 'person',
          name: c.name,
          current_role: c.current_role,
          company: c.company ?? null,
          verified_profile_url: c.verified_profile_url,
          website_url: null,
          education_level: outputEducationLevel,
          direct_matches: [],
          goal_alignment: rec.alignment?.goal_alignment ?? null,
          shared_background_points: [],
          additional_factors: [
            'fallback: no direct match found',
            ...(rec.alignment?.alignment_tags ?? []),
            ...(rec.accessibility?.reasons ?? []),
          ],
          source: rec.sourceUrl,
        });
      } else {
        if (!c.name || !c.website_url) continue;
        connections.push({
          id: `temp-program-${c.name}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`.toLowerCase(),
          type: 'program',
          name: c.name,
          organization: c.organization ?? null,
          program_type: c.program_type ?? null,
          website_url: c.website_url,
          verified_profile_url: null,
          how_this_helps: null,
          direct_matches: [],
          goal_alignment: rec.alignment?.goal_alignment ?? null,
          shared_background_points: [],
          additional_factors: [
            'fallback: no direct match found',
            ...(rec.alignment?.alignment_tags ?? []),
            ...(rec.accessibility?.reasons ?? []),
          ],
          source: rec.sourceUrl,
        });
      }
    }
  }

  logDebug('LangGraph end', { returned: connections.slice(0, 5).length });
  return connections.slice(0, 5);
}
