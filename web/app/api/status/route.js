import { NextResponse } from "next/server";

import { apiError } from "../../../lib/api-error.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { getStatus } = await import("../../../lib/kb-service.js");
    return NextResponse.json(getStatus());
  } catch (error) {
    return NextResponse.json(apiError(error), { status: error.statusCode || 500 });
  }
}
