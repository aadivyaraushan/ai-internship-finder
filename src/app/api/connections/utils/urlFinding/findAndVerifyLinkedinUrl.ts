import { Connection } from '@/lib/firestoreHelpers';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { scrapeLinkedInProfile } from './scrapeLinkedinProfile';
import { ProfileData } from '../utils';

// Add random delay between requests (0.75 - 2.5 seconds)
const delay = () => {
  const min = 750; // 0.75 seconds
  const max = 2500; // 2.5 seconds
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`⏳ Adding search delay of ${ms}ms`);
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Utility: compute a simple token-overlap similarity (Jaccard-like) between two strings.
 * Returns a value in [0,1]. Empty strings yield 0.
 */
function textSimilarity(a: string = '', b: string = ''): number {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  let overlap = 0;
  setA.forEach((tok) => {
    if (setB.has(tok)) overlap++;
  });
  return overlap / Math.max(setA.size, setB.size);
}

export async function findAndVerifyLinkedInUrl(
  connection: Connection
): Promise<{
  url: string | null;
  profile_source?: string;
  match_confidence?: {
    name: number;
    role: number;
    company: number;
    overall: number;
  };
}> {
  let isVerifiedUrl = false; // flag indicating if a verified URL has been found
  let attempts = 0;

  // Pre-compute reusable constants
  const name = connection.name;
  const currentRole = connection.current_role ?? '';
  const company = connection.company ?? '';
  const nameVariations = [
    name.toLowerCase(),
    name.toLowerCase().replace(/\s+/g, ''),
    name.split(' ')[0].toLowerCase(),
    (name.split(' ').pop() ?? '').toLowerCase(),
  ];

  while (!isVerifiedUrl) {
    // Add delay before each search attempt
    await delay();
    
    // Build different search queries for each attempt
    let searchQuery: string;

    // Safely handle optional fields
    const name = connection.name;
    const currentRole = connection.current_role ?? '';
    const company = connection.company ?? '';

    if (attempts === 0) {
      searchQuery = `${name} ${currentRole} ${company} (site:linkedin.com/in/ OR site:github.com OR site:medium.com OR site:about.me OR site:personalwebsite)`;
    } else if (attempts === 1) {
      // Try with just name and company
      searchQuery = `${name} ${company} profile contact`;
    } else {
      // Try with name and role keywords
      const roleKeywords = currentRole
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
      searchQuery = `${name} ${roleKeywords} contact profile`;
    }

    const serpApiKey = process.env.SERP_API_KEY;
    if (!serpApiKey) {
      throw new Error('Missing SERP_API_KEY environment variable');
    }

    const serpUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
      searchQuery
    )}&api_key=${serpApiKey}`;

    let parsedUrl: {
      potential_urls: { url: string; source_type: string }[];
    } | null = null;
    
    try {
      console.log(`🔍 Search attempt ${attempts + 1} for: ${name}`);
      await delay(); // Additional delay before API request
      const serpResp = await fetch(serpUrl);
      
      if (!serpResp.ok) {
        console.error('SERP API error:', await serpResp.text());
        attempts++;
        if (attempts >= 3) break;
        continue;
      }
      
      const data = await serpResp.json();
      
      // Process the search results...
      const organic: any[] = data.organic_results || [];

      const potential_urls = organic
        .map((r) => r.link as string)
        .filter((link) => typeof link === 'string')
        .slice(0, 5) // limit to top 5 like previous prompt
        .map((url) => {
          let source_type: string = 'other';
          if (url.includes('linkedin.com')) source_type = 'linkedin';
          else if (url.includes('github.com')) source_type = 'github';
          else if (url.includes('medium.com')) source_type = 'medium';
          else if (url.includes('about.me')) source_type = 'personal';
          return { url, source_type };
        });

      parsedUrl = { potential_urls };
    } catch (error) {
      console.error('Error during search:', error);
      attempts++;
      if (attempts >= 3) break;
      await delay(); // Additional delay on error before retry
    }

    if (parsedUrl?.potential_urls && parsedUrl.potential_urls.length > 0) {
      // Try each URL until we find a match
      for (const urlData of parsedUrl.potential_urls) {
        const url = typeof urlData === 'string' ? urlData : urlData.url;
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

        console.log(`🔍 Attempting to verify URL (attempt ${attempts + 1}):`, {
          url,
          sourceType,
        });

        try {
          let profileData: ProfileData;
          if (sourceType === 'linkedin') {
            await delay(); // Additional delay before API request
            profileData = await scrapeLinkedInProfile(url);
          } else {
            // For non-LinkedIn URLs, use a general scraping approach
            console.log(`🔍 Scraping non-LinkedIn URL: ${url}`);
            await delay(); // Additional delay before API request
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
              $('meta[name="description"]').attr('content')?.toLowerCase() ||
              '';
            const bodyText = $('body').text().toLowerCase();

            console.log('Scraped content:', {
              title: titleText,
              h1: h1Text,
              metaDescription: metaDescription.substring(0, 100) + '...',
              bodyLength: bodyText.length,
            });

            // Look for name and company/role matches in the page content
            const searchTerms = {
              name: connection.name.toLowerCase(),
              role: (connection.current_role ?? '').toLowerCase(),
              company: (connection.company ?? '').toLowerCase(),
              nameVariations,
              // Add variations of the role
              roleKeywords: (connection.current_role ?? '')
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
              nameInTitle: searchTerms.nameVariations.some((name: string) =>
                titleText.includes(name)
              ),
              nameInH1: searchTerms.nameVariations.some((name: string) =>
                h1Text.includes(name)
              ),
              nameInMeta: searchTerms.nameVariations.some((name: string) =>
                metaDescription.includes(name)
              ),
              nameInBody: searchTerms.nameVariations.some((name: string) =>
                bodyText.includes(name)
              ),
              roleInBody: searchTerms.roleKeywords.some((keyword: string) =>
                bodyText.includes(keyword)
              ),
              companyInBody: bodyText.includes(searchTerms.company),
            };

            console.log('Content matches:', matches);

            // More lenient matching logic
            const nameFound =
              matches.nameInTitle ||
              matches.nameInH1 ||
              matches.nameInMeta ||
              matches.nameInBody;

            profileData = {
              name: nameFound ? connection.name : undefined,
              currentRole: matches.roleInBody
                ? connection.current_role
                : undefined,
              company: matches.companyInBody ? connection.company : undefined,
              error: !nameFound ? 'Name not found in content' : undefined,
              confidence: {
                name: nameFound,
                role: matches.roleInBody,
                company: matches.companyInBody,
              },
            };
          }

          if (!profileData.error) {
            // Check if scraped data matches our connection

            // ---------- Similarity scoring ----------
            const nameSim = textSimilarity(
              connection.name,
              profileData.name ?? ''
            );
            const roleSim = textSimilarity(
              connection.current_role ?? '',
              profileData.currentRole ?? ''
            );
            const companySim = textSimilarity(
              connection.company ?? '',
              profileData.company ?? ''
            );
            const weightedScore =
              nameSim * 0.5 + roleSim * 0.3 + companySim * 0.2;

            console.log('Profile similarity:', {
              source: sourceType,
              found: {
                name: profileData.name,
                role: profileData.currentRole,
                company: profileData.company,
                confidence: profileData.confidence,
              },
              expected: {
                name: connection.name,
                role: connection.current_role,
                company: connection.company,
              },
              similarity: {
                nameSim,
                roleSim,
                companySim,
                weightedScore,
              },
            });

            const isMatch = weightedScore >= 0.75;

            if (isMatch) {
              isVerifiedUrl = true;
              return {
                url,
                profile_source: sourceType,
                match_confidence: {
                  name: nameSim,
                  role: roleSim,
                  company: companySim,
                  overall: weightedScore,
                },
              };
            }
          }
        } catch (error) {
          console.error('❌ Error during profile scraping:', {
            url,
            error: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
      }
    }

    attempts++;
    if (!isVerifiedUrl) {
      // Add a small delay between attempts to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return {
    url: null,
  };
}
