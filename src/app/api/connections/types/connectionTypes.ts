import { Role } from '../utils/utils';

export interface SharedActivity {
  name: string;
  year: string;
  type: string;
}

// Structure returned by resume analysis service
export interface ResumeAnalysisResult {
  education: any;
  work_experience: any;
  activities: any;
  achievements: any;
  growth_areas: any;
}

export interface ConnectionRequest {
  roles?: Role[];
  resumeContext?: string;
  goalTitle?: string;
  race?: string;
  location?: string;
  preferences?: {
    programs: boolean;
    connections: boolean;
  };
}
