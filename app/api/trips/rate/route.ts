import { logRating } from "@/lib/providers/logger";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const ratingSchema = z.object({
  tripId: z.string(),
  rating: z.enum(["like", "dislike"]),
  mood: z.enum(["surprise", "unusual", "nature", "culture", "food"]),
  walking: z.enum(["low", "medium", "high"]),
  durationMinutes: z.number(),
  comment: z.string().max(500).optional()
});

export async function POST(request: Request) {
  try {
    const body = ratingSchema.parse(await request.json());
    await logRating(
      body.tripId,
      body.rating,
      { mood: body.mood, walking: body.walking, durationMinutes: body.durationMinutes },
      body.comment
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid rating payload" }, { status: 400 });
  }
}
