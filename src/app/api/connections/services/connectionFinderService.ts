import { callClaude } from '../../../../lib/anthropicClient';
import { buildConnectionFinderPrompt } from '../utils/connectionFinding/buildConnectionFinder';
import { ConnectionsResponse } from '../utils/utils';
import { Connection } from '@/lib/firestoreHelpers';

interface FinderParams {
  goalTitle: string;
  connectionAspects: any;
  preferences?: any;
  race?: string;
  location?: string;
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
}: FinderParams): Promise<Connection[]> {
  const prompt = buildConnectionFinderPrompt({
    goalTitle,
    connectionAspects,
    preferences,
    race,
    location,
  });
  console.log('Connection finder prompt:', prompt);

  const MAX_RETRIES = 2;
  let retry = 0;

  while (retry <= MAX_RETRIES) {
    try {
      const parsed = await callClaude(prompt, {
        tools: [{ type: 'web_search_preview' }],
        maxTokens: 2000,
        model: 'gpt-4.1',
        schema: ConnectionsResponse,
        schemaLabel: 'ConnectionsResponse',
      });

      if (!parsed?.connections) throw new Error('Invalid finder response');

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
