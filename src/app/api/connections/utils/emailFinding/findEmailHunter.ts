import { Connection } from '@/lib/firestoreHelpers';

/**
 * Attempts to discover a professional email address for a given person using the Hunter.io email-finder API.
 *
 * The API supports either a `domain` *or* `company` parameter.  We default to using the company name if provided
 * because that is generally available from our connection object.  If the company is a single word we derive a
 * naïve domain (e.g. `reddit` -> `reddit.com`).
 *
 * NOTE:  Make sure you have set `HUNTER_API_KEY` in your environment.  If the key is missing the function returns
 * `null` silently so that the calling code can gracefully continue without an e-mail address.
 */
export async function findEmailWithHunter(conn: Connection): Promise<string | null> {
  if (!conn.name) return null;

  const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
  if (!HUNTER_API_KEY) {
    console.warn('⚠️  HUNTER_API_KEY missing – skipping Hunter.io e-mail lookup');
    return null;
  }

  const [firstName, ...restName] = conn.name.split(' ');
  const lastName = restName.join(' ');
  if (!firstName || !lastName) return null;

  const params = new URLSearchParams({
    api_key: HUNTER_API_KEY,
    first_name: firstName,
    last_name: lastName,
  });

  if (conn.company) {
    // Prefer using the company parameter as Hunter can internally resolve it.
    params.append('company', conn.company);

    // Additionally try to derive a basic domain (best-effort) – Hunter will ignore invalid domains.
    const simpleDomain = conn.company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (simpleDomain) {
      params.append('domain', `${simpleDomain}.com`);
    }
  }

  const url = `https://api.hunter.io/v2/email-finder?${params.toString()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('⚠️  Hunter.io request failed', response.status, response.statusText);
      return null;
    }
    const json = (await response.json()) as any;
    return json?.data?.email ?? null;
  } catch (err) {
    console.warn('❌  Hunter.io lookup error', err);
    return null;
  }
}
