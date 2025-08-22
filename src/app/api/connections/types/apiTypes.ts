import { Connection } from '@/lib/firestoreHelpers';
import { ResumeAnalysisResult } from './connectionTypes';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  details?: unknown;
}

export interface ConnectionSearchResponse {
  connections: Connection[];
  aspects: ResumeAnalysisResult;
}

export interface ErrorResponse {
  error: string;
  details?: unknown;
}
