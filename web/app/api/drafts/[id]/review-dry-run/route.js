import { NextResponse } from "next/server";

import { apiError } from "../../../../../lib/api-error.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request, context) {
  try {
    const { createReviewDryRun } = await import("../../../../../lib/kb-service.js");
    const { id } = await context.params;
    return NextResponse.json(createReviewDryRun(decodeURIComponent(id)));
  } catch (error) {
    return NextResponse.json(apiError(error), { status: error.statusCode || 500 });
  }
}
