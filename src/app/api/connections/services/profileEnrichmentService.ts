import { Connection } from '@/lib/firestoreHelpers';
import { findLinkedInUrl } from '../utils/urlFinding/people/findLinkedInUrl';
import { verifyNonLinkedInUrl } from '../utils/urlFinding/people/verifyNonLinkedInUrl';
import {
  verifyProgramWebsite,
  findAndVerifyProgramWebsite,
} from '../utils/urlFinding/program/findAndVerifyProgramWebsite';
import { findEmailWithHunter } from '../utils/emailFinding/findEmailHunter';

/**
 * Enrich an individual connection with:
 *  - LinkedIn / profile URLs + scraped data
 *  - Program website verification (for program type)
 *  - Email address (Hunter.io)
 *
 *  This function is a direct extraction of the enrichment block from the
 *  legacy route.  All logging / fallback semantics are preserved.
 */
export async function enrichConnection(conn: Connection): Promise<Connection> {
  console.log(`🔄 Enriching: ${conn.name}`);

  // 1. PROFILE URL ENRICHMENT ------------------------------------------------
  if (!conn.linkedin_url) {
    try {
      const res = await findLinkedInUrl(conn);
      if (res.url) {
        conn.linkedin_url = res.url;
        conn.profile_source = res.profile_source;
        conn.profile_data = res.profile_data;
        conn.match_confidence = res.match_confidence;
      }
    } catch (err) {
      console.warn('LinkedIn enrichment failed:', err);
    }
  }

  // 2. NON-LINKEDIN URL VERIFICATION ----------------------------------------
  if (conn.url && !conn.website_verified) {
    try {
      const verified = await verifyNonLinkedInUrl(conn.url, conn, [conn.name]);
      if (!verified.error) {
        conn.website_verified = true;
        conn.profile_data = { ...(conn.profile_data || {}), ...verified };
      }
    } catch (err) {
      console.warn('Non-LinkedIn verification failed:', err);
    }
  }

  // 3. PROGRAM WEBSITE HANDLING ---------------------------------------------
  if (conn.type === 'program') {
    try {
      if (conn.website_url) {
        const { isValid } = await verifyProgramWebsite(conn);
        conn.website_verified = isValid;
      } else {
        const found = await findAndVerifyProgramWebsite(
          conn.name,
          conn.organization || undefined
        );
        if (found.url) {
          conn.website_url = found.url;
          conn.website_verified = true;
        }
      }
    } catch (err) {
      console.warn('Program website enrichment failed:', err);
    }
  }

  // 4. EMAIL ENRICHMENT ------------------------------------------------------
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
