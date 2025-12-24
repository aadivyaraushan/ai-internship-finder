export interface Goal {
  title: string;
  description?: string;
}

export interface ProcessingStep {
  id: string;
  label: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface PersonalizationSettings {
  enabled: boolean;
  professionalInterests: string;
  personalInterests: string;
}

export type ConnectionPreferences = {
  connections: boolean;
  programs: boolean;
};


