import { Connection } from '@/lib/firestoreHelpers';
import { z } from 'zod';

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
  from_industries?: string[];
  to_industries?: string[];
}

export interface WorkExperienceDetail {
  company: string;
  role: string;
  duration: string;
  responsibilities: string[];
  scale_and_impact: string;
  key_achievements: string[];
}

export interface WorkExperience {
  detailed_experiences: WorkExperienceDetail[];
  companies: string[]; // Keep for backward compatibility
  startup_experience: string[];
  industry_transitions?: IndustryTransition;
}

export interface Education {
  institutions: string[];
  current_level?: string;
  fields_of_study?: string[];
  graduation_years?: string[];
}

export interface Activities {
  organizations: string[];
  clubs?: string[];
  volunteer_work?: string[];
}

export interface Achievements {
  certifications: string[];
  awards?: string[];
  notable_projects?: string[];
}

export interface GrowthAreas {
  learning_journey?: string;
  developing_skills?: string[];
  target_roles?: string[];
}

export interface ConnectionAspects {
  education: Education;
  work_experience: WorkExperience;
  activities?: Activities;
  achievements?: Achievements;
  growth_areas?: GrowthAreas;
  professional_interests?: string;
  personal_interests?: string;
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
  name?: string | null;
  currentRole?: string | null;
  company?: string | null;
  error?: string;
  confidence?: {
    name: boolean;
    role: boolean;
    company: boolean;
  };
}

// Common constants
export const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
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
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Type guards
export const isConnection = (item: unknown): item is Connection => {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;

  const websiteUrl = obj.website_url;
  const verifiedProfileUrl = obj.verified_profile_url;

  return (
    (websiteUrl === undefined || typeof websiteUrl === 'string') &&
    (verifiedProfileUrl === undefined || typeof verifiedProfileUrl === 'string')
  );
};

const personSchema = z.object({
  id: z.string(),
  type: z.literal('person'),
  name: z.string(),
  current_role: z.string(),
  company: z.string().or(z.null()).optional(),
  verified_profile_url: z
    .string()
    .regex(/^https?:\/\/.+/i, { message: 'must be http/https URL' }),
  education_level: z
    .enum(['undergraduate', 'graduate', 'postgraduate'])
    .or(z.null())
    .optional(),
  direct_matches: z.array(z.string()).or(z.null()).optional(),
  goal_alignment: z.string().or(z.null()).optional(),
  shared_background_points: z.array(z.string()).or(z.null()).optional(),
  shared_professional_interests: z.array(z.string()).or(z.null()).optional(),
  shared_personal_interests: z.array(z.string()).or(z.null()).optional(),
  ai_outreach_message: z.string().or(z.null()).optional(),
});

const programSchema = z.object({
  id: z.string(),
  type: z.literal('program'),
  name: z.string(),
  organization: z.string(),
  program_type: z.string(),
  website_url: z
    .string()
    .regex(/^https?:\/\/.+/i, { message: 'must be http/https URL' })
    .or(z.null())
    .optional(),
  how_this_helps: z.string().or(z.null()).optional(),
  direct_matches: z.array(z.string()).or(z.null()).optional(),
  goal_alignment: z.string().or(z.null()).optional(),
  shared_background_points: z.array(z.string()).or(z.null()).optional(),
});

export const ConnectionsResponse = z.object({
  connections: z.array(z.union([personSchema, programSchema])),
});

export const aspectSchema = z.object({
  connection_aspects: z.object({
    education: z.object({
      institutions: z.array(z.string()),
      graduation_years: z.array(z.string()),
      fields_of_study: z.array(z.string()),
      current_level: z.enum(['high_school', 'undergraduate', 'graduate']),
    }),
    work_experience: z.object({
      detailed_experiences: z.array(z.object({
        company: z.string(),
        role: z.string(),
        duration: z.string(),
        responsibilities: z.array(z.string()),
        scale_and_impact: z.string(),
        key_achievements: z.array(z.string()),
      })),
      companies: z.array(z.string()), // Keep for backward compatibility
      startup_experience: z.array(z.string()),
      industry_transitions: z.object({
        from_industries: z.array(z.string()),
        to_industries: z.array(z.string()),
        transition_context: z.string(),
      }),
    }),
    personal_projects: z.array(z.string()),
    activities: z.object({
      clubs: z.array(z.string()),
      organizations: z.array(z.string()),
      volunteer_work: z.array(z.string()),
    }),
    achievements: z.object({
      certifications: z.array(z.string()),
      awards: z.array(z.string()),
      notable_projects: z.array(z.string()),
    }),
    growth_areas: z.object({
      developing_skills: z.array(z.string()),
      target_roles: z.array(z.string()),
      learning_journey: z.string(),
    }),
  }),
});
