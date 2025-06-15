import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { setResumeContext } from '../../../lib/memory';
import { z } from 'zod';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

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

type Resume = z.infer<typeof ResumeSchema>;

export async function POST(req: NextRequest) {
  try {
    // No external API key required for parsing resume PDF

    // Get the file from the request
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Create a temporary file path
    const tempFilePath = join(tmpdir(), `resume-${Date.now()}.pdf`);
    await writeFile(tempFilePath, buffer);

    try {
      // Load and parse PDF
      const pdfData = await pdfParse(buffer);
      const text = pdfData.text;

      // Store the raw text in memory for future use
      setResumeContext(text);

      // Parse the raw text into structured data
      const structuredData = {
        education: [], // Will be populated from text
        skills: [], // Will be populated from text
        personal_projects: [], // Will be populated from text
        workex: [], // Will be populated from text
        linkedin: null,
        per_web: null,
      };

      return NextResponse.json({
        response: {
          rawText: text,
          structuredData: structuredData,
          timestamp: new Date().toISOString(),
          status: 'success',
          processingSteps: {
            fileRead: true,
            pdfParsed: true,
            aiAnalysis: false,
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
