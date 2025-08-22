import { fetchFromLinkedInAPI, LinkedInApiResponse } from './linkedinApiClient';

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

interface LinkedInProfileData {
  name: string;
  currentRole: string;
  company: string;
  location: string;
  bio: string;
  experience: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
  confidence: number;
}

function transformLinkedInData(data: LinkedInApiResponse['data']): LinkedInProfileData {
  const currentExperience = data.experiences?.[0];

  return {
    name: data.full_name || '',
    currentRole: currentExperience?.title || '',
    company: currentExperience?.company || data.company,
    location: data.city || '',
    bio: data.about || '',
    confidence: 0.8,
    experience:
      data.experiences?.map((exp: { title: string; company: string; date_range: string; is_current: boolean }) => ({
        title: exp.title,
        company: exp.company,
        duration: exp.date_range,
        isCurrent: exp.is_current,
      })) || [],
    education:
      data.educations?.map((edu: { school: string; degree: string; field_of_study: string; date_range: string }) => ({
        school: edu.school,
        degree: edu.degree,
        field: edu.field_of_study,
        duration: edu.date_range,
      })) || [],
    skills: currentExperience?.skills?.split(' · ') || [],
  };
}

export async function scrapeLinkedInProfile(profileUrl: string): Promise<{ error?: string; [key: string]: unknown }> {
  try {
    // console.log(`🔍 Attempting to scrape LinkedIn profile: ${profileUrl}`);

    // First try the new LinkedIn API
    try {
      const apiData = await fetchFromLinkedInAPI(profileUrl);
      const profileData = transformLinkedInData(apiData);
      // console.log('✅ Successfully fetched profile via LinkedIn API');
      return { ...profileData } as { error?: string; [key: string]: unknown };
    } catch {
      // console.log('LinkedIn Profile not found', apiError);
      return { error: 'Profile not found' };
    }
  } catch (error) {
    // console.error('❌ Error scraping LinkedIn profile:', error);

    let errorMessage = 'Failed to scrape LinkedIn profile';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      error: errorMessage,
    };
  }
}