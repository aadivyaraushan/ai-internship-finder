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
