import { scrapeProgramWebsite } from './scrapeProgramWebsite';
import { Connection } from '@/lib/firestoreHelpers';
import axios from 'axios';
import * as cheerio from 'cheerio';

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove all non-alphanumeric characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

// Add random delay between requests (0.75 - 2.5 seconds)
const delay = () => {
  const min = 750; // 0.75 seconds
  const max = 2500; // 2.5 seconds
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`⏳ Adding verification delay of ${ms}ms`);
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Common headers to mimic a real browser
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

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

    // Skip if the URL is from a blocked domain
    const blockedDomains = ['medium.com', 'github.com', 'blogspot.com', 'wordpress.com'];
    try {
      const urlObj = new URL(connection.website_url);
      if (blockedDomains.some(domain => urlObj.hostname.includes(domain))) {
        console.log(`Skipping blocked domain: ${connection.website_url}`);
        return {
          isValid: false,
          explanation: 'Blocked domain',
        };
      }
    } catch (err) {
      console.warn('Invalid URL format', err);
      return { isValid: false };
    }

    // Add random delay before starting verification
    await delay();

    // 1. Scrape
    const websiteData = await scrapeProgramWebsite(connection.website_url);
    if (websiteData.error || !websiteData.pageText) return { isValid: false };

    const text = normalizeText(websiteData.pageText);
    console.log('text: ', text);

    // 2. Expectation strings (fallbacks included)
    const programName = connection.name ? normalizeText(connection.name) : '';
    const organization = connection.organization
      ? normalizeText(connection.organization)
      : '';
    const programType = connection.program_type
      ? normalizeText(connection.program_type)
      : '';

    // 3. Simple presence checks with explicit boolean types
    const matches: {
      program_name: boolean;
      organization: boolean;
      program_type: boolean;
    } = {
      program_name: programName ? text.includes(programName) : false,
      organization: organization ? text.includes(organization) : false,
      program_type: programType ? text.includes(programType) : false,
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

/**
 * Searches for and verifies a program website by iterating through search results
 * @param programName Name of the program to search for
 * @param organization Organization name for additional context
 * @param maxResults Maximum number of search results to check (default: 5)
 * @returns Object containing the verified URL and verification details, or null if none found
 */
export async function findAndVerifyProgramWebsite(
  programName: string,
  organization?: string,
  maxResults: number = 5
): Promise<{
  url: string | null;
  verificationData: {
    isValid: boolean;
    matches?: {
      program_name: boolean;
      organization: boolean;
      program_type: boolean;
    };
    explanation?: string;
  };
}> {
  try {
    if (!programName) {
      console.warn('No program name provided for website search');
      return { url: null, verificationData: { isValid: false } };
    }

    // Build search query
    let searchQuery = programName;
    if (organization) {
      searchQuery += ` ${organization}`;
    }
    searchQuery += ' official site program';

    console.log(`🔍 Searching for program website: "${searchQuery}"`);

    // Use SerpAPI or similar service to get search results
    const serpApiKey = process.env.SERP_API_KEY;
    if (!serpApiKey) {
      console.warn('SERP_API_KEY not found - cannot perform web search');
      return { url: null, verificationData: { isValid: false } };
    }

    // Add delay before search
    await delay();

    // Make search request
    const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(
      searchQuery
    )}&num=${maxResults}&api_key=${serpApiKey}`;

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`Search API returned ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const results = searchData.organic_results || [];

    if (results.length === 0) {
      console.log('No search results found');
      return { url: null, verificationData: { isValid: false } };
    }

    console.log(`Found ${results.length} potential results, verifying...`);

    // Check each result until we find a valid program website
    for (let i = 0; i < Math.min(results.length, maxResults); i++) {
      const result = results[i];
      const url = result.link;

      if (!url || !url.startsWith('http')) {
        continue; // Skip invalid URLs
      }

      console.log(
        `  [${i + 1}/${Math.min(results.length, maxResults)}] Checking: ${url}`
      );

      try {
        // Add delay between verification attempts
        await delay();

        const verificationResult = await verifyProgramWebsite({
          name: programName,
          organization: organization || '',
          website_url: url,
        } as Connection);

        if (verificationResult.isValid) {
          console.log(`✅ Found valid program website: ${url}`);
          return {
            url,
            verificationData: verificationResult,
          };
        } else {
          console.log(
            `  ❌ Invalid program website: ${
              verificationResult.explanation || 'No match found'
            }`
          );
        }
      } catch (error) {
        console.error(`  ⚠️ Error verifying ${url}:`, error);
        continue; // Skip to next result if there's an error
      }
    }

    console.log('No valid program websites found in search results');
    return { url: null, verificationData: { isValid: false } };
  } catch (error) {
    console.error('Error in findAndVerifyProgramWebsite:', error);
    return { url: null, verificationData: { isValid: false } };
  }
}
