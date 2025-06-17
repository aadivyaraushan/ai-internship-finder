import { getResumeContext } from '../../../lib/memory';
import { chatModel, roleAnalysisParser, roleAnalysisPrompt } from '../../../lib/langchainClient';

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

    // Format the prompt with the parser's instructions
    const formattedPrompt = await roleAnalysisPrompt.format({
      resume: resumeContext,
      goals: goals.map((g: any) => g.title).join('\n- '),
      format_instructions: roleAnalysisParser.getFormatInstructions(),
    });

    // Get the response from the model
    const response = await chatModel.invoke(formattedPrompt);
    const responseContent = response.content.toString();

    // Parse the response using our structured parser
    const parsedResponse = await roleAnalysisParser.parse(responseContent);

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
