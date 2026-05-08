import { NextResponse } from "next/server";

import { createReviewDryRun, jsonError } from "../../../../../lib/kb-service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request, context) {
  try {
    const { id } = await context.params;
    return NextResponse.json(createReviewDryRun(decodeURIComponent(id)));
  } catch (error) {
    return NextResponse.json(jsonError(error), { status: error.statusCode || 500 });
  }
}
