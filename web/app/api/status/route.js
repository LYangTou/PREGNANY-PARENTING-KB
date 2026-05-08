import { NextResponse } from "next/server";

import { getStatus, jsonError } from "../../../lib/kb-service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getStatus());
  } catch (error) {
    return NextResponse.json(jsonError(error), { status: error.statusCode || 500 });
  }
}
