import { NextResponse } from 'next/server';
import { analyzeResume } from './services/resumeAnalysisService';
import { findConnections } from './services/connectionFinderService';
import { enrichConnection } from './services/profileEnrichmentService';
import { postProcessConnections } from './services/postProcessConnectionsService';
import { ConnectionRequest } from './types/connectionTypes';
import { Connection } from '@/lib/firestoreHelpers';

export async function POST(req: Request) {
  console.log('\n🚀 Starting connection search process');

  try {
    const body: ConnectionRequest = await req.json();
    const { resumeContext, goalTitle, preferences } = body;

    // Basic validation -------------------------------------------------------
    if (!goalTitle) {
      return errorResponse(400, 'Goal title is required');
    }
    if (!resumeContext) {
      return errorResponse(400, 'Resume context is required');
    }

    // 1. Resume analysis -----------------------------------------------------
    const aspects = await analyzeResume(resumeContext);
    logAspects(aspects);

    // 2. Find and enrich connections (roles deprecated) -----------------------
    const found = await findConnections({
      goalTitle,
      connectionAspects: aspects,
      preferences,
      race: body.race,
      location: body.location,
    });

    const enriched: Connection[] = await Promise.all(
      found.map(enrichConnection)
    );

    // 3. Post-process to trimmed structure expected by frontend
    const processed = postProcessConnections(enriched, resumeContext);

    // 4. Response -----------------------------------------------------------
    return NextResponse.json({
      connections: processed,
      aspects,
      goalTitle,
      timestamp: new Date().toISOString(),
      status: 'success',
    });
  } catch (err) {
    console.error('❌ Route processing error:', err);
    return errorResponse(
      500,
      'Failed to process connection search',
      String(err)
    );
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
