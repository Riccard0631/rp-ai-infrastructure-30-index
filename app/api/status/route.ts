import { NextResponse } from "next/server";

import { getDataStatus } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getDataStatus() ?? { status: "missing" });
}
