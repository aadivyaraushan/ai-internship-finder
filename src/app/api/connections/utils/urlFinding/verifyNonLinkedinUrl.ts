import axios from 'axios';
import * as cheerio from 'cheerio';
import { Connection } from '@/lib/firestoreHelpers';
import { ProfileData } from '../utils';

// Add random delay between requests (0.75 - 2.5 seconds)
const delay = () => {
  const min = 750; // 0.75 seconds
  const max = 2500; // 2.5 seconds
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`⏳ Adding search delay of ${ms}ms`);
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Verifies a non-LinkedIn URL by checking if it contains the expected person's information
 */
export async function verifyNonLinkedInUrl(
  url: string,
  connection: Connection,
  nameVariations: string[]
): Promise<ProfileData> {
  console.log(`🔍 Scraping non-LinkedIn URL: ${url}`);
  await delay(); // Additional delay before API request

  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
    timeout: 10000, // 10 second timeout
  });

  console.log(`✅ Got response from ${url}, status: ${response.status}`);
  const $ = cheerio.load(response.data);

  // Get text content from important elements first
  const titleText = $('title').text().toLowerCase();
  const h1Text = $('h1')
    .map((_, el) => $(el).text())
    .get()
    .join(' ')
    .toLowerCase();
  const metaDescription =
    $('meta[name="description"]').attr('content')?.toLowerCase() || '';
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

  return {
    name: nameFound ? connection.name : undefined,
    currentRole: matches.roleInBody ? connection.current_role : undefined,
    company: matches.companyInBody ? connection.company : undefined,
    error: !nameFound ? 'Name not found in content' : undefined,
    confidence: {
      name: nameFound,
      role: matches.roleInBody,
      company: matches.companyInBody,
    },
  };
}
