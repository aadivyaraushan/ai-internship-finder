import { findConnectionsWithAI } from '@/lib/anthropicClient';
import { buildConnectionFinderPrompt } from '../utils/connectionFinding/buildConnectionFinder';
import { ConnectionAspects } from '../utils/utils';
import { Connection } from '@/lib/firestoreHelpers';
import { ConnectionPreferences } from '@/components/ui/ConnectionPreferencesSelector';
interface FinderParams {
  goalTitle: string;
  connectionAspects: ConnectionAspects;
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
  preferences,
  personalizationSettings,
}: FinderParams): Promise<Connection[]> {
  // Implementation remains the same for backwards compatibility
  return findConnectionsOriginal({
    goalTitle,
    connectionAspects,
    preferences,
    personalizationSettings,
  });
}

/**
 * Generator function that yields connections one by one as they're found
 */
export async function* findConnectionsIteratively({
  goalTitle,
  connectionAspects,
  preferences,
  personalizationSettings,
}: FinderParams): AsyncGenerator<Connection, void, unknown> {
  // Validate context same as original
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

  // const contextSummary = {
  //   education: connectionAspects.education?.institutions?.length || 0,
  //   companies: connectionAspects.work_experience?.companies?.length || 0,
  //   detailed_experiences:
  //     connectionAspects.work_experience?.detailed_experiences?.length || 0,
  //   activities: connectionAspects.activities?.organizations?.length || 0,
  //   achievements: connectionAspects.achievements?.certifications?.length || 0,
  // };
  // console.log('📊 Context summary for connection finding:', contextSummary);

  // console.log('🎯 Connection Finder - Personalization Settings:', {
  //   enabled: personalizationSettings?.enabled,
  //   professionalInterests: personalizationSettings?.professionalInterests,
  //   personalInterests: personalizationSettings?.personalInterests,
  // });

  // console.log('🎯 Connection Finder - Race Parameters:', {
  //   race: race,
  //   raceType: typeof race,
  //   raceLength: race?.length,
  // });

  const basePrompt = buildConnectionFinderPrompt({
    goalTitle,
    connectionAspects,
    preferences,
    personalizationSettings,
  });

  // console.log('📝 Base AI Prompt Being Used:');
  // console.log('='.repeat(80));
  // console.log(basePrompt);
  // console.log('='.repeat(80));

  // console.log('🔍 Base prompt character count:', basePrompt.length);
  // if (basePrompt.length < 5000) {
  //   console.warn(
  //     '⚠️ Prompt seems short - may not have comprehensive background context'
  //   );
  // }

  let previousConnections = '';
  let previousReasoning = '';
  const MAX_RETRIES = 2;

  // Generate 5 connections iteratively
  for (let i = 0; i < 5; i++) {
    let retry = 0;

    while (retry <= MAX_RETRIES) {
      try {
        // console.log(`🔍 Finding connection ${i + 1}/5`);

        // console.log(`🔍 Finding connection ${i + 1} with accumulated context`);

        // Build the iterative prompt with previous context
        let enhancedPrompt = basePrompt;

        if (i > 0 && previousConnections) {
          enhancedPrompt += `\n\n--- Previous Connections Found ---\n${previousConnections}`;
        }

        if (previousReasoning) {
          enhancedPrompt += `\n\n--- Previous Reasoning ---\n${previousReasoning}`;
        }

        enhancedPrompt += `\n\nPlease find connection #${
          i + 1
        } of 5. Focus on finding a different type of connection or from a different background than the previous ones. Return a single connection in valid JSON format.`;

        const rawResponse = await findConnectionsWithAI(
          enhancedPrompt
        );

        // console.log(`🎯 Raw AI Response for connection ${i + 1}:`, rawResponse);

        const parsed = JSON.parse(rawResponse);
        // console.log(`🎯 Parsed response for connection ${i + 1}:`, parsed);

        // Handle case where AI returns {connections: [...]} instead of single connection
        const connection = parsed.connections?.[0] || parsed;

        if (!connection?.name)
          throw new Error(`Invalid connection ${i + 1} response`);

        // Accumulate context for next connection
        previousConnections += `\nConnection ${i + 1}: ${JSON.stringify(
          connection,
          null,
          2
        )}`;

        // Extract reasoning from the response if available
        if (connection.reasoning) {
          previousReasoning += `\nConnection ${i + 1} Reasoning: ${
            connection.reasoning
          }`;
        }

        // Debug connection details
        // console.log(`🎯 Connection ${i + 1} - ${connection.name}:`);
        // console.log(
        //   '  shared_professional_interests:',
        //   JSON.stringify(connection.shared_professional_interests, null, 2)
        // );
        // console.log(
        //   '  shared_personal_interests:',
        //   JSON.stringify(connection.shared_personal_interests, null, 2)
        // );
        // console.log(
        //   '  ai_outreach_message:',
        //   connection.ai_outreach_message?.substring(0, 100) + '...'
        // );

        // Validate connection has required fields
        if (!connection.name) {
          throw new Error(`Connection ${i + 1} missing name`);
        }

        // Add a temporary ID for streaming purposes
        const connectionWithId = {
          ...connection,
          id: `temp-${connection.type || 'person'}-${
            connection.name
          }-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
            .replace(/\s+/g, '-')
            .toLowerCase(),
        };

        // Yield the connection
        yield connectionWithId as Connection;
        break; // Success, move to next connection
      } catch {
        // console.error(
        //   `❌ Connection ${i + 1} attempt ${retry + 1} failed:`,
        //   err
        // );
        if (retry === MAX_RETRIES) {
          // console.error(
          //   `❌ Failed to find connection ${i + 1} after ${
          //     MAX_RETRIES + 1
          //   } attempts`
          // );
          break; // Skip this connection and continue with next
        }
        retry++;
      }
    }
  }
}

/**
 * Original implementation kept for backwards compatibility
 */
async function findConnectionsOriginal({
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
