import { ConnectionAspects } from '../utils';

export function buildBackgroundInfoString(
  connectionAspects: ConnectionAspects
): string {
  console.log('Building background info from aspects:', connectionAspects);

  const sections = [];

  if (connectionAspects.education?.institutions?.length > 0) {
    sections.push(
      `Educational background: ${connectionAspects.education.institutions.join(
        ', '
      )}`
    );
  }

  if (connectionAspects.work_experience?.companies?.length > 0) {
    sections.push(
      `Work experience: ${connectionAspects.work_experience.companies.join(
        ', '
      )}`
    );
  }

  if (connectionAspects.work_experience?.startup_experience?.length > 0) {
    sections.push(
      `Startup experience: ${connectionAspects.work_experience.startup_experience.join(
        ', '
      )}`
    );
  }

  if (
    connectionAspects.work_experience?.industry_transitions?.transition_context
  ) {
    sections.push(
      `Career transition context: ${connectionAspects.work_experience.industry_transitions.transition_context}`
    );
  }

  if (connectionAspects.activities?.organizations?.length) {
    sections.push(
      `Organizations & activities: ${connectionAspects.activities.organizations.join(
        ', '
      )}`
    );
  }

  if (connectionAspects.achievements?.certifications?.length) {
    sections.push(
      `Certifications & achievements: ${connectionAspects.achievements.certifications.join(
        ', '
      )}`
    );
  }

  if (connectionAspects.growth_areas?.learning_journey) {
    sections.push(
      `Learning & growth journey: ${connectionAspects.growth_areas.learning_journey}`
    );
  }

  console.log('Generated background sections:', sections);

  return sections.length > 0
    ? sections.map((section) => `- ${section}`).join('\n    ')
    : '- No background information available';
}
