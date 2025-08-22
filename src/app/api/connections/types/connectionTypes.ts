import { Role } from '../utils/utils';

export interface SharedActivity {
  name: string;
  year: string;
  type: string;
}

// Structure returned by resume analysis service
export interface ResumeAnalysisResult {
  education: unknown;
  work_experience: unknown;
  activities: unknown;
  achievements: unknown;
  growth_areas: unknown;
}

export interface ConnectionRequest {
  roles?: Role[];
  resumeContext?: string;
  goalTitle?: string;
  race?: string;
  preferences?: {
    programs: boolean;
    connections: boolean;
  };
}
