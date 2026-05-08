import { NextResponse } from "next/server";

import { getDraftDetail, jsonError } from "../../../../lib/kb-service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, context) {
  try {
    const { id } = await context.params;
    return NextResponse.json(getDraftDetail(decodeURIComponent(id)));
  } catch (error) {
    return NextResponse.json(jsonError(error), { status: error.statusCode || 500 });
  }
}
