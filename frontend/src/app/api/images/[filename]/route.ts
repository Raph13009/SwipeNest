import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { imagePath } from "@/lib/server/engine";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ filename: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { filename } = await ctx.params;
  const file = imagePath(filename);
  if (!existsSync(file) || filename.includes("..")) {
    return NextResponse.json({ detail: "Image not found" }, { status: 404 });
  }
  const buf = readFileSync(file);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
