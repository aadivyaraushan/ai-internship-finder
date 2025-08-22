import { PassThrough } from 'stream';

export class SSEService {
  static createStream() {
    const stream = new PassThrough();
    return {
      stream,
      sendEvent(event: string, data: unknown) {
        stream.write(`event: ${event}\n`);
        stream.write(`data: ${JSON.stringify(data)}\n\n`);
      },
      close() {
        stream.end();
      },
    };
  }
}
