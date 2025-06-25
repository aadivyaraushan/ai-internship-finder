import { callClaude } from '../../../lib/anthropicClient';
import * as cheerio from 'cheerio';
import axios from 'axios';

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
  race,
  location,
}: {
  roleTitle: string;
  goalTitles?: string[];
  connectionAspects: any;
  race?: string;
  location?: string;
}) {
  const backgroundInfo = buildBackgroundInfoString(connectionAspects);
  console.log('Background info for connection finder:', backgroundInfo);

  return `<system>You are an agent specialized in finding relevant professional connections that MUST have direct background matches and career goal alignment. Return ONLY valid JSON matching the schema below EXACTLY.</system>
<input>
Target role: ${roleTitle}
Background information for matching:
    ${backgroundInfo}
${race ? `\nCandidate race/ethnicity: ${race}` : ''}
${location ? `\nCandidate location: ${location}` : ''}
${
  goalTitles?.length
    ? `\nCareer goals to consider for matching: ${goalTitles.join(', ')}`
    : ''
}
</input>
<rules>
1. Return up to 5 best potential matches (people or programs) making sure to include AT LEAST one person and one program, plus:
   - At least one peer-level connection (intern, entry-level or junior) who can refer the user to roles
   - At least one senior/managerial connection (e.g., hiring managers, mentors) who has influence over hiring decisions or can provide high-level guidance
2. REQUIRED - each match MUST have BOTH:
   a) At least one direct background match (same institution, company, organization)
   b) Clear alignment with stated career goals
3. Optional strengthening factors:
   - Parallel experiences or transitions
   - Potential for meaningful mentorship
4. For people: Include at minimum name, current role, and company (LinkedIn URL is NOT required at this stage)
5. For programs: Include name, organization, program type, website_url and why it's a fit for the candidate's career goals (how_this_helps)
6. Do NOT return any programs that are already mentioned in the candidate's resume (avoid duplicates)
7. If a program has explicit race/ethnicity eligibility requirements, ONLY include if they match the candidate race. Otherwise, exclude.
8. If a program requires on-site presence or is limited to a specific geographic location, ONLY include if it matches the candidate location.
9. REJECT any potential match missing either direct matches or goal alignment.
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
    // First, clean up any markdown or code block markers
    let cleaned = raw
      // Remove any markdown code block markers
      .replace(/```(?:json)?\s*|\s*```/g, '')
      // Remove any XML/HTML-like tags
      .replace(/<\/?[^>]+(>|$)/g, '')
      // Trim whitespace
      .trim();

    console.log('🧹 Initial cleaning:', cleaned);

    // Try direct parse first
    try {
      const direct = JSON.parse(cleaned);
      console.log('✅ Direct parse successful');
      return direct;
    } catch (directError) {
      console.log('⚠️ Direct parse failed, trying extraction:', directError);
    }

    // Extract the first JSON substring (object or array)
    const jsonSubstring = extractFirstJSON(cleaned);
    if (!jsonSubstring) {
      // If no JSON found, try more aggressive cleaning
      cleaned = cleaned
        // Remove non-standard whitespace characters
        .replace(/[\u2028\u2029\u0085]/g, ' ')
        // Fix single quotes to double quotes
        .replace(/'/g, '"')
        // Remove trailing commas before } or ]
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix missing quotes around property names (best-effort)
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Remove any remaining non-JSON characters at start/end
        .replace(/^[^{[]+/, '')
        .replace(/[^}\]]+$/, '');

      console.log('🧹 Aggressive cleaning result:', cleaned);

      // Try parsing again after aggressive cleaning
      try {
        const parsed = JSON.parse(cleaned);
        console.log('✅ Parse successful after aggressive cleaning');
        return parsed;
      } catch (error) {
        console.error('❌ All parsing attempts failed:', error);
        console.error('Final cleaned version:', cleaned);
        throw new Error('Failed to parse JSON response after all attempts');
      }
    }

    console.log('➡️ Extracted JSON substring:', jsonSubstring);

    // Clean the extracted JSON
    let cleanedJson = jsonSubstring
      // Remove non-standard whitespace characters
      .replace(/[\u2028\u2029\u0085]/g, ' ')
      // Fix single quotes to double quotes
      .replace(/'/g, '"')
      // Remove trailing commas before } or ]
      .replace(/,(\s*[}\]])/g, '$1')
      // Fix missing quotes around property names (best-effort)
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    console.log('🧹 Cleaned JSON substring:', cleanedJson);

    try {
      const parsed = JSON.parse(cleanedJson);
      console.log('✅ Parse successful after extraction and cleaning');
      return parsed;
    } catch (error) {
      // One last attempt: try to fix any remaining issues
      cleanedJson = cleanedJson
        // Remove any non-JSON characters at the start
        .replace(/^[^{[]+/, '')
        // Remove any non-JSON characters at the end
        .replace(/[^}\]]+$/, '')
        // Ensure property names are quoted
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Fix potential unescaped quotes in strings
        .replace(/(?<!\\)"/g, '\\"')
        .replace(/^/, '"')
        .replace(/$/, '"')
        .replace(/\\"{/g, '{')
        .replace(/\\"}$/g, '}');

      console.log('🧹 Final cleaning attempt:', cleanedJson);

      try {
        const parsed = JSON.parse(cleanedJson);
        console.log('✅ Parse successful after final cleaning');
        return parsed;
      } catch (finalError) {
        console.error('❌ All parsing attempts failed:', finalError);
        console.error('Final cleaned version:', cleanedJson);
        throw new Error('Failed to parse JSON response after all attempts');
      }
    }
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

// Add new scraping utilities
async function scrapeLinkedInProfile(url: string): Promise<{
  name?: string;
  currentRole?: string;
  company?: string;
  error?: string;
}> {
  try {
    // First try to get public data from LinkedIn
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const $ = cheerio.load(response.data);

    // Extract data from public profile
    // Note: These selectors might need adjustment based on LinkedIn's current structure
    const name = $('h1').first().text().trim();
    const currentRole = $('.experience-section .pv-entity__summary-info h3')
      .first()
      .text()
      .trim();
    const company = $('.experience-section .pv-entity__secondary-title')
      .first()
      .text()
      .trim();

    return { name, currentRole, company };
  } catch (error) {
    // If direct scraping fails, try to get data from Google's cached version
    try {
      const cachedUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(
        url
      )}`;
      const response = await axios.get(cachedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const $ = cheerio.load(response.data);

      const name = $('h1').first().text().trim();
      const currentRole = $('.experience-section .pv-entity__summary-info h3')
        .first()
        .text()
        .trim();
      const company = $('.experience-section .pv-entity__secondary-title')
        .first()
        .text()
        .trim();

      return { name, currentRole, company };
    } catch (cacheError) {
      return { error: 'Failed to scrape profile data' };
    }
  }
}

async function scrapeProgramWebsite(url: string): Promise<{
  programName?: string;
  organizationName?: string;
  programType?: string;
  pageText?: string;
  error?: string;
}> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const $ = cheerio.load(response.data);

    // Get all text content
    const pageText = $('body').text().toLowerCase();

    return {
      pageText,
    };
  } catch (error) {
    return { error: 'Failed to scrape program website' };
  }
}

async function findAndVerifyLinkedInUrl(
  connection: any
): Promise<string | null> {
  try {
    // First use web search to find potential LinkedIn URLs
    const searchQuery = `${connection.name} ${connection.current_role} ${connection.company} site:linkedin.com/in/`;
    const searchResponse = await callClaude(
      `<system>You are a LinkedIn profile URL finder. Return ONLY valid JSON.</system>
<input>
Search query: ${searchQuery}
Expected details:
- Name: ${connection.name}
- Role: ${connection.current_role}
- Company: ${connection.company}
</input>
<rules>
1. Use web_search to find LinkedIn profile URLs
2. Return up to 3 most likely profile URLs
3. URLs must be from linkedin.com/in/ or linkedin.com/pub/
4. Never fabricate URLs
</rules>
<schema>
{
  "potential_urls": ["string"]
}
</schema>`,
      {
        tools: [{ type: 'web_search_preview' }],
        maxTokens: 500,
      }
    );

    const result = cleanAndParseJSON(searchResponse);
    if (!result?.potential_urls?.length) {
      return null;
    }

    // Try to verify each URL by scraping
    for (const url of result.potential_urls) {
      const profileData = await scrapeLinkedInProfile(url);

      if (profileData.error) {
        console.warn(`Failed to scrape ${url}:`, profileData.error);
        continue;
      }

      // Check if scraped data matches our connection
      const nameMatch = profileData.name
        ?.toLowerCase()
        .includes(connection.name.toLowerCase());
      const roleMatch = profileData.currentRole
        ?.toLowerCase()
        .includes(connection.current_role.toLowerCase());
      const companyMatch = profileData.company
        ?.toLowerCase()
        .includes(connection.company.toLowerCase());

      if (nameMatch && roleMatch && companyMatch) {
        return url;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding LinkedIn URL:', error);
    return null;
  }
}

async function verifyProgramWebsite(connection: any): Promise<boolean> {
  try {
    if (!connection.website_url) return false;

    // Scrape the program website
    const websiteData = await scrapeProgramWebsite(connection.website_url);

    if (websiteData.error) {
      console.warn('Failed to scrape program website:', websiteData.error);
      return false;
    }

    // Use Claude to analyze the scraped content
    const analysisResponse = await callClaude(
      `<system>You are a program website validator. Analyze scraped website content to verify program details. Return ONLY valid JSON.</system>
<input>
Website content: ${websiteData.pageText}
Expected program:
- Name: ${connection.name}
- Organization: ${connection.organization}
- Type: ${connection.program_type}
</input>
<rules>
1. Analyze the website content for matches
2. Check if program name, organization, and type are mentioned
3. Return detailed validation results
</rules>
<schema>
{
  "validation": {
    "is_valid": boolean,
    "matches_found": {
      "program_name": boolean,
      "organization": boolean,
      "program_type": boolean
    },
    "explanation": string
  }
}
</schema>`,
      {
        maxTokens: 400,
      }
    );

    const result = cleanAndParseJSON(analysisResponse);
    return result?.validation?.is_valid || false;
  } catch (error) {
    console.error('Error verifying program website:', error);
    return false;
  }
}

function buildConnectionUrlFinderPrompt(connection: any) {
  return `<system>You are a research assistant that ONLY provides verified public profile URLs for the given person. Use web_search tool to find and verify candidates. Return ONLY valid JSON.</system>
<input>
Name: ${connection.name}
Current role: ${connection.current_role}
Company/Organization: ${connection.company}
</input>
<rules>
1. Use findAndVerifyLinkedInUrl to locate and verify their REAL LinkedIn profile
2. A valid profile MUST satisfy ALL:
   a) URL domain is linkedin.com/in/ or linkedin.com/pub/
   b) Profile name matches (allowing for middle names/initials)
   c) Current company matches (case-insensitive)
   d) Current role keywords match (e.g. "software engineer" matches "senior software engineer")
3. If no valid profile is found, set linkedin_url to null
4. Never hallucinate or fabricate URLs
5. Output MUST be ONLY the JSON matching the schema
</rules>
<schema>
{
  "linkedin_url": "string"
}
</schema>`;
}

interface ProfileData {
  name?: string;
  currentRole?: string;
  company?: string;
  error?: string;
  confidence?: {
    name: boolean;
    role: boolean;
    company: boolean;
  };
}

interface SharedActivity {
  name: string;
  year: string;
  type: string;
}

export async function POST(req: Request) {
  console.log('\n🚀 Starting connection search process');

  try {
    const body = await req.json();
    const {
      roles = [],
      resumeContext,
      goals,
      race,
      location,
    }: {
      roles?: any[];
      resumeContext?: string;
      goals?: Goal[];
      race?: string;
      location?: string;
    } = body;

    // Determine which targets (formerly roles) we should process
    const rolesToProcess =
      Array.isArray(roles) && roles.length > 0
        ? roles
        : (goals || []).map((g) => ({ title: g.title }));

    console.log('📝 Request details:', {
      roles: rolesToProcess.map((r) => r.title),
      hasResume: !!resumeContext,
      goals: goals?.map((g) => g.title),
    });

    // Ensure we have at least goals data to work with
    if ((!goals || goals.length === 0) && rolesToProcess.length === 0) {
      console.error('❌ No goals provided in request');
      return new Response(JSON.stringify({ error: 'Goals are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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

    for (const role of rolesToProcess) {
      console.log('\n📋 Processing role:', role.title);
      try {
        // Step 2: Find initial connections using analyzed aspects
        const finderPrompt = buildConnectionFinderPrompt({
          roleTitle: role.title,
          goalTitles: goals?.map((g) => g.title) || [],
          connectionAspects,
          race,
          location,
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

            // === SECOND PASS: verify / fetch URLs ===
            for (const conn of initialConnections) {
              if (conn.type === 'person') {
                try {
                  let verifiedUrl = null;
                  let attempts = 0;
                  const MAX_ATTEMPTS = 3; // Try up to 3 different search queries

                  while (!verifiedUrl && attempts < MAX_ATTEMPTS) {
                    // Build different search queries for each attempt
                    let searchQuery;
                    if (attempts === 0) {
                      searchQuery = `${conn.name} ${conn.current_role} ${conn.company} (site:linkedin.com/in/ OR site:github.com OR site:medium.com OR site:about.me OR site:personalwebsite)`;
                    } else if (attempts === 1) {
                      // Try with just name and company
                      searchQuery = `${conn.name} ${conn.company} profile contact`;
                    } else {
                      // Try with name and role keywords
                      const roleKeywords = conn.current_role
                        .split(' ')
                        .filter(
                          (word: string) =>
                            ![
                              'the',
                              'a',
                              'an',
                              'and',
                              'or',
                              'but',
                              'in',
                              'on',
                              'at',
                              'to',
                              'for',
                            ].includes(word.toLowerCase())
                        )
                        .join(' ');
                      searchQuery = `${conn.name} ${roleKeywords} contact profile`;
                    }

                    const urlPrompt = `<system>You are a professional profile URL finder. Return ONLY valid JSON.</system>
<input>
Search query: ${searchQuery}
Expected details:
- Name: ${conn.name}
- Role: ${conn.current_role}
- Company: ${conn.company}
</input>
<rules>
1. Use web_search to find professional profile URLs
2. Return up to 5 most likely profile URLs
3. Accept URLs from:
   - LinkedIn (linkedin.com/in/ or linkedin.com/pub/)
   - Personal websites
   - Professional portfolios
   - GitHub profiles
   - Medium profiles
   - Company team/about pages
   - Professional social networks
4. Never fabricate URLs
5. Order results by likelihood of match
6. Include source_type for each URL to indicate what kind of profile it is
</rules>
<schema>
{
  "potential_urls": [
    {
      "url": "string",
      "source_type": "string"
    }
  ]
}
</schema>`;

                    const urlResp = await callClaude(urlPrompt, {
                      tools: [{ type: 'web_search_preview' }],
                      maxTokens: 400,
                    });

                    console.log('Raw URL response from Claude:', urlResp);

                    let parsedUrl = null;
                    try {
                      parsedUrl = cleanAndParseJSON(urlResp);
                      if (!parsedUrl) {
                        console.warn(
                          '⚠️ Failed to parse URL response:',
                          urlResp
                        );
                        // Try to extract URLs directly from the response using regex
                        const urlMatches = urlResp.match(
                          /https?:\/\/[^\s"'<>()[\]]+/g
                        );
                        if (urlMatches) {
                          parsedUrl = {
                            potential_urls: urlMatches.map((url) => ({
                              url,
                              source_type: url.includes('linkedin.com')
                                ? 'linkedin'
                                : url.includes('github.com')
                                ? 'github'
                                : url.includes('medium.com')
                                ? 'medium'
                                : 'other',
                            })),
                          };
                          console.log(
                            '📝 Extracted URLs directly from response:',
                            parsedUrl.potential_urls
                          );
                        }
                      }
                    } catch (parseError) {
                      console.error(
                        '❌ Error parsing URL response:',
                        parseError
                      );
                      const urlMatches = urlResp.match(
                        /https?:\/\/[^\s"'<>()[\]]+/g
                      );
                      if (urlMatches) {
                        parsedUrl = {
                          potential_urls: urlMatches.map((url) => ({
                            url,
                            source_type: url.includes('linkedin.com')
                              ? 'linkedin'
                              : url.includes('github.com')
                              ? 'github'
                              : url.includes('medium.com')
                              ? 'medium'
                              : 'other',
                          })),
                        };
                        console.log(
                          '📝 Extracted URLs directly from response:',
                          parsedUrl.potential_urls
                        );
                      }
                    }

                    if (parsedUrl?.potential_urls?.length > 0) {
                      // Try each URL until we find a match
                      for (const urlData of parsedUrl.potential_urls) {
                        const url =
                          typeof urlData === 'string' ? urlData : urlData.url;
                        const sourceType =
                          typeof urlData === 'string'
                            ? url.includes('linkedin.com')
                              ? 'linkedin'
                              : url.includes('github.com')
                              ? 'github'
                              : url.includes('medium.com')
                              ? 'medium'
                              : 'other'
                            : urlData.source_type;

                        console.log(
                          `🔍 Attempting to verify URL (attempt ${
                            attempts + 1
                          }):`,
                          { url, sourceType }
                        );

                        try {
                          let profileData: ProfileData;
                          if (sourceType === 'linkedin') {
                            profileData = await scrapeLinkedInProfile(url);
                          } else {
                            // For non-LinkedIn URLs, use a general scraping approach
                            console.log(`🔍 Scraping non-LinkedIn URL: ${url}`);
                            const response = await axios.get(url, {
                              headers: {
                                'User-Agent':
                                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                              },
                              timeout: 10000, // 10 second timeout
                            });

                            console.log(
                              `✅ Got response from ${url}, status: ${response.status}`
                            );
                            const $ = cheerio.load(response.data);

                            // Get text content from important elements first
                            const titleText = $('title').text().toLowerCase();
                            const h1Text = $('h1')
                              .map((_, el) => $(el).text())
                              .get()
                              .join(' ')
                              .toLowerCase();
                            const metaDescription =
                              $('meta[name="description"]')
                                .attr('content')
                                ?.toLowerCase() || '';
                            const bodyText = $('body').text().toLowerCase();

                            console.log('Scraped content:', {
                              title: titleText,
                              h1: h1Text,
                              metaDescription:
                                metaDescription.substring(0, 100) + '...',
                              bodyLength: bodyText.length,
                            });

                            // Look for name and company/role matches in the page content
                            const searchTerms = {
                              name: conn.name.toLowerCase(),
                              role: conn.current_role.toLowerCase(),
                              company: conn.company.toLowerCase(),
                              // Add variations of the name
                              nameVariations: [
                                conn.name.toLowerCase(),
                                conn.name.toLowerCase().replace(/\s+/g, ''),
                                conn.name.toLowerCase().split(' ')[0], // First name
                                conn.name.toLowerCase().split(' ').pop(), // Last name
                              ],
                              // Add variations of the role
                              roleKeywords: conn.current_role
                                .toLowerCase()
                                .split(' ')
                                .filter(
                                  (word: string) =>
                                    ![
                                      'the',
                                      'a',
                                      'an',
                                      'and',
                                      'or',
                                      'but',
                                      'in',
                                      'on',
                                      'at',
                                      'to',
                                      'for',
                                    ].includes(word)
                                ),
                            };

                            console.log('Searching for terms:', searchTerms);

                            // Check for matches in different parts of the page
                            const matches = {
                              nameInTitle: searchTerms.nameVariations.some(
                                (name: string) => titleText.includes(name)
                              ),
                              nameInH1: searchTerms.nameVariations.some(
                                (name: string) => h1Text.includes(name)
                              ),
                              nameInMeta: searchTerms.nameVariations.some(
                                (name: string) => metaDescription.includes(name)
                              ),
                              nameInBody: searchTerms.nameVariations.some(
                                (name: string) => bodyText.includes(name)
                              ),
                              roleInBody: searchTerms.roleKeywords.some(
                                (keyword: string) => bodyText.includes(keyword)
                              ),
                              companyInBody: bodyText.includes(
                                searchTerms.company
                              ),
                            };

                            console.log('Content matches:', matches);

                            // More lenient matching logic
                            const nameFound =
                              matches.nameInTitle ||
                              matches.nameInH1 ||
                              matches.nameInMeta ||
                              matches.nameInBody;
                            const roleOrCompanyFound =
                              matches.roleInBody || matches.companyInBody;

                            profileData = {
                              name: nameFound ? conn.name : undefined,
                              currentRole: matches.roleInBody
                                ? conn.current_role
                                : undefined,
                              company: matches.companyInBody
                                ? conn.company
                                : undefined,
                              error: !nameFound
                                ? 'Name not found in content'
                                : undefined,
                              confidence: {
                                name: nameFound,
                                role: matches.roleInBody,
                                company: matches.companyInBody,
                              },
                            };
                          }

                          if (!profileData.error) {
                            // Check if scraped data matches our connection
                            const nameMatch =
                              profileData.name
                                ?.toLowerCase()
                                .includes(conn.name.toLowerCase()) ||
                              profileData.confidence?.name === true;
                            const roleMatch =
                              profileData.currentRole
                                ?.toLowerCase()
                                .includes(conn.current_role.toLowerCase()) ||
                              profileData.confidence?.role === true;
                            const companyMatch =
                              profileData.company
                                ?.toLowerCase()
                                .includes(conn.company.toLowerCase()) ||
                              profileData.confidence?.company === true;

                            console.log('Profile data comparison:', {
                              source: sourceType,
                              found: {
                                name: profileData.name,
                                role: profileData.currentRole,
                                company: profileData.company,
                                confidence: profileData.confidence,
                              },
                              expected: {
                                name: conn.name,
                                role: conn.current_role,
                                company: conn.company,
                              },
                              matches: {
                                name: nameMatch,
                                role: roleMatch,
                                company: companyMatch,
                              },
                            });

                            // Much more lenient matching for non-LinkedIn sources
                            const isMatch =
                              sourceType === 'linkedin'
                                ? nameMatch && (roleMatch || companyMatch) // LinkedIn needs stronger verification
                                : nameMatch || // For other sources, just need some confidence
                                  (url
                                    .toLowerCase()
                                    .includes(
                                      conn.name
                                        .toLowerCase()
                                        .replace(/\s+/g, '')
                                    ) &&
                                    (roleMatch ||
                                      companyMatch ||
                                      url
                                        .toLowerCase()
                                        .includes(
                                          conn.company
                                            .toLowerCase()
                                            .replace(/\s+/g, '')
                                        )));

                            if (isMatch) {
                              verifiedUrl = url;
                              conn.profile_source = sourceType;
                              conn.match_confidence = {
                                name: nameMatch,
                                role: roleMatch,
                                company: companyMatch,
                              };
                              console.log(
                                `✅ Found and verified ${sourceType} profile for:`,
                                conn.name
                              );
                              break;
                            } else {
                              console.log(
                                `❌ Profile data mismatch for ${sourceType}`
                              );
                            }
                          } else {
                            console.warn(
                              '⚠️ Failed to scrape URL:',
                              url,
                              profileData.error
                            );
                          }
                        } catch (error: any) {
                          console.error('❌ Error during profile scraping:', {
                            url,
                            error: error.message,
                            stack: error.stack,
                          });
                          continue;
                        }
                      }
                    } else {
                      console.warn(
                        '⚠️ No valid URLs found in response for attempt',
                        attempts + 1
                      );
                    }

                    if (verifiedUrl) {
                      break; // Found a match, exit attempt loop
                    }

                    attempts++;
                    if (attempts < MAX_ATTEMPTS) {
                      console.log(
                        `⏳ No match found, trying different search query (attempt ${
                          attempts + 1
                        }/${MAX_ATTEMPTS})`
                      );
                      // Add a small delay between attempts to avoid rate limiting
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                    }
                  }

                  if (verifiedUrl) {
                    conn.linkedin_url = verifiedUrl;
                  } else {
                    console.warn(
                      '⚠️ Could not verify any LinkedIn profile for:',
                      conn.name
                    );
                    conn.linkedin_url = null;
                  }
                } catch (e) {
                  console.warn('❌ URL verification failed for:', conn.name, e);
                }
              } else if (conn.type === 'program' && conn.website_url) {
                try {
                  // Verify program website by scraping
                  const websiteData = await scrapeProgramWebsite(
                    conn.website_url
                  );
                  if (!websiteData.error) {
                    // Use Claude to analyze the scraped content
                    const analysisResponse = await callClaude(
                      `<system>You are a program website validator. Analyze scraped website content to verify program details. Return ONLY valid JSON.</system>
<input>
Website content: ${websiteData.pageText}
Expected program:
- Name: ${conn.name}
- Organization: ${conn.organization}
- Type: ${conn.program_type}
</input>
<rules>
1. Analyze the website content for matches
2. Check if program name, organization, and type are mentioned
3. Return detailed validation results
</rules>
<schema>
{
  "validation": {
    "is_valid": boolean,
    "matches_found": {
      "program_name": boolean,
      "organization": boolean,
      "program_type": boolean
    },
    "explanation": string
  }
}
</schema>`,
                      {
                        maxTokens: 400,
                      }
                    );

                    const result = cleanAndParseJSON(analysisResponse);
                    if (!result?.validation?.is_valid) {
                      console.warn(
                        '⚠️ Invalid program website:',
                        conn.website_url
                      );
                      conn.website_url = null;
                    }
                  } else {
                    console.warn(
                      '⚠️ Failed to scrape program website:',
                      conn.website_url
                    );
                    conn.website_url = null;
                  }
                } catch (e) {
                  console.warn('❌ Program verification failed:', e);
                }
              }
            }

            // Filter out connections with failed verifications
            initialConnections = initialConnections.filter((conn) => {
              if (conn.type === 'person') {
                // Keep person connections that either have a verified LinkedIn URL or don't need one
                return conn.linkedin_url || !conn.current_role || !conn.company;
              } else if (conn.type === 'program') {
                // Keep program connections that either have a verified website or don't need one
                return (
                  !conn.website_url || (conn.website_url && conn.organization)
                );
              }
              return false;
            });

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
    const transformedConnections = sorted.map((conn) => {
      // Generate a description based on connection type and match details
      let description = '';
      if (conn.type === 'person') {
        const matchPoints = [];

        // Add direct matches if available
        if (conn.direct_matches?.length > 0) {
          matchPoints.push(`Direct matches: ${conn.direct_matches.join(', ')}`);
        }

        // Add goal alignment
        if (conn.goal_alignment) {
          matchPoints.push(conn.goal_alignment);
        }

        // Add hiring power details if available
        if (conn.hiring_power) {
          const hiringDetails = [];
          if (conn.hiring_power.role_type) {
            hiringDetails.push(conn.hiring_power.role_type);
          }
          if (conn.hiring_power.department) {
            hiringDetails.push(`in ${conn.hiring_power.department}`);
          }
          if (conn.hiring_power.can_hire_interns) {
            hiringDetails.push('can hire interns');
          }
          if (hiringDetails.length > 0) {
            matchPoints.push(`Hiring capacity: ${hiringDetails.join(', ')}`);
          }
        }

        // Add exact matches if available
        if (conn.exact_matches) {
          if (conn.exact_matches.education?.university) {
            matchPoints.push(
              `Attended ${conn.exact_matches.education.university}`
            );
          }
          if (conn.exact_matches.shared_activities?.length > 0) {
            const activities = conn.exact_matches.shared_activities
              .map((act: SharedActivity) => `${act.name} (${act.year})`)
              .join(', ');
            matchPoints.push(`Shared activities: ${activities}`);
          }
        }

        description = matchPoints.join('. ');
      } else if (conn.type === 'program') {
        const programPoints = [];

        // Add direct matches if available
        if (conn.direct_matches?.length > 0) {
          programPoints.push(
            `Matches your background: ${conn.direct_matches.join(', ')}`
          );
        }

        // Add goal alignment
        if (conn.goal_alignment) {
          programPoints.push(conn.goal_alignment);
        }

        // Add program description
        if (conn.program_description) {
          programPoints.push(conn.program_description);
        }

        // Add how this helps
        if (conn.how_this_helps) {
          programPoints.push(conn.how_this_helps);
        }

        // Add enrollment info if available
        if (conn.enrollment_info) {
          programPoints.push(`Enrollment: ${conn.enrollment_info}`);
        }

        description = programPoints.join('. ');
      }

      // If no description was generated, use match details
      if (!description && conn.match_details?.scoring_explanation) {
        description = conn.match_details.scoring_explanation;
      }

      return {
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
        description: description || 'No additional details available',
      };
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
