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
        type: z.enum(['person', 'program']),
        matchPercentage: z.number(),
        matchReason: z.string(),
        status: z.enum(['not_contacted', 'email_sent', 'response_received', 'meeting_scheduled', 'rejected', 'ghosted']).optional(),
        current_role: z.string().optional(),
        company: z.string().optional(),
        organization: z.string().optional(),
        program_description: z.string().optional(),
        program_type: z.string().optional(),
        url: z.string().optional(),
        enrollment_info: z.string().optional(),
        how_this_helps: z.string().optional(),
        hiring_power: z.object({
          role_type: z.string(),
          can_hire_interns: z.boolean(),
          department: z.string()
        }).optional(),
        exact_matches: z.object({
          education: z.object({
            university: z.string(),
            graduation_year: z.string(),
            degree: z.string()
          }).optional(),
          shared_activities: z.array(z.object({
            name: z.string(),
            year: z.string(),
            type: z.string()
          })).optional()
        }).optional(),
        outreach_strategy: z.object({
          shared_background_points: z.array(z.string()),
          unique_connection_angle: z.string(),
          suggested_approach: z.string()
        }).optional()
      })
    )
  })
);

// Role analysis prompt template
export const roleAnalysisPrompt = PromptTemplate.fromTemplate(`
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
Analyze the user's background and identify their core career goals and aspirations. Focus on high-level objectives that would be useful for finding relevant roles and connections.

Examples of good goals:
- "Wants to break into finance industry"
- "Seeks to transition into product management"
- "Interested in AI/ML research positions"
- "Looking for software engineering internships"
- "Wants to explore data science roles"
- "Interested in consulting opportunities"
- "Seeks to gain experience in healthcare technology"

Avoid specific action items or how-to goals. Instead, focus on:
1. Industry/field interests
2. Role types they're targeting
3. Career transition goals
4. Experience level they're seeking
5. General career direction

{format_instructions}
`);

// Connection analysis prompt template
export const connectionAnalysisPrompt = PromptTemplate.fromTemplate(`
User Profile:
{profile}

User Goals:
{goals}

Return a JSON object with suggestedConnections array containing up to 3 best matches.
Each connection must have:
1. Required fields for all connections:
   - name: string
   - type: "person" or "program"
   - matchPercentage: number (0-100)
   - matchReason: string

2. For type="person":
   - current_role: string
   - company: string
   - status: "not_contacted" | "email_sent" | "response_received" | "meeting_scheduled" | "rejected" | "ghosted"
   - hiring_power: {{ role_type: string, can_hire_interns: boolean, department: string }}
   - exact_matches: {{ education?: {{ university: string, graduation_year: string, degree: string }}, shared_activities?: Array<{{ name: string, year: string, type: string }}> }}
   - outreach_strategy: {{ shared_background_points: string[], unique_connection_angle: string, suggested_approach: string }}

3. For type="program":
   - program_description: string
   - program_type: string
   - url: string
   - enrollment_info: string
   - how_this_helps: string

IMPORTANT: Return ONLY the JSON object, no markdown formatting or additional text.

{format_instructions}
`); 