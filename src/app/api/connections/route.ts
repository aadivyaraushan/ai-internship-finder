import { ChatOpenAI } from '@langchain/openai';
import { BufferMemory } from 'langchain/memory';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getUser } from '@/lib/firestoreHelpers';
import { auth } from '@/lib/firebase';

// Use the same memory instance as other routes
const memory = new BufferMemory({
  memoryKey: 'resume_context',
  returnMessages: true,
  outputKey: 'output',
  inputKey: 'input',
});

// Create the prompt template for finding similar career trajectories
const promptTemplate =
  PromptTemplate.fromTemplate(`You are an AI career advisor tasked with finding people who have similar career trajectories to the user.

User's Resume Context: {resume_context}
User's Selected Roles: {roles}

Based on the user's background and their selected roles, find people who:
1. Started from a similar educational or professional background
2. Have successfully transitioned into roles similar to what the user is targeting
3. Share key skills or experiences with the user

IMPORTANT: You must return a valid JSON object with the exact structure shown below. Do not add any additional text before or after the JSON.

The response must follow this exact format:
{{
  "connections": [
    {{
      "id": "unique_id_1",
      "name": "Full Name",
      "current_role": "Current Job Title",
      "company": "Current Company",
      "matchPercentage": 95,
      "matchReason": "Detailed explanation of why this person is a good match",
      "sharedBackground": [
        "Key similarity point 1",
        "Key similarity point 2"
      ],
      "careerHighlights": [
        "Notable achievement or transition 1",
        "Notable achievement or transition 2"
      ]
    }}
  ],
  "processingSteps": {{
    "resumeAnalyzed": true,
    "rolesEvaluated": true,
    "connectionsFound": true,
    "matchesRanked": true
  }}
}}

Remember:
1. Return ONLY the JSON object
2. Each connection must have all the specified fields
3. matchPercentage should be between 0 and 100
4. Focus on real, actionable career trajectory matches
5. Prioritize quality of matches over quantity`);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roles } = body;

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Selected roles are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Get the user's resume context from memory
    const memoryVariables = await memory.loadMemoryVariables({});
    const resumeContext =
      memoryVariables.resume_context || 'No resume data available';

    // Get additional user data from Firebase
    const userData = await getUser(auth.currentUser!.uid);
    if (!userData) {
      return new Response(JSON.stringify({ error: 'User data not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

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
          resumeAnalyzed: false,
          rolesEvaluated: false,
          connectionsFound: false,
          matchesRanked: false,
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
      roles: roles.map((r: any) => r.title).join(', '),
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
}
