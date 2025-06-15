import { callClaude } from '../../../lib/anthropicClient';

interface Goal {
  title: string;
  description?: string;
}

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
  return `
You are an AI career advisor tasked with identifying people who can directly refer or hire the user for internship roles, specifically focusing on those with nearly identical backgrounds.

User Resume Context (for reference):
${resumeContext || 'N/A'}

User Career Goals:
${goalTitles?.join('\n- ') || 'N/A'}

Target Role:
${roleTitle}

SEARCH STRATEGY:
1. First, extract key identifiers from the user's background:
   - Universities/schools attended
   - Specific clubs, competitions, or activities (especially niche ones)
   - Previous workplaces and timeframes
   - Notable awards or certifications

2. Use the \`web_search\` tool to find people by searching for combinations of:
   - The exact schools/universities + the target role title
   - Specific niche clubs/competitions + the target role title
   - Previous workplaces + target role title
   
3. For each potential match, verify they have:
   - Current hiring power (e.g., hiring manager, team lead, senior+ role with referral influence)
   - At least 2-3 exact matches with user's background (same school AND same club/competition)
   - Made a similar career transition

4. Calculate match percentage based on:
   - Hiring Power (30%):
     * Direct hiring manager = 30%
     * Team lead = 25%
     * Senior with referral power = 20%
   - Background Matches (50%):
     * Same university = 15%
     * Same degree = 5%
     * Each shared niche activity = 10%
     * Each shared workplace = 10%
     * Same graduation timeframe (±2 years) = 10%
   - Career Path Relevance (20%):
     * Similar starting point = 10%
     * Made the exact transition user wants = 10%

Output a JSON object in this exact format:

{
  "connections": [
    {
      "name": "Full Name",
      "current_role": "Current Job Title",
      "hiring_power": {
        "role_type": "hiring_manager|team_lead|senior_with_referral",
        "can_hire_interns": true,
        "department": "Relevant department name"
      },
      "company": "Current Company",
      "exact_matches": {
        "education": {
          "university": "Exact university name",
          "graduation_year": "YYYY",
          "degree": "Exact degree name"
        },
        "shared_activities": [
          {
            "name": "Exact club/competition/activity name",
            "year": "YYYY",
            "type": "club|competition|workplace|certification"
          }
        ]
      },
      "career_path": {
        "starting_point": "Their background when they were at user's stage",
        "key_transition": "How they moved into current field",
        "time_in_industry": "X years"
      },
      "outreach_strategy": {
        "shared_background_points": [
          "Specific shared experience 1",
          "Specific shared experience 2"
        ],
        "unique_connection_angle": "What makes this connection particularly strong",
        "suggested_approach": "Specific mention of shared experiences"
      },
      "contact_info": {
        "public_profile": "URL to their public profile",
        "work_email": "Work email if public, otherwise null",
        "contact_source": "Where this information was found"
      },
      "match_details": {
        "total_percentage": 85,
        "hiring_power_score": 25,
        "background_match_score": 40,
        "career_path_score": 20,
        "scoring_explanation": "Brief explanation of how scores were calculated"
      }
    }
  ]
}

IMPORTANT:
- Only include people with VERIFIED hiring/referral power
- Prioritize EXACT matches in background over approximate matches
- Focus on UNCOMMON shared experiences that will make outreach memorable
- Calculate match percentages precisely according to the scoring system
- Return ONLY the JSON object with NO additional commentary`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      roles,
      resumeContext,
      goals,
    }: { roles: any[]; resumeContext?: string; goals?: Goal[] } = body;

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Selected roles are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const connections: any[] = [];

    for (const role of roles) {
      const prompt = buildPrompt({
        roleTitle: role.title,
        resumeContext,
        goalTitles: goals?.map((g) => g.title) || [],
      });

      try {
        const raw = await callClaude(prompt, {
          tools: CLAUDE_WEB_SEARCH_TOOL,
          maxTokens: 1200,
        });

        // Look for a JSON object in the response
        const jsonTextMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonTextMatch) {
          throw new Error('Claude response did not contain JSON');
        }

        const parsed = JSON.parse(jsonTextMatch[0]);

        if (parsed && Array.isArray(parsed.connections)) {
          connections.push(...parsed.connections);
        } else {
          console.warn(
            'Unexpected JSON structure from Claude. Skipping role:',
            role.title,
            '\nReceived:',
            raw
          );
        }
      } catch (err) {
        console.error('Error while processing role', role.title, err);
        continue;
      }
    }

    // Deduplicate connections by name and company
    const unique = new Map<string, any>();
    for (const conn of connections) {
      const key = `${conn.name}-${conn.company}`;
      if (!unique.has(key)) {
        unique.set(key, conn);
      }
    }

    // Sort by match percentage
    const sorted = Array.from(unique.values()).sort((a, b) => {
      return (
        (b.match_details?.total_percentage || 0) -
        (a.match_details?.total_percentage || 0)
      );
    });

    return new Response(
      JSON.stringify({
        response: {
          connections: sorted,
          processingSteps: {
            resumeAnalyzed: true,
            rolesEvaluated: true,
            connectionsFound: sorted.length > 0,
            matchesRanked: true,
          },
        },
        timestamp: new Date().toISOString(),
        status: 'success',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Fatal error in connection search:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
