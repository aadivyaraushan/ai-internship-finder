import { callClaude } from '../../../lib/anthropicClient';

interface Goal {
  title: string;
  description?: string;
}

// Add interface at the top of the file after imports
interface ConnectionResponse {
  name: string;
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
  return `<system>JSON-only output required. No other text allowed.</system>

<input>
  <resume>${resumeContext || 'N/A'}</resume>
  <goals>${goalTitles?.join(', ') || 'N/A'}</goals>
  <role>${roleTitle}</role>
</input>

<rules>
- Search for people with hiring power and matching backgrounds
- Score: hiring(30%): manager=30|lead=25|senior=20
- Score: background(50%): uni=15|degree=5|activity=10|work=10|grad=10
- Score: career(20%): start=10|transition=10
</rules>

<format>Empty response: {"connections":[]}
Full response: {"connections":[{
  "name": "Jane Doe",
  "current_role": "Tech Lead",
  "company": "Example Corp",
  "hiring_power": {"role_type": "team_lead", "can_hire_interns": true, "department": "Engineering"},
  "exact_matches": {
    "education": {"university": "MIT", "graduation_year": "2018", "degree": "CS"},
    "shared_activities": [{"name": "Hackathon", "year": "2017", "type": "competition"}]
  },
  "career_path": {"starting_point": "Intern", "key_transition": "To leadership", "time_in_industry": "5y"},
  "outreach_strategy": {
    "shared_background_points": ["Same hackathon"],
    "unique_connection_angle": "Similar path",
    "suggested_approach": "Mention hackathon"
  },
  "contact_info": {"public_profile": "linkedin/jane", "work_email": null, "contact_source": "LinkedIn"},
  "match_details": {
    "total_percentage": 80,
    "hiring_power_score": 25,
    "background_match_score": 35,
    "career_path_score": 20,
    "scoring_explanation": "Strong match"
  }
}]}</format>

<critical>Output must be valid JSON only. No other text allowed.</critical>`;
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

        // Clean the response to ensure we only have JSON
        let cleanedResponse = raw
          .trim()
          // Remove markdown code blocks
          .replace(/^```json\s*|\s*```$/g, '')
          // Remove any non-JSON text before or after
          .replace(/^[^{]*/, '')
          .replace(/[^}]*$/, '')
          // Fix common JSON formatting issues
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/([^,{[:])\s*}/g, '$1}') // Fix missing commas
          .replace(/\n/g, ' ') // Remove newlines
          .trim();

        try {
          // First attempt: direct parse
          const parsed = JSON.parse(cleanedResponse);
          if (parsed && Array.isArray(parsed.connections)) {
            // Validate each connection object
            const validConnections = parsed.connections.filter(
              (conn: unknown) => {
                return (
                  conn &&
                  typeof conn === 'object' &&
                  typeof (conn as ConnectionResponse).name === 'string' &&
                  typeof (conn as ConnectionResponse).current_role ===
                    'string' &&
                  typeof (conn as ConnectionResponse).company === 'string' &&
                  (conn as ConnectionResponse).hiring_power &&
                  typeof (conn as ConnectionResponse).hiring_power ===
                    'object' &&
                  typeof (conn as ConnectionResponse).hiring_power.role_type ===
                    'string' &&
                  typeof (conn as ConnectionResponse).hiring_power
                    .can_hire_interns === 'boolean' &&
                  (conn as ConnectionResponse).exact_matches &&
                  typeof (conn as ConnectionResponse).exact_matches ===
                    'object' &&
                  (conn as ConnectionResponse).match_details &&
                  typeof (conn as ConnectionResponse).match_details ===
                    'object' &&
                  typeof (conn as ConnectionResponse).match_details
                    .total_percentage === 'number'
                );
              }
            );
            connections.push(...(validConnections as ConnectionResponse[]));
          } else {
            console.warn(
              'Invalid JSON structure from Claude. Skipping role:',
              role.title,
              '\nReceived:',
              cleanedResponse
            );
          }
        } catch (parseError) {
          console.error('First parse attempt failed:', parseError);

          // Second attempt: try to find and extract a valid JSON object
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const extracted = JSON.parse(jsonMatch[0]);
              if (extracted && Array.isArray(extracted.connections)) {
                const validConnections = extracted.connections.filter(
                  (conn: unknown) => {
                    return (
                      conn &&
                      typeof conn === 'object' &&
                      typeof (conn as ConnectionResponse).name === 'string' &&
                      typeof (conn as ConnectionResponse).current_role ===
                        'string' &&
                      typeof (conn as ConnectionResponse).company ===
                        'string' &&
                      (conn as ConnectionResponse).hiring_power &&
                      typeof (conn as ConnectionResponse).hiring_power ===
                        'object' &&
                      typeof (conn as ConnectionResponse).hiring_power
                        .role_type === 'string' &&
                      typeof (conn as ConnectionResponse).hiring_power
                        .can_hire_interns === 'boolean' &&
                      (conn as ConnectionResponse).exact_matches &&
                      typeof (conn as ConnectionResponse).exact_matches ===
                        'object' &&
                      (conn as ConnectionResponse).match_details &&
                      typeof (conn as ConnectionResponse).match_details ===
                        'object' &&
                      typeof (conn as ConnectionResponse).match_details
                        .total_percentage === 'number'
                    );
                  }
                );
                connections.push(...(validConnections as ConnectionResponse[]));
              }
            } catch (extractError) {
              console.error('Failed to parse extracted JSON:', extractError);
              console.error('Problematic JSON:', jsonMatch[0]);
            }
          } else {
            console.error('No valid JSON found in response');
            console.error('Raw response:', raw);
          }
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

    // Transform connections to match frontend interface
    const transformedConnections = sorted.map((conn) => ({
      id:
        conn.id ||
        `${conn.name}-${conn.company}`.replace(/\s+/g, '-').toLowerCase(),
      name: conn.name,
      imageUrl: '', // We don't have images yet
      matchPercentage: conn.match_details.total_percentage,
      matchReason: conn.outreach_strategy.unique_connection_angle,
      status: 'not_contacted',
      // Keep the original data for reference
      ...conn,
    }));

    console.log('API Response Structure:', {
      sample_connection: transformedConnections[0] || 'No connections found',
      total_connections: transformedConnections.length,
    });

    return new Response(
      JSON.stringify({
        response: {
          connections: transformedConnections,
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
