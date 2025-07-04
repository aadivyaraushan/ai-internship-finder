import axios from 'axios';
import * as cheerio from 'cheerio';
import { delay } from '../utils';

interface LinkedInExperience {
  title: string;
  company: string;
  duration: string;
  isCurrent: boolean;
}

interface LinkedInEducation {
  school: string;
  degree: string;
  field: string;
  duration: string;
}

export interface LinkedInProfileData {
  name: string;
  currentRole: string;
  company?: string;
  about?: string;
  location?: string;
  experience?: LinkedInExperience[];
  education?: LinkedInEducation[];
  skills?: string[];
  profileUrl?: string;
  profilePictureUrl?: string;
  error?: string;
}

interface RapidApiResponse {
  profile: {
    name: string;
    headline: string;
    location?: string;
    about?: string;
    profile_picture_url?: string;
    profile_url?: string;
    current_company?: string;
  };
  experience?: Array<{
    title: string;
    company: string;
    duration: string;
    is_current: boolean;
  }>;
  education?: Array<{
    school: string;
    degree: string;
    field_of_study: string;
    duration: string;
  }>;
  skills?: string[];
}

// Common headers to mimic a real browser
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

/**
 * Extracts username from a LinkedIn profile URL
 */
function extractUsername(profileUrl: string): string | null {
  const patterns = [
    /linkedin\.com\/in\/([^\/?#]+)/i,  // Standard LinkedIn URL
    /linkedin\.com\/pub\/[^\/]+\/([^\/?#]+)/i,  // Old LinkedIn URL format
    /linkedin\.com\/company\/([^\/?#]+)/i  // Company profile
  ];

  for (const pattern of patterns) {
    const match = profileUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Fetches LinkedIn profile data using RapidAPI
 */
async function fetchFromRapidAPI(username: string): Promise<LinkedInProfileData> {
  if (!process.env.RAPID_API_KEY) {
    throw new Error('RAPID_API_KEY is not configured');
  }

  await delay(); // Add delay between requests
  const url = `https://linkedin-data-scraper-api1.p.rapidapi.com/profile/detail?username=${encodeURIComponent(username)}`;
  
  const response = await axios.get<RapidApiResponse>(url, {
    headers: {
      'x-rapidapi-host': 'linkedin-data-scraper-api1.p.rapidapi.com',
      'x-rapidapi-key': process.env.RAPID_API_KEY,
    },
    timeout: 10000, // 10 second timeout
  });

  if (response.status !== 200) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data = response.data;
  const profile = data.profile;
  const currentExperience = data.experience?.[0];
  
  return {
    name: profile.name || '',
    currentRole: profile.headline || '',
    company: currentExperience?.company || profile.current_company,
    about: profile.about,
    location: profile.location,
    profileUrl: profile.profile_url,
    profilePictureUrl: profile.profile_picture_url,
    experience: data.experience?.map(exp => ({
      title: exp.title,
      company: exp.company,
      duration: exp.duration,
      isCurrent: exp.is_current,
    })),
    education: data.education?.map(edu => ({
      school: edu.school,
      degree: edu.degree,
      field: edu.field_of_study,
      duration: edu.duration,
    })),
    skills: data.skills,
  };
}

/**
 * Fallback method using direct scraping when API fails
 */
async function fallbackScrape(profileUrl: string): Promise<LinkedInProfileData> {
  try {
    await delay();
    console.log('🔍 Falling back to direct scraping for:', profileUrl);

    const response = await axios.get(profileUrl, {
      headers: DEFAULT_HEADERS,
      timeout: 10000,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const $ = cheerio.load(response.data);
    const name = $('h1.text-heading-xlarge').text().trim() || 'Unknown';
    const currentRole = $('div.text-body-medium.break-words').first().text().trim() || '';
    
    if (name === 'Unknown') {
      throw new Error('Could not extract profile information - LinkedIn may have detected scraping');
    }

    return {
      name,
      currentRole,
      company: $('div.pv-entity__company-summary-info h3').first().text().trim() || undefined,
    };
  } catch (error) {
    console.error('Error in fallback scrape:', error);
    throw new Error('Failed to scrape LinkedIn profile directly');
  }
}

export async function scrapeLinkedInProfile(profileUrl: string): Promise<LinkedInProfileData> {
  try {
    console.log(`🔍 Attempting to scrape LinkedIn profile: ${profileUrl}`);
    
    // Extract username from profile URL
    const username = extractUsername(profileUrl);
    if (!username) {
      throw new Error('Invalid LinkedIn profile URL');
    }

    try {
      // First try the RapidAPI method
      const profileData = await fetchFromRapidAPI(username);
      console.log('✅ Successfully fetched profile via RapidAPI');
      return profileData;
    } catch (apiError) {
      console.warn('RapidAPI fetch failed, falling back to direct scraping:', apiError);
      // If API fails, fall back to direct scraping
      return await fallbackScrape(profileUrl);
    }
  } catch (error) {
    console.error('❌ Error scraping LinkedIn profile:', error);
    
    let errorMessage = 'Failed to scrape LinkedIn profile';
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else if (typeof error === 'string') {
      errorMessage += `: ${error}`;
    }
    
    return {
      name: '',
      currentRole: '',
      error: errorMessage,
    };
  }
}
