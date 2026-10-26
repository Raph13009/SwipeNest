import { NextRequest, NextResponse } from "next/server";
import { engine } from "@/lib/server/engine";
import type { RejectionReason, UserPreferences } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function userId(req: NextRequest) {
  return req.nextUrl.searchParams.get("user_id") || "default";
}

async function handle(req: NextRequest, slug: string[]) {
  const path = slug.join("/");
  const uid = userId(req);
  const method = req.method.toUpperCase();

  try {
    if (path === "health" && method === "GET") {
      return NextResponse.json(engine.health());
    }

    if (path === "onboarding" && method === "POST") {
      const body = (await req.json()) as {
        preferences: UserPreferences;
        demo_profile?: boolean;
      };
      return NextResponse.json(
        engine.onboarding(uid, body.preferences, Boolean(body.demo_profile))
      );
    }

    if (path === "user" && method === "GET") {
      return NextResponse.json(engine.getUser(uid));
    }

    if (path === "user/preferences" && method === "PUT") {
      const prefs = (await req.json()) as UserPreferences;
      return NextResponse.json(engine.updatePreferences(uid, prefs));
    }

    if (path === "user/reset" && method === "POST") {
      return NextResponse.json(engine.resetUser(uid));
    }

    if (path === "feed" && method === "GET") {
      const limit = Number(req.nextUrl.searchParams.get("limit") || 25);
      return NextResponse.json(engine.feed(uid, limit));
    }

    if (path === "listings" && method === "GET") {
      return NextResponse.json(
        engine.listings(uid, {
          arrondissement: req.nextUrl.searchParams.get("arrondissement")
            ? Number(req.nextUrl.searchParams.get("arrondissement"))
            : undefined,
          max_rent: req.nextUrl.searchParams.get("max_rent")
            ? Number(req.nextUrl.searchParams.get("max_rent"))
            : undefined,
          limit: Number(req.nextUrl.searchParams.get("limit") || 100),
        })
      );
    }

    if (path.startsWith("listings/") && method === "GET") {
      const id = path.slice("listings/".length);
      const listing = engine.listing(uid, id);
      if (!listing) return NextResponse.json({ detail: "Listing not found" }, { status: 404 });
      return NextResponse.json(listing);
    }

    if (path === "swipe" && method === "POST") {
      const body = (await req.json()) as {
        listing_id: string;
        action: "like" | "reject";
        reason?: RejectionReason | null;
      };
      return NextResponse.json(
        engine.swipe(uid, body.listing_id, body.action, body.reason)
      );
    }

    if (path === "swipe/undo" && method === "POST") {
      return NextResponse.json(engine.undo(uid));
    }

    if (path.startsWith("favorites/") && method === "POST") {
      const id = path.slice("favorites/".length);
      return NextResponse.json(engine.addFavorite(uid, id));
    }

    if (path.startsWith("favorites/") && method === "DELETE") {
      const id = path.slice("favorites/".length);
      return NextResponse.json(engine.removeFavorite(uid, id));
    }

    if (path === "favorites" && method === "GET") {
      return NextResponse.json(engine.favorites(uid));
    }

    if (path.startsWith("explain/") && method === "GET") {
      const id = path.slice("explain/".length);
      return NextResponse.json(engine.explain(uid, id));
    }

    if (path === "taste-dna" && method === "GET") {
      return NextResponse.json(engine.tasteDna(uid));
    }

    if (path === "taste-dna/reset" && method === "POST") {
      return NextResponse.json(engine.resetDna(uid));
    }

    if (path === "search" && method === "POST") {
      const body = (await req.json()) as { query: string; limit?: number };
      return NextResponse.json(engine.search(uid, body.query || "", body.limit || 24));
    }

    if (path.startsWith("scam/") && method === "GET") {
      const id = path.slice("scam/".length);
      return NextResponse.json(engine.scam(uid, id));
    }

    if (path === "apply" && method === "POST") {
      const body = (await req.json()) as {
        listing_id: string;
        tone: string;
        language: string;
      };
      return NextResponse.json(
        engine.apply(uid, body.listing_id, body.tone, body.language)
      );
    }

    if (path === "compare" && method === "POST") {
      const body = (await req.json()) as { listing_ids: string[] };
      return NextResponse.json(engine.compare(uid, body.listing_ids || []));
    }

    if (path === "map" && method === "GET") {
      return NextResponse.json(engine.map(uid));
    }

    if (path === "demo/adaptation" && method === "GET") {
      return NextResponse.json(engine.adaptation(uid));
    }

    return NextResponse.json({ detail: `Not found: ${path}` }, { status: 404 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}

type Ctx = { params: Promise<{ slug: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  return handle(req, slug);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  return handle(req, slug);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  return handle(req, slug);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  return handle(req, slug);
}
