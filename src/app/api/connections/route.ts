import { NextResponse } from 'next/server';
import { analyzeResume } from './services/resumeAnalysisService';
import { findConnections } from './services/connectionFinderService';
import { enrichPersonConnection } from './services/profileEnrichmentService';
import { enrichProgramConnection } from './services/programEnrichmentService';
import { postProcessConnections } from './services/postProcessConnectionsService';
import { ConnectionRequest } from './types/connectionTypes';
import { Connection } from '@/lib/firestoreHelpers';

export async function POST(req: Request) {
  console.log('\n🚀 Starting connection search process');

  try {
    const body: ConnectionRequest = await req.json();
    const { resumeContext, goalTitle, preferences } = body;

    // Define the steps for the connection finding process
    const steps = [
      'Starting',
      'Analyzing resume',
      'Finding connections',
      'Enriching connections',
      'Post-processing',
      'Completed',
    ];
    let currentStepIndex = 0;

    // Broadcast the initial step event
    broadcastEvent({ type: 'step-init', steps });
    broadcastEvent({ type: 'step-update', stepIndex: currentStepIndex });

    // Basic validation -------------------------------------------------------
    if (!goalTitle) {
      return errorResponse(400, 'Goal title is required');
    }
    if (!resumeContext) {
      return errorResponse(400, 'Resume context is required');
    }

    // Step 1: Resume analysis
    currentStepIndex = 1;
    broadcastEvent({ type: 'step-update', stepIndex: currentStepIndex });
    const aspects = await analyzeResume(resumeContext);
    logAspects(aspects);

    // Step 2: Find and enrich connections (roles deprecated) -----------------------
    currentStepIndex = 2;
    broadcastEvent({ type: 'step-update', stepIndex: currentStepIndex });
    const found = await findConnections({
      goalTitle,
      connectionAspects: aspects,
      preferences,
      race: body.race,
      location: body.location,
    });

    const enriched: Connection[] = await Promise.all(
      found.map((conn) => {
        if (conn.type === 'person') {
          return enrichPersonConnection(conn);
        } else if (conn.type === 'program') {
          return enrichProgramConnection(conn);
        }
        return conn; // Fallback
      })
    );

    // Step 3: Post-process to trimmed structure expected by frontend
    currentStepIndex = 3;
    broadcastEvent({ type: 'step-update', stepIndex: currentStepIndex });
    const processed = postProcessConnections(enriched, resumeContext);

    // Step 4: Completed
    currentStepIndex = 4;
    broadcastEvent({ type: 'step-update', stepIndex: currentStepIndex });

    // Return the processed connections to the client
    return NextResponse.json({
      connections: processed,
      aspects,
      goalTitle,
      timestamp: new Date().toISOString(),
      status: 'success',
    });
  } catch (err) {
    console.error('❌ Critical error in connection search:', err);
    return errorResponse(500, 'Failed to fetch connections');
  }
}

// ---------------------------------------------------------------------------
function errorResponse(status: number, message: string, details?: string) {
  return NextResponse.json(
    { error: message, ...(details && { details }) },
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

function logAspects(aspects: any) {
  console.log('Connection aspects details:');
  for (const [k, v] of Object.entries(aspects)) {
    console.log(`- ${k}:`, JSON.stringify(v, null, 2));
  }
}

function broadcastEvent(event: any) {
  // TO DO: implement event broadcasting logic
  console.log('Broadcasting event:', event);
}
