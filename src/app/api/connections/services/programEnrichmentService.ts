import { Connection } from '@/lib/firestoreHelpers';
import {
  verifyProgramWebsite,
  findAndVerifyProgramWebsite,
} from '../utils/urlFinding/program/findAndVerifyProgramWebsite';

/**
 * Enriches a program connection with additional data:
 *  - Program website verification
 *
 * @param {Connection} conn - The program connection to enrich
 * @returns {Promise<Connection>} The enriched connection
 */
export async function enrichProgramConnection(
  conn: Connection
): Promise<Connection> {
  // console.log(` Enriching program: ${conn.name}`);

  // Program website handling
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
  } catch {
    // console.warn('Program website enrichment failed:', err);
  }

  return conn;
}
