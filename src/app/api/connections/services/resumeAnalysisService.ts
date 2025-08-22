import { analyzeResumeWithAI, parseWithSchema } from '../../../../lib/anthropicClient';
import { buildResumeAspectAnalyzerPrompt } from '../utils/buildResumeAnalyzer';
import { aspectSchema, ConnectionAspects, WorkExperienceDetail, Education, WorkExperience, Activities, Achievements, GrowthAreas } from '../utils/utils';

/**
 * Resulting structure from resume analysis.
 * Now properly typed to preserve maximum context.
 */
export interface ResumeAspects {
  education: Education;
  work_experience: WorkExperience;
  activities: Activities;
  achievements: Achievements;
  growth_areas: GrowthAreas;
  connection_aspects: ConnectionAspects;
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

      const rawResponse = await analyzeResumeWithAI(prompt);

      console.log('🧠 Thinking...', rawResponse);

      const parsed = await parseWithSchema(
        'Parse the following response and convert the JSON at the end to pure JSON: \n\n' +
          rawResponse,
        aspectSchema
      ) as { connection_aspects?: unknown };
      console.log('Parsed aspects response:', parsed, typeof parsed);

      if (!parsed?.connection_aspects) {
        throw new Error(
          'Invalid aspects response – missing connection_aspects'
        );
      }

      const aspects = {
        ...parsed.connection_aspects,
        connection_aspects: parsed.connection_aspects
      } as ResumeAspects;

      // Ensure backward compatibility: populate companies array from detailed_experiences
      if (aspects.work_experience?.detailed_experiences?.length > 0 && 
          (!aspects.work_experience.companies || aspects.work_experience.companies.length === 0)) {
        aspects.work_experience.companies = aspects.work_experience.detailed_experiences.map((exp: WorkExperienceDetail) => exp.company);
      }

      // Validate that detailed experiences have meaningful content
      if (aspects.work_experience?.detailed_experiences?.length > 0) {
        const incompleteExperiences = aspects.work_experience.detailed_experiences.filter(
          exp => !exp.company || !exp.role || !exp.scale_and_impact
        );
        if (incompleteExperiences.length > 0) {
          console.warn(`⚠️ Found ${incompleteExperiences.length} incomplete work experiences missing key details`);
          console.warn('Incomplete experiences:', incompleteExperiences);
        }
        
        console.log(`✅ Successfully captured ${aspects.work_experience.detailed_experiences.length} detailed work experiences`);
        aspects.work_experience.detailed_experiences.forEach((exp, i) => {
          console.log(`Experience ${i + 1}: ${exp.role} at ${exp.company} - Scale: ${exp.scale_and_impact?.slice(0, 100)}...`);
        });
      } else {
        console.warn('⚠️ No detailed work experiences captured - may lose important context for connection matching');
      }

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
