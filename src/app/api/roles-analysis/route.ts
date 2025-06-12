import { ChatOpenAI } from '@langchain/openai';
import { BufferMemory } from 'langchain/memory';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

// Create a global memory instance (same as in resume-analysis)
const memory = new BufferMemory({
  memoryKey: 'resume_context',
  returnMessages: true,
  outputKey: 'output',
  inputKey: 'input',
});

// Create the prompt template
const promptTemplate =
  PromptTemplate.fromTemplate(`You are an AI career advisor with access to the user's resume data and their career goals.

Resume Context: {resume_context}
Selected Goals: {goals}

Based on the user's background and their selected career goals, analyze and identify the most suitable roles they could pursue.
Focus on roles that:
1. Align with their current skills and experience
2. Represent realistic transition paths
3. Match their stated career goals

IMPORTANT: You must return a valid JSON object with the exact structure shown below. Do not add any additional text before or after the JSON.

The response must follow this exact format:
{{
  "suggestedRoles": [
    {{
      "title": "Role Title",
      "bulletPoints": [
        "First key point about the role",
        "Second key point about the role"
      ]
    }}
  ],
  "processingSteps": {{
    "contextAnalyzed": true,
    "goalsEvaluated": true,
    "rolesIdentified": true,
    "recommendationsFormatted": true
  }}
}}

Remember:
1. Return ONLY the JSON object
2. Each role must have exactly these fields: title and bulletPoints (array of 2 strings)
3. Each bullet point should be concise and highlight key aspects of the role
4. Limit to 10 most relevant roles
5. For bullet points, focus on:
   - Entry requirements and skill development opportunities
   - Key responsibilities and daily tasks`);

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const { goals } = body;

    if (!goals || !Array.isArray(goals) || goals.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Selected goals are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Get the resume context from memory
    const memoryVariables = await memory.loadMemoryVariables({});
    const resumeContext =
      memoryVariables.resume_context || 'No resume data available';

    const model = new ChatOpenAI({
      model: 'gpt-4.1-mini',
      temperature: 0,
    });

    // Create the chain
    const chain = RunnableSequence.from([
      promptTemplate,
      model,
      new StringOutputParser(),
    ]);

    // Send initial progress update
    const initialResponse = new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        status: 'in_progress',
        processingSteps: {
          contextAnalyzed: false,
          goalsEvaluated: false,
          rolesIdentified: false,
          recommendationsFormatted: false,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Run the chain
    const response = await chain.invoke({
      resume_context: resumeContext,
      goals: goals.map((g: any) => g.title).join(', '),
    });

    // Parse the response to ensure it's valid JSON
    const parsedResponse = JSON.parse(response);

    return new Response(
      JSON.stringify({
        response: parsedResponse,
        timestamp: new Date().toISOString(),
        status: 'success',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
