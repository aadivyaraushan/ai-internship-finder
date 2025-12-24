import OpenAI from 'openai';
import { z } from 'zod';

// Create singleton OpenAI client
const client = new OpenAI();

// Local JSON extractor (kept here to avoid importing from app/ routes)
function extractFirstJSON(raw: string): string | null {
  const firstObj = raw.indexOf('{');
  const firstArr = raw.indexOf('[');

  if (firstObj === -1 && firstArr === -1) return null;

  let start: number;
  let openChar: '{' | '[';
  let closeChar: '}' | ']';

  if (firstObj === -1) {
    start = firstArr;
    openChar = '[';
    closeChar = ']';
  } else if (firstArr === -1) {
    start = firstObj;
    openChar = '{';
    closeChar = '}';
  } else {
    if (firstObj < firstArr) {
      start = firstObj;
      openChar = '{';
      closeChar = '}';
    } else {
      start = firstArr;
      openChar = '[';
      closeChar = ']';
    }
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const char = raw[i];

    if (inString) {
      if (!escaped && char === '"') inString = false;
      escaped = char === '\\' && !escaped;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) depth++;
    else if (char === closeChar) {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * Deterministically parse the first JSON object/array from `rawText` and validate with a Zod schema.
 * This is used to avoid a second LLM call when the model already returned JSON + extra text.
 */
export async function parseWithSchema<T>(
  rawText: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const extracted = extractFirstJSON(rawText) ?? rawText;
  const parsed = JSON.parse(extracted);
  return schema.parse(parsed);
}

// Exponential backoff retry utility
async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      // Check if it's a rate limit error
      const isRateLimit =
        (error as { status?: number })?.status === 429 ||
        (error as { code?: string })?.code === 'rate_limit_exceeded' ||
        (error as { message?: string })?.message
          ?.toLowerCase()
          .includes('rate limit') ||
        (error as { message?: string })?.message
          ?.toLowerCase()
          .includes('too many requests');

      // Don't retry non-rate-limit errors on final attempt
      if (attempt === maxRetries || (!isRateLimit && attempt > 0)) {
        console.error(`Operation failed after ${attempt + 1} attempts:`, error);
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000);
      const jitter = delay * 0.1 * Math.random();
      const totalDelay = Math.floor(delay + jitter);

      console.warn(
        `Attempt ${attempt + 1} failed, retrying in ${totalDelay}ms...`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  throw lastError;
}

function buildMessages(
  prompt: string
): Array<{ role: string; content: string }> {
  return [
    {
      role: 'user',
      content: prompt,
    },
  ];
}

export async function findConnectionsWithAI(prompt: string): Promise<string> {
  return withExponentialBackoff(async () => {
    console.log('🤖 Calling GPT-5 for connection finding...');

    const messages = buildMessages(prompt);

    const completion = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: messages as Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
      }>,
      max_completion_tokens: 4000,
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from GPT-5');
    }

    return result;
  });
}

export async function analyzeResumeWithAI(resumeText: string): Promise<string> {
  return withExponentialBackoff(async () => {
    console.log('🤖 Calling GPT-5 for resume analysis...');

    const messages = buildMessages(`Analyze this resume: ${resumeText}`);

    const completion = await client.chat.completions.create({
      model: 'gpt-5-nano',
      messages: messages as Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
      }>,
      max_completion_tokens: 4000,
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from GPT-5');
    }

    return result;
  });
}
