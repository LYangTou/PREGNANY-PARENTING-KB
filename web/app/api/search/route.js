import { NextResponse } from "next/server";

import { jsonError, searchReviewed } from "../../../lib/kb-service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const response = searchReviewed(url.searchParams);
    response.results = response.results.map(({ card, ...result }) => result);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(jsonError(error), { status: error.statusCode || 500 });
  }
}
