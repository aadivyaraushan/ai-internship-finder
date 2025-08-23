import { getAnalytics, logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { app } from './firebase';

// Initialize Firebase Analytics
let firebaseAnalyticsInstance: any = null;

export const initializeAnalytics = () => {
  if (typeof window !== 'undefined') {
    try {
      firebaseAnalyticsInstance = getAnalytics(app);
      console.log('Firebase Analytics initialized');
    } catch (error) {
      console.error('Failed to initialize Firebase Analytics:', error);
    }
  }
};

// Set user ID for retention tracking (automatically links with Firebase Auth)
export const setAnalyticsUserId = (userId: string) => {
  if (firebaseAnalyticsInstance) {
    setUserId(firebaseAnalyticsInstance, userId);
  }
};

// Set user properties for cohort analysis
export const setAnalyticsUserProperties = (properties: {
  signup_date?: string;
  user_type?: string;
  has_resume?: boolean;
  first_search_date?: string;
  total_connections_found?: number;
}) => {
  if (firebaseAnalyticsInstance) {
    setUserProperties(firebaseAnalyticsInstance, properties);
  }
};

// Helper function to log events
const trackEvent = (eventName: string, parameters?: { [key: string]: any }) => {
  if (firebaseAnalyticsInstance) {
    logEvent(firebaseAnalyticsInstance, eventName, parameters);
  }
};

// App-specific event tracking functions
export const firebaseAnalytics = {
  // User Authentication Events (Firebase has built-in login/signup events)
  trackSignup: (method: string = 'email') => {
    trackEvent('sign_up', { method });
  },
  
  trackLogin: (method: string = 'email') => {
    trackEvent('login', { method });
  },
  
  trackLogout: () => {
    trackEvent('logout');
  },

  // Resume Events
  trackResumeUpload: (success: boolean) => {
    trackEvent('resume_upload', { success, event_category: 'resume' });
  },
  
  trackResumeAnalysis: (success: boolean) => {
    trackEvent('resume_analysis', { success, event_category: 'resume' });
  },

  // Connection Finding Events
  trackConnectionSearch: (goalType: string, preferences: { connections: boolean, programs: boolean }) => {
    trackEvent('connection_search_started', { 
      goal_type: goalType,
      search_people: preferences.connections,
      search_programs: preferences.programs,
      event_category: 'connections'
    });
  },
  
  trackConnectionFound: (type: 'person' | 'program', count: number) => {
    trackEvent('connection_found', { 
      connection_type: type, 
      count,
      event_category: 'connections'
    });
  },
  
  trackConnectionStatusChange: (fromStatus: string, toStatus: string, connectionType: 'person' | 'program') => {
    trackEvent('connection_status_change', { 
      from_status: fromStatus,
      to_status: toStatus,
      connection_type: connectionType,
      event_category: 'connections'
    });
  },

  // Engagement Events
  trackPersonalizationEnabled: () => {
    trackEvent('personalization_enabled', { event_category: 'engagement' });
  },
  
  trackPersonalizationSaved: () => {
    trackEvent('personalization_saved', { event_category: 'engagement' });
  },
  
  trackOutreachMessageViewed: (connectionType: 'person' | 'program') => {
    trackEvent('outreach_message_viewed', { 
      connection_type: connectionType,
      event_category: 'engagement'
    });
  },
  
  trackContactClicked: (contactType: 'email' | 'linkedin', connectionType: 'person' | 'program') => {
    trackEvent('contact_clicked', { 
      contact_type: contactType,
      connection_type: connectionType,
      event_category: 'engagement'
    });
  },

  // Filter and Search Events
  trackFilterUsed: (filterType: string, value: string) => {
    trackEvent('filter_used', { 
      filter_type: filterType,
      filter_value: value,
      event_category: 'navigation'
    });
  },
  
  trackSearchUsed: (searchTerm: string) => {
    trackEvent('search_used', { 
      has_term: searchTerm.length > 0,
      event_category: 'navigation'
    });
  },

  // Modal and UI Events
  trackModalOpened: (modalType: string) => {
    trackEvent('modal_opened', { modal_type: modalType, event_category: 'ui' });
  },
  
  trackModalClosed: (modalType: string) => {
    trackEvent('modal_closed', { modal_type: modalType, event_category: 'ui' });
  },
  
  trackArchiveToggled: (showArchive: boolean) => {
    trackEvent('archive_toggled', { show_archive: showArchive, event_category: 'ui' });
  },

  // Error Events
  trackError: (errorType: string, errorMessage: string) => {
    trackEvent('app_error', { 
      error_type: errorType,
      error_message: errorMessage.substring(0, 100),
      event_category: 'errors'
    });
  },
  
  trackAdBlockerDetected: () => {
    trackEvent('adblocker_detected', { event_category: 'technical' });
  },
  
  trackAdBlockerWarningDismissed: () => {
    trackEvent('adblocker_warning_dismissed', { event_category: 'technical' });
  },

  // Conversion Events (Key Metrics) - Firebase has built-in conversion tracking
  trackSuccessfulInternshipAcquisition: () => {
    // This is a conversion event - Firebase will automatically track for retention analysis
    trackEvent('internship_acquired', { 
      event_category: 'conversions',
      value: 1
    });
  },
  
  trackFirstConnectionContacted: () => {
    // Another key conversion event
    trackEvent('first_connection_contacted', { 
      event_category: 'conversions',
      milestone: 'first_contact'
    });
  },
  
  // Firebase Analytics has built-in session tracking, but we can add custom session events
  trackActiveUser: (sessionDuration: number) => {
    // Track users who spend more than 5 minutes in the app
    if (sessionDuration > 300000) { // 5 minutes in milliseconds
      trackEvent('active_session', { 
        session_duration_seconds: Math.floor(sessionDuration / 1000),
        event_category: 'engagement'
      });
    }
  },

  // Performance Events
  trackConnectionFindingTime: (duration: number) => {
    trackEvent('connection_finding_duration', { 
      duration_seconds: Math.floor(duration / 1000),
      event_category: 'performance'
    });
  },
  
  trackPageLoadTime: (pageName: string, loadTime: number) => {
    trackEvent('page_load_time', { 
      page_name: pageName,
      load_time_ms: Math.floor(loadTime),
      event_category: 'performance'
    });
  },

  // Retention-specific events (Firebase Analytics will automatically create retention reports from these)
  trackDailyActive: () => {
    trackEvent('daily_active_user', { event_category: 'retention' });
  },
  
  trackWeeklyActive: () => {
    trackEvent('weekly_active_user', { event_category: 'retention' });
  },
  
  trackReturnVisit: (daysSinceLastVisit: number) => {
    trackEvent('return_visit', { 
      days_since_last_visit: daysSinceLastVisit,
      event_category: 'retention'
    });
  },

  // Feature adoption tracking
  trackFeatureFirstUse: (featureName: string) => {
    trackEvent('feature_first_use', { 
      feature_name: featureName,
      event_category: 'adoption'
    });
  },

  // User journey milestones
  trackOnboardingComplete: (step: string) => {
    trackEvent('onboarding_complete', { 
      completed_step: step,
      event_category: 'onboarding'
    });
  },
};

// Legacy exports for compatibility (will be replaced throughout the app)
export const analytics = firebaseAnalytics;