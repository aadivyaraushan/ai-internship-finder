import { getResumeContext } from '../../../lib/memory';
import { chatModel, connectionAnalysisParser, connectionAnalysisPrompt } from '../../../lib/langchainClient';
import { auth, db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('Missing Firebase Admin credentials:', {
      hasProjectId: !!serviceAccount.projectId,
      hasClientEmail: !!serviceAccount.clientEmail,
      hasPrivateKey: !!serviceAccount.privateKey,
    });
    throw new Error('Missing Firebase Admin credentials');
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
}

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

    // Clean the response content
    let cleanedContent = responseContent;
    try {
      // Remove markdown code block if present
      cleanedContent = responseContent.replace(/```json\n?|\n?```/g, '');
      // Remove any leading/trailing whitespace
      cleanedContent = cleanedContent.trim();
      
      console.log('Raw LLM Response:', responseContent);
      console.log('Cleaned Response:', cleanedContent);

      // Parse the response using our structured parser
      const parsedResponse = await connectionAnalysisParser.parse(cleanedContent);

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
    } catch (parseError: any) {
      console.error('Error parsing LLM response:', parseError);
      console.error('Failed content:', cleanedContent);
      return new Response(
        JSON.stringify({
          error: 'Failed to parse LLM response',
          details: parseError.message,
          rawResponse: responseContent,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const GET = async (req: Request) => {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No authorization token provided' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify the token
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Get user's stored connections from Firestore
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return new Response(
        JSON.stringify({ error: 'User document not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const userData = userDoc.data();
    const connections = userData.connections || [];

    console.log('Retrieved connections from Firestore:', connections);

    return new Response(
      JSON.stringify({
        response: { suggestedConnections: connections },
        timestamp: new Date().toISOString(),
        status: 'success',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error fetching connections:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch connections',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
