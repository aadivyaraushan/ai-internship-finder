import Anthropic from '@anthropic-ai/sdk';

// Singleton Anthropics client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ClaudeCallOptions {
  tools?: any[];
  maxTokens?: number;
  model?: string;
}

/**
 * Call Claude with the given prompt and optional tool definitions.
 * If the response includes multiple content blocks (e.g. tool events),
 * this helper extracts the text content of the final assistant block.
 */
export async function callClaude(
  prompt: string,
  {
    tools = [],
    maxTokens = 1024,
    model = 'claude-3-5-sonnet-latest',
  }: ClaudeCallOptions = {}
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    tools,
  });

  // The response content is an array of content blocks.
  // We assume the final text block contains the answer.
  const blocks = response.content;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i] as any;
    if (block?.type === 'text' && typeof block.text === 'string') {
      return block.text.trim();
    }
  }

  throw new Error('Claude response did not include text content');
}
