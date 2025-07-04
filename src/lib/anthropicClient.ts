import OpenAI from 'openai';
import { zodResponseFormat, zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { ConnectionsResponse } from '../app/api/connections/utils/utils';

// Singleton OpenAI client

export interface ClaudeCallOptions {
  tools?: any[]; // Currently ignored for OpenAI calls, kept for API-compatibility
  maxTokens?: number;
  model?: string;
  schema: z.ZodType<any>;
  schemaLabel?: string;
}

/**
 * Convert the legacy prompt format that may include a <system>...</system> block
 * into OpenAI Chat Completion messages. If a <system> block is present it will
 * be sent as the system message and the remainder will be sent as the user
 * message. Otherwise, the entire prompt is sent as a single user message.
 */
function buildMessages(
  prompt: string
): Array<{ role: 'system' | 'user'; content: string }> {
  const systemTagRegex = /<system>([\s\S]*?)<\/system>/i;
  const match = prompt.match(systemTagRegex);

  if (match) {
    const systemContent = match[1].trim();
    const userContent = prompt.replace(systemTagRegex, '').trim();
    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];
  }

  return [{ role: 'user', content: prompt }];
}

/**
 * Call OpenAI Chat Completions (defaults to gpt-4o-mini). The function name and
 * signature are preserved so that the rest of the codebase continues to work
 * without modification.
 */
export async function callClaude(
  prompt: string,
  {
    tools = [],
    maxTokens = 1024,
    model = 'gpt-4.1-mini',
    schema = ConnectionsResponse,
    schemaLabel = 'ConnectionsResponse',
  }: ClaudeCallOptions
): Promise<z.infer<typeof schema>> {
  const client = new OpenAI();
  const messages = buildMessages(prompt);

  const completionOptions: any = {
    model,
    input: messages,
    text: {},
  } as any;

  // If an array of tools was provided, pass it through to OpenAI. The OpenAI
  // web-search tool expects objects of the form `{ type: 'web_search' }`.
  if (tools && tools.length > 0) {
    completionOptions.tools = tools;
    // Let the model decide when to call a tool.
    completionOptions.tool_choice = 'auto';
  }
  console.log(
    'zodTextFormat(schema, schemaLabel)',
    zodTextFormat(schema, schemaLabel)
  );
  if (schema && schemaLabel) {
    completionOptions.text.format = zodTextFormat(schema, schemaLabel);
  }
  const response = await client.responses.parse(completionOptions);

  return response.output_parsed as z.infer<typeof ConnectionsResponse>;
}
