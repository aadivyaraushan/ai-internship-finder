import axios from 'axios';

export interface LinkedInApiResponse {
  data: {
    about: string;

    certifications: Array<{
      authority: string;

      issued: string;

      name: string;

      url: string | null;
    }>;

    city: string;

    company: string;

    company_description: string;

    company_domain: string;

    company_employee_count: number;

    company_employee_range: string;

    company_industry: string;

    company_linkedin_url: string;

    company_logo_url: string;

    company_website: string;

    company_year_founded: number;

    connection_count: number;

    country: string;

    courses: Array<unknown>; // Empty array in response, type unknown

    current_company_join_month: number | null;

    current_company_join_year: number | null;

    current_job_duration: string;

    educations: Array<{
      activities: string;

      date_range: string;

      degree: string;

      end_month: string;

      end_year: string;

      field_of_study: string;

      school: string;

      school_id: string;

      school_linkedin_url: string;

      school_logo_url: string;

      start_month: string;

      start_year: string;
    }>;

    email: string;

    experiences: Array<{
      company: string;

      company_id: string;

      company_linkedin_url: string;

      company_logo_url: string;

      company_public_url: string | null;

      date_range: string;

      description: string;

      duration: string;

      end_month: string | null;

      end_year: string | null;

      is_current: boolean;

      job_type: string;

      location: string;

      skills: string;

      start_month: string | null;

      start_year: number | null;

      title: string;
    }>;

    first_name: string;

    follower_count: number;

    full_name: string;

    headline: string;

    honors_and_awards: Array<{
      associated: string | null;

      date: string;

      description: string | null;

      issuer: string;

      title: string;
    }>;

    hq_city: string;

    hq_country: string;

    hq_region: string;

    is_creator: boolean;

    is_influencer: boolean;

    is_premium: boolean;

    is_verified: boolean;

    job_title: string;

    languages: Array<{
      name: string;

      proficiency: string;
    }>;

    last_name: string;

    linkedin_url: string;

    location: string;

    organizations: Array<{
      associated: string | null;

      date_range: string;

      description: string | null;

      name: string;
    }>;

    patents: Array<unknown>; // Empty array in response, type unknown

    phone: string;

    profile_id: string;

    profile_image_url: string;

    profile_status: {
      contact_info_updated: string;

      joined_date: string;

      profile_photo_updated: string;

      verifications: Array<{
        description: string;

        method: string;

        time: string;
      }>;

      verified: boolean;
    };

    projects: Array<unknown>; // Empty array in response, type unknown

    public_id: string;

    publications: Array<{
      date: string;

      description: string | null;

      link: string;

      publisher: string;

      title: string;
    }>;

    school: string;

    skills: string; // Pipe-separated string of skills

    state: string;

    urn: string;

    volunteers: Array<{
      company: string;

      company_linkedin_url: string | null;

      date_range: string;

      description: string;

      duration: string;

      title: string;

      topic: string | null;
    }>;
  };
}
/**
 * Fetches LinkedIn profile data using the LinkedIn API with retry logic
 */
export async function fetchFromLinkedInAPI(
  profileUrl: string,
  attempt = 1,
  maxAttempts = 1
): Promise<LinkedInApiResponse['data']> {
  if (!process.env.RAPID_API_KEY) {
    throw new Error('RAPID_API_KEY is not configured');
  }

  try {
    // Only add delay for retry attempts, not the first attempt
    if (attempt > 1) {
      // More reasonable exponential backoff: 500ms, 1s, 2s (capped at 3s)
      const delayMs = Math.min(500 * Math.pow(2, attempt - 2), 3000);
      // console.log(
      //   `⏳ Adding retry delay of ${delayMs}ms before LinkedIn API request (attempt ${attempt}/${maxAttempts})`
      // );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const url = `https://fresh-linkedin-profile-data.p.rapidapi.com/get-profile-public-data?linkedin_url=${encodeURIComponent(
      profileUrl
    )}&include_skills=false&include_certifications=false&include_publications=false&include_honors=false&include_volunteers=false&include_projects=false&include_patents=false&include_courses=false&include_organizations=false&include_profile_status=false&include_company_public_url=false`;

    const response = await axios.get<LinkedInApiResponse>(url, {
      headers: {
        'x-rapidapi-host': 'fresh-linkedin-profile-data.p.rapidapi.com',
        'x-rapidapi-key': process.env.RAPID_API_KEY,
      },
      timeout: 20000, // Increased timeout to 20 seconds
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    // Handle rate limiting
    if (response.status === 429) {
      if (attempt < maxAttempts) {
        // console.log(
        //   `⚠️ Rate limited (429). Retrying (${attempt + 1}/${maxAttempts})...`
        // );
        return fetchFromLinkedInAPI(profileUrl, attempt + 1, maxAttempts);
      }
      throw new Error(
        `Rate limited by LinkedIn API after ${maxAttempts} attempts`
      );
    }

    if (response.status !== 200) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const apiData = response.data;
    if (!apiData.data) {
      throw new Error('Invalid API response structure');
    }

    return apiData.data;
  } catch (error) {
    // console.error('Error in fetchFromLinkedInAPI:', error);
    if (attempt < maxAttempts) {
      // console.log(
      //   `⚠️ Error occurred. Retrying (${attempt + 1}/${maxAttempts})...`
      // );
      return fetchFromLinkedInAPI(profileUrl, attempt + 1, maxAttempts);
    }
    throw error;
  }
}
