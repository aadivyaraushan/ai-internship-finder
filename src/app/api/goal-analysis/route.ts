import { callClaude } from '../../../lib/anthropicClient';
import { getResumeContext } from '../../../lib/memory';

const PROMPT_TEMPLATE = (resume: string, userInput: string) => `
You are an AI assistant with access to the user's resume data. Use this context to provide personalized responses.

Resume Context:
${resume}

Current Request:
${userInput}

Read between the lines and analyze 5 actual potential career goals and opportunities that the person wants out of this.

Focus on identifying specific, actionable goals that align with their experience and skills.

Return ONLY valid JSON with the exact structure:
{
  "endGoals": [
    {
      "id": "1",
      "title": "Goal Title",
      "description": "Detailed description"
    }
  ]
}`;

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const { goal } = body;

    if (!goal) {
      return new Response(JSON.stringify({ error: 'Goal is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resumeContext = getResumeContext() || 'No resume data available';

    const prompt = PROMPT_TEMPLATE(resumeContext, goal);

    const raw = await callClaude(prompt);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude did not return JSON');

    const parsedResponse = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({
        response: parsedResponse,
        timestamp: new Date().toISOString(),
        status: 'success',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
