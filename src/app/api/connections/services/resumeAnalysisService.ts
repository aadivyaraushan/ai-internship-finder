import { callClaude } from '../../../../lib/anthropicClient';
import { buildResumeAspectAnalyzerPrompt } from '../utils/buildResumeAnalyzer';
import { aspectSchema } from '../utils/utils';

/**
 * Resulting structure from resume analysis.
 * Matches the shape returned by the previous route implementation.
 */
export interface ResumeAspects {
  education: any;
  work_experience: any;
  activities: any;
  achievements: any;
  growth_areas: any;
}

/**
 * Analyse the raw resume text for aspects that will later be used to match
 * connections/programs.  This is a direct extraction of the logic that lived
 * inside the big `POST` route.  All retry / logging semantics are preserved.
 */
export async function analyzeResume(
  resumeContext: string,
  maxRetries: number = 2
): Promise<ResumeAspects> {
  console.log('📄 Starting resume analysis');
  console.log('Resume context preview:', resumeContext.slice(0, 200) + '…');

  let retry = 0;
  while (retry <= maxRetries) {
    try {
      const prompt = buildResumeAspectAnalyzerPrompt(resumeContext);
      console.log('Resume analysis prompt:', prompt);

      const parsed = await callClaude(prompt, {
        maxTokens: 1000,
        model: 'gpt-4.1-nano',
        schema: aspectSchema,
        schemaLabel: 'ConnectionAspects',
      });
      console.log('Raw aspects response:', parsed);

      if (!parsed?.connection_aspects) {
        throw new Error('Invalid aspects response – missing connection_aspects');
      }

      const aspects = parsed.connection_aspects as ResumeAspects;

      // Basic structural validation
      const expected = [
        'education',
        'work_experience',
        'activities',
        'achievements',
        'growth_areas',
      ];
      const missing = expected.filter((k) => !(k in aspects));
      if (missing.length) {
        throw new Error(`Missing required sections: ${missing.join(', ')}`);
      }

      return aspects;
    } catch (err) {
      console.error(`❌ Resume analysis attempt ${retry + 1} failed:`, err);
      if (retry === maxRetries) throw err;
      retry++;
    }
  }
  // Should never reach here
  throw new Error('Unexpected resume analysis failure');
}
