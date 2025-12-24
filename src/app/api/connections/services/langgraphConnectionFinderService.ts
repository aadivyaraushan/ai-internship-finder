import { z } from 'zod';
import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { extractFirstJSON } from '../utils/extractFirstJson';
import { Connection } from '@/lib/firestoreHelpers';
import { ConnectionAspects } from '../utils/utils';
import { ConnectionPreferences } from '@/components/ui/ConnectionPreferencesSelector';
import { tavilySearch as tavilySearchLib } from '@/lib/tavilySearch';

// -------------------------
// Prompt building
// -------------------------

const SHARED_SYSTEM_PROMPT = `You are a strict JSON generator.
Return ONLY valid JSON that matches the schema in the user message.
Do not invent facts. If missing/unknown, use null, empty arrays, or "unknown".
No extra keys. No extra text.`;

const ConnectionWriteupSchema = z.object({
  connection_reason: z
    .string()
    .describe(
      'A short 2nd-person explanation of why this connection/program is a good fit for the user.'
    ),
  outreach_message: z
    .string()
    .nullable()
    .describe(
      'A natural outreach message the user can send to the person. Null for programs.'
    ),
});

function buildWriteupPrompt(input: {
  goalTitle: string;
  educationLevel: string;
  connection: Pick<
    Connection,
    | 'type'
    | 'name'
    | 'current_role'
    | 'company'
    | 'verified_profile_url'
    | 'website_url'
    | 'organization'
    | 'program_type'
    | 'direct_matches'
    | 'goal_alignment'
    | 'additional_factors'
  >;
}) {
  return `You are generating user-facing copy for a networking app.

Return JSON ONLY matching this schema:
{
  "connection_reason": "string",
  "outreach_message": "string|null"
}

Rules for connection_reason:
- Write in 2nd person ("you") and keep it to 1-2 sentences.
- Use only the provided fields; do not invent facts.
- Mention the strongest shared anchor(s) and how it helps with the user's goal.

Rules for outreach_message:
- If type is "program": set outreach_message to null.
- If type is "person": write a natural, concise message the user can send (4-7 sentences).
- Avoid inventing referrals/hiring authority. Avoid overclaiming closeness.
- Reference the shared anchor(s) and a specific ask (15 min chat / quick advice).

Inputs:
${JSON.stringify(input)}`;
}

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

function cleanAnchorList(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const s = (raw ?? '').trim();
    if (!s) continue;
    // Filter obvious non-anchors / recognizer artifacts
    if (/^[-–—]\s*/.test(s)) continue;
    if (/\b(recognized|recognised|recognition)\b/i.test(s)) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

function cleanAnchors(
  a: z.infer<typeof Step1Schema>
): z.infer<typeof Step1Schema> {
  return {
    companies: cleanAnchorList(a.companies),
    institutions: cleanAnchorList(a.institutions),
    organizations: cleanAnchorList(a.organizations),
    projects: cleanAnchorList(a.projects),
    locations: cleanAnchorList(a.locations),
    keywords: cleanAnchorList(a.keywords),
  };
}

function buildStep1Prompt(backgroundInfo: string) {
  return `Step 1 — Anchor extractor (from resume/background)

Purpose: pull only explicit match anchors.

Extract ONLY explicitly stated entities from the background text.
No inference, no guessing, no normalization beyond trimming whitespace.

Institutional-connection rules (be critical):
- For "institutions": ONLY schools/universities/colleges or formal academic institutions the candidate attended/was affiliated with.
- For "organizations": ONLY organizations/clubs/groups where the candidate had explicit membership/role/participation.
- EXCLUDE entities that merely recognized/awarded/certified the candidate (e.g., "recognized by X", award issuers, certification authorities) unless the text explicitly says the candidate was a member/employee/volunteer there.
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
Queries MUST include at least one anchor from companies/institutions/organizations.

IMPORTANT CONSTRAINT (avoid weak/side-project anchors):
- Do NOT build queries around small personal side projects or solo projects from the resume.
- Treat "projects" as low-signal and generally unusable for discovery (they often have no employee/alumni pages and create junk results).
- Only use a project as an anchor if it is clearly an established organization/product with a real team and public footprint; otherwise ignore it.

LOOP BROADENING BEHAVIOR:
- If previous attempts found too few candidates, broaden incrementally:
  - broaden_level=0: strict anchors (company/institution/organization) + goal role keywords
  - broaden_level=1: still anchored, but allow broader role keywords and include user location if available
  - broaden_level=2: still anchored, but allow industry-wide queries and "alumni" style queries; increase diversity of query templates
- Even when broadening, keep at least one strong anchor term in each query.

What to prioritize for strong, non-obvious discovery:
- Prefer anchors from established companies, educational institutions, and well-known organizations/clubs.
- Prefer alumni queries and "ex-[anchor]" style queries that surface people who have moved on (not someone obviously already known from a tiny project).
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
  "goal": ${JSON.stringify(goalJson)},
  "broaden_level": {{broaden_level}}
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

function buildHighSignalBackgroundInfo(
  aspects: ConnectionAspects | null,
  rawResumeText: string
) {
  if (!aspects) return rawResumeText;
  const institutions = uniqStrings(aspects.education?.institutions ?? []);
  const companies = uniqStrings(aspects.work_experience?.companies ?? []);
  const clubs = uniqStrings(aspects.activities?.clubs ?? []);
  const orgs = uniqStrings(aspects.activities?.organizations ?? []);
  const volunteer = uniqStrings(aspects.activities?.volunteer_work ?? []);

  // Intentionally exclude achievements/certification issuers to avoid false “institutional connection” anchors.
  // Keep it compact and explicit.
  const parts = [
    institutions.length ? `Institutions: ${institutions.join(', ')}` : '',
    companies.length ? `Companies: ${companies.join(', ')}` : '',
    clubs.length ? `Clubs: ${clubs.join(', ')}` : '',
    orgs.length ? `Organizations: ${orgs.join(', ')}` : '',
    volunteer.length ? `Volunteer: ${volunteer.join(', ')}` : '',
  ].filter(Boolean);

  // Fallback: if aspects are empty, use raw text.
  if (parts.length === 0) return rawResumeText;
  return parts.join('\n');
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
  if (!process.env.TAVILY_API_KEY) {
    logWarn('Missing TAVILY_API_KEY; webSearch returns empty', {
      query,
    });
    return [];
  }
  const out = await tavilySearchLib(query, maxResults);
  logDebug('webSearch results', { query, count: out.length });
  return out;
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

function recordScore(rec: CandidateRecord): number {
  // Deterministic ranking for selection/fallback.
  // Prefer direct matches, then blend alignment confidence and accessibility score.
  const directBoost = rec.directMatches.direct_matches.length > 0 ? 1.0 : 0.0;
  const alignment = rec.alignment?.confidence ?? 0;
  const access = rec.accessibility?.accessibility_score ?? 0;
  return directBoost * 2.0 + alignment * 1.0 + access * 0.5;
}

function bestOfType(
  records: CandidateRecord[],
  type: Candidate['type']
): CandidateRecord | null {
  const filtered = records.filter((r) => r.candidate.type === type);
  if (filtered.length === 0) return null;
  filtered.sort((a, b) => recordScore(b) - recordScore(a));
  return filtered[0];
}

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
  broadenLevel: z.number(),
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
  const backgroundInfo = buildHighSignalBackgroundInfo(
    aspects,
    params.rawResumeText
  );

  logDebug('LangGraph start', {
    goalTitle: params.goalTitle,
    educationLevel,
    preferences: params.preferences ?? { connections: true, programs: true },
    rawResumeTextLen: safeLen(params.rawResumeText),
    backgroundInfoLen: safeLen(backgroundInfo),
    maxIterations: params.maxIterations ?? 2,
    maxQueriesPerIteration: params.maxQueriesPerIteration ?? 6,
    maxUrlsPerQuery: params.maxUrlsPerQuery ?? 6,
    hasSearchKey: !!process.env.TAVILY_API_KEY,
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
      const parsedRaw = safeParseJson(raw, Step1Schema);
      const parsed = cleanAnchors(parsedRaw);
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
        broadenLevel: state.broadenLevel,
      });
      // Enforce: do not use "projects" as anchors for query planning (side projects are low-signal / often nonexistent online).
      // We still keep projects in the main `anchors` for direct-match validation later.
      const anchorsForQueryPlanning = state.anchors
        ? { ...state.anchors, projects: [] as string[] }
        : state.anchors;

      // Inject broaden level into the prompt template without polluting the state schema.
      const prompt = buildStep3Prompt(
        anchorsForQueryPlanning,
        state.goal
      ).replace('{{broaden_level}}', JSON.stringify(state.broadenLevel));
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

      logDebug('Step3 queries preview', {
        person_queries_preview: person_queries.slice(0, 3),
        program_queries_preview: program_queries.slice(0, 3),
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

    if (queries.length === 0) {
      logWarn(
        'Retrieve skipped: no queries generated (check Step3 + preferences)'
      );
      return { candidates: state.candidates };
    }

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
        // BUT: after broadening starts (broadenLevel >= 1), we also evaluate non-direct candidates
        // so the system can still return useful results even if direct matches are scarce.
        if (!validDirectMatch) {
          if (state.broadenLevel < 1) {
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
          directMatch: validDirectMatch,
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

        // Stop early if we already have enough kept candidates.
        // Prefer direct matches, but allow non-direct (broadening mode) to fill.
        const keptDirect = [
          ...(state.candidates as CandidateRecord[]),
          ...newRecords,
        ].filter(
          (cr) =>
            cr.directMatches.direct_matches.length > 0 && cr.accessibility?.keep
        );
        logDebug('Kept direct-match count', { count: keptDirect.length });
        const keptAny = [
          ...(state.candidates as CandidateRecord[]),
          ...newRecords,
        ].filter((cr) => cr.accessibility?.keep);
        if (keptDirect.length >= 8 || keptAny.length >= 12) break;
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
    const keptRecords = (state.candidates as CandidateRecord[]).filter(
      (cr) => cr.accessibility?.keep
    );

    const requirePerson = state.preferences.connections;
    const requireProgram = state.preferences.programs;

    const allowed = keptRecords.filter((r) => {
      if (r.candidate.type === 'person') return requirePerson;
      if (r.candidate.type === 'program') return requireProgram;
      return false;
    });

    logDebug('Balance keptAny', {
      keptAny: keptRecords.length,
      allowed: allowed.length,
      peopleAllowed: requirePerson,
      programsAllowed: requireProgram,
      havePeople: allowed.some((r) => r.candidate.type === 'person'),
      havePrograms: allowed.some((r) => r.candidate.type === 'program'),
    });

    // Enforce: if a type is selected, we MUST output at least one item of that type.
    const bestPerson = requirePerson ? bestOfType(allowed, 'person') : null;
    const bestProgram = requireProgram ? bestOfType(allowed, 'program') : null;

    if (requirePerson && !bestPerson) {
      throw new Error(
        'No reachable person candidates found (people is selected). Try again, broaden search, or adjust anchors.'
      );
    }
    if (requireProgram && !bestProgram) {
      throw new Error(
        'No reachable program candidates found (programs is selected). Try again, broaden search, or adjust anchors.'
      );
    }

    const selected: CandidateRecord[] = [];
    const used = new Set<string>();
    const keyFor = (r: CandidateRecord) =>
      r.candidate.type === 'person'
        ? r.candidate.verified_profile_url
        : r.candidate.website_url;

    const push = (r: CandidateRecord | null) => {
      if (!r) return;
      const k = keyFor(r);
      if (used.has(k)) return;
      used.add(k);
      selected.push(r);
    };

    // Seed required types first.
    push(bestPerson);
    push(bestProgram);

    // Fill remaining slots by score.
    const remaining = allowed
      .filter((r) => !used.has(keyFor(r)))
      .sort((a, b) => recordScore(b) - recordScore(a));
    for (const r of remaining) {
      if (selected.length >= 5) break;
      push(r);
    }

    return { selectedCandidates: selected.map((r) => r.candidate) };
  };

  const shouldLoop = (state: GraphState) => {
    const keptDirect = (state.candidates as CandidateRecord[]).filter(
      (cr) =>
        cr.directMatches.direct_matches.length > 0 && cr.accessibility?.keep
    );
    const keptAny = (state.candidates as CandidateRecord[]).filter(
      (cr) => cr.accessibility?.keep
    );
    const enough = keptDirect.length >= 5;
    const havePerson = keptAny.some((r) => r.candidate.type === 'person');
    const haveProgram = keptAny.some((r) => r.candidate.type === 'program');
    const requirePerson = state.preferences.connections;
    const requireProgram = state.preferences.programs;
    const typeOk =
      (!requirePerson || havePerson) && (!requireProgram || haveProgram);
    logDebug('Loop decision', {
      iteration: state.iteration,
      keptDirect: keptDirect.length,
      keptAny: keptAny.length,
      enough,
      typeOk,
      havePerson,
      haveProgram,
      requirePerson,
      requireProgram,
      maxIterations: state.maxIterations,
      broadenLevel: state.broadenLevel,
    });
    if (enough && typeOk) return 'balance';
    if (state.iteration >= state.maxIterations) return 'balance';
    logDebug('Loop action', { next: 'broaden' });
    return 'broaden';
  };

  // When we come up empty, broaden search incrementally (and allow non-direct candidates to be evaluated).
  const broadenNode = async (state: GraphState) => {
    const nextLevel = Math.min((state.broadenLevel ?? 0) + 1, 2);
    const nextMaxQueries = Math.min(state.maxQueriesPerIteration + 2, 12);
    const nextMaxUrls = Math.min(state.maxUrlsPerQuery + 2, 10);
    logWarn('Broadening search', {
      broadenLevel: state.broadenLevel,
      nextLevel,
      maxQueriesPerIteration: state.maxQueriesPerIteration,
      nextMaxQueries,
      maxUrlsPerQuery: state.maxUrlsPerQuery,
      nextMaxUrls,
    });
    return {
      broadenLevel: nextLevel,
      maxQueriesPerIteration: nextMaxQueries,
      maxUrlsPerQuery: nextMaxUrls,
    };
  };

  // LangGraph's TS overloads are strict; keep the runtime Zod schema and cast for compilation.
  const app = new StateGraph(GraphStateSchema as any)
    .addNode('anchor', anchorNode)
    .addNode('goalStep', goalNode)
    .addNode('planQueries', planQueriesNode)
    .addNode('retrieve', retrieveAndFilterNode)
    .addNode('broaden', broadenNode)
    .addNode('balance', balanceNode)
    .addEdge(START, 'anchor')
    .addEdge('anchor', 'goalStep')
    .addEdge('goalStep', 'planQueries')
    .addEdge('planQueries', 'retrieve')
    .addConditionalEdges('retrieve', shouldLoop, ['broaden', 'balance'])
    .addEdge('broaden', 'planQueries')
    .addEdge('balance', END)
    .compile();

  let finalState: any;
  try {
    finalState = await app.invoke({
      goalTitle: params.goalTitle,
      educationLevel,
      backgroundInfo,
      preferences: {
        connections: params.preferences?.connections ?? true,
        programs: params.preferences?.programs ?? true,
      },
      anchors: null,
      goal: null,
      queries: null,
      iteration: 0,
      broadenLevel: 0,
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

  // Post-step: generate user-facing reason + outreach message
  for (const conn of connections) {
    try {
      const resp = await model.invoke([
        new SystemMessage(SHARED_SYSTEM_PROMPT),
        new HumanMessage(
          buildWriteupPrompt({
            goalTitle: params.goalTitle,
            educationLevel,
            connection: {
              type: conn.type ?? null,
              name: conn.name,
              current_role: conn.current_role ?? null,
              company: conn.company ?? null,
              verified_profile_url: conn.verified_profile_url ?? null,
              website_url: conn.website_url ?? null,
              organization: conn.organization ?? null,
              program_type: conn.program_type ?? null,
              direct_matches: (conn.direct_matches ?? []) as any,
              goal_alignment: conn.goal_alignment ?? null,
              additional_factors: conn.additional_factors ?? null,
            } as any,
          })
        ),
      ]);

      const raw = String(resp.content ?? '');
      const parsed = safeParseJson(raw, ConnectionWriteupSchema);
      conn.ai_connection_reason = parsed.connection_reason;
      // Person only; schema + prompt ensures programs return null.
      conn.ai_outreach_message = parsed.outreach_message;
    } catch (err) {
      logWarn('Writeup generation failed; continuing without copy', {
        connectionType: conn.type ?? null,
        name: conn.name,
      });
      logError('Writeup generation error detail', err, { name: conn.name });
      conn.ai_connection_reason = conn.ai_connection_reason ?? null;
      conn.ai_outreach_message = conn.ai_outreach_message ?? null;
    }
  }

  logDebug('LangGraph end', { returned: connections.slice(0, 5).length });
  return connections.slice(0, 5);
}
