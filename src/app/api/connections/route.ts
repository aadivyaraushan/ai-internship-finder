import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { WebBrowser } from 'langchain/tools/webbrowser';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { Connection } from '@/lib/firestoreHelpers';

interface Goal {
  title: string;
  description?: string;
}

// Create the prompt template for analyzing LinkedIn profiles
const profileAnalysisTemplate = PromptTemplate.fromTemplate(`
You are an AI career advisor tasked with analyzing LinkedIn profiles to find potential connections for the user.
Based on the profile content provided, determine how well this person matches with the user's background and goals.

User's Background:
{resume_context}

User's Target Role:
{role}

LinkedIn Profile Content:
{profile_content}

Analyze this profile and return a JSON object with the following structure:
{
  "name": "Full Name",
  "current_role": "Current Job Title",
  "company": "Current Company",
  "matchPercentage": 95,
  "matchReason": "Detailed explanation of why this person is a good match",
  "sharedBackground": [
    "Key similarity point 1",
    "Key similarity point 2"
  ],
  "careerHighlights": [
    "Notable achievement or transition 1",
    "Notable achievement or transition 2"
  ]
}

Focus on:
1. Similar educational or professional background (e.g. same degree, same industry, same location, same university, same company, etc.)
2. Successful landing roles similar to user's target
3. Shared experiences (e.g. clubs, events, projects, etc.). Ideally, these experiences are not common and are niche.

Return ONLY the JSON object with no additional text.
`);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      roles,
      resumeContext,
      goals,
      userId,
    }: {
      roles: any[];
      resumeContext?: string;
      goals?: Goal[];
      userId: string;
    } = body;

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Selected roles are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const model = new ChatOpenAI({
      model: 'gpt-4.1-mini',
      temperature: 0,
    });

    const embeddings = new OpenAIEmbeddings();
    const browser = new WebBrowser({ model, embeddings });

    // Track processed URLs to avoid duplicates
    const processedUrls = new Set<string>();
    const connections = [];

    for (const role of roles) {
      // Construct search query based on role, background, and goals
      const contextKeywords = resumeContext
        ? resumeContext.split(' ').slice(0, 5).join(' ')
        : '';
      const goalKeywords =
        goals && goals.length > 0
          ? goals
              .slice(0, 2)
              .map((g) => g.title)
              .join(' ')
          : '';
      const searchQuery =
        `site:linkedin.com/in/ ${role.title} ${contextKeywords} ${goalKeywords}`.trim();

      try {
        // Search for profiles
        const searchResult = await browser.invoke(`"${searchQuery}",""`);

        // Extract profile URLs from search results
        const profileUrls =
          searchResult.match(/https:\/\/[www.]*linkedin.com\/in\/[^\s"')]+/g) ||
          [];

        // Analyze each profile (limit to top 3)
        for (const url of profileUrls.slice(0, 3)) {
          // Skip if we've already processed this URL
          if (processedUrls.has(url)) {
            continue;
          }
          processedUrls.add(url);

          try {
            // Visit profile and extract content
            const profileContent = await browser.invoke(`"${url}",""`);

            // Analyze profile
            const analysisChain = RunnableSequence.from([
              profileAnalysisTemplate,
              model,
              new StringOutputParser(),
            ]);

            const analysis = await analysisChain.invoke({
              resume_context: resumeContext || '',
              role: role.title,
              profile_content: profileContent,
            });

            try {
              const profileData = JSON.parse(analysis);
              connections.push({
                ...profileData,
                linkedInUrl: url,
              });
            } catch (parseError) {
              console.error('Failed to parse profile analysis:', parseError);
              continue;
            }
          } catch (profileError) {
            console.error('Error analyzing profile:', profileError);
            continue;
          }
        }
      } catch (searchError) {
        console.error('Error searching for profiles:', searchError);
        continue;
      }
    }

    // Sort connections by match percentage
    connections.sort((a, b) => b.matchPercentage - a.matchPercentage);

    // Add indices as IDs and initial status
    const connectionsWithIds: Connection[] = connections.map(
      (connection, index) => ({
        ...connection,
        id: index.toString(),
        status: 'not_contacted',
        lastUpdated: new Date().toISOString(),
      })
    );

    // Store connections in Firebase
    const { updateUserConnections } = await import('@/lib/firestoreHelpers');
    await updateUserConnections(userId, connectionsWithIds);

    return new Response(
      JSON.stringify({
        response: {
          connections: connectionsWithIds,
          processingSteps: {
            resumeAnalyzed: true,
            rolesEvaluated: true,
            connectionsFound: connections.length > 0,
            matchesRanked: true,
          },
        },
        timestamp: new Date().toISOString(),
        status: 'success',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
