import { Connection } from '@/lib/firestoreHelpers';

interface ConnectionWithOptionalNames extends Omit<Connection, 'first_name' | 'last_name'> {
  first_name?: string;
  last_name?: string;
}
import { ProfileData } from '../../utils';
import { verifyLinkedInUrl } from './verifyLinkedInUrl';
import { findNonLinkedInUrl } from './findNonLinkedInUrl';

/**
 * Adds a random delay between requests to avoid rate limiting
 */
const delay = (minMs = 1000, maxMs = 3000) => {
  const delayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`⏳ Adding delay of ${delayMs}ms to prevent rate limiting`);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};

/**
 * Finds and verifies a LinkedIn URL for a given connection
 */
export async function findLinkedInUrl(
  connection: ConnectionWithOptionalNames,
  existingUrl?: string
): Promise<{
  url: string | null;
  profile_source?: string;
  profile_data?: ProfileData;
  match_confidence?: {
    name: number;
    role: number;
    company: number;
    overall: number;
  };
}> {
  let isVerifiedUrl = false;
  let attempts = 0;
  // Extract name variations from the connection
  const nameVariations = [connection.name];
  if (connection.first_name) nameVariations.push(connection.first_name);
  if (connection.last_name) nameVariations.push(connection.last_name);
  const filteredNameVariations = nameVariations.filter((name): name is string => Boolean(name));

  // If we already have a verified URL, try to use it first
  if (existingUrl && existingUrl.includes('linkedin.com')) {
    console.log('🔍 Checking existing LinkedIn URL:', existingUrl);
    const result = await verifyLinkedInUrl(existingUrl, connection.name);
    
    if (result.isValid && result.profileData) {
      console.log('✅ Using existing verified LinkedIn URL');
      return {
        url: existingUrl,
        profile_source: 'existing',
        profile_data: result.profileData,
        match_confidence: result.confidence
      };
    }
  }

  // Main search loop
  while (attempts < 3 && !isVerifiedUrl) {
    try {
      await delay();
      
      // TODO: Implement actual search logic here
      // This is a placeholder - you'll need to implement the actual search
      const searchResults: Array<string | { url: string; source_type: string }> = []; // await searchForProfiles(connection, filteredNameVariations);
      
      for (const urlData of searchResults) {
        const url = typeof urlData === 'string' ? urlData : urlData.url;
        const sourceType = typeof urlData === 'string' ? 'other' : urlData.source_type;

        console.log(`🔍 Attempting to verify URL (attempt ${attempts + 1}):`, {
          url,
          sourceType,
        });

        try {
          if (sourceType === 'linkedin') {
            const result = await verifyLinkedInUrl(url, connection.name);
            if (result.isValid && result.profileData) {
              return {
                url,
                profile_source: sourceType,
                profile_data: result.profileData,
                match_confidence: result.confidence
              };
            }
          } else {
            const profileData = await findNonLinkedInUrl(url, connection, nameVariations);
            if (profileData) {
              return {
                url,
                profile_source: sourceType,
                profile_data: profileData
              };
            }
          }
        } catch (error) {
          console.error(`Error verifying ${url}:`, error);
          continue;
        }
      }

      attempts++;
      if (attempts < 3) {
        console.log(`Attempt ${attempts} failed, retrying...`);
      }
    } catch (error) {
      console.error('Error during search:', error);
      attempts++;
      if (attempts < 3) {
        await delay();
      }
    }
  }

  console.log('❌ Could not find a valid LinkedIn URL');
  return { url: null };
}
