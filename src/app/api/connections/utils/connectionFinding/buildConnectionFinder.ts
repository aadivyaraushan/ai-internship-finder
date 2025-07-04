import { Role, Goal, ConnectionAspects } from '../utils';
import { buildBackgroundInfoString } from './buildBackgroundInfoString';

export function buildConnectionFinderPrompt({
  roleTitle,
  goalTitles,
  connectionAspects,
  race,
  location,
  preferences = { programs: true, connections: true },
}: {
  roleTitle: string;
  goalTitles?: string[];
  connectionAspects: ConnectionAspects;
  race?: string;
  location?: string;
  preferences?: { programs: boolean; connections: boolean };
}): string {
  const backgroundInfo = buildBackgroundInfoString(connectionAspects);
  console.log('Background info for connection finder:', backgroundInfo);

  // Determine rule 1 based on user preferences
  let ruleOne: string;
  if (preferences.programs && preferences.connections) {
    ruleOne =
      '1. Return up to 5 best potential matches (people or programs) making sure to include AT LEAST one person and one program, plus:';
  } else if (preferences.connections) {
    ruleOne =
      '1. Return up to 5 best potential person matches (do NOT include programs). Include at least one near-peer and one senior/managerial person, plus:';
  } else {
    ruleOne =
      '1. Return up to 5 best potential program matches (do NOT include people).';
  }

  return `<system>You are an agent specialized in finding relevant professional connections that MUST have direct background matches and career goal alignment. Return ONLY valid JSON matching the schema below EXACTLY.</system>
<input>
Target role: ${roleTitle}
Background information for matching:
    ${backgroundInfo}
Education level: ${connectionAspects.education?.current_level || 'unknown'}
${race ? `\nCandidate race/ethnicity: ${race}` : ''}
${location ? `\nCandidate location: ${location}` : ''}
${
  goalTitles?.length
    ? `\nCareer goals to consider for matching: ${goalTitles.join(', ')}`
    : ''
}
</input>
<rules>
${ruleOne}
   - At least one near-peer connection (someone one step ahead in education—e.g., high-school ➔ undergraduate, early undergraduate ➔ later undergraduate, undergraduate ➔ graduate) who can refer the user to roles
   - At least one senior/managerial connection (e.g., hiring managers, mentors) who has influence over hiring decisions or can provide high-level guidance
2. REQUIRED - each match MUST have BOTH:
   a) At least one DIRECT, VERIFIABLE background match from these categories:
      - Same company (must match company name exactly)
      - Same educational institution (must match institution name exactly)
      - Same specific organization/club (must be explicitly mentioned in background)
      - Same specific project (must be explicitly mentioned in background)
      
      For EACH direct match, you MUST:
      - Specify the EXACT matching element from the background
      - Include a source URL that verifies the connection
      - Explain the nature of the connection (e.g., 'Both worked at [Company]', 'Both attended [School]')
      
      Examples of GOOD matches:
      ✅ Both worked at Google (https://www.linkedin.com/company/google/)
      ✅ Both graduated from Stanford University (https://www.stanford.edu/)
      ✅ Both were members of ACM at UIUC (https://acm.illinois.edu/)
      
      Examples of BAD matches:
      ❌ "Both interested in technology" (too vague)
      ❌ "Both worked in tech" (not specific enough)
      ❌ "Both have experience with programming" (not a direct connection)
      
   b) Clear, specific alignment with stated career goals that explains EXACTLY how this connection helps achieve those goals
3. Optional strengthening factors:
   - Parallel experiences or transitions
   - Potential for meaningful mentorship
4. For people: Include at minimum name, current role, company, AND a valid contact method (preferably a LinkedIn profile URL that allows messaging). EXCLUDE any person who does not have a clear way the user can reach out.
5. For programs: Include name, organization, program type, website_url and why it's a fit for the candidate's career goals (how_this_helps)
6. Do NOT return any programs that are already mentioned in the candidate's resume (avoid duplicates)
7. If a program has explicit race/ethnicity eligibility requirements, ONLY include if they match the candidate race. Otherwise, exclude.
8. If a program requires on-site presence or is limited to a specific geographic location, ONLY include if it matches the candidate location.
9. REJECT any potential match missing either direct matches or goal alignment.
10. Match opportunities to education level and background:
    - High school: Focus on early internships and pre-college programs
    - Undergraduate: Focus on internships, co-ops, and entry-level roles
    - Graduate: Focus on research, specialized roles, and advanced programs
    - ALWAYS verify the person's current role/education level matches the connection type
    - For alumni connections, verify they actually attended the same institution
11. ALWAYS verify program eligibility matches candidate's education level
12. For every *person* connection include an "education_level" field set to one of: undergraduate, graduate, postgraduate
13. Avoid celebrities or people who are unlikely to be accessible (e.g., very popular public figures or extremely senior C-suite executives); suggestions should focus on contacts the candidate can realistically reach.
14. If it is COMPLETELY IMPOSSIBLE to find enough connections satisfying rule 2a given the candidate's background, you may relax rule 2a. In that case, prioritize accessible connections that still align with the candidate's career goals and clearly note the lack of direct background matches.
15. DO NOT MAKE UP fake people ever, especially not just to create some arbitrary link with the user's background or goals. To ensure this, make sure that each connection is backed up by some web source.
16. Avoid recommending career services coordinators or career counselors as they do not directly work in the user's target field. Only include people who ACTUALLY work in the user's target field.
17. For each person connection, you MUST include a 'source' field with a URL where this person's profile can be verified (e.g., LinkedIn, company website, etc.)
18. If you cannot find a verifiable source for a connection, DO NOT include that connection
19. Prefer fewer high-quality, verifiable connections over many unverified ones
20. For each direct match claim, you MUST be able to point to specific evidence in either:
    - The candidate's resume/background
    - The connection's public profile
    - The organization's official records
21. If you cannot find concrete evidence of a direct connection, DO NOT claim one exists - it's better to have no connection than a tenuous one
</rules>

Please list each recommended connection in a clear, concise bullet or numbered list. For each item include all the details specified in the rules (name, role, company or organization, contact URL, education level/program type, direct_matches, goal_alignment, shared_background_points, additional_factors, and for programs how_this_helps). Do NOT create any formatted JSON; plain text is preferred.
{
  "connections": [
    {
      "type": "person",
      "name": "string",
      "current_role": "string",
      "company": "string",
      "linkedin_url": "string",
      "education_level": "undergraduate" | "graduate" | "postgraduate",
      "direct_matches": ["string"],
      "goal_alignment": "string",
      "shared_background_points": ["string"],
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
      "shared_background_points": ["string"],
      "additional_factors": ["string"]
    }
  ]
}
`;
}
