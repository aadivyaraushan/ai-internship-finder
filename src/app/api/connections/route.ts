import { getResumeContext } from '../../../lib/memory';
import { chatModel, connectionAnalysisParser, connectionAnalysisPrompt } from '../../../lib/langchainClient';

interface Goal {
  title: string;
  description?: string;
}

// Add interface at the top of the file after imports
interface PersonConnection {
  name: string;
  type?: 'person';
  current_role: string;
  company: string;
  hiring_power: {
    role_type: string;
    can_hire_interns: boolean;
    department: string;
  };
  exact_matches: {
    education: {
      university: string;
      graduation_year: string;
      degree: string;
    };
    shared_activities: Array<{
      name: string;
      year: string;
      type: string;
    }>;
  };
  match_details: {
    total_percentage: number;
    hiring_power_score: number;
    background_match_score: number;
    career_path_score: number;
    scoring_explanation: string;
  };
}

interface ProgramConnection {
  type: 'program';
  name: string;
  organization: string;
  program_type: string; // internship, fellowship, bootcamp, etc
  program_description: string;
  url?: string;
  enrollment_info?: string;
  how_this_helps?: string;
  match_details: {
    total_percentage: number;
    relevance_score: number;
    opportunity_quality_score: number;
    scoring_explanation: string;
  };
}

type ConnectionResponse = PersonConnection | ProgramConnection;

// Helper tool definition for Claude web search
const CLAUDE_WEB_SEARCH_TOOL = [
  {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 5,
  },
];

// Builds the prompt Claude will receive for each role
function buildPrompt({
  roleTitle,
  resumeContext,
  goalTitles,
}: {
  roleTitle: string;
  resumeContext?: string;
  goalTitles?: string[];
}) {
  const resume = resumeContext || 'N/A';
  const goals = goalTitles?.join('|') || 'N/A';

  return `<system>Return ONLY valid JSON.</system>
<input>resume:${resume};goals:${goals};role:${roleTitle}</input>
<rules>
1. Return up to 3 best matches.
2. Each item must have a "type" field: "person" or "program".
3. Person requirements: include outreach_strategy.shared_background_points (≥1) & suggested_approach.
4. Program requirements: describe how opportunity helps achieve goals.
5. Provide match_details.total_percentage (0-100).
</rules>
<schema>
Person:{"type":"person","name":"","current_role":"","company":"","outreach_strategy":{"shared_background_points":[],"suggested_approach":""},"match_details":{"total_percentage":0}}
Program:{"type":"program","name":"","organization":"","program_type":"","program_description":"","how_this_helps":"","match_details":{"total_percentage":0}}
</schema>
If none:{"connections":[]} `;
}

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
    const formattedPrompt = await connectionAnalysisPrompt.format({
      profile: resumeContext,
      goals: goals.map((g: any) => g.title).join('\n- '),
      format_instructions: connectionAnalysisParser.getFormatInstructions(),
    });

    // Get the response from the model
    const response = await chatModel.invoke(formattedPrompt);
    const responseContent = response.content.toString();

    // Parse the response using our structured parser
    const parsedResponse = await connectionAnalysisParser.parse(responseContent);

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
