import { LinkedInProfileData } from '../utils';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Add random delay between requests (0.75 - 2.5 seconds)
const delay = () => {
  const min = 750; // 0.75 seconds
  const max = 2500; // 2.5 seconds
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`⏳ Adding delay of ${ms}ms`);
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Common headers to mimic a real browser
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

// Helper function to clean and normalize text
const cleanText = (text: string | undefined): string | undefined => {
  if (!text) return undefined;
  return text.replace(/\s+/g, ' ').trim();
};

export async function scrapeLinkedInProfile(
  url: string
): Promise<LinkedInProfileData> {
  // Validate URL
  if (!url || !url.includes('linkedin.com')) {
    console.error('❌ Invalid LinkedIn URL:', url);
    return { error: 'Invalid LinkedIn URL' };
  }

  // Ensure URL uses HTTPS
  const profileUrl = url.startsWith('http') ? url : `https://${url}`;
  
  try {
    // Add random delay to avoid rate limiting
    await delay();
    
    console.log(`🔍 Attempting to scrape LinkedIn profile: ${profileUrl}`);
    
    const response = await axios.get(profileUrl, {
      headers: DEFAULT_HEADERS,
      timeout: 10000, // 10 second timeout
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400, // Accept all 2xx and 3xx responses
    });

    const $ = cheerio.load(response.data);
    
    // Multiple selector patterns for each field to handle different LinkedIn layouts
    const nameSelectors = [
      'h1.text-heading-xlarge',
      'h1.text-4xl',
      'h1.top-card-layout__title',
      'h1.pv-top-card--name',
      'h1.pv-text-details__left-panel h1',
      'h1',
    ];
    
    const roleSelectors = [
      'div.text-body-medium.break-words',
      'h2.mt1.t-18.t-black.t-normal',
      'div.text-body-medium',
      'h2.pv-text-details__left-panel h2',
      'h2',
    ];
    
    const companySelectors = [
      'div.inline-show-more-text.inline-show-more-text--is-collapsed',
      'div.inline-show-more-text',
      'div.pv-text-details__right-panel',
      'div.experience-item__subtitle',
      'div.pv-text-details__right-panel-item',
    ];

    // Find name using multiple selectors
    let name: string | undefined;
    for (const selector of nameSelectors) {
      const el = $(selector).first();
      if (el.length) {
        name = cleanText(el.text());
        if (name) break;
      }
    }

    // Find current role using multiple selectors
    let currentRole: string | undefined;
    for (const selector of roleSelectors) {
      const el = $(selector).first();
      if (el.length) {
        currentRole = cleanText(el.text());
        if (currentRole) break;
      }
    }

    // Find company using multiple selectors
    let company: string | undefined;
    for (const selector of companySelectors) {
      const el = $(selector).first();
      if (el.length) {
        company = cleanText(el.text());
        if (company) break;
      }
    }

    // Log what we found
    console.log('✅ Scraped LinkedIn profile:', { name, currentRole, company });

    return {
      name,
      currentRole,
      company,
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ LinkedIn scraping failed:', {
      url: profileUrl,
      error: errorMessage,
      status: error?.response?.status,
      headers: error?.response?.headers,
    });
    
    // Try fallback to Google cache if direct scraping fails
    try {
      console.log('🔄 Attempting to fetch from Google cache...');
      const cachedUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(profileUrl)}`;
      
      await delay(); // Random delay before Google cache request
      
      const response = await axios.get(cachedUrl, {
        headers: DEFAULT_HEADERS,
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      
      // Try to extract from common cache formats
      const name = cleanText($('h1').first().text()) || 
                  cleanText($('.top-card-layout__title').first().text());
                  
      const currentRole = cleanText($('.text-body-medium').first().text()) ||
                         cleanText($('.top-card__headline').first().text());
                         
      const company = cleanText($('.experience-item__subtitle').first().text()) ||
                     cleanText($('.top-card__org-name-link').first().text());

      if (name || currentRole || company) {
        console.log('✅ Retrieved partial data from Google cache:', { name, currentRole, company });
        return { name, currentRole, company };
      }
      
      throw new Error('No valid data found in cache');
    } catch (cacheError) {
      console.error('❌ Cache scraping failed:', {
        url: profileUrl,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
      
      return {
        error: 'Unable to verify profile. LinkedIn may be blocking automated access.',
        technicalDetails: errorMessage,
      };
    }
  }
}
