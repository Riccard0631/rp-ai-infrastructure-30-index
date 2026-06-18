import { NextResponse } from "next/server";

import { getIndexHistory, getIndexMetrics } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    metrics: getIndexMetrics(),
    history: getIndexHistory()
  });
}
