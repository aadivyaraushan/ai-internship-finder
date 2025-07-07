import { Connection } from '@/lib/firestoreHelpers';
import { ProfileData } from '../../utils';
import { verifyNonLinkedInUrl } from './verifyNonLinkedInUrl';

/**
 * Finds and verifies non-LinkedIn URLs for a connection
 */
export async function findNonLinkedInUrl(
  url: string,
  connection: Connection,
  nameVariations: string[]
): Promise<ProfileData | null> {
  try {
    // Use the existing verification function for non-LinkedIn URLs
    const profileData = await verifyNonLinkedInUrl(
      url,
      connection,
      nameVariations
    );

    // Only return if we have valid profile data
    if (profileData.name || profileData.currentRole || profileData.company) {
      return profileData;
    }
    return null;
  } catch (error) {
    console.error('Error finding non-LinkedIn URL:', error);
    return null;
  }
}
