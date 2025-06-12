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
  PromptTemplate.fromTemplate(`You are an AI assistant with access to the user's resume data. Use this context to provide personalized responses.

Resume Context: {resume_context}

Current Request: {input}

Analyze the resume and the user's request to identify potential career goals and opportunities.
Focus on identifying specific, actionable goals that align with their experience and skills.

Return the response in the following format:
{{
  "endGoals": [
    {{
      "id": "goal_1",
      "title": "Career goal",
      "description": "Detailed description"
    }}
  ]
}}`);

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const { goal } = body;

    if (!goal) {
      return new Response(JSON.stringify({ error: 'Goal is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Get the resume context from memory
    const memoryVariables = await memory.loadMemoryVariables({});
    const resumeContext =
      memoryVariables.resume_context || 'No resume data available';

    const model = new ChatOpenAI({
      model: 'gpt-4.1',
      temperature: 0,
    });

    // Create the chain
    const chain = RunnableSequence.from([
      promptTemplate,
      model,
      new StringOutputParser(),
    ]);

    // Run the chain
    const response = await chain.invoke({
      resume_context: resumeContext,
      input: goal,
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
