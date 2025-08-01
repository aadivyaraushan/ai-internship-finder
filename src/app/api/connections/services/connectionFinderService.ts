import { callClaude } from '@/lib/anthropicClient';
import { buildConnectionFinderPrompt } from '../utils/connectionFinding/buildConnectionFinder';
import { ConnectionsResponse, ConnectionAspects } from '../utils/utils';
import { Connection } from '@/lib/firestoreHelpers';
import { ConnectionPreferences } from '@/components/ui/ConnectionPreferencesSelector';
interface FinderParams {
  goalTitle: string;
  connectionAspects: ConnectionAspects;
  preferences?: ConnectionPreferences;
  race?: string;
  location?: string;
  personalizationSettings?: {
    enabled: boolean;
    professionalInterests: string;
    personalInterests: string;
  };
}

/**
 * Finds relevant connections based on the provided parameters
 *
 * @param {FinderParams} params - Parameters for finding connections
 * @returns {Promise<Connection[]>} A promise that resolves to an array of connections
 */
export async function findConnections({
  goalTitle,
  connectionAspects,
  preferences,
  race,
  location,
  personalizationSettings,
}: FinderParams): Promise<Connection[]> {
  // Validate that we have detailed work experience context
  if (connectionAspects.work_experience?.detailed_experiences?.length > 0) {
    console.log(`✅ Using detailed work experience context: ${connectionAspects.work_experience.detailed_experiences.length} experiences`);
    connectionAspects.work_experience.detailed_experiences.forEach((exp, i) => {
      console.log(`  ${i + 1}. ${exp.role} at ${exp.company} - ${exp.scale_and_impact?.slice(0, 50)}...`);
    });
  } else {
    console.warn('⚠️ No detailed work experiences available - connection matching may be less precise');
  }
  
  // Validate other important context
  const contextSummary = {
    education: connectionAspects.education?.institutions?.length || 0,
    companies: connectionAspects.work_experience?.companies?.length || 0,
    detailed_experiences: connectionAspects.work_experience?.detailed_experiences?.length || 0,
    activities: connectionAspects.activities?.organizations?.length || 0,
    achievements: connectionAspects.achievements?.certifications?.length || 0
  };
  console.log('📊 Context summary for connection finding:', contextSummary);

  const prompt = buildConnectionFinderPrompt({
    goalTitle,
    connectionAspects,
    preferences,
    race,
    location,
    personalizationSettings,
  });
  
  console.log('🔍 Connection finder prompt character count:', prompt.length);
  if (prompt.length < 5000) {
    console.warn('⚠️ Prompt seems short - may not have comprehensive background context');
  }

  const MAX_RETRIES = 2;
  let retry = 0;

  while (retry <= MAX_RETRIES) {
    try {
      const rawResponse = await callClaude(prompt, {
        tools: [
          {
            type: 'function',
            name: 'search_web',
            description:
              'Search the internet using Perplexity AI to find relevant sources, URLs, and information',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description:
                    'The search query to find relevant information about people, companies, programs, or opportunities',
                },
              },
              required: ['query'],
            },
          },
        ],
        maxTokens: 10000,
        model: 'gpt-4.1',
      });

      const parsed = await callClaude(
        'Parse the following response and convert the JSON at the end to pure JSON: \n\n' +
          rawResponse,
        {
          model: 'gpt-4.1-nano',
          maxTokens: 2000,
          schema: ConnectionsResponse,
          schemaLabel: 'ConnectionsResponse',
        }
      );

      if (!parsed?.connections) throw new Error('Invalid finder response');

      console.log('✅ Connections found: ', parsed);

      // Filter and validate connections
      const validConnections = parsed.connections.filter(
        (conn: Connection) => conn.name // Only require name
      );

      if (validConnections.length === 0) {
        throw new Error('No valid connections found - all are missing name');
      }

      if (validConnections.length < parsed.connections.length) {
        const invalidCount =
          parsed.connections.length - validConnections.length;
        console.warn(
          `⚠️ Filtered out ${invalidCount} invalid connections missing name`
        );
        // Log invalid connections for debugging
        parsed.connections
          .filter((conn: Connection) => !conn.name)
          .forEach((invalidConn: Connection) =>
            console.warn('Invalid connection:', invalidConn)
          );
      }

      return validConnections;
    } catch (err) {
      console.error(`❌ Connection finder attempt ${retry + 1} failed:`, err);
      if (retry === MAX_RETRIES) throw err;
      retry++;
    }
  }
  throw new Error('Unexpected connection finder failure');
}
