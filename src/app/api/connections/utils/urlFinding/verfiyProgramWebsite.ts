import { scrapeProgramWebsite } from './scrapeProgramWebsite';
import { Connection } from '@/lib/firestoreHelpers';

// async function verifyProgramWebsite(connection: Connection): Promise<{
//   isValid: boolean;
//   matches?: {
//     program_name: boolean;
//     organization: boolean;
//     program_type: boolean;
//   };
//   explanation?: string;
// }> {
//   try {
//     if (!connection.website_url) {
//       return { isValid: false };
//     }

//     // Scrape the program website
//     const websiteData = await scrapeProgramWebsite(connection.website_url);

//     if (websiteData.error) {
//       console.warn('Failed to scrape program website:', websiteData.error);
//       return { isValid: false };
//     }

//     // Use Claude to analyze the scraped content
//     const analysisPrompt = `<system>You are a program website validator. Analyze scraped website content to verify program details. Return ONLY valid JSON.</system>
// <input>
// Website content: ${websiteData.pageText}
// Expected program:
// - Name: ${connection.name}
// - Organization: ${connection.organization}
// - Type: ${connection.program_type}
// </input>
// <rules>
// 1. Analyze the website content for matches
// 2. Check if program name, organization, and type are mentioned
// 3. Return detailed validation results
// 4. Consider variations and partial matches
// 5. Look for related keywords and synonyms
// </rules>
// <schema>
// {
//   "validation": {
//     "is_valid": boolean,
//     "matches_found": {
//       "program_name": boolean,
//       "organization": boolean,
//       "program_type": boolean
//     },
//     "explanation": string,
//     "confidence_level": "high" | "medium" | "low"
//   }
// }
// </schema>`;

//     const analysisResponse = await callClaude(analysisPrompt, {
//       maxTokens: 400,
//     });

//     const result = cleanAndParseJSON(analysisResponse);

//     if (!result?.validation) {
//       return { isValid: false };
//     }

//     return {
//       isValid: result.validation.is_valid,
//       matches: result.validation.matches_found,
//       explanation: result.validation.explanation,
//     };
//   } catch (error) {
//     console.error('Error verifying program website:', error);
//     return { isValid: false };
//   }
// }

export async function verifyProgramWebsite(connection: Connection): Promise<{
  isValid: boolean;
  matches?: {
    program_name: boolean;
    organization: boolean;
    program_type: boolean;
  };
  explanation?: string;
}> {
  try {
    if (!connection.website_url) return { isValid: false };

    // 1. Scrape
    const websiteData = await scrapeProgramWebsite(connection.website_url);
    if (websiteData.error || !websiteData.pageText) return { isValid: false };

    const text = websiteData.pageText.toLowerCase();

    // 2. Expectation strings (fallbacks included)
    const programName = connection.name?.toLowerCase() ?? '';
    const organization =
      (connection as any).organization?.toLowerCase?.() ??
      connection.company?.toLowerCase() ??
      '';
    const programType = (connection as any).program_type?.toLowerCase?.() ?? '';

    // 3. Simple presence checks
    const matches = {
      program_name: programName && text.includes(programName),
      organization: organization && text.includes(organization),
      program_type: programType && text.includes(programType),
    };

    const hitCount = Object.values(matches).filter(Boolean).length;
    const isValid = hitCount >= 2 || matches.program_name; // need at least 2 hits or the name alone

    return {
      isValid,
      matches,
      explanation: `Matched ${hitCount} of 3 attributes on the site.`,
    };
  } catch (err) {
    console.error('Error verifying program website:', err);
    return { isValid: false };
  }
}
