'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { 
  initializeAnalytics, 
  setAnalyticsUserId, 
  setAnalyticsUserProperties, 
  analytics 
} from '@/lib/analytics';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Initialize Firebase Analytics on mount
    initializeAnalytics();
    
    // Track session start time for active user metrics
    const sessionStart = Date.now();
    
    // Set up Firebase Auth listener for user identification
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Set user ID for retention tracking
        setAnalyticsUserId(user.uid);
        
        // Set user properties for cohort analysis
        setAnalyticsUserProperties({
          signup_date: user.metadata.creationTime || new Date().toISOString(),
          user_type: 'authenticated',
          has_resume: false, // Will be updated when we know more
        });
        
        // Track daily active user
        analytics.trackDailyActive();
        
        // Track return visit if not first visit (client-side only)
        if (typeof window !== 'undefined') {
          const lastVisit = localStorage.getItem('lastVisit');
          if (lastVisit) {
            const daysSinceLastVisit = Math.floor((Date.now() - parseInt(lastVisit)) / (1000 * 60 * 60 * 24));
            if (daysSinceLastVisit > 0) {
              analytics.trackReturnVisit(daysSinceLastVisit);
            }
          }
          localStorage.setItem('lastVisit', Date.now().toString());
        }
      }
    });
    
    // Track session duration on beforeunload
    const handleBeforeUnload = () => {
      const sessionDuration = Date.now() - sessionStart;
      analytics.trackActiveUser(sessionDuration);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      unsubscribeAuth();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    // Firebase Analytics automatically tracks page views, but we can add custom page tracking
    if (pathname && typeof window !== 'undefined') {
      // Track page load performance
      if (window.performance && window.performance.getEntriesByType) {
        const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation && navigation.loadEventEnd > 0) {
          const loadTime = navigation.loadEventEnd - navigation.fetchStart;
          analytics.trackPageLoadTime(pathname, loadTime);
        }
      }
    }
  }, [pathname]);

  return <>{children}</>;
}