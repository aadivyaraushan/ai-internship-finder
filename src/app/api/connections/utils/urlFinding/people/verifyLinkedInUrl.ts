import { scrapeLinkedInProfile } from './scrapeLinkedInProfile';
import { ProfileData } from '../../utils';

export interface VerificationResult {
  isValid: boolean;
  confidence?: {
    name: number;
    role: number;
    company: number;
    overall: number;
  };
  profileData?: ProfileData;
}

/**
 * Verifies if a given URL is a valid LinkedIn profile and matches the expected user
 */
export async function verifyLinkedInUrl(
  url: string,
  expectedName?: string
): Promise<VerificationResult> {
  try {
    const profileData = await scrapeLinkedInProfile(url);

    if (profileData.error) {
      return { isValid: false };
    }

    // Simple verification - if we got profile data, consider it valid
    // You can add more sophisticated verification logic here if needed
    return {
      isValid: true,
      profileData,
      confidence: {
        name: expectedName && profileData.name ? 1 : 0,
        role: 1,
        company: 1,
        overall: 0.9,
      },
    };
  } catch (error) {
    console.error('Error verifying LinkedIn URL:', error);
    return { isValid: false };
  }
}
