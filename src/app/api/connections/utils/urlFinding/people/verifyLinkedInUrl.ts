import { Connection } from '@/lib/firestoreHelpers';
import { scrapeLinkedInProfile } from './scrapeLinkedInProfile';

/**
 * Verifies a LinkedIn URL against a connection object.
 *
 * @param {string} url - The LinkedIn URL to verify
 * @param {Connection} conn - The connection object to compare against
 * @returns {Promise<{valid: boolean, profile_data: any}>} - Object indicating validity and profile data
 */
export async function verifyLinkedInUrl(
  url: string,
  conn: Connection
): Promise<{
  valid: boolean;
  profile_data?: any;
}> {
  try {
    const profileData = await scrapeLinkedInProfile(url);

    if (profileData.error) {
      return { valid: false };
    }

    // Check if scraped data matches our connection
    const nameMatch =
      profileData.name?.toLowerCase().includes(conn.name.toLowerCase()) ||
      conn.name.toLowerCase().includes(profileData.name?.toLowerCase() || '');

    const roleMatch =
      profileData.currentRole
        ?.toLowerCase()
        .includes(conn.current_role?.toLowerCase() || '') ||
      conn.current_role
        ?.toLowerCase()
        .includes(profileData.currentRole?.toLowerCase() || '');

    const companyMatch =
      profileData.company
        ?.toLowerCase()
        .includes(conn.company?.toLowerCase() || '') ||
      conn.company
        ?.toLowerCase()
        .includes(profileData.company?.toLowerCase() || '');

    // Consider it valid if at least two of the three match
    const matchCount = [nameMatch, roleMatch, companyMatch].filter(
      Boolean
    ).length;
    const valid = matchCount >= 2;

    if (valid) {
      console.log(`✅ Verified LinkedIn URL: ${url}`);
    } else {
      console.log(`❌ LinkedIn URL verification failed for: ${url}`);
    }

    return {
      valid,
      profile_data: valid ? profileData : undefined,
    };
  } catch (error) {
    console.error('❌ LinkedIn URL verification failed:', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return { valid: false };
  }
}
