import { Connection } from '@/lib/firestoreHelpers';
import { ResumeAnalysisResult } from './connectionTypes';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  details?: any;
}

export interface ConnectionSearchResponse {
  connections: Connection[];
  aspects: ResumeAnalysisResult;
}

export interface ErrorResponse {
  error: string;
  details?: any;
}
