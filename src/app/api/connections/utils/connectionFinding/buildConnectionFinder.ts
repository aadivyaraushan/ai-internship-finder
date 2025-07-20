import { Role, Goal, ConnectionAspects } from '../utils';
import { buildBackgroundInfoString } from './buildBackgroundInfoString';

export function buildConnectionFinderPrompt({
  goalTitle,
  connectionAspects,
  race,
  location,
  preferences = { programs: true, connections: true },
}: {
  goalTitle: string;
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
      'Return up to 5 best potential matches (people or programs) making sure to include AT LEAST one person and one program, plus:';
  } else if (preferences.connections) {
    ruleOne =
      'Return up to 5 best potential person matches (do NOT include programs). Include at least one near-peer and one senior/managerial person, plus:';
  } else {
    ruleOne =
      'Return up to 5 best potential program matches (do NOT include people).';
  }

  // TODO:  MODIFY THE PART OF THE PROMPT THAT LISTS OUT TYPES OF CONNECTIONS FOR DIFFERENT LEVELS OF EDUCATION TO BE FAR MORE SPECIFIC AND USEFUL TO REAL WORLD CONTEXTS (THINK ABOUT THE TYPE OF CONNECTIONS THAT WOULD HELP YOU PERSONALLY)
  return `
## Role and Objective

Find relevant professional connections that can meaningfully advance the candidate's career goals.

## Goal
${ruleOne}

## Non-Negotiable Requirements

**Direct Background Match** - Each connection must share at least one verifiable element:
- Same company (exact name match)
- Same educational institution (exact name match)  
- Same organization/club (explicitly mentioned)
- Same current country of residence

**Verification Requirements:**
- People: Must have discoverable LinkedIn profiles (linkedin.com/in/[username] format only)
- Programs: Must have current websites with future application deadlines
- Use web search to verify all connections before including

**Role Alignment:**
- Target exact field only - exclude adjacent but different fields (e.g., for investment banking, exclude equity research, sales & trading, etc.)
- Include mix of near-peer (1-2 steps ahead) and senior connections

## Context
- Background: ${backgroundInfo}
- Education: ${connectionAspects.education?.current_level || 'unknown'}
- Location: ${location}
- Career Goal: ${goalTitle}

## Output
Return valid JSON only:

\`\`\`json
{
  "connections": [
    {
      "type": "person" | "program",
      "name": "string",
      "current_role": "string", 
      "company": "string",
      "verified_profile_url": "string",
      "education_level": "undergraduate" | "graduate" | "postgraduate",
      "direct_matches": ["specific matching elements"],
      "goal_alignment": "how this helps achieve the career goal",
      "shared_background_points": ["verifiable common elements"],
      "additional_factors": ["other relevant information"],
      "source": "verification method and source"
    }
  ]
}
\`\`\`
`;
}
