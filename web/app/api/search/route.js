import { NextResponse } from "next/server";

import { apiError } from "../../../lib/api-error.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchReviewed } = await import("../../../lib/kb-service.js");
    const url = new URL(request.url);
    const response = searchReviewed(url.searchParams);
    response.results = response.results.map(({ card, ...result }) => result);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(apiError(error), { status: error.statusCode || 500 });
  }
}
