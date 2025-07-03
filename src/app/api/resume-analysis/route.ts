import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { callClaude } from '../../../lib/anthropicClient';
import { z } from 'zod';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

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

      // Use Claude to analyze and structure the resume data
      const analysisPrompt = `<system>You are a resume parser that extracts structured information from resumes. You MUST return ONLY valid JSON - no other text, no markdown formatting, no explanation. The JSON must match the schema below exactly.</system>
<input>${text}</input>
<schema>
{
  "education": [{
    "school_name": "string",
    "clubs": ["string"],
    "awards": ["string"],
    "gpa": "string or null",
    "notable_coursework": ["string"]
  }],
  "skills": ["string"],
  "personal_projects": [{
    "project_name": "string",
    "description": "string",
    "responsibilities": ["string"],
    "recognition": "string or null",
    "skills": ["string"]
  }],
  "workex": [{
    "workplace": "string",
    "notable_projects": ["string"],
    "role": "string",
    "reference_email": "string or null",
    "is_alumni": boolean
  }],
  "linkedin": "string or null",
  "per_web": "string or null"
}
</schema>
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

      const analysisResponse = await callClaude(analysisPrompt, {
        maxTokens: 1000,
        model: 'gpt-4.1-nano',
      });

      // Log the raw response for debugging
      console.log('Raw Claude Response:', analysisResponse);

      let structuredData;
      try {
        // Trim any whitespace and check for common formatting issues
        let cleanedResponse = analysisResponse.trim();

        // If response starts with ``` or ends with ```, remove them
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.slice(7);
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.slice(3);
        }
        if (cleanedResponse.endsWith('```')) {
          cleanedResponse = cleanedResponse.slice(0, -3);
        }

        cleanedResponse = cleanedResponse.trim();

        // Log the cleaned response
        console.log('Cleaned Response:', cleanedResponse);

        const parsedResponse: ResumeAnalysisResponse =
          JSON.parse(cleanedResponse);

        // Validate the parsed data against our schema
        const validationResult = ResumeSchema.safeParse(parsedResponse);

        if (!validationResult.success) {
          console.error('Resume validation failed:', validationResult.error);

          // Try to salvage what we can from the response
          structuredData = {
            education: Array.isArray(parsedResponse.education)
              ? parsedResponse.education.filter((e: School) => e.school_name)
              : [],
            skills: Array.isArray(parsedResponse.skills)
              ? parsedResponse.skills
              : [],
            personal_projects: Array.isArray(parsedResponse.personal_projects)
              ? parsedResponse.personal_projects.filter(
                  (p: Project) => p.project_name
                )
              : [],
            workex: Array.isArray(parsedResponse.workex)
              ? parsedResponse.workex.filter(
                  (w: WorkExperience) => w.workplace && w.role
                )
              : [],
            linkedin:
              typeof parsedResponse.linkedin === 'string'
                ? parsedResponse.linkedin
                : null,
            per_web:
              typeof parsedResponse.per_web === 'string'
                ? parsedResponse.per_web
                : null,
          };
        } else {
          structuredData = validationResult.data;
        }
      } catch (error: unknown) {
        console.error('Failed to parse or validate Claude response:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message);
        }
        structuredData = {
          education: [],
          skills: [],
          personal_projects: [],
          workex: [],
          linkedin: null,
          per_web: null,
        };
      }

      // Log the final structured data for debugging
      console.log(
        'Structured Resume Data:',
        JSON.stringify(structuredData, null, 2)
      );

      return NextResponse.json({
        response: {
          rawText: text,
          structuredData: structuredData,
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
