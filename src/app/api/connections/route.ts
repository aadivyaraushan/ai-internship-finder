import { NextRequest, NextResponse } from 'next/server';
import { findConnections } from './services/connectionFinderService';
import { enrichPersonConnection } from './services/profileEnrichmentService';
import { enrichProgramConnection } from './services/programEnrichmentService';
import { postProcessConnections } from './services/postProcessConnectionsService';
import { Connection } from '@/lib/firestoreHelpers';
import { EventEmitter } from 'events';
import { ConnectionPreferences } from '@/components/ui/ConnectionPreferencesSelector';
import { ResumeAspects } from './services/resumeAnalysisService';
import { getResume } from '@/lib/firestoreHelpers';

// Create a global event emitter (consider using a request-specific emitter in production)
const globalEmitter = new EventEmitter();

type ConnectionRequest = {
  goalTitle: string;
  preferences: ConnectionPreferences;
  race: string;
  location: string;
  userId: string;
  resumeAspects: ResumeAspects;
  rawResumeText: string;
};

export async function POST(req: Request) {
  console.log('\n🚀 Starting connection search process');

  try {
    const body: ConnectionRequest = await req.json();
    const {
      goalTitle,
      preferences,
      userId,
      race,
      location,
      resumeAspects,
      rawResumeText,
    } = body;

    // Create a request-specific event emitter
    const requestEmitter = new EventEmitter();

    // Forward events to the global emitter
    requestEmitter.on('event', (event) => {
      globalEmitter.emit('event', { ...event, userId });
    });

    // Function to broadcast events for this request
    const broadcastEvent = (event: any) => {
      requestEmitter.emit('event', event);
    };

    // Basic validation -------------------------------------------------------
    if (!goalTitle) {
      return errorResponse(400, 'Goal title is required');
    }
    if (!userId) {
      return errorResponse(400, 'User ID is required');
    }

    // Step 1: Use resumeAspects from request body
    broadcastEvent({ type: 'step-update' });
    const aspects = resumeAspects as ResumeAspects;
    if (!aspects) {
      return errorResponse(400, 'No resume aspects provided');
    }

    logAspects(aspects);

    // Step 2: Find and enrich connections (roles deprecated) -----------------------
    broadcastEvent({ type: 'step-update' });
    const found = await findConnections({
      goalTitle,
      connectionAspects: aspects,
      preferences,
      race,
      location,
    });

    // Broadcast found connections
    found.forEach((connection) => {
      broadcastEvent({ type: 'add', action: 'add', connection });
    });

    broadcastEvent({ type: 'step-update' });
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

    // Broadcast enriched connections
    enriched.forEach((connection) => {
      broadcastEvent({
        type: 'add',
        action: 'add',
        connection: postProcessConnections([connection], rawResumeText)[0],
      });
    });

    // Step 3: Post-process to trimmed structure expected by frontend
    broadcastEvent({ type: 'step-update' });
    const processed = postProcessConnections(enriched, rawResumeText);

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

// SSE endpoint for progress events
// IMPORTANT: This must be a GET handler for SSE
// We'll use a dynamic route parameter to identify the request
// This is a simplified example - in production you'd need a more robust system
// to match events to specific client requests

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
    const eventName = event.type;
    const data = JSON.stringify(event);
    const sseMessage = `event: ${eventName}\ndata: ${data}\n\n`;
    console.log('Sending SSE:', sseMessage); // Temporary debug
    writer.write(encoder.encode(sseMessage));
  };

  // Use the global emitter for SSE
  globalEmitter.on('event', listener);

  // Cleanup on client disconnect
  req.signal.onabort = () => {
    globalEmitter.off('event', listener);
    writer.close();
  };

  // Send initial event to keep connection alive
  writer.write(encoder.encode(': ping\n\n'));

  return new Response(responseStream.readable, { headers });
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
