import { NextResponse } from "next/server";

import { applyReview, jsonError } from "../../../../../lib/kb-service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    return NextResponse.json(applyReview(decodeURIComponent(id), body));
  } catch (error) {
    return NextResponse.json(jsonError(error), { status: error.statusCode || 500 });
  }
}
