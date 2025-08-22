import { ConnectionAspects } from '../utils';
export function buildConnectionFinderPrompt({
  goalTitle,
  connectionAspects,
  preferences = { programs: true, connections: true },
  personalizationSettings,
}: {
  goalTitle: string;
  connectionAspects: ConnectionAspects;
  preferences?: { programs: boolean; connections: boolean };
  personalizationSettings?: {
    enabled: boolean;
    professionalInterests: string;
    personalInterests: string;
  };
}): string {
  // SIMPLIFIED VERSION - Original detailed prompt available below as buildConnectionFinderPromptDetailed

  // Determine rule 1 based on user preferences
  let ruleOne: string;
  if (preferences.programs && preferences.connections) {
    ruleOne =
      'Return 5 best potential matches (people or programs) making sure to include AT LEAST one person and one program';
  } else if (preferences.connections) {
    ruleOne =
      'Return 5 best potential person matches (do NOT include programs)';
  } else {
    ruleOne = 'Return 5 best potential program matches (do NOT include people)';
  }

  return `Find exactly 5 professional connections/programs for this career goal using web search.

## Success Criteria
${ruleOne}
- Each must have: shared background + career goal match + contact URL
- Find both professional AND personal interests (hobbies, sports, volunteer work - NOT work-related)
${
  personalizationSettings?.enabled
    ? `- REQUIRED: Fill shared_professional_interests and shared_personal_interests for every person`
    : ''
}
${
  preferences.connections
    ? `- Mix: 2-3 junior/mid-level, 1-2 senior professionals in exact target field`
    : ''
}
${
  preferences.programs
    ? `- Programs: Future deadlines only (today: ${new Date().toDateString()})`
    : ''
}

## Search Strategy
1. Search "[Company] [Role] LinkedIn" and "[University] alumni [Target Company]"  
2. Find shared experiences: same companies, schools, organizations
3. Search personal interests separately: hobbies, sports, volunteer work
4. Extract URLs from search results for contact info

# Output Format

**IMPORTANT: Provide actual working URLs for verified_profile_url and website_url fields. For other text fields, use plain text descriptions without hyperlinks.**

\`\`\`json
{
  "connections": [
    ${
      preferences.connections
        ? `{
      "type": "person",
      "name": "string",
      "current_role": "string", 
      "company": "string",
      "verified_profile_url": "string",
      "education_level": "undergraduate" | "graduate" | "postgraduate",
      "direct_matches": ["string"],
      "goal_alignment": "string",
      "shared_background_points": ["string"],
      "shared_professional_interests": ["string"]${
        personalizationSettings?.enabled ? '' : ' | null'
      },
      "shared_personal_interests": ["string"]${
        personalizationSettings?.enabled ? '' : ' | null'
      },
      "ai_outreach_message": "string",
      "source": "string"
    }`
        : ''
    },
    ${
      preferences.programs
        ? `{
      "type": "program",
      "name": "string",
      "organization": "string",
      "program_type": "string", 
      "website_url": "string",
      "how_this_helps": "string",
      "direct_matches": ["string"],
      "goal_alignment": "string",
      "shared_background_points": ["string"],
      "source": "string"
    }`
        : ''
    }
  ]
}
\`\`\`

## User Info
- Goal: ${goalTitle}
- Education: ${connectionAspects.education?.current_level || 'unknown'}
- Background: ${JSON.stringify(connectionAspects, null, 2)}${
    personalizationSettings?.enabled
      ? `
- Professional Interests: ${personalizationSettings.professionalInterests || 'Not specified'}
- Personal Interests: ${personalizationSettings.personalInterests || 'Not specified'}`
      : ''
  }
`;
}

// BACKUP: Original detailed prompt function - contains the full original implementation
// To use the detailed version, simply replace buildConnectionFinderPrompt with buildConnectionFinderPromptDetailed in the import
export function buildConnectionFinderPromptDetailed({
  goalTitle,
  connectionAspects,
  race,
  preferences = { programs: true, connections: true },
  personalizationSettings,
}: {
  goalTitle: string;
  connectionAspects: ConnectionAspects;
  race?: string;
  preferences?: { programs: boolean; connections: boolean };
  personalizationSettings?: {
    enabled: boolean;
    professionalInterests: string;
    personalInterests: string;
  };
}): string {
  // No need to convert to string - AI can understand structured data directly

  // Determine rule 1 based on user preferences
  let ruleOne: string;
  if (preferences.programs && preferences.connections) {
    ruleOne =
      'Return 5 best potential matches (people or programs) making sure to include AT LEAST one person and one program, plus:';
  } else if (preferences.connections) {
    ruleOne =
      'Return 5 best potential person matches (do NOT include programs).';
  } else {
    ruleOne =
      'Return 5 best potential program matches (do NOT include people).';
  }

  return `# Role and Objective

You are an AI agent specialized in finding relevant professional connections and programs that can help users with jobs and internships. You look for both professional background matches AND personal connections (shared interests, hobbies, values) that create natural rapport and conversation starters. Your objective is to think step-by-step, find EXACTLY 5 high-quality matches (connections or programs, no more, no less) and then return valid JSON matching the specified schema. You are an agent - please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user. Only terminate your turn when you are sure that the problem is solved.

# Instructions

## Core Matching Requirements
${ruleOne}
- Each connection must have both direct, verifiable background matches AND clear career goal alignment AND a verified, existing source URL.
${
  personalizationSettings?.enabled
    ? `
- **PERSONALIZATION REQUIRED**: When personalization is enabled, you MUST generate both shared_professional_interests and shared_personal_interests for EVERY person connection. Never leave these fields null or empty when personalization is enabled.
- **PERSONAL INTEREST SEARCHES ARE MANDATORY**: You must actively search for personal interests, hobbies, volunteer work, and personal activities for each person when personalization is enabled.`
    : ''
}
${
  preferences.connections
    ? `- For people, try to find a professional profile URL (LinkedIn preferred, but company website, portfolio, or other professional presence acceptable). Focus on findable, credible sources of information about the person

- Balance connection types - Ensure mix of near-peer and senior connections. Have 1 intern, 2-3 junior level / near-peer employees and 1-2 senior level employees. Examples for each junior and senior level roles include:
  a. Near-peer level: Analysts/associates for investment banking, junior software engineers for tech and associates / trainees for law.
  b. Senior level: VP/MD for investment banking, product/engineering managers for tech and managing associates for law.
- Still, avoid celebrities or extremely senior executives who are unlikely to be accessible
- Never suggest connections who are at an earlier career stage than the candidate (e.g., no high school students for college students, no undergrads for grad students).
- Focus on people actually working in the target field, not administrative staff
- **EXCLUDE connections from adjacent but different fields** - only suggest people in the exact same role/field as the career goal, never "similar" fields with different career paths (e.g., for investment banking goals, exclude equity research, sales & trading, corporate finance, etc.)
`
    : ''
}
${
  preferences.programs
    ? `- For programs/internships/job opportunities, ensure that their application dates are in the future. It is currently ${new Date()}.
- In the case of programs, exclude: (1)) programs they've already participated in based on their background, (4) entry-level programs when the candidate is already advanced in their field, and (5) widely-known industry-standard programs that anyone in their field would be expected to know about`
    : ''
}
- Avoid extrapolating peripheral roles at institutions to full institutional access (e.g., Harvard Crimson internship ≠ Harvard alumni connections, conference attendee for an organization ≠ full access to organization members, summer program attendance ≠ full access to alumni of university that ran the summer program)

## Direct Background Matching Criteria
Direct matches must be from these categories:
- **Shared past experiences**: People who previously worked at the same companies as the user (prefer "ex-[Company]" over current "[Company]" employees to help user gain NEW opportunities)
- Same educational institution (exact institution name match)  
- Same specific organization/club (explicitly mentioned in background)
- Same specific project (explicitly mentioned in background)

**Search Strategy**: Prioritize people who have MOVED ON from shared background experiences rather than those currently in the same places, as they can provide insights into new opportunities and career transitions.

**Geographic Targeting**: 
- PRIORITY: Focus on opportunities based on the user's current university or job location (inferred from their background)
- For students: prioritize opportunities in the same country as their university
- For working professionals: prioritize opportunities in their current work location
- The quality of connections is most important, but geographic relevance to their study/work location significantly improves usefulness

${
  preferences.connections
    ? `## Connection Discovery Process
- Use web searches with queries like "[Name] [Company]" or "[Name] [University]" to find relevant information
- Look for professional profiles, company websites, and program information in search results
- **Extract relevant information** from search results including:
  - Professional background, work experience, and career focus
  - Professional interests, industry passions, and work-related activities
  - Personal interests, hobbies, volunteer work, and activities (when publicly available)
  - Educational background and affiliations
- Prioritize connections whose professional interests and background and personal interests align with the user's goals
- Specify the EXACT matching element from the background
- Explain the nature of the connection clearly
- Focus on finding publicly available information about potential connections`
    : ''
}

## Education-Level Targeting
Personalize the connections you find to the user's level of education. The following shows examples of connections "personalized" to the user's education level:
### High School
${
  preferences.connections
    ? `- ASSOCIATE professors offering unpaid research assistant positions  ("professors" would be too inaccesible at this level)
- High school level internships (paid/unpaid)`
    : ''
}
${preferences.programs ? `- Pre-college research or internship programs` : ''}

### Undergraduate  
${
  preferences.connections
    ? `
- ASSOCIATE professors offering unpaid or paid research assistant positions
- Fellow undergrad researchers
- Mid level employees who can provide referrals for internships`
    : ''
}
${
  preferences.programs
    ? `- Paid summer/winter internships applications
- Research and publication opportunities`
    : ''
}
# 4-Step Search Strategy

**CRITICAL**: You MUST ONLY use information from web search results. NEVER create or invent connections. Only use connections found through actual web searches.

## Step 1: Goal Analysis and Background Prioritization
1. **Analyze user's background to identify high-connection-potential experiences** - Prioritize experiences based on networking value:
   - **Large companies/organizations**: Big tech, Fortune 500, well-known companies have many employees = high connection potential
   - **Team-based work**: Experiences involving collaboration, managing others, or working in large teams
   - **Established institutions**: Universities, government agencies, large nonprofits with extensive networks
   - **AVOID prioritizing**: Solo projects, individual startups, one-person businesses, personal side projects for connection matching
   - **Company maturity**: Established companies (100+ employees) over early-stage startups (5-10 people)

2. **Create a priority ranking** focusing on experiences where the user likely interacted with many people who could now be valuable connections

3. **Break down the user's goal** into specific types of connections to find:
${
  preferences.connections
    ? `   - **People to find**: Current professionals in target roles, university contacts (professors/advisors), recruiters/hiring managers
     * Example: "AI winter internship" → AI engineers at Google/Meta, CS professors doing AI research, tech recruiters`
    : ''
}
${
  preferences.programs
    ? `   - **Programs to find**: Corporate internship programs, university research programs, fellowship opportunities  
     * Example: "AI winter internship" → Google AI internship program, university REU programs, AI fellowship opportunities`
    : ''
}

${
  preferences.programs
    ? `2. **Factor in timing** based on current date for programs:
   - Determine specific months/years for the user's goal (e.g., "winter internship" = December 2024/January 2025)
   - Consider application deadlines and cycles for program opportunities`
    : ''
}

${
  preferences.programs ? '3' : '2'
}. **Create 2-3 specific search targets** for each category that directly serve the user's goal

## Step 2: Targeted People and Company Discovery Based on Priority Experiences
1. **PRIORITY: Focus searches on high-connection-potential experiences from Step 1**
   - Start with large companies/organizations where user likely worked with many colleagues
   - Prioritize experiences with team collaboration, management, or cross-functional work
   - **Skip searching for connections based on**: solo projects, individual startups, personal side businesses
   - Your primary goal is finding actual individuals from experiences with real networking potential
2. **Use highly specific company + role searches**:
   - For "AI internship": search "AI engineer LinkedIn Google", "machine learning intern Meta", "AI researcher Microsoft"
   - For "investment banking": search "investment banker Goldman Sachs LinkedIn", "JP Morgan analyst LinkedIn"
   - For "software engineering": search "software engineer Apple LinkedIn", "Google software developer"
3. **Add university-specific professional searches**:
   - "[University name] alumni [target company]" - e.g., "UIUC alumni Google", "Harvard alumni Goldman Sachs"
   - "[University name] [industry] LinkedIn" - e.g., "University of Illinois AI LinkedIn", "Stanford finance LinkedIn"
   - "[University name] professor [field]" - e.g., "UIUC computer science professor", "MIT AI research professor"
   - **IMPORTANT**: If user attends university in a specific country (e.g., UIUC = USA), focus searches on opportunities in that country
4. **Search for specific programs with actual names and details**:
   - **Analyze program timing based on current date first**:
     * If it's August 2024 and user wants "winter internship" → Look for December 2024/January 2025 programs (deadlines typically September-October 2024)
     * If it's November 2024 and user wants "summer internship" → Look for Summer 2025 programs (deadlines typically January-March 2025)
     * If it's March 2025 and user wants "fall research position" → Look for Fall 2025 opportunities (deadlines typically April-June 2025)
   - "[Company] internship program [specific year]" - e.g., "Google internship program 2025", "Meta internship 2025"
   - "[University] research program [field]" - e.g., "UIUC AI research program", "Stanford CS research opportunities"
   - "[Field] fellowship program" - e.g., "AI fellowship program", "data science fellowship"
   - Focus on finding: program name, organization, program type, website URL, application details, deadlines

**CRITICAL**: Every search should aim to find specific people's names, companies, or program titles - not generic information.

## Step 3: Personalized Filtering and Enhancement
1. **Extract candidates from Step 1 results** - Identify all potential connections and programs from web search results
2. **Apply personalization filters** - For each candidate found in Step 1:
   - Search for specific person/program details: "[Person Name] [Company]"
   - Look for background matches with user's experience
   - Find shared interests, educational background, or work history
3. **Validate through additional searches** - Use web search to verify:
   - Professional background and current role
   - Educational history and shared institutions
   - Personal interests and activities (if publicly available)
   - Contact information and professional profiles
${
  personalizationSettings?.enabled
    ? `
4. **PERSONALIZATION SEARCHES** (when personalization is enabled):
   - "[Person Name] Instagram" - find personal interests and hobbies
   - "[Person Name] Twitter" OR "[Person Name] X.com" - discover personal opinions and interests
   - "[Person Name] personal blog" OR "[Person Name] medium" - find personal writing and interests
   - "[Person Name] GitHub" - for tech professionals, discover coding interests and projects
   - "[Person Name] volunteer" OR "[Person Name] nonprofit" - find charitable interests and causes
   - "[Person Name] hobby" OR "[Person Name] outside work" - discover personal activities
   - "[Person Name] speaking" OR "[Person Name] conference" - find professional passions and expertise
   - Evaluate and try to maximize the amount of overlap between the user's and the target connection's personal and professional interests:
   - If there's little overlap, go back to step 2 and find new connections with more personal matches.`
    : ''
}

## Step 4: Final Selection and Validation  
1. **Apply quality filters** - From personalized results, select connections that have:
   - **Direct background matches** from search results (same companies, schools, organizations)
   - **Clear goal alignment** based on web search information  
   - **Verified contact information** found through searches
2. **If insufficient results** - If fewer than 3-5 quality connections remain:
   - Return to Step 1 with different search terms
   - Try broader geographic searches
   - Search for related industries or roles
   - Look for alumni networks and professional organizations
3. **Final validation** - Ensure each selected connection:
   - Was found through actual web searches (not invented)
   - Has verifiable background information from search results  
   - Shows clear relevance to user's goal based on search findings
   - **Is based on high-networking-potential shared experiences**: Connections from large companies, established institutions, or team-based work (not solo projects or individual startups)

4. **Create highly personalized outreach messages** - For each person connection:
   - **NEVER use generic templates** like "your field", "your work", "your experience"
   - **Be specific**: Use their actual company name (e.g., "your work at Nora AI", not "your work")
   - **Mention shared background**: Reference specific shared experiences found in searches (e.g., "As a fellow UIUC alum", not "uiuc alumnus")
   - **Reference their expertise**: Use their actual role/field (e.g., "your AI research", not "your field")
   - **Include user's specific goal**: Use actual goal from prompt (e.g., "winter AI internship", not generic "internship opportunities")
   - **Add personal touch**: Reference shared interests, projects, or experiences found through searches
   ${
     personalizationSettings?.enabled
       ? `- **Add personal and profesional interests**: Naturally reference personal and professional interests in the outreach message.`
       : ''
   }
   - **Keep it concise**: 2-3 sentences maximum
   - **End with specific call to action**: If shared personal interests exist, suggest activity related to that interest (e.g., "grab coffee and talk hiking", "quick rock climbing session"). If no shared personal interests, default to "15-minute chat"
   
   **EXAMPLE GOOD OUTREACH MESSAGE:**
   "Hey Sarah! Saw you're at OpenAI now - that's awesome! I'm a UIUC CS student (go Illini!) looking for AI internships and noticed we both love rock climbing from your posts. Want to go rock climbing together sometime and chat about your path from Microsoft to OpenAI?"

${
  personalizationSettings?.enabled
    ? `
5. **MANDATORY PERSONALIZATION FIELDS** - For EVERY person connection when personalization is enabled:
   - **shared_professional_interests**: MUST contain at least 1-3 professional interests, passions, or work-related activities that align with the user's professional interests: ${personalizationSettings.professionalInterests}
   - **shared_personal_interests**: MUST contain at least 1-3 personal interests, hobbies, volunteer activities, or personal pursuits that align with the user's personal interests: ${personalizationSettings.personalInterests}
   - **CRITICAL**: Personal interests must be COMPLETELY DISTINCT from professional interests. Examples: hobbies like hiking, cooking, sports, music, art, reading, travel, fitness, gaming, volunteering for causes unrelated to work, etc. Do NOT include work-related activities, industry interests, or career-focused pursuits in personal interests.
   - **NEVER leave these fields null or empty** - if you cannot find specific matches, use broader categories that still align with the user's interests
   - **Search thoroughly** for personal information through social media, personal websites, speaking engagements, volunteer work, etc.`
    : ''
}

## How to use function / tool calls and extract URLs
**CRITICAL PROCESS:**
- **BEFORE each web search**: Write out your search strategy and what you hope to find
- **AFTER each web search**: Analyze the results thoroughly. What contacts/programs did you find? Are they high-quality matches?
- **EXTRACT URLs FROM SEARCH RESULTS**: Every web search returns sources with URL fields. Use these URLs for:
  - \`verified_profile_url\` for people connections (LinkedIn, company profiles, etc.)
  - \`website_url\` for program connections (official program pages, application links)
  - \`source\` field for all connections (cite which search result provided the information)
- **ONLY use search results**: Never create or invent information. All connection details must come from web search results
- **Document your sources**: For each connection, use the exact URL from the search results in the appropriate field
- **Evaluate continuously**: If search results are poor quality or lack relevant URLs/information, adjust your search terms and try again
- **Think step-by-step**: Follow the 3-step process methodically. Do NOT skip steps or rush through searches.

**URL Extraction Guide:**
- When you get search results, look at the \`sources\` array
- Each source has: \`title\`, \`url\`, \`date\`, \`last_updated\`
- Use the \`url\` field as your \`verified_profile_url\`, \`website_url\`, or \`source\` depending on the result type
- LinkedIn profiles → \`verified_profile_url\`
- Company career pages → \`verified_profile_url\` or \`website_url\`  
- Program official pages → \`website_url\`
- Any informative article → \`source\`

# Output Instructions

**CRITICAL: Once you have found 5 valuable connections:**

1. **FIRST: Output the JSON** - After your thorough analysis, provide the JSON output with exactly 5 connections
2. **THEN: Stop making tool calls** - Do not continue searching or making any additional tool calls after outputting the JSON

# Output Format

**IMPORTANT: Provide actual working URLs for verified_profile_url and website_url fields. For other text fields, use plain text descriptions without hyperlinks.**

\`\`\`json
{
  "connections": [
    ${
      preferences.connections
        ? `{
      "type": "person",
      "name": "string",
      "current_role": "string", 
      "company": "string",
      "verified_profile_url": "string",
      "education_level": "undergraduate" | "graduate" | "postgraduate",
      "direct_matches": ["string"],
      "goal_alignment": "string",
      "shared_background_points": ["string"],
      "shared_professional_interests": ["string"]${
        personalizationSettings?.enabled ? '' : ' | null'
      },
      "shared_personal_interests": ["string"]${
        personalizationSettings?.enabled ? '' : ' | null'
      },
      "ai_outreach_message": "string - personalized outreach message based on goal and shared interests",
      "source": "string"
    }`
        : ''
    },
    ${
      preferences.programs
        ? `{
      "type": "program",
      "name": "string",
      "organization": "string",
      "program_type": "string", 
      "website_url": "string",
      "how_this_helps": "string",
      "direct_matches": ["string"],
      "goal_alignment": "string",
      "shared_background_points": ["string"],
      "source": "string"
    }`
        : ''
    }
  ]
}
\`\`\`


# Context

**Input Variables:**
- Current date: ${new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}
- Background information for matching (structured JSON data):

\`\`\`json
${JSON.stringify(connectionAspects, null, 2)}
\`\`\`

- Education level: ${connectionAspects.education?.current_level || 'unknown'}
- Candidate race/ethnicity: ${race} (if provided)
- Career goal to consider for matching: ${goalTitle}${
    personalizationSettings?.enabled
      ? `
- User's Professional Interests: ${
          personalizationSettings.professionalInterests || 'Not specified'
        }
- User's Personal Interests (COMPLETELY SEPARATE from professional interests): ${
          personalizationSettings.personalInterests || 'Not specified'
        }`
      : ''
  }
`;
}
