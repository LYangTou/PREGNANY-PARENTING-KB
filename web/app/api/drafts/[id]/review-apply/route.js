import { NextResponse } from "next/server";

import { apiError } from "../../../../../lib/api-error.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, context) {
  try {
    const { applyReview } = await import("../../../../../lib/kb-service.js");
    const { id } = await context.params;
    const body = await request.json();
    return NextResponse.json(applyReview(decodeURIComponent(id), body));
  } catch (error) {
    return NextResponse.json(apiError(error), { status: error.statusCode || 500 });
  }
}
