import { getResumeContext } from '../../../lib/memory';
import { chatModel, goalAnalysisParser, goalAnalysisPrompt } from '../../../lib/langchainClient';

export const POST = async (req: Request) => {
  try {
    const resumeContext = getResumeContext() || 'No resume data available';

    // Format the prompt with the parser's instructions
    const formattedPrompt = await goalAnalysisPrompt.format({
      resume: resumeContext,
      format_instructions: goalAnalysisParser.getFormatInstructions(),
    });

    // Get the response from the model
    const response = await chatModel.invoke(formattedPrompt);
    const responseContent = response.content.toString();

    // Parse the response using our structured parser
    const parsedResponse = await goalAnalysisParser.parse(responseContent);

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
