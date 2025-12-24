import { findConnectionsWithAI } from '@/lib/anthropicClient';
import { buildConnectionFinderPrompt } from '../utils/connectionFinding/buildConnectionFinder';
import { ConnectionAspects } from '../utils/utils';
import { Connection } from '@/lib/firestoreHelpers';
import { ConnectionPreferences } from '@/components/ui/ConnectionPreferencesSelector';
import { findConnectionsWithLangGraph } from './langgraphConnectionFinderService';
interface FinderParams {
  goalTitle: string;
  connectionAspects: ConnectionAspects;
  rawResumeText?: string;
  preferences?: ConnectionPreferences;
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
  rawResumeText,
  preferences,
}: FinderParams): Promise<Connection[]> {
  // LangGraph-based agentic implementation (preferred)
  return await findConnectionsWithLangGraph({
    goalTitle,
    rawResumeText: rawResumeText ?? JSON.stringify(connectionAspects, null, 2),
    connectionAspects,
    preferences,
  });
}

/**
 * Generator function that yields connections one by one as they're found
 */
export async function* findConnectionsIteratively({
  goalTitle,
  connectionAspects,
  rawResumeText,
  preferences,
}: FinderParams): AsyncGenerator<Connection, void, unknown> {
  const connections = await findConnectionsWithLangGraph({
    goalTitle,
    rawResumeText: rawResumeText ?? JSON.stringify(connectionAspects, null, 2),
    connectionAspects,
    preferences,
  });

  for (const conn of connections) {
    const connectionWithId = {
      ...conn,
      id:
        conn.id ||
        `temp-${conn.type || 'person'}-${
          conn.name
        }-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
          .replace(/\s+/g, '-')
          .toLowerCase(),
    };
    yield connectionWithId as Connection;
  }
}

/**
 * Original implementation kept for backwards compatibility
 */
async function _findConnectionsOriginal({
  goalTitle,
  connectionAspects,
  preferences,
  personalizationSettings,
}: FinderParams): Promise<Connection[]> {
  // Validate that we have detailed work experience context
  if (connectionAspects.work_experience?.detailed_experiences?.length > 0) {
    // console.log(
    //   `✅ Using detailed work experience context: ${connectionAspects.work_experience.detailed_experiences.length} experiences`
    // );
    // connectionAspects.work_experience.detailed_experiences.forEach((exp, i) => {
    //   console.log(
    //     `  ${i + 1}. ${exp.role} at ${
    //       exp.company
    //     } - ${exp.scale_and_impact?.slice(0, 50)}...`
    //   );
    // });
  } else {
    // console.warn(
    //   '⚠️ No detailed work experiences available - connection matching may be less precise'
    // );
  }

  // Validate other important context
  // const contextSummary = {
  //   education: connectionAspects.education?.institutions?.length || 0,
  //   companies: connectionAspects.work_experience?.companies?.length || 0,
  //   detailed_experiences:
  //     connectionAspects.work_experience?.detailed_experiences?.length || 0,
  //   activities: connectionAspects.activities?.organizations?.length || 0,
  //   achievements: connectionAspects.achievements?.certifications?.length || 0,
  // };
  // console.log('📊 Context summary for connection finding:', contextSummary);

  // Debug personalization settings in connection finder
  // console.log('🎯 Connection Finder - Personalization Settings:', {
  //   enabled: personalizationSettings?.enabled,
  //   professionalInterests: personalizationSettings?.professionalInterests,
  //   personalInterests: personalizationSettings?.personalInterests,
  // });

  // Debug race parameters
  // console.log('🎯 Connection Finder - Race Parameters:', {
  //   race: race,
  //   raceType: typeof race,
  //   raceLength: race?.length,
  // });

  const prompt = buildConnectionFinderPrompt({
    goalTitle,
    connectionAspects,
    preferences,
    personalizationSettings,
  });

  // Debug the actual prompt being sent to AI
  // console.log('📝 Full AI Prompt Being Sent:');
  // console.log('='.repeat(80));
  // console.log(prompt);
  // console.log('='.repeat(80));

  // console.log('🔍 Connection finder prompt character count:', prompt.length);
  // if (prompt.length < 5000) {
  //   console.warn(
  //     '⚠️ Prompt seems short - may not have comprehensive background context'
  //   );
  // }

  const MAX_RETRIES = 2;
  let retry = 0;

  while (retry <= MAX_RETRIES) {
    try {
      const rawResponse = await findConnectionsWithAI(prompt);

      // console.log('🎯 Raw AI Response before parsing:', rawResponse);

      const parsed = JSON.parse(rawResponse);

      // console.log('🎯 Parsed response after schema validation:', parsed);

      if (!parsed?.connections) throw new Error('Invalid finder response');

      // console.log('✅ Connections found: ', parsed);

      // Debug each connection's interest fields
      // parsed.connections.forEach((conn: Connection, index: number) => {
      //   console.log(`🎯 Connection ${index + 1} - ${conn.name}:`);
      //   console.log(
      //     '  shared_professional_interests:',
      //     JSON.stringify(conn.shared_professional_interests, null, 2)
      //   );
      //   console.log(
      //     '  shared_personal_interests:',
      //     JSON.stringify(conn.shared_personal_interests, null, 2)
      //   );
      //   console.log(
      //     '  ai_outreach_message:',
      //     conn.ai_outreach_message?.substring(0, 100) + '...'
      //   );
      // });

      // Filter and validate connections
      const validConnections = parsed.connections.filter(
        (conn: Connection) => conn.name // Only require name
      );

      if (validConnections.length === 0) {
        throw new Error('No valid connections found - all are missing name');
      }

      if (validConnections.length < parsed.connections.length) {
        // const invalidCount =
        //   parsed.connections.length - validConnections.length;
        // console.warn(
        //   `⚠️ Filtered out ${invalidCount} invalid connections missing name`
        // );
        // Log invalid connections for debugging
        // parsed.connections
        //   .filter((conn: Connection) => !conn.name)
        //   .forEach((invalidConn: Connection) =>
        //     console.warn('Invalid connection:', invalidConn)
        //   );
      }

      return validConnections;
    } catch (err) {
      // console.error(`❌ Connection finder attempt ${retry + 1} failed:`, err);
      if (retry === MAX_RETRIES) throw err;
      retry++;
    }
  }
  throw new Error('Unexpected connection finder failure');
}

// Kept for backwards compatibility / quick rollback reference.
// Explicitly referenced to avoid unused-var lint while preserving the implementation.
void _findConnectionsOriginal;
