import { apiError } from "../../../../lib/api-error.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sse(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request) {
  const encoder = new TextEncoder();

  try {
    const { streamAgentAnswer, jsonError } = await import("../../../../lib/kb-service.js");
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
    return Response.json(apiError(error), { status: error.statusCode || 500 });
  }
}
