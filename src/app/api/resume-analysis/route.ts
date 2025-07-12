import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { callClaude } from '../../../lib/anthropicClient';
import { z } from 'zod';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { EventEmitter } from 'events';
import { analyzeResume } from '@/app/api/connections/services/resumeAnalysisService';

// Create a global event emitter (consider using a request-specific emitter in production)
const globalEmitter = new EventEmitter();

type School = {
  school_name: string;
  clubs: string[];
  awards: string[];
  gpa: string | null;
  notable_coursework: string[];
};

type Project = {
  project_name: string;
  description: string;
  responsibilities: string[];
  recognition: string | null;
  skills: string[];
};

type WorkExperience = {
  workplace: string;
  notable_projects: string[];
  role: string;
  reference_email: string | null;
  is_alumni: boolean;
};

// Define Zod schemas for each section
const EducationSchema = z.object({
  school_name: z.string().describe('Name of the educational institution'),
  clubs: z
    .array(z.string())
    .describe('List of clubs and organizations participated in'),
  awards: z.array(z.string()).describe('List of academic awards and honors'),
  gpa: z.string().nullable().describe('GPA if mentioned'),
  notable_coursework: z
    .array(z.string())
    .describe('List of relevant courses taken'),
});

const PersonalProjectSchema = z.object({
  project_name: z.string().describe('Name of the project'),
  description: z.string().describe('Brief description of the project'),
  responsibilities: z
    .array(z.string())
    .describe('Key responsibilities and contributions'),
  recognition: z
    .string()
    .nullable()
    .describe('Any recognition or achievements'),
  skills: z.array(z.string()).describe('Technical skills used in the project'),
});

const WorkExperienceSchema = z.object({
  workplace: z.string().describe('Name of the company or organization'),
  notable_projects: z.array(z.string()).describe('Key projects worked on'),
  role: z.string().describe('Job title or position'),
  reference_email: z
    .string()
    .nullable()
    .describe('Email of reference if provided'),
  is_alumni: z.boolean().describe('Whether they are still working there'),
});

// Define the main resume schema
type ResumeAnalysisResponse = {
  education: Array<{
    school_name: string;
    clubs: string[];
    awards: string[];
    gpa: string | null;
    notable_coursework: string[];
  }>;
  skills: string[];
  personal_projects: Array<{
    project_name: string;
    description: string;
    responsibilities: string[];
    recognition: string | null;
    skills: string[];
  }>;
  workex: Array<{
    workplace: string;
    notable_projects: string[];
    role: string;
    reference_email: string | null;
    is_alumni: boolean;
  }>;
  linkedin: string | null;
  per_web: string | null;
};

const ResumeSchema = z.object({
  education: z.array(EducationSchema).describe('Educational background'),
  skills: z.array(z.string()).describe('Technical and non-technical skills'),
  personal_projects: z
    .array(PersonalProjectSchema)
    .describe('Personal and academic projects'),
  workex: z.array(WorkExperienceSchema).describe('Work experience entries'),
  linkedin: z.string().nullable().describe('LinkedIn profile URL'),
  per_web: z.string().nullable().describe('Personal website URL'),
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Create a temporary file path
    const tempFilePath = join(tmpdir(), `resume-${Date.now()}.pdf`);
    await writeFile(tempFilePath, buffer);

    try {
      // Create a request-specific event emitter
      const requestEmitter = new EventEmitter();

      // Function to broadcast events for this request
      const broadcastEvent = (event: any) => {
        requestEmitter.emit('event', event);
      };

      // Define processing steps to match frontend
      const steps = [
        'Preparing upload',
        'Uploading file',
        'Parsing resume content',
        'Processing results with AI',
        'Uploading data',
      ];
      let currentStep = 0;

      // Broadcast initial events
      broadcastEvent({ type: 'step-init', steps });
      broadcastEvent({ type: 'step-update', stepIndex: currentStep });

      // Step 1: File reading -> Preparing upload (already step 0)
      // We are already at step 0, so move to step 1 for uploading file
      currentStep = 1;
      broadcastEvent({ type: 'step-update', stepIndex: currentStep });

      // Step 2: Load and parse PDF -> Parsing resume content
      currentStep = 2;
      broadcastEvent({ type: 'step-update', stepIndex: currentStep });
      const pdfData = await pdfParse(buffer);
      const text = pdfData.text;

      // Build the prompt for structured parsing
      const analysisPrompt = `<system>You are a resume parser that extracts structured information from resumes. You MUST return ONLY valid JSON - no other text, no markdown formatting, no explanation. The JSON must match the schema below exactly.</system>
<input>${text}</input>
<rules>
1. Return ONLY the JSON object - no other text
2. The JSON must be properly formatted with double quotes around property names
3. Extract all relevant information from the resume text
4. For education: Include all schools, clubs, awards, GPA if mentioned
5. For skills: List all technical and soft skills mentioned
6. For projects: Include both personal and academic projects
7. For work experience: Include internships and jobs
8. Extract LinkedIn and personal website URLs if present
9. If a field is not found in the text, use appropriate empty values ([], null, etc.)
10. Clean and standardize extracted text (remove extra spaces, normalize formatting)
</rules>`;

      // Parse the resume to structured data using AI
      const structuredData = await callClaude(analysisPrompt, {
        maxTokens: 1000,
        model: 'gpt-4.1-nano',
        schema: ResumeSchema,
        schemaLabel: 'Resume',
      });

      // Step 3: Processing results with AI -> Analyzing connection aspects
      currentStep = 3;
      broadcastEvent({ type: 'step-update', stepIndex: currentStep });
      const analyzedAspects = await analyzeResume(text);

      // Step 4: Uploading data
      currentStep = 4;
      broadcastEvent({ type: 'step-update', stepIndex: currentStep });
      // We are now returning the data to the frontend, which will handle the Firestore write

      // Log the final structured data for debugging
      console.log(
        'Structured Resume Data:',
        JSON.stringify(structuredData, null, 2)
      );

      return NextResponse.json({
        response: {
          rawText: text,
          structuredData: structuredData,
          resumeAspects: analyzedAspects,
          timestamp: new Date().toISOString(),
          status: 'success',
          processingSteps: {
            fileRead: true,
            pdfParsed: true,
            aiAnalysis: true,
            dataStored: true,
          },
        },
      });
    } finally {
      // Clean up temp file
      await unlink(tempFilePath);
    }
  } catch (error: any) {
    console.error('Error processing resume:', error);
    return NextResponse.json(
      {
        error: 'Error processing resume',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// SSE endpoint for progress events
export async function GET(req: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Write the SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const listener = (event: any) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  // Use a temporary event emitter for this connection
  const emitter = new EventEmitter();
  emitter.on('event', listener);

  // Cleanup on client disconnect
  req.signal.onabort = () => {
    emitter.off('event', listener);
    writer.close();
  };

  // Send initial event to keep connection alive
  writer.write(encoder.encode(': ping\n\n'));

  return new Response(responseStream.readable, { headers });
}
