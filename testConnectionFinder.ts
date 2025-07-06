import { callClaude } from './src/lib/anthropicClient';
import { buildConnectionFinderPrompt } from './src/app/api/connections/utils/connectionFinding/buildConnectionFinder';
import { ConnectionsResponse } from './src/app/api/connections/utils/utils';

// Sample data for testing
const sampleConnectionAspects = {
  education: {
    institutions: ['Stanford University'],
    graduation_years: ['2025'],
    fields_of_study: ['Computer Science'],
    current_level: 'undergraduate',
  },
  work_experience: {
    companies: ['Google', 'Microsoft'],
    startup_experience: [],
    industry_transitions: {
      from_industries: [],
      to_industries: [],
      transition_context: '',
    },
  },
  personal_projects: ['AI Research Project', 'Web Development'],
  activities: {
    clubs: ['AI Club', 'Coding Club'],
    organizations: ['ACM'],
    volunteer_work: ['Local Hackathon'],
  },
  achievements: {
    certifications: ['AWS Certified'],
    awards: ['Hackathon Winner'],
    notable_projects: ['AI Chatbot'],
  },
  growth_areas: {
    developing_skills: ['Machine Learning', 'Cloud Computing'],
    target_roles: ['Software Engineer', 'ML Engineer'],
    learning_journey: 'Transitioning to AI/ML roles',
  },
};

async function testConnectionFinder() {
  try {
    console.log('Building connection finder prompt...');

    // Build the prompt with sample data
    const prompt = buildConnectionFinderPrompt({
      roleTitle: 'Software Engineering Intern',
      goalTitles: ['Gain industry experience', 'Learn ML in production'],
      connectionAspects: sampleConnectionAspects,
      race: 'Asian',
      location: 'San Francisco, CA',
      preferences: {
        programs: true,
        connections: true,
      },
    });

    console.log('\n--- Generated Prompt ---\n');
    console.log(prompt);
    console.log('\n--- End of Prompt ---\n');

    console.log('Calling Claude API...');

    // Call Claude with the generated prompt
    const response = await callClaude(prompt, {
      model: 'o4-mini', // Using the specified model
      maxTokens: 2000,
      schema: ConnectionsResponse,
      schemaLabel: 'ConnectionsResponse',
    });

    console.log('\n--- Raw Response ---\n');
    console.log(JSON.stringify(response, null, 2));
    console.log('\n--- End of Response ---\n');

    // Process the response
    if (response?.connections) {
      console.log(`✅ Found ${response.connections.length} connections`);
      response.connections.forEach((conn: any, index: number) => {
        console.log(`\nConnection ${index + 1}:`);
        console.log(`Type: ${conn.type}`);
        console.log(`Name: ${conn.name}`);
        if (conn.type === 'person') {
          console.log(`Role: ${conn.current_role} at ${conn.company}`);
          console.log(`LinkedIn: ${conn.linkedin_url}`);
        } else {
          console.log(`Organization: ${conn.organization}`);
          console.log(`Website: ${conn.website_url}`);
        }
        console.log('Direct Matches:', conn.direct_matches);
      });
    } else {
      console.warn('⚠️ No connections found in response');
    }
  } catch (error) {
    console.error('❌ Error testing connection finder:');
    if (error instanceof Error) {
      console.error(error.message);
      console.error(error.stack);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the test
testConnectionFinder()
  .then(() => console.log('\nTest completed successfully!'))
  .catch((error) => console.error('Test failed:', error));
