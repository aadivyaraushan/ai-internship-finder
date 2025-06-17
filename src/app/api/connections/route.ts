import { callClaude } from '../../../lib/anthropicClient';

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
          maxTokens: 800,
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
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/,\s*,/g, ',') // Fix double commas
          .replace(/}\s*{/g, '},{') // Fix object concatenation
          .replace(/]\s*\[/g, '],[') // Fix array concatenation
          .replace(/"\s*"/g, '","') // Fix string concatenation
          .replace(/:\s*:/g, ':') // Fix double colons
          .replace(/([{,])\s*}/g, '$1}') // Fix empty objects
          .replace(/\[\s*]/g, '[]') // Fix empty arrays
          .trim();

        try {
          // First attempt: direct parse
          const parsed = JSON.parse(cleanedResponse);
          if (parsed && Array.isArray(parsed.connections)) {
            const validConnections = parsed.connections.filter((conn: any) => {
              if (
                !conn ||
                typeof conn !== 'object' ||
                typeof conn.name !== 'string'
              ) {
                return false;
              }
              // Ensure type defaults to person if not provided
              conn.type = conn.type || 'person';
              // Basic match details requirement
              if (
                !conn.match_details ||
                typeof conn.match_details.total_percentage !== 'number'
              ) {
                conn.match_details = { total_percentage: 0 } as any;
              }
              return true;
            });
            connections.push(...validConnections);
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
          console.error('Problematic JSON:', cleanedResponse);

          // Second attempt: try to find and extract a valid JSON object
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              // Additional cleaning for the extracted JSON
              let extractedJson = jsonMatch[0]
                .replace(/,(\s*[}\]])/g, '$1')
                .replace(/([^,{[:])\s*}/g, '$1}')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/,\s*,/g, ',')
                .replace(/}\s*{/g, '},{')
                .replace(/]\s*\[/g, '],[')
                .replace(/"\s*"/g, '","')
                .replace(/:\s*:/g, ':')
                .replace(/([{,])\s*}/g, '$1}')
                .replace(/\[\s*]/g, '[]')
                .trim();

              const extracted = JSON.parse(extractedJson);
              if (extracted && Array.isArray(extracted.connections)) {
                const validConnections = extracted.connections.filter(
                  (conn: any) => {
                    if (
                      !conn ||
                      typeof conn !== 'object' ||
                      typeof conn.name !== 'string'
                    ) {
                      return false;
                    }
                    conn.type = conn.type || 'person';
                    if (
                      !conn.match_details ||
                      typeof conn.match_details.total_percentage !== 'number'
                    ) {
                      conn.match_details = { total_percentage: 0 } as any;
                    }
                    return true;
                  }
                );
                connections.push(...validConnections);
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

    // Deduplicate connections by name + type + company/org
    const unique = new Map<string, any>();
    for (const conn of connections) {
      const key = `${conn.type || 'person'}-${conn.name}-${
        (conn as any).company || (conn as any).organization || ''
      }`;
      if (!unique.has(key)) {
        unique.set(key, conn);
      }
    }

    // Sort by match percentage (fall back to 0)
    const sorted = Array.from(unique.values()).sort((a, b) => {
      return (
        (b.match_details?.total_percentage || 0) -
        (a.match_details?.total_percentage || 0)
      );
    });

    const stripCite = (str: string) =>
      typeof str === 'string' ? str.replace(/<cite[^>]*>|<\/cite>/g, '') : str;

    // Transform connections to match frontend interface
    const transformedConnections = sorted.map((conn) => {
      const isProgram = conn.type === 'program';
      const companyOrOrg =
        (conn as any).company || (conn as any).organization || '';
      return {
        id:
          conn.id ||
          `${conn.type || 'person'}-${conn.name}-${companyOrOrg}`
            .replace(/\s+/g, '-')
            .toLowerCase(),
        type: conn.type || 'person',
        name: stripCite(conn.name),
        imageUrl: '',
        matchPercentage: conn.match_details?.total_percentage || 0,
        matchReason: isProgram
          ? stripCite(
              (conn as any).how_this_helps || (conn as any).program_description
            )
          : stripCite(
              (conn as any).outreach_strategy?.unique_connection_angle || ''
            ),
        status: 'not_contacted',
        ...conn,
      };
    });

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
