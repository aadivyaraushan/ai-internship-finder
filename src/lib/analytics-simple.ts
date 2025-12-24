// Simple analytics fallback - uses console logging for development
// and can be easily switched to any analytics provider

const isDev = process.env.NODE_ENV === 'development';

// Simple event logging function
const logEvent = (eventName: string, parameters?: Record<string, unknown>) => {
  if (isDev) {
    console.log(`📊 Analytics Event: ${eventName}`, parameters);
  }
  
  // In production, you could send to any analytics service
  // or save to Firestore for custom analytics
  if (typeof window !== 'undefined' && !isDev) {
    // Store in localStorage or send to your backend
    const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
    events.push({
      event: eventName,
      parameters,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('analytics_events', JSON.stringify(events.slice(-100))); // Keep last 100 events
  }
};

// Simple analytics functions that work immediately
export const simpleAnalytics = {
  // User Authentication Events
  trackSignup: (method: string = 'email') => {
    logEvent('sign_up', { method });
  },
  
  trackLogin: (method: string = 'email') => {
    logEvent('login', { method });
  },
  
  trackLogout: () => {
    logEvent('logout');
  },

  // Resume Events
  trackResumeUpload: (success: boolean) => {
    logEvent('resume_upload', { success });
  },
  
  trackResumeAnalysis: (success: boolean) => {
    logEvent('resume_analysis', { success });
  },

  // Connection Finding Events
  trackConnectionSearch: (goalType: string, preferences: { connections: boolean, programs: boolean }) => {
    logEvent('connection_search_started', { 
      goal_type: goalType,
      search_people: preferences.connections,
      search_programs: preferences.programs
    });
  },
  
  trackConnectionFound: (type: 'person' | 'program', count: number) => {
    logEvent('connection_found', { connection_type: type, count });
  },
  
  trackConnectionStatusChange: (fromStatus: string, toStatus: string, connectionType: 'person' | 'program') => {
    logEvent('connection_status_change', { 
      from_status: fromStatus,
      to_status: toStatus,
      connection_type: connectionType
    });
  },

  // Engagement Events
  trackPersonalizationEnabled: () => {
    logEvent('personalization_enabled');
  },
  
  trackPersonalizationSaved: () => {
    logEvent('personalization_saved');
  },
  
  trackOutreachMessageViewed: (connectionType: 'person' | 'program') => {
    logEvent('outreach_message_viewed', { connection_type: connectionType });
  },
  
  trackContactClicked: (contactType: 'email' | 'linkedin', connectionType: 'person' | 'program') => {
    logEvent('contact_clicked', { 
      contact_type: contactType,
      connection_type: connectionType
    });
  },

  // UI Events
  trackModalOpened: (modalType: string) => {
    logEvent('modal_opened', { modal_type: modalType });
  },
  
  trackModalClosed: (modalType: string) => {
    logEvent('modal_closed', { modal_type: modalType });
  },

  // Error Events
  trackError: (errorType: string, errorMessage: string) => {
    logEvent('app_error', { 
      error_type: errorType,
      error_message: errorMessage.substring(0, 100)
    });
  },
  
  trackAdBlockerDetected: () => {
    logEvent('adblocker_detected');
  },
  
  trackAdBlockerWarningDismissed: () => {
    logEvent('adblocker_warning_dismissed');
  },

  // Conversion Events
  trackSuccessfulInternshipAcquisition: () => {
    logEvent('internship_acquired', { value: 1 });
  },
  
  trackFirstConnectionContacted: () => {
    logEvent('first_connection_contacted');
  },
  
  trackActiveUser: (sessionDuration: number) => {
    if (sessionDuration > 300000) { // 5 minutes
      logEvent('active_session', { 
        session_duration_seconds: Math.floor(sessionDuration / 1000)
      });
    }
  },

  // Performance Events
  trackConnectionFindingTime: (duration: number) => {
    logEvent('connection_finding_duration', { 
      duration_seconds: Math.floor(duration / 1000)
    });
  },
  
  trackPageLoadTime: (pageName: string, loadTime: number) => {
    logEvent('page_load_time', { 
      page_name: pageName,
      load_time_ms: Math.floor(loadTime)
    });
  },

  // Retention Events
  trackDailyActive: () => {
    logEvent('daily_active_user');
  },
  
  trackReturnVisit: (daysSinceLastVisit: number) => {
    logEvent('return_visit', { days_since_last_visit: daysSinceLastVisit });
  },

  // Filter Events
  trackFilterUsed: (filterType: string, value: string) => {
    logEvent('filter_used', { filter_type: filterType, filter_value: value });
  },
  
  trackSearchUsed: (searchTerm: string) => {
    logEvent('search_used', { has_term: searchTerm.length > 0 });
  },

  // Feature adoption
  trackFeatureFirstUse: (featureName: string) => {
    logEvent('feature_first_use', { feature_name: featureName });
  },
};

// Initialize function (no-op for simple version)
export const initializeSimpleAnalytics = () => {
  console.log('📊 Simple Analytics initialized');
};

// User identification functions (store in localStorage for now)
export const setSimpleAnalyticsUserId = (userId: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('analytics_user_id', userId);
    logEvent('user_identified', { user_id: userId });
  }
};

export const setSimpleAnalyticsUserProperties = (properties: Record<string, unknown>) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('analytics_user_properties', JSON.stringify(properties));
    logEvent('user_properties_set', properties);
  }
};