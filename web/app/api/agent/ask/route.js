import { jsonError, streamAgentAnswer } from "../../../../lib/kb-service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sse(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request) {
  const encoder = new TextEncoder();

  try {
    const body = await request.json();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event, payload) => controller.enqueue(encoder.encode(sse(event, payload)));
        try {
          await streamAgentAnswer(body, send);
        } catch (error) {
          send("error", jsonError(error));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-transform",
        connection: "keep-alive"
      }
    });
  } catch (error) {
    return Response.json(jsonError(error), { status: error.statusCode || 500 });
  }
}
