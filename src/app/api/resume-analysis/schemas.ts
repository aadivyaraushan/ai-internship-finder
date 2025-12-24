import { z } from 'zod';

// -------------------------
// Section schemas
// -------------------------

export const EducationSchema = z.object({
  school_name: z.string().describe('Name of the educational institution'),
  clubs: z.array(z.string()).describe('List of clubs and organizations participated in'),
  awards: z.array(z.string()).describe('List of academic awards and honors'),
  gpa: z.string().nullable().describe('GPA if mentioned'),
  notable_coursework: z.array(z.string()).describe('List of relevant courses taken'),
});

export const PersonalProjectSchema = z.object({
  project_name: z.string().describe('Name of the project'),
  description: z.string().describe('Brief description of the project'),
  responsibilities: z.array(z.string()).describe('Key responsibilities and contributions'),
  recognition: z.string().nullable().describe('Any recognition or achievements'),
  skills: z.array(z.string()).describe('Technical skills used in the project'),
});

export const WorkExperienceSchema = z.object({
  workplace: z.string().describe('Name of the company or organization'),
  notable_projects: z.array(z.string()).describe('Key projects worked on'),
  role: z.string().describe('Job title or position'),
  reference_email: z.string().nullable().describe('Email of reference if provided'),
  is_alumni: z.boolean().describe('Whether they are still working there'),
});

// -------------------------
// Combined schema (structured resume + connection aspects)
// -------------------------

export const CombinedResumeSchema = z.object({
  education: z.array(EducationSchema).describe('Educational background'),
  skills: z.array(z.string()).describe('Technical and non-technical skills'),
  personal_projects: z.array(PersonalProjectSchema).describe('Personal and academic projects'),
  workex: z.array(WorkExperienceSchema).describe('Work experience entries'),
  linkedin: z.string().nullable().describe('LinkedIn profile URL'),
  per_web: z.string().nullable().describe('Personal website URL'),
  connection_aspects: z
    .object({
      education: z.object({
        institutions: z.array(z.string()),
        graduation_years: z.array(z.string()),
        fields_of_study: z.array(z.string()),
        current_level: z.enum(['high_school', 'undergraduate', 'graduate']),
      }),
      work_experience: z.object({
        detailed_experiences: z.array(
          z.object({
            company: z.string(),
            role: z.string(),
            duration: z.string(),
            responsibilities: z.array(z.string()),
            scale_and_impact: z.string(),
            key_achievements: z.array(z.string()),
          })
        ),
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
    })
    .describe('Detailed connection aspects for networking'),
});

export type CombinedResume = z.infer<typeof CombinedResumeSchema>;


