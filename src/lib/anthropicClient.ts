import OpenAI from 'openai';
import { z } from 'zod';

// Create singleton OpenAI client
const client = new OpenAI();

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
        (error as { message?: string })?.message?.toLowerCase().includes('rate limit') ||
        (error as { message?: string })?.message?.toLowerCase().includes('too many requests');

      // Don't retry non-rate-limit errors on final attempt
      if (attempt === maxRetries || (!isRateLimit && attempt > 0)) {
        console.error(
          `Operation failed after ${attempt + 1} attempts:`,
          error
        );
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

function buildMessages(prompt: string): Array<{ role: string; content: string }> {
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
      model: 'gpt-5-turbo',
      messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      max_tokens: 4000,
      temperature: 0.7,
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from GPT-5');
    }

    return result;
  });
}

export async function parseConnectionsWithAI(
  prompt: string,
  schema: z.ZodType
): Promise<unknown> {
  return withExponentialBackoff(async () => {
    console.log('🤖 Calling GPT-5 for structured parsing...');

    const messages = buildMessages(prompt);

    const completion = await client.chat.completions.create({
      model: 'gpt-5-turbo',
      messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      max_tokens: 4000,
      temperature: 0.3,
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from GPT-5');
    }

    // Try to parse as JSON and validate with schema
    try {
      const parsed = JSON.parse(result);
      return schema.parse(parsed);
    } catch {
      return result;
    }
  });
}

export async function analyzeResumeWithAI(resumeText: string): Promise<string> {
  return withExponentialBackoff(async () => {
    console.log('🤖 Calling GPT-5 for resume analysis...');

    const messages = buildMessages(`Analyze this resume: ${resumeText}`);

    const completion = await client.chat.completions.create({
      model: 'gpt-5-turbo',
      messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      max_tokens: 4000,
      temperature: 0.3,
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from GPT-5');
    }

    return result;
  });
}

// Alias for backward compatibility
export const parseWithSchema = parseConnectionsWithAI;