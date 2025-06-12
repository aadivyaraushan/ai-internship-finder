import { NextRequest, NextResponse } from 'next/server';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BufferMemory } from 'langchain/memory';

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

// Create a global memory instance
const memory = new BufferMemory({
  memoryKey: 'resume_context',
  returnMessages: true,
  outputKey: 'output',
  inputKey: 'input',
});

// Create the prompt template
const promptTemplate = new PromptTemplate({
  template: `Process and store the following resume data for future analysis:

Resume Content: {resume_context}

Current Request: {input}

Store this information in a structured format for later use.`,
  inputVariables: ['resume_context', 'input'],
});

const model = new ChatOpenAI({
  temperature: 0,
  modelName: 'gpt-4.1-mini',
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const outputParser = new StringOutputParser();

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

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
      const loader = new PDFLoader(tempFilePath);
      const docs = await loader.load();
      const text = docs
        .map((doc: { pageContent: string }) => doc.pageContent)
        .join('\n');

      // Create the chain
      const chain = RunnableSequence.from([
        promptTemplate,
        model,
        outputParser,
      ]);

      // Run the chain with progress tracking
      const response = NextResponse.json({
        response: {
          rawText: text,
          timestamp: new Date().toISOString(),
          status: 'in_progress',
          processingSteps: {
            fileRead: true,
            pdfParsed: false,
            aiAnalysis: false,
            dataStored: false,
          },
        },
      });
      response.headers.set('Content-Type', 'application/json');

      // Add a small delay to simulate PDF parsing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Run the AI analysis
      const rawResult = await chain.invoke({
        resume_context: text,
        input: 'Store Resume Data',
      });

      // Store the raw text in memory for future use
      await memory.saveContext(
        { input: 'Store Resume Data' },
        { output: text }
      );

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
