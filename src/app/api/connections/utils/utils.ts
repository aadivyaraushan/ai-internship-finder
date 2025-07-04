import { Connection } from '@/lib/firestoreHelpers';

// Common types used across the application
export interface Goal {
  title: string;
  description?: string;
}

// Represents a target position the user is aiming for
export interface Role {
  title: string;
  description?: string;
}

export interface IndustryTransition {
  transition_context: string;
}

export interface WorkExperience {
  companies: string[];
  startup_experience: string[];
  industry_transitions?: IndustryTransition;
}

export interface Education {
  institutions: string[];
  current_level?: string;
}

export interface Activities {
  organizations: string[];
}

export interface Achievements {
  certifications: string[];
}

export interface GrowthAreas {
  learning_journey?: string;
}

export interface ConnectionAspects {
  education: Education;
  work_experience: WorkExperience;
  activities?: Activities;
  achievements?: Achievements;
  growth_areas?: GrowthAreas;
}

export interface LinkedInProfileData {
  name?: string;
  currentRole?: string;
  company?: string;
  error?: string;
  confidence?: {
    name: boolean;
    role: boolean;
    company: boolean;
  };
  technicalDetails?: string;
}

export interface ProfileData {
  name?: string;
  currentRole?: string;
  company?: string;
  error?: string;
  confidence?: {
    name: boolean;
    role: boolean;
    company: boolean;
  };
}

// Common constants
export const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

// Common utility functions
export const delay = (minMs = 750, maxMs = 2500) => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`⏳ Adding delay of ${ms}ms`);
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Type guards
export const isConnection = (item: any): item is Connection => {
  return (
    item && 
    typeof item === 'object' &&
    (item.website_url === undefined || typeof item.website_url === 'string') &&
    (item.linkedin_url === undefined || typeof item.linkedin_url === 'string')
  );
};
