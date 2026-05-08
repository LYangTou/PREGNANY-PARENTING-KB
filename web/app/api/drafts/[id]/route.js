import { NextResponse } from "next/server";

import { apiError } from "../../../../lib/api-error.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, context) {
  try {
    const { getDraftDetail } = await import("../../../../lib/kb-service.js");
    const { id } = await context.params;
    return NextResponse.json(getDraftDetail(decodeURIComponent(id)));
  } catch (error) {
    return NextResponse.json(apiError(error), { status: error.statusCode || 500 });
  }
}
