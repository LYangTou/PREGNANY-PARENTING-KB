import { NextResponse } from "next/server";

import { jsonError, listDrafts } from "../../../lib/kb-service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(listDrafts(url.searchParams));
  } catch (error) {
    return NextResponse.json(jsonError(error), { status: error.statusCode || 500 });
  }
}
