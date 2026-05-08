import { NextResponse } from "next/server";

import { apiError } from "../../../lib/api-error.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { listDrafts } = await import("../../../lib/kb-service.js");
    const url = new URL(request.url);
    return NextResponse.json(listDrafts(url.searchParams));
  } catch (error) {
    return NextResponse.json(apiError(error), { status: error.statusCode || 500 });
  }
}
