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
  linkedin_url?: string;
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

function buildResumeAspectAnalyzerPrompt(resumeContext: string) {
  return `<system>You are an agent specialized in analyzing resumes and career goals to find key aspects for networking connections. You MUST return ONLY valid JSON matching the schema below EXACTLY. Do not include any other text or explanation.</system>
<input>
Resume Content:
${resumeContext}
</input>
<rules>
1. Extract ALL information that could create meaningful connections, considering BOTH resume AND career goals:
   - Educational institutions, years, fields of study
   - Companies worked at (especially startups/small firms)
   - ALL clubs, organizations, and activities mentioned
   - ALL certifications and awards listed
   - Career transitions or pivots mentioned
   - Areas where the candidate shows interest in growth
   - Skills and experiences that align with stated career goals
2. For each aspect found:
   - Include EXACT names as they appear in the resume or goals
   - Include ALL instances found, not just the most recent
   - If a field has no information, use empty array [] or empty string ""
   - For growth areas, consider both current skills and goal aspirations
3. NEVER skip or omit information found in either resume or goals
4. ALWAYS return ALL fields in the schema, even if empty
5. Pay special attention to:
   - Skills mentioned in goals that relate to resume experience
   - Industries/sectors from goals that match resume background
   - Career transitions indicated by goals vs current experience
</rules>
<schema>
{
  "connection_aspects": {
    "education": {
      "institutions": ["string"],
      "graduation_years": ["string"],
      "fields_of_study": ["string"]
    },
    "work_experience": {
      "companies": ["string"],
      "startup_experience": ["string"],
      "industry_transitions": {
        "from_industries": ["string"],
        "to_industries": ["string"],
        "transition_context": "string"
      }
    },
    "activities": {
      "clubs": ["string"],
      "organizations": ["string"],
      "volunteer_work": ["string"]
    },
    "achievements": {
      "certifications": ["string"],
      "awards": ["string"],
      "notable_projects": ["string"]
    },
    "growth_areas": {
      "developing_skills": ["string"],
      "target_roles": ["string"],
      "learning_journey": "string"
    }
  }
}
</schema>`;
}

function buildBackgroundInfoString(connectionAspects: any) {
  console.log('Building background info from aspects:', connectionAspects);

  const sections = [];

  if (connectionAspects.education?.institutions?.length > 0) {
    sections.push(
      `Educational background: ${connectionAspects.education.institutions.join(
        ', '
      )}`
    );
  }

  if (connectionAspects.work_experience?.companies?.length > 0) {
    sections.push(
      `Work experience: ${connectionAspects.work_experience.companies.join(
        ', '
      )}`
    );
  }

  if (connectionAspects.work_experience?.startup_experience?.length > 0) {
    sections.push(
      `Startup experience: ${connectionAspects.work_experience.startup_experience.join(
        ', '
      )}`
    );
  }

  if (
    connectionAspects.work_experience?.industry_transitions?.transition_context
  ) {
    sections.push(
      `Career transition context: ${connectionAspects.work_experience.industry_transitions.transition_context}`
    );
  }

  if (connectionAspects.activities?.organizations?.length > 0) {
    sections.push(
      `Organizations & activities: ${connectionAspects.activities.organizations.join(
        ', '
      )}`
    );
  }

  if (connectionAspects.achievements?.certifications?.length > 0) {
    sections.push(
      `Certifications & achievements: ${connectionAspects.achievements.certifications.join(
        ', '
      )}`
    );
  }

  if (connectionAspects.growth_areas?.learning_journey) {
    sections.push(
      `Learning & growth journey: ${connectionAspects.growth_areas.learning_journey}`
    );
  }

  console.log('Generated background sections:', sections);

  return sections.length > 0
    ? sections.map((section) => `- ${section}`).join('\n    ')
    : '- No background information available';
}

function buildConnectionFinderPrompt({
  roleTitle,
  goalTitles,
  connectionAspects,
}: {
  roleTitle: string;
  goalTitles?: string[];
  connectionAspects: any;
}) {
  const backgroundInfo = buildBackgroundInfoString(connectionAspects);
  console.log('Background info for connection finder:', backgroundInfo);

  return `<system>You are an agent specialized in finding relevant professional connections that MUST have direct background matches and career goal alignment. Return ONLY valid JSON matching the schema below EXACTLY.</system>
<input>
Target role: ${roleTitle}
Background information for matching:
    ${backgroundInfo}
${
  goalTitles?.length
    ? `\nCareer goals to consider for matching: ${goalTitles.join(', ')}`
    : ''
}
</input>
<rules>
1. Return up to 3 best potential matches (people or programs)
2. REQUIRED - each match MUST have BOTH:
   a) At least one direct background match (same institution, company, organization)
   b) Clear alignment with stated career goals
3. Optional strengthening factors:
   - Parallel experiences or transitions
   - Potential for meaningful mentorship
4. For people: Include name, current role, company, and their direct LinkedIn URL (linkedin_url)
5. For programs: Include name, organization, program type, website_url and why it's a fit for the candidate's career goals (how_this_helps)
6. Do NOT return any programs that are already mentioned in the candidate's resume (avoid duplicates)
7. REJECT any potential match missing either direct matches or goal alignment
</rules>
<schema>
{
  "connections": [
    {
      "type": "person",
      "name": "string",
      "current_role": "string",
      "company": "string",
      "linkedin_url": "string",
      "direct_matches": ["string"],
      "goal_alignment": "string",
      "additional_factors": ["string"]
    },
    {
      "type": "program",
      "name": "string",
      "organization": "string",
      "program_type": "string",
      "website_url": "string",
      "how_this_helps": "string",
      "direct_matches": ["string"],
      "goal_alignment": "string",
      "additional_factors": ["string"]
    }
  ]
}
</schema>`;
}

function buildMatchScorerPrompt(
  connection: any,
  connectionAspects: any,
  goals: string[]
) {
  const backgroundInfo = buildBackgroundInfoString(connectionAspects);
  console.log('Background info for match scorer:', backgroundInfo);

  return `<system>Return ONLY valid JSON. You are an agent specialized in scoring professional matches with emphasis on direct background matches and career goal alignment.</system>
<input>
Connection details: ${JSON.stringify(connection)}
Background information:
    ${backgroundInfo}
Career goals: ${goals.join(', ')}
</input>
<rules>
1. Score based on two MANDATORY criteria (70% of total score):
   a) Direct Background Matches (40%):
      - Same educational institutions
      - Same companies or organizations
      - Same certifications or achievements
      - Score of 0 here MUST result in total_percentage of 0
   b) Career Goal Alignment (30%):
      - Clear connection to stated career goals
      - Ability to help achieve these goals
      - Score of 0 here MUST result in total_percentage of 0

2. Score additional strengthening factors (30% of total score):
   - Parallel experiences or career transitions (20%)
   - Potential for meaningful mentorship (10%)

3. Scoring requirements:
   - total_percentage MUST be 0 if either direct matches or goal alignment is missing
   - Provide detailed explanation of all matches found and scoring rationale
   - Be strict with scoring - high scores should only be given for strong matches
</rules>
<schema>
{
  "match_details": {
    "total_percentage": 0,
    "direct_match_score": 0,
    "goal_alignment_score": 0,
    "additional_factors_score": 0,
    "direct_matches_found": [""],
    "goal_alignment_details": "",
    "scoring_explanation": ""
  }
}
</schema>`;
}

function buildStrategyGeneratorPrompt(
  connection: any,
  matchDetails: any,
  connectionAspects: any
) {
  const backgroundInfo = buildBackgroundInfoString(connectionAspects);
  console.log('Background info for strategy generator:', backgroundInfo);

  return `<system>Return ONLY valid JSON. You are an agent specialized in creating personalized outreach strategies based on confirmed matches and goals.</system>
<input>
Connection: ${JSON.stringify(connection)}
Match details: ${JSON.stringify(matchDetails)}
Background information:
    ${backgroundInfo}
</input>
<rules>
1. Prioritize direct matches in the outreach strategy:
   - Lead with the strongest shared background elements
   - Reference specific institutions, companies, or organizations you share
   - Highlight how your career goals align with their position/program
2. For programs:
   - Focus on application strategy emphasizing matching qualifications
   - Show clear understanding of program benefits for your goals
3. For people:
   - Create warm introduction leveraging shared background
   - Show genuine interest in their career path
4. Include specific talking points that demonstrate:
   - Knowledge of shared experiences
   - Understanding of their potential impact on your goals
   - Professional enthusiasm and preparation
</rules>
<schema>
{
  "outreach_strategy": {
    "shared_background_points": [""], // Lead with strongest direct matches
    "goal_alignment_points": [""], // How their position/program aligns with goals
    "suggested_approach": "", // Warm, professional outreach strategy
    "key_talking_points": [""] // Specific conversation starters
  }
}
</schema>`;
}

// Utility function to extract the first full JSON object/array from a string
function extractFirstJSON(raw: string): string | null {
  // Find first opening brace or bracket
  const firstObj = raw.indexOf('{');
  const firstArr = raw.indexOf('[');

  if (firstObj === -1 && firstArr === -1) return null;

  let start: number;
  let openChar: '{' | '[';
  let closeChar: '}' | ']';

  if (firstObj === -1) {
    start = firstArr;
    openChar = '[';
    closeChar = ']';
  } else if (firstArr === -1) {
    start = firstObj;
    openChar = '{';
    closeChar = '}';
  } else {
    // Choose whichever appears first in the string
    if (firstObj < firstArr) {
      start = firstObj;
      openChar = '{';
      closeChar = '}';
    } else {
      start = firstArr;
      openChar = '[';
      closeChar = ']';
    }
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const char = raw[i];

    if (inString) {
      if (!escaped && char === '"') {
        inString = false;
      }
      escaped = char === '\\' && !escaped;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  // If we reach here, we didn't find a matching close char; return null
  return null;
}

// Utility function to clean and parse JSON responses
function cleanAndParseJSON(raw: string) {
  console.log('\n🔍 Starting JSON parsing of raw response:', raw);

  if (!raw || typeof raw !== 'string') {
    console.error('❌ Invalid input to cleanAndParseJSON:', raw);
    return null;
  }

  try {
    // Remove markdown code fences if present
    let withoutFences = raw.replace(/```json\s*|```/g, '');

    // Attempt direct parse first
    try {
      const direct = JSON.parse(withoutFences.trim());
      console.log('✅ Direct parse successful');
      return direct;
    } catch {
      // fall-through
    }

    // Extract the first JSON substring (object or array)
    const jsonSubstring = extractFirstJSON(withoutFences);
    if (!jsonSubstring) {
      throw new Error('No JSON substring found');
    }

    console.log('➡️ Extracted JSON substring:', jsonSubstring);

    // Clean common issues before parse
    let cleaned = jsonSubstring
      // Remove non-standard whitespace characters
      .replace(/[\u2028\u2029\u0085]/g, ' ')
      // Fix single quotes to double quotes
      .replace(/'/g, '"')
      // Remove trailing commas before } or ]
      .replace(/,(\s*[}\]])/g, '$1')
      // Fix missing quotes around property names (best-effort)
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    console.log('🧹 Cleaned JSON substring:', cleaned);

    const parsed = JSON.parse(cleaned);
    console.log('✅ Parse successful after extraction');
    return parsed;
  } catch (error) {
    console.error('❌ JSON cleaning/parsing error:', error);
    console.error('Original input snippet:', raw.slice(0, 500));
    throw new Error('Failed to parse JSON response');
  }
}

// Helper function to infer the appropriate default response
function inferDefaultResponse(raw: string) {
  // Check the content to determine what kind of response we were expecting
  if (raw.includes('"connections"')) {
    return { connections: [] };
  } else if (raw.includes('"match_details"')) {
    return {
      match_details: {
        total_percentage: 0,
        scoring_explanation: 'Failed to parse match details',
        background_match_score: 0,
        goal_alignment_score: 0,
      },
    };
  } else if (raw.includes('"outreach_strategy"')) {
    return {
      outreach_strategy: {
        shared_background_points: [],
        suggested_approach: 'Failed to parse strategy',
        key_talking_points: [],
      },
    };
  } else if (raw.includes('"connection_aspects"')) {
    return {
      connection_aspects: {
        education: {
          institutions: [],
          graduation_years: [],
          fields_of_study: [],
        },
        work_experience: {
          companies: [],
          startup_experience: [],
          industry_transitions: {
            from_industries: [],
            to_industries: [],
            transition_context: '',
          },
        },
        activities: { clubs: [], organizations: [], volunteer_work: [] },
        achievements: { certifications: [], awards: [], notable_projects: [] },
        growth_areas: {
          developing_skills: [],
          target_roles: [],
          learning_journey: '',
        },
      },
    };
  }
  return {};
}

async function processConnectionWithAgents(
  connection: any,
  goals: string[],
  connectionAspects: any
): Promise<any> {
  console.log('\n🔄 Processing connection:', connection.name);

  try {
    // Step 1: Score the match
    console.log('📊 Starting match scoring for:', connection.name);
    const scoringPrompt = buildMatchScorerPrompt(
      connection,
      connectionAspects,
      goals
    );
    console.log('Scoring prompt:', scoringPrompt);

    const scoringResponse = await callClaude(scoringPrompt, {
      maxTokens: 2500,
    });
    console.log('Raw scoring response:', scoringResponse);

    const parsedScoring = cleanAndParseJSON(scoringResponse);
    console.log('Parsed scoring:', parsedScoring);

    if (!parsedScoring?.match_details) {
      console.error('❌ Invalid scoring response structure:', scoringResponse);
      throw new Error('Invalid scoring response');
    }
    const matchDetails = parsedScoring.match_details;
    console.log('✅ Match details:', matchDetails);

    // Step 2: Generate outreach strategy
    console.log('🤝 Starting strategy generation for:', connection.name);
    const strategyPrompt = buildStrategyGeneratorPrompt(
      connection,
      matchDetails,
      connectionAspects
    );
    console.log('Strategy prompt:', strategyPrompt);

    const strategyResponse = await callClaude(strategyPrompt, {
      maxTokens: 500,
    });
    console.log('Raw strategy response:', strategyResponse);

    const parsedStrategy = cleanAndParseJSON(strategyResponse);
    console.log('Parsed strategy:', parsedStrategy);

    if (!parsedStrategy?.outreach_strategy) {
      console.error(
        '❌ Invalid strategy response structure:',
        strategyResponse
      );
      throw new Error('Invalid strategy response');
    }
    const strategy = parsedStrategy.outreach_strategy;
    console.log('✅ Generated strategy:', strategy);

    const result = {
      ...connection,
      match_details: matchDetails,
      outreach_strategy: strategy,
    };
    console.log('✅ Successfully processed connection:', connection.name);
    return result;
  } catch (error) {
    console.error('❌ Error processing connection:', connection.name, error);
    return {
      ...connection,
      match_details: {
        total_percentage: 0,
        scoring_explanation: 'Failed to process match details',
        background_match_score: 0,
        goal_alignment_score: 0,
      },
      outreach_strategy: {
        shared_background_points: [],
        suggested_approach: 'Unable to generate strategy',
        key_talking_points: [],
      },
    };
  }
}

export async function POST(req: Request) {
  console.log('\n🚀 Starting connection search process');

  try {
    const body = await req.json();
    const {
      roles,
      resumeContext,
      goals,
    }: { roles: any[]; resumeContext?: string; goals?: Goal[] } = body;
    console.log('📝 Request details:', {
      roles: roles.map((r) => r.title),
      hasResume: !!resumeContext,
      goals: goals?.map((g) => g.title),
    });

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      console.error('❌ No roles provided in request');
      return new Response(
        JSON.stringify({ error: 'Selected roles are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!resumeContext) {
      console.error('❌ No resume context provided');
      return new Response(
        JSON.stringify({
          error: 'Resume context is required for personalized matching',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 1: Analyze resume for connection aspects
    console.log('📄 Starting resume analysis');
    console.log('Resume context:', resumeContext?.substring(0, 200) + '...');
    console.log(
      'Goals:',
      goals?.map((g) => ({ title: g.title, description: g.description }))
    );

    let connectionAspects = null;
    let retryCount = 0;
    const MAX_RETRIES = 2;

    while (retryCount <= MAX_RETRIES) {
      try {
        const aspectsPrompt = buildResumeAspectAnalyzerPrompt(resumeContext);
        console.log('Resume analysis prompt:', aspectsPrompt);

        const aspectsResponse = await callClaude(aspectsPrompt, {
          maxTokens: 1000,
        });
        console.log('Raw aspects response from Claude:', aspectsResponse);

        const parsedAspects = cleanAndParseJSON(aspectsResponse);

        if (!parsedAspects) {
          throw new Error('Failed to parse Claude response');
        }

        console.log('Parsed aspects result:', parsedAspects);

        if (!parsedAspects?.connection_aspects) {
          throw new Error(
            'Invalid aspects response - missing connection_aspects'
          );
        }

        // Validate the structure matches what we expect
        const expectedKeys = [
          'education',
          'work_experience',
          'activities',
          'achievements',
          'growth_areas',
        ];
        const missingKeys = expectedKeys.filter(
          (key) => !parsedAspects.connection_aspects[key]
        );

        if (missingKeys.length > 0) {
          throw new Error(
            `Missing required sections: ${missingKeys.join(', ')}`
          );
        }

        connectionAspects = parsedAspects.connection_aspects;
        break; // Success, exit the retry loop
      } catch (error) {
        console.error(`❌ Attempt ${retryCount + 1} failed:`, error);

        if (retryCount === MAX_RETRIES) {
          return new Response(
            JSON.stringify({
              error: 'Failed to analyze resume for matching criteria',
              details: error instanceof Error ? error.message : String(error),
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        retryCount++;
        console.log(
          `🔄 Retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`
        );
      }
    }

    // Log each section of the aspects to see what we got
    console.log('Connection aspects details:');
    console.log(
      '- Education:',
      JSON.stringify(connectionAspects.education, null, 2)
    );
    console.log(
      '- Work Experience:',
      JSON.stringify(connectionAspects.work_experience, null, 2)
    );
    console.log(
      '- Activities:',
      JSON.stringify(connectionAspects.activities, null, 2)
    );
    console.log(
      '- Achievements:',
      JSON.stringify(connectionAspects.achievements, null, 2)
    );
    console.log(
      '- Growth Areas:',
      JSON.stringify(connectionAspects.growth_areas, null, 2)
    );

    // Validate we have usable connection aspects before proceeding
    if (!connectionAspects || Object.keys(connectionAspects).length === 0) {
      console.error('❌ Connection aspects is empty or null after analysis');
      return new Response(
        JSON.stringify({
          error: 'Failed to extract meaningful information from resume',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const connections: any[] = [];
    console.log(
      '🔍 Starting role processing with connection aspects:',
      JSON.stringify(connectionAspects, null, 2)
    );

    for (const role of roles) {
      console.log('\n📋 Processing role:', role.title);
      try {
        // Step 2: Find initial connections using analyzed aspects
        const finderPrompt = buildConnectionFinderPrompt({
          roleTitle: role.title,
          goalTitles: goals?.map((g) => g.title) || [],
          connectionAspects,
        });
        console.log('Connection finder prompt:', finderPrompt);

        let finderResponse;
        let initialConnections: any[] = [];
        let retryCount = 0;
        const MAX_RETRIES = 2;

        while (retryCount <= MAX_RETRIES) {
          try {
            finderResponse = await callClaude(finderPrompt, {
              tools: [{ type: 'web_search_preview' }],
              maxTokens: 1000,
            });
            console.log('Raw finder response:', finderResponse);

            const parsedFinder = cleanAndParseJSON(finderResponse);
            console.log('Parsed finder response:', parsedFinder);

            if (
              !parsedFinder?.connections ||
              !Array.isArray(parsedFinder.connections)
            ) {
              throw new Error(
                'Invalid finder response - missing connections array'
              );
            }

            // Validate each connection has required fields
            for (const conn of parsedFinder.connections) {
              if (
                !conn.type ||
                !conn.name ||
                !conn.direct_matches ||
                !conn.goal_alignment
              ) {
                throw new Error(
                  'Invalid connection structure - missing required fields'
                );
              }

              if (
                conn.type === 'person' &&
                (!conn.current_role || !conn.company)
              ) {
                throw new Error(
                  'Invalid person connection - missing role or company'
                );
              }

              if (
                conn.type === 'program' &&
                (!conn.organization || !conn.program_type)
              ) {
                throw new Error(
                  'Invalid program connection - missing organization or type'
                );
              }

              // Ensure arrays are actually arrays
              if (!Array.isArray(conn.direct_matches)) {
                conn.direct_matches = [conn.direct_matches].filter(Boolean);
              }
              if (!Array.isArray(conn.additional_factors)) {
                conn.additional_factors = [conn.additional_factors].filter(
                  Boolean
                );
              }
            }

            initialConnections = parsedFinder.connections;
            console.log(
              '✅ Found valid connections:',
              initialConnections.length
            );
            break;
          } catch (error) {
            console.error(
              `❌ Connection finder attempt ${retryCount + 1} failed:`,
              error
            );

            if (retryCount === MAX_RETRIES) {
              console.error('❌ All connection finder attempts failed');
              continue; // Skip this role but continue with others
            }

            retryCount++;
            console.log(
              `🔄 Retrying connection finder... (Attempt ${retryCount + 1}/${
                MAX_RETRIES + 1
              })`
            );
          }
        }

        // Only proceed if we found valid connections
        if (initialConnections.length === 0) {
          console.log('⚠️ No valid connections found for role:', role.title);
          continue; // Skip to next role
        }

        // Step 3: Process each connection with specialized agents
        console.log('🔄 Starting connection processing for role:', role.title);
        for (const connection of initialConnections) {
          if (!connection?.name) {
            console.error('❌ Invalid connection structure:', connection);
            continue; // Skip invalid connections
          }
          try {
            const processedConnection = await processConnectionWithAgents(
              connection,
              goals?.map((g) => g.title) || [],
              connectionAspects
            );
            connections.push(processedConnection);
            console.log(
              '✅ Successfully processed connection:',
              connection.name
            );
          } catch (err) {
            console.error(
              '❌ Error processing connection:',
              connection.name,
              err
            );
            continue;
          }
        }
      } catch (err) {
        console.error('❌ Error processing role:', role.title, err);
        continue;
      }
    }

    // Deduplicate and transform connections
    console.log('🔄 Starting connection deduplication and transformation');
    console.log('Total connections before deduplication:', connections.length);

    // Deduplicate connections by name + type + company/org
    const unique = new Map<string, any>();
    for (const conn of connections) {
      const key = `${conn.type || 'person'}-${conn.name}-${
        conn.company || conn.organization || ''
      }`;
      if (
        !unique.has(key) ||
        (conn.match_details?.total_percentage || 0) >
          (unique.get(key).match_details?.total_percentage || 0)
      ) {
        unique.set(key, conn);
      }
    }

    // Filter out program connections that are already mentioned in the resume
    const filtered = Array.from(unique.values()).filter((conn) => {
      if (conn.type === 'program' && resumeContext) {
        const lcResume = resumeContext.toLowerCase();
        const name = (conn.name || '').toLowerCase();
        const org = (conn.organization || '').toLowerCase();
        return !lcResume.includes(name) && !lcResume.includes(org);
      }
      return true;
    });

    // Sort by match percentage
    const sorted = filtered.sort((a, b) => {
      return (
        (b.match_details?.total_percentage || 0) -
        (a.match_details?.total_percentage || 0)
      );
    });

    // Transform connections to match frontend interface
    const transformedConnections = sorted.map((conn) => ({
      id: `${conn.type || 'person'}-${conn.name}-${
        conn.company || conn.organization || ''
      }`
        .replace(/\s+/g, '-')
        .toLowerCase(),
      type: conn.type || 'person',
      name: conn.name,
      imageUrl: '',
      matchPercentage: conn.match_details?.total_percentage || 0,
      linkedin_url: conn.linkedin_url,
      status: 'not_contacted',
      current_role: conn.current_role,
      company: conn.company,
      program_description: conn.program_description,
      program_type: conn.program_type,
      organization: conn.organization,
      website_url: conn.website_url || conn.url,
      enrollment_info: conn.enrollment_info,
      how_this_helps: conn.how_this_helps,
      hiring_power: conn.hiring_power,
      exact_matches: conn.exact_matches,
      outreach_strategy: {
        shared_background_points:
          conn.outreach_strategy?.shared_background_points || [],
        suggested_approach: conn.outreach_strategy?.suggested_approach || '',
      },
    }));

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
