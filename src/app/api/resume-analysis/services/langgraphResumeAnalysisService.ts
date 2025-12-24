import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { extractFirstJSON } from '@/app/api/connections/utils/extractFirstJson';
import { CombinedResumeSchema, type CombinedResume } from '../schemas';

const SHARED_SYSTEM_PROMPT = `You are a strict JSON generator.
Return ONLY valid JSON that matches the schema in the user message.
Do not invent facts. If missing/unknown, use null, empty arrays, or "unknown".
No extra keys. No extra text.`;

function safeParseJson<T>(raw: string, schema: z.ZodSchema<T>): T {
  const extracted = extractFirstJSON(raw) ?? raw;
  const parsed = JSON.parse(extracted);
  return schema.parse(parsed);
}

function buildAnalysisPrompt(resumeText: string) {
  // Keep this intentionally strict and compact: the model should output only JSON.
  // (The previous implementation asked for reasoning + JSON which increases odds of non-JSON output.)
  return `Extract structured resume data AND networking connection aspects.

Return JSON ONLY matching this schema (no additional keys):

{
  "education": [
    { "school_name": "string", "clubs": ["string"], "awards": ["string"], "gpa": "string|null", "notable_coursework": ["string"] }
  ],
  "skills": ["string"],
  "personal_projects": [
    { "project_name": "string", "description": "string", "responsibilities": ["string"], "recognition": "string|null", "skills": ["string"] }
  ],
  "workex": [
    { "workplace": "string", "notable_projects": ["string"], "role": "string", "reference_email": "string|null", "is_alumni": boolean }
  ],
  "linkedin": "string|null",
  "per_web": "string|null",
  "connection_aspects": {
    "education": { "institutions": ["string"], "graduation_years": ["string"], "fields_of_study": ["string"], "current_level": "high_school|undergraduate|graduate" },
    "work_experience": {
      "detailed_experiences": [
        { "company": "string", "role": "string", "duration": "string", "responsibilities": ["string"], "scale_and_impact": "string", "key_achievements": ["string"] }
      ],
      "companies": ["string"],
      "startup_experience": ["string"],
      "industry_transitions": { "from_industries": ["string"], "to_industries": ["string"], "transition_context": "string" }
    },
    "personal_projects": ["string"],
    "activities": { "clubs": ["string"], "organizations": ["string"], "volunteer_work": ["string"] },
    "achievements": { "certifications": ["string"], "awards": ["string"], "notable_projects": ["string"] },
    "growth_areas": { "developing_skills": ["string"], "target_roles": ["string"], "learning_journey": "string" }
  }
}

Hard rules:
- Work experience MUST be actual roles in organizations (not solo projects).
- Personal projects MUST be solo/independent work (not employment).
- Institutional connections MUST be true affiliations.
- In connection_aspects.activities.organizations, ONLY include organizations where the candidate had an explicit role or membership (e.g., "Member", "President", "Volunteer", "Research Assistant", "Intern", "Employee").
- EXCLUDE entities that merely recognized/awarded/certified the candidate (e.g., "recognized by X", award issuers, certification authorities) unless the resume explicitly states membership/employment/volunteering with that entity.
- If unknown, prefer null or [].

Resume text:
${JSON.stringify(resumeText.slice(0, 18000))}`;
}

type GraphState = {
  resumeText: string;
  prompt?: string;
  raw?: string;
  parsed?: CombinedResume;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
};

export async function analyzeResumeWithLangGraph(opts: {
  resumeText: string;
  maxAttempts?: number;
}): Promise<CombinedResume> {
  const GraphStateSchema = z.object({
    resumeText: z.string(),
    prompt: z.string().optional(),
    raw: z.string().optional(),
    parsed: CombinedResumeSchema.optional(),
    attempts: z.number(),
    maxAttempts: z.number(),
    lastError: z.string().optional(),
  });

  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    temperature: 0,
  });

  const buildPromptNode = async (state: GraphState) => {
    return { prompt: buildAnalysisPrompt(state.resumeText) };
  };

  const llmNode = async (state: GraphState) => {
    const prompt = state.prompt ?? buildAnalysisPrompt(state.resumeText);
    const resp = await model.invoke([
      new SystemMessage(SHARED_SYSTEM_PROMPT),
      new HumanMessage(prompt),
    ]);
    return { raw: String(resp.content ?? '') };
  };

  const parseNode = async (state: GraphState) => {
    try {
      const parsed = safeParseJson(
        String(state.raw ?? ''),
        CombinedResumeSchema
      );
      return { parsed, lastError: undefined };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Unknown parse error: ${String(err)}`;
      return {
        parsed: undefined,
        lastError: msg,
        attempts: state.attempts + 1,
      };
    }
  };

  const repairNode = async (state: GraphState) => {
    const repairPrompt = `The previous output was invalid or did not match the schema.
Fix it and return ONLY valid JSON matching the schema.

Schema: same as previously requested.

Invalid output:
${JSON.stringify(String(state.raw ?? '').slice(0, 12000))}

Error:
${JSON.stringify(state.lastError ?? 'unknown')}
`;

    const resp = await model.invoke([
      new SystemMessage(SHARED_SYSTEM_PROMPT),
      new HumanMessage(repairPrompt),
    ]);
    return { raw: String(resp.content ?? '') };
  };

  const shouldRepair = (state: GraphState): 'repair' | typeof END => {
    if (state.parsed) return END;
    if (state.attempts >= state.maxAttempts) return END;
    return 'repair';
  };

  const graph = new StateGraph(GraphStateSchema as any)
    .addNode('buildPrompt', buildPromptNode)
    .addNode('llm', llmNode)
    .addNode('parse', parseNode)
    .addNode('repair', repairNode)
    .addEdge(START, 'buildPrompt')
    .addEdge('buildPrompt', 'llm')
    .addEdge('llm', 'parse')
    .addConditionalEdges('parse', shouldRepair)
    .addEdge('repair', 'parse');

  const app = graph.compile();

  const finalState = await app.invoke({
    resumeText: opts.resumeText,
    attempts: 0,
    maxAttempts: opts.maxAttempts ?? 2,
  });

  if (!finalState.parsed) {
    throw new Error(
      `Resume analysis failed to produce schema-valid JSON after ${
        finalState.attempts
      } attempts. Last error: ${finalState.lastError ?? 'unknown'}`
    );
  }

  return finalState.parsed;
}
