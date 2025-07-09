import { Connection } from '@/lib/firestoreHelpers';
import axios from 'axios';
import * as cheerio from 'cheerio';

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
  programName?: string;
  organizationName?: string;
}> {
  if (!connection.website_url) {
    return { isValid: false };
  }

  try {
    console.log(`🌐 Verifying program website: ${connection.website_url}`);

    const urlToVerify = connection.website_url;

    const response = await axios.get(urlToVerify, {
      headers: DEFAULT_HEADERS,
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // Remove non-visible elements
    $('script, style, noscript, iframe, nav, footer, header').remove();

    // Get clean text content
    const pageText = $('body')
      .text()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();

    // Check for program name mentions
    const nameFound = connection.name
      ? pageText.includes(connection.name.toLowerCase())
      : false;

    // Check for organization mentions
    const orgFound = connection.organization
      ? pageText.includes(connection.organization.toLowerCase())
      : false;

    return {
      isValid: nameFound || orgFound,
      programName: connection.name,
      organizationName: connection.organization ?? undefined,
    };
  } catch (error) {
    console.error('❌ Program website verification failed:', {
      url: connection.website_url,
      error: error instanceof Error ? error.message : String(error),
    });
    return { isValid: false };
  }
}
