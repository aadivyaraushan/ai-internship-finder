import { Connection } from '@/lib/firestoreHelpers';
import { scrapeLinkedInProfile } from './scrapeLinkedInProfile';

export async function findAndVerifyLinkedInUrl(
  _connection: Connection,
  existingUrl: string
): Promise<{ valid: boolean; profile_data?: unknown }> {
  // If we already have a verified URL, try to use it first
  if (existingUrl && existingUrl.includes('linkedin.com')) {
    try {
      const profileData = await scrapeLinkedInProfile(existingUrl);
      if (profileData && !profileData.error) {
        return {
          valid: true,
          profile_data: profileData,
        };
      }
    } catch {
      // Failed to verify existing LinkedIn URL
    }
  }

  return {
    valid: false,
  };
}