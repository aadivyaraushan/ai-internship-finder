import axios from 'axios';
import * as cheerio from 'cheerio';

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

// Add random delay between requests (0.75 - 2.5 seconds)
const delay = () => {
  const min = 750; // 0.75 seconds
  const max = 2500; // 2.5 seconds
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`⏳ Adding delay of ${ms}ms`);
  return new Promise(resolve => setTimeout(resolve, ms));
};

export async function scrapeProgramWebsite(url: string, retries = 2): Promise<{
  programName?: string;
  organizationName?: string;
  programType?: string;
  pageText?: string;
  error?: string;
  statusCode?: number;
}> {
  // Validate URL
  if (!url || !url.startsWith('http')) {
    return { error: 'Invalid URL', statusCode: 400 };
  }

  try {
    // Add random delay to avoid rate limiting
    await delay();
    
    console.log(`🌐 Scraping program website: ${url}`);
    
    const response = await axios.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 10000, // 10 second timeout
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Accept all status codes less than 500
    });

    // If we get a 404, no need to retry
    if (response.status === 404) {
      return { error: 'Page not found (404)', statusCode: 404 };
    }

    // If we get a 403, try with different headers
    if (response.status === 403 && retries > 0) {
      console.log(`⚠️ Got 403, retrying (${retries} attempts left)...`);
      // Try with a different user agent
      const newHeaders = {
        ...DEFAULT_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      
      await delay(); // Random delay before retry
      
      const retryResponse = await axios.get(url, {
        headers: newHeaders,
        timeout: 15000,
        maxRedirects: 5,
      });
      
      return processResponse(retryResponse.data, url);
    }

    return processResponse(response.data, url);
  } catch (error: any) {
    console.error('❌ Program website scraping failed:', {
      url,
      status: error.response?.status,
      message: error.message,
    });

    // If we have retries left and it's a retryable error
    if (retries > 0 && error.response?.status !== 404) {
      console.log(`🔄 Retrying... (${retries} attempts left)`);
      await delay(); // Random delay before retry
      return scrapeProgramWebsite(url, retries - 1);
    }

    return {
      error: error.response?.status === 403 
        ? 'Access denied (403). The website is blocking our requests.' 
        : error.response?.status === 404
          ? 'Page not found (404)'
          : 'Failed to fetch program website',
      statusCode: error.response?.status || 500,
    };
  }
}

function processResponse(html: string, url: string) {
  try {
    const $ = cheerio.load(html);
    
    // Remove scripts, styles, and other non-visible elements
    $('script, style, noscript, iframe, nav, footer, header').remove();
    
    // Get clean text content
    const pageText = $('body').text()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n/g, ' ') // Replace newlines with space
      .replace(/\t/g, ' ') // Replace tabs with space
      .trim();

    // Try to extract basic metadata
    const title = $('title').first().text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    
    // Extract organization from common patterns
    let organizationName = '';
    const orgSelectors = [
      '.organization-name',
      '.org-name',
      '.institution',
      '.university',
      '.school',
      'header h1',
      'header h2',
    ];
    
    for (const selector of orgSelectors) {
      const orgText = $(selector).first().text().trim();
      if (orgText) {
        organizationName = orgText;
        break;
      }
    }

    return {
      programName: title,
      organizationName: organizationName || new URL(url).hostname.replace('www.', '').split('.')[0],
      pageText: `${title} ${description} ${pageText}`.toLowerCase(),
    };
  } catch (error) {
    console.error('Error processing website content:', error);
    return { 
      error: 'Error processing website content',
      pageText: ''
    };
  }
}

