import { logFeedback } from "@/lib/providers/logger";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  tripId: z.string(),
  status: z.enum(["completed", "rejected"]),
  mood: z.enum(["surprise", "unusual", "nature", "culture", "food"]),
  walking: z.enum(["low", "medium", "high"]),
  durationMinutes: z.number()
});

export async function POST(request: Request) {
  try {
    const body = feedbackSchema.parse(await request.json());
    await logFeedback(body.tripId, body.status, {
      mood: body.mood,
      walking: body.walking,
      durationMinutes: body.durationMinutes
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
  }
}
