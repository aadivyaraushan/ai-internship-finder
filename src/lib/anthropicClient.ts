import OpenAI from 'openai';

// Singleton OpenAI client

export interface ClaudeCallOptions {
  tools?: any[]; // Currently ignored for OpenAI calls, kept for API-compatibility
  maxTokens?: number;
  model?: string;
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
  { tools = [], maxTokens = 1024, model = 'gpt-4.1' }: ClaudeCallOptions = {}
): Promise<string> {
  const client = new OpenAI();
  const messages = buildMessages(prompt);

  const completionOptions: any = {
    model,
    input: messages,
  } as any;

  // If an array of tools was provided, pass it through to OpenAI. The OpenAI
  // web-search tool expects objects of the form `{ type: 'web_search' }`.
  if (tools && tools.length > 0) {
    completionOptions.tools = tools;
    // Let the model decide when to call a tool.
    completionOptions.tool_choice = 'auto';
  }

  const response = await client.responses.create(completionOptions);

  const assistantMessage = response.output_text;
  if (!assistantMessage) {
    throw new Error('OpenAI response did not include a message');
  }

  if (assistantMessage) {
    return assistantMessage.trim();
  }

  // Fallback: if the assistant responded with a function call or no content
  // just return the stringified message so downstream code can handle it.
  return JSON.stringify(assistantMessage, null, 2);
}
