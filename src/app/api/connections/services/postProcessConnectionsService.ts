import { Connection } from '@/lib/firestoreHelpers';

export interface ProcessedConnection {
  id: string;
  type: 'person' | 'program';
  name: string;
  imageUrl: string;
  matchPercentage: number;
  verified_profile_url?: string | null;
  email?: string;
  status: string;
  current_role?: string;
  company?: string | null;
  program_description?: string | null;
  program_type?: string | null;
  organization?: string | null;
  website_url?: string | null;
  enrollment_info?: string | null;
  how_this_helps?: string | null;
  hiring_power?: Connection['hiring_power'];
  exact_matches?: Connection['exact_matches'];
  shared_background_points?: string[] | null;
  shared_professional_interests?: string[] | null;
  shared_personal_interests?: string[] | null;
  ai_connection_reason?: string | null;
  ai_outreach_message?: string | null;
  description: string;
}

/**
 * Post-processes raw enriched Connection objects into the trimmed structure
 * expected by the old frontend.  This logic is copied from the legacy route
 * and intentionally kept side-effect-free.
 */
export function postProcessConnections(
  connections: Connection[],
  resumeContext?: string
): ProcessedConnection[] {
  // 1. Optionally filter out connections already mentioned in the resume (now with fuzzy matching)
  let filtered: Connection[] = connections;
  if (resumeContext) {
    const resumeTokens = new Set(
      resumeContext.toLowerCase().split(/\s+/).filter(Boolean)
    );

    // Returns true if at least `threshold` proportion of tokens in `phrase` exist in the resume
    const fuzzyMatch = (phrase: string, threshold = 0.8): boolean => {
      const tokens = phrase.toLowerCase().split(/\s+/).filter(Boolean);
      if (!tokens.length) return false;
      const matches = tokens.filter((t) => resumeTokens.has(t)).length;
      return matches / tokens.length >= threshold;
    };

    filtered = connections.filter((conn) => {
      if (conn.type === 'person') {
        const name = conn.name || '';
        const org = conn.organization || '';
        return !fuzzyMatch(name) && !fuzzyMatch(org);
      }
      return true;
    });
  }

  // 2. Sort by descending match percentage (falls back to 0)
  const sorted = [...filtered].sort((a, b) => {
    const scoreB = typeof b.match_details?.total_percentage === 'number' ? b.match_details.total_percentage : 0;
    const scoreA = typeof a.match_details?.total_percentage === 'number' ? a.match_details.total_percentage : 0;
    return scoreB - scoreA;
  });

  // 3. Map into ProcessedConnection shape
  return sorted.map((conn) => {
    const description = buildDescription(conn);

    return {
      id: `${conn.type || 'person'}-${conn.name}-${
        conn.company || conn.organization || ''
      }-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
        .replace(/\s+/g, '-')
        .toLowerCase(),
      type: (conn.type || 'person') as 'person' | 'program',
      name: conn.name,
      imageUrl: '', // kept for backward compatibility (TODO: supply real image)
      matchPercentage: typeof conn.match_details?.total_percentage === 'number' ? conn.match_details.total_percentage : 0,
      verified_profile_url: conn.verified_profile_url,
      email: conn.email,
      status: 'not_contacted',
      current_role: conn.current_role,
      company: conn.company,
      program_description: conn.program_description,
      program_type: conn.program_type,
      organization: conn.organization,
      website_url: conn.website_url || conn.url || null,
      enrollment_info: conn.enrollment_info,
      how_this_helps: conn.how_this_helps,
      hiring_power: conn.hiring_power,
      exact_matches: conn.exact_matches,
      shared_background_points:
        conn.shared_background_points ??
        (typeof conn.outreach_strategy === 'object' &&
        (conn.outreach_strategy as Record<string, unknown>)?.shared_background_points &&
        Array.isArray((conn.outreach_strategy as Record<string, unknown>).shared_background_points)
          ? (conn.outreach_strategy as Record<string, unknown>).shared_background_points as string[]
          : []),
      shared_professional_interests: conn.shared_professional_interests || null,
      shared_personal_interests: conn.shared_personal_interests || null,
      ai_connection_reason: conn.ai_connection_reason ?? null,
      ai_outreach_message: conn.ai_outreach_message,
      description: description || 'No additional details available',
    };
  });
}

function buildDescription(conn: Connection): string {
  if (conn.type === 'person') {
    const matchPoints: string[] = [];

    if (Array.isArray(conn.direct_matches) && conn.direct_matches.length) {
      matchPoints.push(`Direct matches: ${conn.direct_matches.join(', ')}`);
    }
    if (conn.goal_alignment) {
      matchPoints.push(conn.goal_alignment);
    }
    if (conn.hiring_power) {
      const hp: string[] = [];
      if (conn.hiring_power.role_type) hp.push(conn.hiring_power.role_type);
      if (conn.hiring_power.department)
        hp.push(`in ${conn.hiring_power.department}`);
      if (conn.hiring_power.can_hire_interns) hp.push('can hire interns');
      if (hp.length) matchPoints.push(`Hiring capacity: ${hp.join(', ')}`);
    }
    if (conn.exact_matches) {
      if (conn.exact_matches.education?.university) {
        matchPoints.push(`Attended ${conn.exact_matches.education.university}`);
      }
      if (conn.exact_matches.shared_activities?.length) {
        const activities = conn.exact_matches.shared_activities
          .map((a) => `${a.name} (${a.year ?? ''})`)
          .join(', ');
        matchPoints.push(`Shared activities: ${activities}`);
      }
    }

    return matchPoints.join('. ');
  }

  if (conn.type === 'program') {
    const programPoints: string[] = [];
    if (Array.isArray(conn.direct_matches) && conn.direct_matches.length)
      programPoints.push(
        `Matches your background: ${conn.direct_matches.join(', ')}`
      );
    if (conn.goal_alignment) programPoints.push(conn.goal_alignment);
    if (conn.program_description) programPoints.push(conn.program_description);
    if (conn.how_this_helps) programPoints.push(conn.how_this_helps);
    if (conn.enrollment_info)
      programPoints.push(`Enrollment: ${conn.enrollment_info}`);
    return programPoints.join('. ');
  }

  return conn.match_details?.scoring_explanation || '';
}
