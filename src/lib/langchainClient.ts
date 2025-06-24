import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';

// Initialize the OpenAI chat model
export const chatModel = new ChatOpenAI({
  modelName: 'gpt-4-turbo-preview',
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Role analysis parser
export const roleAnalysisParser = StructuredOutputParser.fromZodSchema(
  z.object({
    suggestedRoles: z.array(
      z.object({
        title: z.string(),
        bulletPoints: z.array(z.string()),
      })
    ),
  })
);

// Goal analysis parser
export const goalAnalysisParser = StructuredOutputParser.fromZodSchema(
  z.object({
    suggestedGoals: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        relevance: z.number(),
      })
    ),
  })
);

// Connection analysis parser
export const connectionAnalysisParser = StructuredOutputParser.fromZodSchema(
  z.object({
    suggestedConnections: z.array(
      z.object({
        name: z.string(),
        matchPercentage: z.number(),
        matchReason: z.string(),
        status: z.enum(['Awaiting response', 'Responded']).optional(),
      })
    ),
  })
);

// Role analysis prompt template
export const roleAnalysisPrompt = PromptTemplate.fromTemplate(`
You are an AI career advisor with access to the user's resume data and their career goals.

Resume Context:
{resume}

Selected Goals:
{goals}

Based on the user's background and their selected career goals, analyze and identify the most suitable roles they could pursue.
Focus on roles that:
1. Align with their current skills and experience
2. Represent realistic transition paths
3. Match their stated career goals

{format_instructions}
`);

// Goal analysis prompt template
export const goalAnalysisPrompt = PromptTemplate.fromTemplate(`
You are an AI career advisor analyzing a user's resume to suggest relevant career goals.

Resume Context:
{resume}

Based on the user's background, suggest relevant career goals that would help them advance their career.
Focus on goals that:
1. Are specific and measurable
2. Align with their current skills and experience
3. Represent realistic career progression

{format_instructions}
`);

// Connection analysis prompt template
export const connectionAnalysisPrompt = PromptTemplate.fromTemplate(`
You are an AI career advisor suggesting potential connections for a user based on their profile and goals.

User Profile:
{profile}

User Goals:
{goals}

Based on the user's profile and goals, suggest potential connections that could help them achieve their career objectives.
Focus on connections that:
1. Have relevant experience or expertise
2. Could provide valuable mentorship or opportunities
3. Share similar career interests or backgrounds

{format_instructions}
`); 