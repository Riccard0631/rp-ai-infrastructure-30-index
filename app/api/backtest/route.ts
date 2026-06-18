import { NextResponse } from "next/server";

import { getBacktestHistory, getBacktestSummary, getMetricsForHistory } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const history = getBacktestHistory();

  return NextResponse.json({
    summary: getBacktestSummary(),
    metrics: getMetricsForHistory(history),
    history
  });
}
