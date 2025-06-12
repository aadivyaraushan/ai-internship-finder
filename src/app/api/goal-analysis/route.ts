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

IMPORTANT: You must return a valid JSON object with the exact structure shown below. Do not add any additional text before or after the JSON.

The response must follow this exact format:
{{
  "endGoals": [
    {{
      "id": "1",
      "title": "Example Career Goal",
      "description": "Example detailed description of the career goal"
    }},
    {{
      "id": "2",
      "title": "Another Career Goal",
      "description": "Another detailed description"
    }}
  ]
}}

Remember:
1. Return ONLY the JSON object
2. Each goal must have exactly these three fields: id, title, and description
3. The id should be a string number starting from "1"
4. Do not add any explanation text before or after the JSON
5. Ensure all quotes and brackets are properly matched`);

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
          contextLoaded: true,
          aiAnalysis: false,
          goalsGenerated: false,
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

    // Simulate processing time for context loading
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Run the chain
    const response = await chain.invoke({
      resume_context: resumeContext,
      input: goal,
    });

    // Simulate AI processing time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Parse the response to ensure it's valid JSON
    const parsedResponse = JSON.parse(response);

    // Simulate formatting time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return new Response(
      JSON.stringify({
        response: parsedResponse,
        timestamp: new Date().toISOString(),
        status: 'success',
        processingSteps: {
          contextLoaded: true,
          aiAnalysis: true,
          goalsGenerated: true,
          recommendationsFormatted: true,
        },
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
