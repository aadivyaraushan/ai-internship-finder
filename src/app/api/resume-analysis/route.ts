import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { analyzeResumeWithAI, parseWithSchema } from '../../../lib/anthropicClient';
import { z } from 'zod';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { EventEmitter } from 'events';

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

// Combined schema that includes both structured data and connection aspects
const CombinedResumeSchema = z.object({
  education: z.array(EducationSchema).describe('Educational background'),
  skills: z.array(z.string()).describe('Technical and non-technical skills'),
  personal_projects: z
    .array(PersonalProjectSchema)
    .describe('Personal and academic projects'),
  workex: z.array(WorkExperienceSchema).describe('Work experience entries'),
  linkedin: z.string().nullable().describe('LinkedIn profile URL'),
  per_web: z.string().nullable().describe('Personal website URL'),
  connection_aspects: z.object({
    education: z.object({
      institutions: z.array(z.string()),
      graduation_years: z.array(z.string()),
      fields_of_study: z.array(z.string()),
      current_level: z.enum(['high_school', 'undergraduate', 'graduate']),
    }),
    work_experience: z.object({
      detailed_experiences: z.array(z.object({
        company: z.string(),
        role: z.string(),
        duration: z.string(),
        responsibilities: z.array(z.string()),
        scale_and_impact: z.string(),
        key_achievements: z.array(z.string()),
      })),
      companies: z.array(z.string()),
      startup_experience: z.array(z.string()),
      industry_transitions: z.object({
        from_industries: z.array(z.string()),
        to_industries: z.array(z.string()),
        transition_context: z.string(),
      }),
    }),
    personal_projects: z.array(z.string()),
    activities: z.object({
      clubs: z.array(z.string()),
      organizations: z.array(z.string()),
      volunteer_work: z.array(z.string()),
    }),
    achievements: z.object({
      certifications: z.array(z.string()),
      awards: z.array(z.string()),
      notable_projects: z.array(z.string()),
    }),
    growth_areas: z.object({
      developing_skills: z.array(z.string()),
      target_roles: z.array(z.string()),
      learning_journey: z.string(),
    }),
  }).describe('Detailed connection aspects for networking'),
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

      // Step 3: Single comprehensive resume analysis with detailed networking-focused extraction
      currentStep = 3;
      broadcastEvent({ type: 'step-update', stepIndex: currentStep });
      
      // Enhanced resume parsing with comprehensive structure and networking focus
      const analysisPrompt = `
# Role and Objective

You are a specialized resume and career analysis agent. Your primary objective is to carefully analyze a candidate's resume and career goals, thinking through each piece of information to identify all potential networking connection points with professionals, alumni, and industry contacts. 

Take time to understand the context, consider the implications of career transitions, and think about what information would be most valuable for networking purposes.

# Instructions

## Information Extraction Categories

### Educational Background
- Extract ALL educational institutions: past, current, AND confirmed future attendance
- Include universities, colleges, bootcamps, trade schools, online programs
- Capture graduation years, degree types, fields of study, and any academic honors
- Include only confirmed future plans (accepted programs, enrolled courses) - NOT applications or aspirations

### Professional Experience  
- **ONLY include actual employment, internships, and official roles where you worked WITH OTHER PEOPLE**
- **CRITICAL DISTINCTION**: Professional experience MUST involve:
  - Working at an established company/organization (not solo projects)
  - Collaborating with colleagues, teams, or other employees  
  - Having supervisors, managers, or organizational structure
  - Receiving compensation (salary, stipend, or official internship)
- **EXCLUDE from work experience**:
  - Solo personal projects (even if they generated revenue)
  - Individual startups where you were the only person working
  - Personal side businesses with no employees or co-founders
  - Academic projects done alone
  - Freelance work done independently without team collaboration
- **For legitimate work experiences, capture:**
  - Company name (exactly as listed)
  - Specific role/job title
  - Duration/timeframe
  - Key responsibilities and daily tasks
  - **Scale and impact**: Team size managed, budget handled, users served, revenue generated, projects delivered, etc.
  - Major achievements and accomplishments
- Include full-time, part-time, internships, and accepted job offers with confirmed start dates
- Include only confirmed future employment (signed offers, confirmed internships) - NOT applications or interviews

### Personal Projects and Initiatives
- **ONLY include solo projects, independent work, or self-initiated ventures**
- **Examples of personal projects:**
  - Individual coding projects, apps, or websites you built alone
  - Solo startups where you were the only person involved
  - Personal side businesses without employees
  - Academic projects done independently
  - Freelance work done without team collaboration
- **These are SEPARATE from employment** - do NOT categorize as work experience
- Include project names, descriptions, technologies used, and personal achievements
- **Note**: These projects have LIMITED networking value since no colleagues were involved

### Organizations and Activities
- Capture ALL clubs, professional organizations, volunteer work, and extracurricular activities
- Include leadership roles, committee memberships, and participation levels

### Certifications and Recognition
- List ALL professional certifications, licenses, awards, and honors
- Include issuing organizations and dates when available

### Career Transition Indicators
- Identify career pivots, industry changes, or role transitions
- Note aspirations that differ from current experience
- Highlight skills gaps the candidate is working to fill

## Data Quality Requirements

### Completeness Standards
- Include EVERY instance found across all timeframes: past, current, and confirmed future commitments
- Never omit information due to perceived irrelevance or temporal status
- Extract information from BOTH resume content AND stated career goals
- Capture transition periods and confirmed future plans, but exclude uncertain applications or aspirations

### Accuracy Standards
- Use EXACT names and terminology as they appear in source documents
- Maintain original spelling, capitalization, and formatting
- Do not interpret or translate organization names

### Consistency Standards
- Return ALL schema fields, using empty arrays [] or empty strings "" when no data exists
- Apply the same extraction standards throughout the entire document

## Education Level Determination

Classify current education level based on:
- **"high_school"**: Currently in or recently completed secondary education
- **"undergraduate"**: Currently pursuing or completed bachelor's degree
- **"graduate"**: Currently pursuing or completed master's/PhD programs
- Use contextual clues (work experience, age indicators) when education level is ambiguous

# Reasoning Steps

1. **Document Review**: Read through the entire resume and career goals comprehensively, taking notes on key themes
2. **Information Mapping**: Think through which pieces of information fall into each extraction category and why they matter for networking
3. **Context Analysis**: Consider the person's career stage, transition goals, and what connections would be most valuable
4. **Verification**: Cross-reference career goals against resume experience to identify alignment, gaps, and opportunities
   - **For work experience**: Pay special attention to role titles, responsibilities, and quantifiable impact metrics (team sizes, budgets, user numbers, revenue, etc.)
   - **Capture scale indicators**: Look for numbers, metrics, and scope descriptors that show the magnitude of work
5. **Classification**: Determine education level using the specified criteria, explaining your reasoning
6. **Quality Check**: Ensure all required fields are populated and reflect on whether you've missed anything important

**Important**: Think through each step and explain your reasoning before providing the final JSON output.

# Context

This analysis enables networking platforms and career services to:
- Match candidates with relevant alumni and professionals
- Identify shared experiences and backgrounds for conversation starters
- Connect people with similar career transition paths
- Facilitate introductions based on mutual interests and goals

Resume Content:
${text}

# Final Instructions

Analyze the provided resume content thoughtfully and systematically:

1. **Think deeply**: Don't just extract information mechanically - consider the bigger picture of this person's career journey
2. **Read completely**: Review all resume content and stated career goals with full attention
3. **Analyze context**: What story does this resume tell? What are the networking implications?
4. **Extract systematically**: Go through each category and extract ALL relevant information while explaining your reasoning
5. **Cross-reference thoughtfully**: Compare career goals against current experience to identify meaningful transitions and growth areas
6. **Validate completeness**: Ensure every piece of networking-relevant information is captured and explain why it matters
7. **Present findings**: Share your analysis and reasoning, then provide the structured JSON output

Remember: You're not just a data extraction tool - you're analyzing someone's career to help them build meaningful professional connections. Think about what would actually be valuable for networking and explain your thought process.

# Output Format

Return ONLY valid JSON matching this exact structure:

\`\`\`json
{
  "education": [
    {
      "school_name": "string",
      "clubs": ["string"],
      "awards": ["string"], 
      "gpa": "string or null",
      "notable_coursework": ["string"]
    }
  ],
  "skills": ["string"],
  "personal_projects": [
    {
      "project_name": "string",
      "description": "string",
      "responsibilities": ["string"],
      "recognition": "string or null",
      "skills": ["string"]
    }
  ],
  "workex": [
    {
      "workplace": "string",
      "notable_projects": ["string"],
      "role": "string",
      "reference_email": "string or null",
      "is_alumni": "boolean"
    }
  ],
  "linkedin": "string or null",
  "per_web": "string or null",
  "connection_aspects": {
    "education": {
      "institutions": ["string"],
      "graduation_years": ["string"],
      "fields_of_study": ["string"],
      "current_level": "high_school|undergraduate|graduate"
    },
    "work_experience": {
      "detailed_experiences": [
        {
          "company": "string",
          "role": "string",
          "duration": "string", 
          "responsibilities": ["string"],
          "scale_and_impact": "string describing team size, budget, users, revenue, scope, etc.",
          "key_achievements": ["string"]
        }
      ],
      "companies": ["string"],
      "startup_experience": ["string"],
      "industry_transitions": {
        "from_industries": ["string"],
        "to_industries": ["string"],
        "transition_context": "string"
      }
    },
    "personal_projects": ["string"],
    "activities": {
      "clubs": ["string"],
      "organizations": ["string"], 
      "volunteer_work": ["string"]
    },
    "achievements": {
      "certifications": ["string"],
      "awards": ["string"],
      "notable_projects": ["string"]
    },
    "growth_areas": {
      "developing_skills": ["string"],
      "target_roles": ["string"],
      "learning_journey": "string"
    }
  }
}
\`\`\`
`;

      // First call: Let AI think and reason, then provide JSON
      const rawResponse = await analyzeResumeWithAI(analysisPrompt, 'gpt-4.1-mini', 3000);

      // Second call: Parse the JSON from the response using schema validation
      const parsedResult = await parseWithSchema(
        'Parse the JSON put at the end of the following response: \n\n' + rawResponse,
        CombinedResumeSchema,
        'CombinedResumeAnalysis',
        'gpt-4.1-nano',
        2000
      );
      const structuredData = {
        education: parsedResult.education || [],
        skills: parsedResult.skills || [],
        personal_projects: parsedResult.personal_projects || [],
        workex: parsedResult.workex || [],
        linkedin: parsedResult.linkedin || null,
        per_web: parsedResult.per_web || null
      };
      
      const analyzedAspects = parsedResult.connection_aspects || null;

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
