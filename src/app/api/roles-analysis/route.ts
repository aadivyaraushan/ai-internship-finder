import { getResumeContext } from '../../../lib/memory';
import { callClaude } from '../../../lib/anthropicClient';

const PROMPT_TEMPLATE = (resume: string, goalTitles: string[]) => `
You are an AI career advisor with access to the user's resume data and their career goals.

Resume Context:
${resume}

Selected Goals:
${goalTitles.join('\n- ')}

Based on the user's background and their selected career goals, analyze and identify the most suitable roles they could pursue.
Focus on roles that:
1. Align with their current skills and experience
2. Represent realistic transition paths
3. Match their stated career goals

Return ONLY JSON with the exact structure:
{
  "suggestedRoles": [
    {
      "title": "Role Title",
      "bulletPoints": [
        "First key point",
        "Second key point"
      ]
    }
  ]
}`;

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const { goals } = body;

    if (!goals || !Array.isArray(goals) || goals.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Selected goals are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const resumeContext = getResumeContext() || 'No resume data available';

    const prompt = PROMPT_TEMPLATE(
      resumeContext,
      goals.map((g: any) => g.title)
    );

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
