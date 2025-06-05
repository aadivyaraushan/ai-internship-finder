import { useCallback } from 'react';
import { logEvent, Analytics } from 'firebase/analytics';
import { analytics } from '@/lib/firebase';

export function useAnalytics() {
  const trackEvent = async (
    event: string,
    properties?: Record<string, any>
  ) => {
    try {
      const response = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event,
          properties,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to track event');
      }

      return await response.json();
    } catch (error) {
      console.error('Analytics Error:', error);
    }
  };

  return { trackEvent };
}
