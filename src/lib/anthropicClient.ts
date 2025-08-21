import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

// Create singleton OpenAI client
const client = new OpenAI();

// Note: Perplexity API integration removed - now using GPT-5's native web_search_preview tool

// Exponential backoff retry utility
async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error
      const isRateLimit =
        error?.status === 429 ||
        error?.code === 'rate_limit_exceeded' ||
        error?.message?.toLowerCase().includes('rate limit') ||
        error?.message?.toLowerCase().includes('too many requests');

      // Don't retry non-rate-limit errors on final attempt
      if (attempt === maxRetries || (!isRateLimit && attempt > 0)) {
        console.error(
          `❌ Final attempt failed (${attempt + 1}/${maxRetries + 1}):`,
          error?.message || error
        );
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;

      console.warn(
        `⚠️ Rate limit hit, retrying in ${Math.round(delay)}ms (attempt ${
          attempt + 1
        }/${maxRetries + 1}):`,
        error?.message || error
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Singleton OpenAI client

/**
 * Convert the legacy prompt format that may include a <system>...</system> block
 * into OpenAI Chat Completion messages. If a <system> block is present it will
 * be sent as the system message and the remainder will be sent as the user
 * message. Otherwise, the entire prompt is sent as a single user message.
 */
function buildMessages(prompt: string): Array<any> {
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
 * Connection finder with web search and reasoning capabilities.
 * Specifically designed for finding connections with detailed analysis.
 */
export async function findConnectionsWithAI(
  prompt: string,
  model: string = 'gpt-5',
  maxTokens: number = 9000
): Promise<string> {
  try {
    console.log('🔍 Starting connection finding with web search');
    const messages = buildMessages(prompt);

    const response = (await client.responses.create({
      model,
      input: messages,
      max_output_tokens: maxTokens,
      tools: [{ type: 'web_search_preview' }],
      tool_choice: 'auto',
      reasoning: {
        effort: 'low',
        summary: 'auto',
      },
    })) as any;

    // Log reasoning summary if available
    if (response.output && Array.isArray(response.output)) {
      response.output.forEach((outputItem: any, index: number) => {
        if (outputItem.type === 'reasoning' && outputItem.summary) {
          console.log(`🧠 AI Reasoning Summary ${index + 1}:`);
          console.log(outputItem.summary.text);
        }
      });
    }

    return response.output_text || '';
  } catch (error: any) {
    console.error('❌ Error in findConnectionsWithAI:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
    });
    throw new Error(
      `Connection finding failed: ${error?.message || 'Unknown error'}`
    );
  }
}


/**
 * Parse JSON responses using schema validation.
 * Used for converting AI text responses to structured data.
 */
export async function parseWithSchema<T>(
  prompt: string,
  schema: z.ZodType<T>,
  schemaLabel: string,
  model: string = 'gpt-5-nano',
  maxTokens: number = 2000
): Promise<T> {
  try {
    console.log(`📝 Parsing response with ${schemaLabel} schema`);
    const messages = buildMessages(prompt);

    const response = (await withExponentialBackoff(() =>
      client.responses.parse({
        model,
        input: messages,
        max_output_tokens: maxTokens,
        text: { format: zodTextFormat(schema, schemaLabel) },
      })
    )) as any;

    if (!response.output_parsed) {
      throw new Error('No parsed output received from API');
    }

    return response.output_parsed as T;
  } catch (error: any) {
    console.error(`❌ Error in parseWithSchema (${schemaLabel}):`, {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
    });
    throw new Error(
      `Schema parsing failed for ${schemaLabel}: ${
        error?.message || 'Unknown error'
      }`
    );
  }
}

/**
 * Resume analysis with reasoning capabilities.
 * Generates detailed analysis before structured output.
 */
export async function analyzeResumeWithAI(
  prompt: string,
  model: string = 'gpt-4.1-mini',
  maxTokens: number = 3000
): Promise<string> {
  try {
    console.log('📄 Starting resume analysis with reasoning');
    const messages = buildMessages(prompt);

    const response = (await withExponentialBackoff(() =>
      client.responses.create({
        model,
        input: messages,
        max_output_tokens: maxTokens,
      })
    )) as any;

    if (!response.output_text) {
      throw new Error('No output text received from API');
    }

    return response.output_text;
  } catch (error: any) {
    console.error('❌ Error in analyzeResumeWithAI:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
    });
    throw new Error(
      `Resume analysis failed: ${error?.message || 'Unknown error'}`
    );
  }
}
