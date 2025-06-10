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

// Create a more specific prompt template
const promptTemplate = new PromptTemplate({
  template: `Extract structured information from the following resume text. Be precise and thorough in your analysis.

Resume text: {text}

Please provide the following information in a structured format:

1. Education:
   - Extract school names, clubs, awards, GPA (if mentioned), and notable coursework
   - Include only clearly stated information

2. Skills:
   - List all technical and non-technical skills mentioned
   - Include skills that can be inferred from projects and work experience
   - Format as individual skills, not paragraphs

3. Personal Projects:
   - Extract project names, descriptions, responsibilities
   - Include any recognition or achievements
   - List specific skills used in each project

4. Work Experience:
   - Include company names, roles, and notable projects
   - Note if reference emails are provided
   - Determine if they are currently working there (is_alumni)

5. URLs:
   - Extract LinkedIn profile URL if present
   - Extract personal website URL if present

Format the output as a valid JSON object with this exact structure (replace values with actual data):

{{
  "education": [
    {{
      "school_name": "University Name",
      "clubs": ["Club 1", "Club 2"],
      "awards": ["Award 1", "Award 2"],
      "gpa": "3.8",
      "notable_coursework": ["Course 1", "Course 2"]
    }}
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "personal_projects": [
    {{
      "project_name": "Project Name",
      "description": "Project Description",
      "responsibilities": ["Responsibility 1", "Responsibility 2"],
      "recognition": "Any awards or recognition",
      "skills": ["Skill 1", "Skill 2"]
    }}
  ],
  "workex": [
    {{
      "workplace": "Company Name",
      "notable_projects": ["Project 1", "Project 2"],
      "role": "Job Title",
      "reference_email": "reference@email.com",
      "is_alumni": true
    }}
  ],
  "linkedin": "https://linkedin.com/in/profile",
  "per_web": "https://personal-website.com"
}}

If any field is not found in the resume, use null for optional fields or empty arrays [] for array fields. Ensure the output is valid JSON.
Do NOT wrap the JSON in any markdown formatting or triple backticks. Return ONLY the JSON object.`,
  inputVariables: ['text'],
});

const model = new ChatOpenAI({
  temperature: 0,
  modelName: 'gpt-4.1',
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

      // Run the chain
      const rawResult = await chain.invoke({
        text: text,
      });

      console.log('Raw LLM output:', rawResult); // For debugging

      // Clean potential markdown code fences from the LLM output before parsing
      let cleaned = rawResult.trim();
      if (cleaned.startsWith('```')) {
        // Remove leading ```json or ```
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
        // Remove trailing ```
        cleaned = cleaned.replace(/```\s*$/i, '');
      }

      // Parse and validate the result with Zod
      try {
        const parsedJson = JSON.parse(cleaned);
        const result = ResumeSchema.parse(parsedJson);
        return NextResponse.json(result);
      } catch (parseError) {
        console.error('Schema validation error:', parseError);
        console.error('Raw LLM output (cleaned):', cleaned);
        return NextResponse.json(
          { error: 'Failed to parse resume data', details: parseError },
          { status: 422 }
        );
      }
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
