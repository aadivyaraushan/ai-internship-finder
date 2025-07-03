import { callClaude } from '../../../lib/anthropicClient';
import { Connection } from '@/lib/firestoreHelpers';
import { buildResumeAspectAnalyzerPrompt } from './utils/buildResumeAnalyzer';
import { buildConnectionFinderPrompt } from './utils/connectionFinding/buildConnectionFinder';
import { cleanAndParseJSON } from './utils/cleanAndParseJson';
import { Role } from './utils/types';
import { Goal } from './utils/types';
import { findAndVerifyLinkedInUrl } from './utils/urlFinding/findAndVerifyLinkedinUrl';
import { verifyProgramWebsite } from './utils/urlFinding/verfiyProgramWebsite';
import { findEmailWithHunter } from './utils/emailFinding/findEmailHunter';

interface SharedActivity {
  name: string;
  year: string;
  type: string;
}

export async function POST(req: Request) {
  console.log('\n🚀 Starting connection search process');

  try {
    const body = await req.json();
    const {
      roles = [],
      resumeContext,
      goals,
      race,
      location,
      preferences,
    }: {
      roles?: Role[];
      resumeContext?: string;
      goals?: Goal[];
      race?: string;
      location?: string;
      preferences?: { programs: boolean; connections: boolean };
    } = body;

    // Determine which targets (formerly roles) we should process
    const rolesToProcess =
      Array.isArray(roles) && roles.length > 0
        ? roles
        : (goals || []).map((g) => ({ title: g.title }));

    console.log('📝 Request details:', {
      roles: rolesToProcess.map((r) => r.title),
      hasResume: !!resumeContext,
      goals: goals?.map((g) => g.title),
    });

    // Ensure we have at least goals data to work with
    if ((!goals || goals.length === 0) && rolesToProcess.length === 0) {
      console.error('❌ No goals provided in request');
      return new Response(JSON.stringify({ error: 'Goals are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!resumeContext) {
      console.error('❌ No resume context provided');
      return new Response(
        JSON.stringify({
          error: 'Resume context is required for personalized matching',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 1: Analyze resume for connection aspects
    console.log('📄 Starting resume analysis');
    console.log('Resume context:', resumeContext?.substring(0, 200) + '...');
    console.log(
      'Goals:',
      goals?.map((g) => ({ title: g.title, description: g.description }))
    );

    let connectionAspects = null;
    let retryCount = 0;
    const MAX_RETRIES = 2;

    while (retryCount <= MAX_RETRIES) {
      try {
        const aspectsPrompt = buildResumeAspectAnalyzerPrompt(resumeContext);
        console.log('Resume analysis prompt:', aspectsPrompt);

        const aspectsResponse = await callClaude(aspectsPrompt, {
          maxTokens: 1000,
        });
        console.log('Raw aspects response from Claude:', aspectsResponse);

        const parsedAspects = cleanAndParseJSON(aspectsResponse);

        if (!parsedAspects) {
          throw new Error('Failed to parse Claude response');
        }

        console.log('Parsed aspects result:', parsedAspects);

        if (!parsedAspects?.connection_aspects) {
          throw new Error(
            'Invalid aspects response - missing connection_aspects'
          );
        }

        // Validate the structure matches what we expect
        const expectedKeys = [
          'education',
          'work_experience',
          'activities',
          'achievements',
          'growth_areas',
        ];
        const missingKeys = expectedKeys.filter(
          (key) => !parsedAspects.connection_aspects[key]
        );

        if (missingKeys.length > 0) {
          throw new Error(
            `Missing required sections: ${missingKeys.join(', ')}`
          );
        }

        connectionAspects = parsedAspects.connection_aspects;
        break; // Success, exit the retry loop
      } catch (error) {
        console.error(`❌ Attempt ${retryCount + 1} failed:`, error);

        if (retryCount === MAX_RETRIES) {
          return new Response(
            JSON.stringify({
              error: 'Failed to analyze resume for matching criteria',
              details: error instanceof Error ? error.message : String(error),
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        retryCount++;
        console.log(
          `🔄 Retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`
        );
      }
    }

    // Log each section of the aspects to see what we got
    console.log('Connection aspects details:');
    console.log(
      '- Education:',
      JSON.stringify(connectionAspects.education, null, 2)
    );
    console.log(
      '- Work Experience:',
      JSON.stringify(connectionAspects.work_experience, null, 2)
    );
    console.log(
      '- Activities:',
      JSON.stringify(connectionAspects.activities, null, 2)
    );
    console.log(
      '- Achievements:',
      JSON.stringify(connectionAspects.achievements, null, 2)
    );
    console.log(
      '- Growth Areas:',
      JSON.stringify(connectionAspects.growth_areas, null, 2)
    );

    // Validate we have usable connection aspects before proceeding
    if (!connectionAspects || Object.keys(connectionAspects).length === 0) {
      console.error('❌ Connection aspects is empty or null after analysis');
      return new Response(
        JSON.stringify({
          error: 'Failed to extract meaningful information from resume',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const connections: Connection[] = [];
    console.log(
      '🔍 Starting role processing with connection aspects:',
      JSON.stringify(connectionAspects, null, 2)
    );

    for (const role of rolesToProcess) {
      console.log('\n📋 Processing role:', role.title);
      try {
        // Step 2: Find initial connections using analyzed aspects
        const finderPrompt = buildConnectionFinderPrompt({
          roleTitle: role.title,
          goalTitles: goals?.map((g) => g.title) || [],
          connectionAspects,
          preferences,
          race,
          location,
        });
        console.log('Connection finder prompt:', finderPrompt);

        let finderResponse;
        let initialConnections: Connection[] = [];
        let retryCount = 0;
        const MAX_RETRIES = 2;

        while (retryCount <= MAX_RETRIES) {
          try {
            finderResponse = await callClaude(finderPrompt, {
              tools: [{ type: 'web_search_preview' }],
              maxTokens: 2000,
            });
            console.log('Raw finder response:', finderResponse);

            const parsedFinder = cleanAndParseJSON(finderResponse);
            console.log('Parsed finder response:', parsedFinder);

            if (
              !parsedFinder?.connections ||
              !Array.isArray(parsedFinder.connections)
            ) {
              throw new Error(
                'Invalid finder response - missing connections array'
              );
            }

            // Validate each connection has required fields
            for (const conn of parsedFinder.connections) {
              if (
                !conn.type ||
                !conn.name ||
                !conn.direct_matches ||
                !conn.goal_alignment
              ) {
                throw new Error(
                  'Invalid connection structure - missing required fields'
                );
              }

              if (
                conn.type === 'person' &&
                (!conn.current_role || !conn.company)
              ) {
                throw new Error(
                  'Invalid person connection - missing role or company'
                );
              }

              if (
                conn.type === 'program' &&
                (!conn.organization || !conn.program_type)
              ) {
                throw new Error(
                  'Invalid program connection - missing organization or type'
                );
              }

              // Ensure arrays are actually arrays
              if (!Array.isArray(conn.direct_matches)) {
                conn.direct_matches = [conn.direct_matches].filter(Boolean);
              }
              if (!Array.isArray(conn.additional_factors)) {
                conn.additional_factors = [conn.additional_factors].filter(
                  Boolean
                );
              }
            }

            initialConnections = parsedFinder.connections;
            console.log(
              '✅ Found valid connections:',
              initialConnections.length
            );

            // === SECOND PASS: verify / fetch URLs ===
            for (const conn of initialConnections) {
              if (conn.type === 'person') {
                try {
                  const verificationResult = await findAndVerifyLinkedInUrl(
                    conn
                  );
                  if (verificationResult.url) {
                    conn.linkedin_url = verificationResult.url;
                    conn.profile_source = verificationResult.profile_source;
                    conn.match_confidence = verificationResult.match_confidence;
                    console.log(
                      `✅ Found and verified profile for: ${conn.name}`
                    );
                  } else {
                    console.warn(
                      `⚠️ Could not verify any profile for: ${conn.name}`
                    );
                    conn.linkedin_url = undefined;
                  }

                  // 📧 Attempt to discover email regardless of LinkedIn success
                  if (!conn.email) {
                    const email = await findEmailWithHunter(conn as any);
                    if (email) {
                      conn.email = email;
                      console.log(`✅ Found email for ${conn.name}: ${email}`);
                    } else {
                      console.log(`ℹ️  No email found for ${conn.name}`);
                    }
                  }
                } catch (error) {
                  console.warn('❌ URL verification failed:', {
                    connection: conn.name,
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                }
              } else if (conn.type === 'program' && conn.website_url) {
                try {
                  const verificationResult = await verifyProgramWebsite(conn);
                  if (!verificationResult.isValid) {
                    console.warn(
                      '⚠️ Invalid program website:',
                      conn.website_url,
                      verificationResult.explanation || ''
                    );
                    conn.website_url = null;
                  } else {
                    console.log(
                      `✅ Verified program website for: ${conn.name}`,
                      verificationResult.matches
                    );
                  }
                } catch (error) {
                  console.warn('❌ Program verification failed:', {
                    program: conn.name,
                    website: conn.website_url,
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                }
              }
            }

            // Filter out connections with failed verifications
            initialConnections = initialConnections.filter((conn) => {
              if (conn.type === 'person') {
                // Keep person connections that either have a verified LinkedIn URL or don't need one
                return (
                  !!conn.linkedin_url || !!conn.email || !conn.current_role || !conn.company
                );
              } else if (conn.type === 'program') {
                // Keep program connections that either have a verified website or don't need one
                return (
                  !conn.website_url || (conn.website_url && conn.organization)
                );
              }
              return false;
            });

            break;
          } catch (error) {
            console.error(
              `❌ Connection finder attempt ${retryCount + 1} failed:`,
              error instanceof Error ? error.message : String(error)
            );

            if (retryCount === MAX_RETRIES) {
              console.error('❌ All connection finder attempts failed');
              continue; // Skip this role but continue with others
            }

            retryCount++;
            console.log(
              `🔄 Retrying connection finder... (Attempt ${retryCount + 1}/${
                MAX_RETRIES + 1
              })`
            );
          }
        }

        // Only proceed if we found valid connections
        if (initialConnections.length === 0) {
          console.log('⚠️ No valid connections found for role:', role.title);
          continue; // Skip to next role
        }

        // Step 3: Adds each connection that's valid to the connections array
        console.log('🔄 Starting connection processing for role:', role.title);
        for (const connection of initialConnections) {
          if (!connection?.name) {
            console.error('❌ Invalid connection structure:', connection);
            continue; // Skip invalid connections
          }
          try {
            connections.push(connection);
            console.log('✅ Successfully added connection:', connection.name);
          } catch (error) {
            console.error('❌ Error adding connection:', {
              name: connection.name,
              error: error instanceof Error ? error.message : String(error),
            });
            continue;
          }
        }
      } catch (error) {
        console.error('❌ Error adding connection:', {
          role: role.title,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    // Deduplicate and transform connections
    console.log('🔄 Starting connection deduplication and transformation');
    console.log('Total connections before deduplication:', connections.length);

    // Deduplicate connections by name + type + company/org
    const unique = new Map<string, Connection>();
    for (const conn of connections) {
      const key = `${conn.type || 'person'}-${conn.name}-${
        conn.company || conn.organization || ''
      }`;
      if (
        !unique.has(key) ||
        (conn.match_details?.total_percentage || 0) >
          (unique.get(key).match_details?.total_percentage || 0)
      ) {
        unique.set(key, conn);
      }
    }

    // Filter out program connections that are already mentioned in the resume
    const filtered = Array.from(unique.values()).filter((conn) => {
      if (conn.type === 'program' && resumeContext) {
        const lcResume = resumeContext.toLowerCase();
        const name = (conn.name || '').toLowerCase();
        const org = (conn.organization || '').toLowerCase();
        return !lcResume.includes(name) && !lcResume.includes(org);
      }
      return true;
    });

    // Sort by match percentage
    const sorted = filtered.sort((a, b) => {
      return (
        (b.match_details?.total_percentage || 0) -
        (a.match_details?.total_percentage || 0)
      );
    });

    // Transform connections to match frontend interface
    const transformedConnections = sorted.map((conn) => {
      // Generate a description based on connection type and match details
      let description = '';
      if (conn.type === 'person') {
        const matchPoints = [];

        // Add direct matches if available
        if (conn.direct_matches?.length > 0) {
          matchPoints.push(`Direct matches: ${conn.direct_matches.join(', ')}`);
        }

        // Add goal alignment
        if (conn.goal_alignment) {
          matchPoints.push(conn.goal_alignment);
        }

        // Add hiring power details if available
        if (conn.hiring_power) {
          const hiringDetails = [];
          if (conn.hiring_power.role_type) {
            hiringDetails.push(conn.hiring_power.role_type);
          }
          if (conn.hiring_power.department) {
            hiringDetails.push(`in ${conn.hiring_power.department}`);
          }
          if (conn.hiring_power.can_hire_interns) {
            hiringDetails.push('can hire interns');
          }
          if (hiringDetails.length > 0) {
            matchPoints.push(`Hiring capacity: ${hiringDetails.join(', ')}`);
          }
        }

        // Add exact matches if available
        if (conn.exact_matches) {
          if (conn.exact_matches.education?.university) {
            matchPoints.push(
              `Attended ${conn.exact_matches.education.university}`
            );
          }
          if (conn.exact_matches.shared_activities?.length > 0) {
            const activities = conn.exact_matches.shared_activities
              .map((act: SharedActivity) => `${act.name} (${act.year})`)
              .join(', ');
            matchPoints.push(`Shared activities: ${activities}`);
          }
        }

        description = matchPoints.join('. ');
      } else if (conn.type === 'program') {
        const programPoints = [];

        // Add direct matches if available
        if (conn.direct_matches?.length > 0) {
          programPoints.push(
            `Matches your background: ${conn.direct_matches.join(', ')}`
          );
        }

        // Add goal alignment
        if (conn.goal_alignment) {
          programPoints.push(conn.goal_alignment);
        }

        // Add program description
        if (conn.program_description) {
          programPoints.push(conn.program_description);
        }

        // Add how this helps
        if (conn.how_this_helps) {
          programPoints.push(conn.how_this_helps);
        }

        // Add enrollment info if available
        if (conn.enrollment_info) {
          programPoints.push(`Enrollment: ${conn.enrollment_info}`);
        }

        description = programPoints.join('. ');
      }

      // If no description was generated, use match details
      if (!description && conn.match_details?.scoring_explanation) {
        description = conn.match_details.scoring_explanation;
      }

      return {
        id: `${conn.type || 'person'}-${conn.name}-${
          conn.company || conn.organization || ''
        }`
          .replace(/\s+/g, '-')
          .toLowerCase(),
        type: conn.type || 'person',
        name: conn.name,
        imageUrl: '',
        matchPercentage: conn.match_details?.total_percentage || 0,
        linkedin_url: conn.linkedin_url,
        email: conn.email,
        status: 'not_contacted',
        current_role: conn.current_role,
        company: conn.company,
        program_description: conn.program_description,
        program_type: conn.program_type,
        organization: conn.organization,
        website_url: conn.website_url || conn.url,
        enrollment_info: conn.enrollment_info,
        how_this_helps: conn.how_this_helps,
        hiring_power: conn.hiring_power,
        exact_matches: conn.exact_matches,
        shared_background_points:
          conn.shared_background_points ??
          conn.outreach_strategy?.shared_background_points ??
          [],
        description: description || 'No additional details available',
      };
    });

    return new Response(
      JSON.stringify({
        response: {
          connections: transformedConnections,
          processingSteps: {
            resumeAnalyzed: true,
            rolesEvaluated: true,
            connectionsFound: sorted.length > 0,
            matchesRanked: true,
          },
        },
        timestamp: new Date().toISOString(),
        status: 'success',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Technical error - Request processing failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({
        error:
          'We encountered an unexpected issue. Please try again in a few moments.',
      }),
      { status: 500 }
    );
  }
}
