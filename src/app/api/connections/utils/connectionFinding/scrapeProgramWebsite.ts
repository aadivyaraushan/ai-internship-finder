import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeProgramWebsite(url: string): Promise<{
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
  } catch (error: unknown) {
    // Log the technical error
    console.error('❌ Technical error - Program website scraping failed:', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: 'We were unable to verify this program at the moment.' };
  }
}
