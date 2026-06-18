import { NextResponse } from "next/server";

import { INDEX_META, getComponents, getDataStatus, getIndexMetrics } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const metrics = getIndexMetrics();
  const components = getComponents();

  return NextResponse.json({
    name: INDEX_META.name,
    ticker: INDEX_META.ticker,
    value: Number(metrics.currentValue.toFixed(4)),
    date: metrics.date,
    dailyReturn: metrics.dailyReturn,
    performanceSinceLaunch: metrics.performanceSinceLaunch,
    type: INDEX_META.type,
    weighting: INDEX_META.weighting,
    rebalance: INDEX_META.rebalance,
    baseValue: INDEX_META.baseValue,
    baseDate: INDEX_META.baseDate,
    components: components.length,
    dataStatus: getDataStatus()
  });
}
