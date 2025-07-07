import { callClaude } from '../../../../lib/anthropicClient';
import { buildConnectionFinderPrompt } from '../utils/connectionFinding/buildConnectionFinder';
import { ConnectionsResponse } from '../utils/utils';
import { Connection } from '@/lib/firestoreHelpers';

interface FinderParams {
  roleTitle: string;
  goalTitle: string;
  connectionAspects: any;
  preferences?: any;
  race?: string;
  location?: string;
}

export async function findConnections({
  roleTitle,
  goalTitle,
  connectionAspects,
  preferences,
  race,
  location,
}: FinderParams): Promise<Connection[]> {
  const prompt = buildConnectionFinderPrompt({
    roleTitle,
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

      // Basic validation copied from legacy route
      parsed.connections.forEach((conn: any) => {
        if (!conn.type || !conn.name || !conn.direct_matches || !conn.goal_alignment) {
          throw new Error('Invalid connection structure');
        }
      });

      return parsed.connections;
    } catch (err) {
      console.error(`❌ Connection finder attempt ${retry + 1} failed:`, err);
      if (retry === MAX_RETRIES) throw err;
      retry++;
    }
  }
  throw new Error('Unexpected connection finder failure');
}
