import axios from 'axios';

export interface LinkedInApiResponse {
  data: {
    about: string;
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
    phone: string;
    profile_id: string;
    profile_image_url: string;
    public_id: string;
    school: string;
    state: string;
    urn: string;
  };
  message: string;
}

/**
 * Fetches LinkedIn profile data using the LinkedIn API with retry logic
 */
export async function fetchFromLinkedInAPI(
  profileUrl: string,
  attempt = 1,
  maxAttempts = 2
): Promise<LinkedInApiResponse['data']> {
  if (!process.env.RAPID_API_KEY) {
    throw new Error('RAPID_API_KEY is not configured');
  }

  try {
    // Increase delay between retries (exponential backoff)
    const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 15000); // Max 15s delay
    console.log(
      `⏳ Adding delay of ${delayMs}ms before LinkedIn API request (attempt ${attempt}/${maxAttempts})`
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const url = `https://data.p.rapidapi.com/get-profile-public-data?linkedin_url=${encodeURIComponent(
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
        console.log(
          `⚠️ Rate limited (429). Retrying (${attempt + 1}/${maxAttempts})...`
        );
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
    console.error('Error in fetchFromLinkedInAPI:', error);
    if (attempt < maxAttempts) {
      console.log(
        `⚠️ Error occurred. Retrying (${attempt + 1}/${maxAttempts})...`
      );
      return fetchFromLinkedInAPI(profileUrl, attempt + 1, maxAttempts);
    }
    throw error;
  }
}
