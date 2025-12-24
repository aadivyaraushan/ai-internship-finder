import { Connection } from '@/lib/firestoreHelpers';
import { scrapeLinkedInProfile } from './scrapeLinkedInProfile';

/**
 * Verifies a LinkedIn URL against a connection object.
 *
 * @param {string} url - The LinkedIn URL to verify
 * @param {Connection} conn - The connection object to compare against
 * @returns {Promise<{valid: boolean, profile_data?: unknown}>} - Object indicating validity and profile data
 */
export async function verifyLinkedInUrl(
  url: string,
  conn: Connection
): Promise<{
  valid: boolean;
  profile_data?: unknown;
}> {
  try {
    const profileData = await scrapeLinkedInProfile(url);

    if (profileData.error) {
      return { valid: false };
    }

    const profileObj =
      profileData && typeof profileData === 'object'
        ? (profileData as Record<string, unknown>)
        : {};

    const profileName = typeof profileObj.name === 'string' ? profileObj.name : '';
    const profileRole =
      typeof profileObj.currentRole === 'string' ? profileObj.currentRole : '';
    const profileCompany =
      typeof profileObj.company === 'string' ? profileObj.company : '';

    // Check if scraped data matches our connection
    const nameMatch =
      profileName.toLowerCase().includes(conn.name.toLowerCase()) ||
      conn.name.toLowerCase().includes(profileName.toLowerCase());

    const roleMatch =
      profileRole.toLowerCase().includes(conn.current_role?.toLowerCase() || '') ||
      conn.current_role
        ?.toLowerCase()
        .includes(profileRole.toLowerCase());

    const companyMatch =
      profileCompany.toLowerCase().includes(conn.company?.toLowerCase() || '') ||
      conn.company
        ?.toLowerCase()
        .includes(profileCompany.toLowerCase());

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
