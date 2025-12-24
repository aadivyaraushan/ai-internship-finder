import { NextRequest } from 'next/server';
import { findConnectionsIteratively } from './services/connectionFinderService';
import { postProcessConnections } from './services/postProcessConnectionsService';
import { Connection } from '@/lib/firestoreHelpers';
import { EventEmitter } from 'events';
import { ConnectionPreferences } from '@/components/ui/ConnectionPreferencesSelector';
import { ResumeAspects } from './services/resumeAnalysisService';

// Create a global event emitter (consider using a request-specific emitter in production)
const globalEmitter = new EventEmitter();

type PersonalizationSettings = {
  enabled: boolean;
  professionalInterests: string;
  personalInterests: string;
};

type ConnectionRequest = {
  goalTitle: string;
  preferences: ConnectionPreferences;
  race: string;
  userId: string;
  resumeAspects: ResumeAspects;
  rawResumeText: string;
  personalizationSettings?: PersonalizationSettings;
};

export async function POST(req: Request) {
  // console.log('\n🚀 Starting connection search process');

  const encoder = new TextEncoder();
  let streamClosed = false;

  // Create the SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body: ConnectionRequest = await req.json();
        const {
          goalTitle,
          preferences,
          userId,
          resumeAspects,
          rawResumeText,
          personalizationSettings,
        } = body;

        // Debug personalization settings
        // console.log('🎯 Personalization Settings Received:', {
        //   enabled: personalizationSettings?.enabled,
        //   professionalInterests: personalizationSettings?.professionalInterests,
        //   personalInterests: personalizationSettings?.personalInterests,
        // });

        // Helper to send SSE messages
        const sendSSE = (data: Record<string, unknown>) => {
          if (!streamClosed) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          }
        };

        // Basic validation
        if (!goalTitle) {
          sendSSE({ type: 'error', message: 'Goal title is required' });
          controller.close();
          return;
        }
        if (!userId) {
          sendSSE({ type: 'error', message: 'User ID is required' });
          controller.close();
          return;
        }

        // Step 1: Use resumeAspects
        sendSSE({
          type: 'step-update',
          step: 0,
          message: 'Processing resume aspects...',
        });
        const aspects = resumeAspects;

        // console.log('🎯 API - Raw resumeAspects received:', {
        //   exists: !!aspects,
        //   isEmpty: !aspects || Object.keys(aspects).length === 0,
        //   keys: aspects ? Object.keys(aspects) : 'null',
        // });

        if (!aspects) {
          sendSSE({ type: 'error', message: 'No resume aspects provided' });
          controller.close();
          return;
        }

        // Check if aspects is empty object
        if (Object.keys(aspects).length === 0) {
          // console.warn('⚠️ API - resumeAspects is an empty object, background info will be missing');
          sendSSE({
            type: 'error',
            message:
              'Resume aspects are empty. Please make sure your resume has been properly analyzed.',
          });
          controller.close();
          return;
        }

        // logAspects(aspects);

        // Step 1: Start finding connections
        sendSSE({
          type: 'step-update',
          step: 1,
          message: 'Finding 1st connection...',
        });
        // console.log('preferences: ', preferences);

        const found: Connection[] = [];
        let connectionCount = 0;

        // Use the iterative generator to find connections one by one
        for await (const connection of findConnectionsIteratively({
          goalTitle,
          connectionAspects: aspects,
          rawResumeText,
          preferences,
          personalizationSettings,
        })) {
          connectionCount++;
          found.push(connection);

          // console.log(`🎯 Sending connection ${connectionCount} to frontend - ${connection.name}:`);
          // console.log('  shared_professional_interests:', JSON.stringify(connection.shared_professional_interests, null, 2));
          // console.log('  shared_personal_interests:', JSON.stringify(connection.shared_personal_interests, null, 2));

          // Send connection found event
          const sseMessage = {
            type: 'connection-found',
            connection,
            count: connectionCount,
            total: 5, // We generate 5 connections
          };

          // console.log('🎯 Full SSE message being sent:', JSON.stringify(sseMessage, null, 2));
          sendSSE(sseMessage);

          // Send step update for next connection (if not the last one)
          if (connectionCount < 5) {
            sendSSE({
              type: 'step-update',
              step: connectionCount + 1,
              message: `Finding ${connectionCount + 1}${
                connectionCount + 1 === 2
                  ? 'nd'
                  : connectionCount + 1 === 3
                  ? 'rd'
                  : 'th'
              } connection...`,
            });
          }
        }

        // // Process enrichment in batches to send updates
        // const enriched: Connection[] = [];
        // for (let i = 0; i < found.length; i++) {
        //   const conn = found[i];
        //   let enrichedConn: Connection;

        //   if (conn.type === 'person') {
        //     enrichedConn = await enrichPersonConnection(conn);
        //   } else if (conn.type === 'program') {
        //     enrichedConn = await enrichProgramConnection(conn);
        //   } else {
        //     enrichedConn = conn;
        //   }
        //   if (enrichedConn.verified_profile_url) {
        //     enriched.push(enrichedConn);
        //   }

        // Send progress update
        //   sendSSE({
        //     type: 'enrichment-progress',
        //     progress: ((i + 1) / found.length) * 100,
        //     current: i + 1,
        //     total: found.length,
        //   });
        // }

        // Step 6: Post-process
        sendSSE({
          type: 'step-update',
          step: 6,
          message: 'Processing results...',
        });
        const processed = postProcessConnections(found, rawResumeText);

        // Send final results
        sendSSE({
          type: 'complete',
          data: {
            connections: processed,
            aspects,
            goalTitle,
            timestamp: new Date().toISOString(),
            status: 'success',
          },
        });

        // Close the stream
        controller.close();
      } catch (err: unknown) {
        console.error('❌ Critical error in connection search:', err);
        if (!streamClosed) {
          const errMessage =
            err instanceof Error ? err.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: `Failed to fetch connections: ${errMessage}`,
                error: errMessage,
              })}\n\n`
            )
          );
        }
        controller.close();
      }
    },

    cancel() {
      streamClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
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

  const listener = (event: Record<string, unknown>) => {
    const eventName = event.type;
    const data = JSON.stringify(event);
    const sseMessage = `event: ${eventName}\ndata: ${data}\n\n`;
    // console.log('Sending SSE:', sseMessage); // Temporary debug
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
