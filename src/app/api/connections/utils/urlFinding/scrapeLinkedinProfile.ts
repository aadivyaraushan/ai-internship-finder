import { LinkedInProfileData } from '../types';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeLinkedInProfile(
  url: string
): Promise<LinkedInProfileData> {
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

    return {
      name: name || undefined,
      currentRole: currentRole || undefined,
      company: company || undefined,
    };
  } catch (error) {
    // Log the technical error
    console.error('❌ Technical error - LinkedIn scraping failed:', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });

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

      return {
        name: name || undefined,
        currentRole: currentRole || undefined,
        company: company || undefined,
      };
    } catch (cacheError) {
      console.error('❌ Technical error - Cache scraping failed:', {
        url,
        error:
          cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
      return {
        error: 'We were unable to verify this profile at the moment.',
      } as const;
    }
  }
}
