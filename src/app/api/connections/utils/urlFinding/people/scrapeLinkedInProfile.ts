import * as cheerio from 'cheerio';
import { delay } from '../../utils';
import { fetchFromLinkedInAPI, LinkedInApiResponse } from './linkedinApiClient';
import axios from 'axios';

interface LinkedInExperience {
  title: string;
  company: string;
  duration: string;
  isCurrent: boolean;
}

interface LinkedInEducation {
  school: string;
  degree?: string;
  field?: string;
  duration?: string;
}

interface LinkedInProfileData {
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

// Common headers to mimic a real browser
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
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
    /linkedin\.com\/in\/([^\/?#]+)/i, // Standard LinkedIn URL
    /linkedin\.com\/pub\/[^\/]+\/([^\/?#]+)/i, // Old LinkedIn URL format
    /linkedin\.com\/company\/([^\/?#]+)/i, // Company profile
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
 * Transforms LinkedIn API response to our internal LinkedInProfileData format
 */
function transformLinkedInData(
  data: LinkedInApiResponse['data']
): LinkedInProfileData {
  const currentExperience =
    data.experiences?.find((exp) => exp.is_current) || data.experiences?.[0];

  return {
    name: data.full_name || `${data.first_name} ${data.last_name}`.trim() || '',
    currentRole: data.headline || data.job_title || '',
    company: currentExperience?.company || data.company,
    about: data.about,
    location:
      data.location ||
      [data.city, data.state, data.country].filter(Boolean).join(', '),
    profileUrl: data.linkedin_url,
    profilePictureUrl: data.profile_image_url,
    experience:
      data.experiences?.map((exp) => ({
        title: exp.title,
        company: exp.company,
        duration: exp.duration,
        isCurrent: exp.is_current,
      })) || [],
    education:
      data.educations?.map((edu) => ({
        school: edu.school,
        degree: edu.degree,
        field: edu.field_of_study,
        duration: edu.date_range,
      })) || [],
    skills: currentExperience?.skills?.split(' · ') || [],
  };
}

export async function scrapeLinkedInProfile(profileUrl: string): Promise<any> {
  try {
    console.log(`🔍 Attempting to scrape LinkedIn profile: ${profileUrl}`);

    // First try the new LinkedIn API
    try {
      const apiData = await fetchFromLinkedInAPI(profileUrl);
      const profileData = transformLinkedInData(apiData);
      console.log('✅ Successfully fetched profile via LinkedIn API');
      return profileData;
    } catch (apiError) {
      console.log('LinkedIn Profile not found', apiError);
      return null;
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
