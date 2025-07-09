import { Connection } from '@/lib/firestoreHelpers';
import { findAndVerifyLinkedInUrl } from '../utils/urlFinding/people/findAndVerifyLinkedinUrl';
import { verifyNonLinkedInUrl } from '../utils/urlFinding/people/verifyNonLinkedInUrl';
import { findEmailWithHunter } from '../utils/emailFinding/findEmailHunter';
import { verifyLinkedInUrl } from '../utils/urlFinding/people/verifyLinkedInUrl';

/**
 * Enriches a person connection with additional data:
 *  - LinkedIn/profile URLs + scraped data
 *  - Non-LinkedIn URL verification
 *  - Email address
 *
 * @param {Connection} conn - The person connection to enrich
 * @returns {Promise<Connection>} The enriched connection
 */
export async function enrichPersonConnection(
  conn: Connection
): Promise<Connection> {
  console.log(` Enriching person: ${conn.name}`);

  // 1. VERIFY EXISTING LINKEDIN URL (if present)
  if (conn.verified_profile_url) {
    try {
      const verification = await verifyLinkedInUrl(
        conn.verified_profile_url,
        conn
      );
      if (verification.valid) {
        // Valid LinkedIn URL
        conn.website_verified = true;
        conn.profile_data = verification.profile_data;
      } else {
        // Invalid LinkedIn URL - clear it so we can search for a new one
        conn.verified_profile_url = undefined;
      }
    } catch (err) {
      console.warn('LinkedIn URL verification failed:', err);
    }
  }

  // 2. VERIFY SOURCE URL (if present and not LinkedIn)
  if (conn.url && !conn.website_verified) {
    try {
      if (conn.url.includes('linkedin.com')) {
        // Verify as LinkedIn URL
        const verification = await verifyLinkedInUrl(conn.url, conn);
        if (verification.valid) {
          conn.verified_profile_url = conn.url;
          conn.website_verified = true;
          conn.profile_data = verification.profile_data;
        }
      } else {
        // Verify as non-LinkedIn URL
        const verified = await verifyNonLinkedInUrl(conn.url, conn, [
          conn.name,
        ]);
        if (!verified.error) {
          conn.website_verified = true;
          conn.profile_data = { ...(conn.profile_data || {}), ...verified };
        }
      }
    } catch (err) {
      console.warn('URL verification failed:', err);
    }
  }

  // 3. SEARCH FOR NEW LINKEDIN URL (if no valid URL found)
  if (!conn.verified_profile_url && !conn.website_verified) {
    try {
      const res = await findAndVerifyLinkedInUrl(
        conn,
        conn.source ?? undefined
      );
      if (res.verified_profile_url) {
        conn.verified_profile_url = res.verified_profile_url;
        conn.profile_source = res.profile_source;
        conn.profile_data = res.profile_data;
        conn.match_confidence = { overall: res.match_confidence };
      }
    } catch (err) {
      console.warn('LinkedIn search failed:', err);
    }
  }

  // 4. EMAIL ENRICHMENT
  if (!conn.email) {
    try {
      const email = await findEmailWithHunter(conn);
      if (email) conn.email = email;
    } catch (err) {
      console.warn('Email enrichment failed:', err);
    }
  }

  return conn;
}
