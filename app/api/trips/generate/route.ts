import { generateTrip, NoReliableTripError } from "@/lib/engine";
import { GoogleApiError } from "@/lib/providers/google";
import { logTrip } from "@/lib/providers/logger";
import { generateTripSchema } from "@/lib/validation";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let input: ReturnType<typeof generateTripSchema.parse> | undefined;
  try {
    input = generateTripSchema.parse(await request.json());
    const { plan, stats } = await generateTrip(input);
    logTrip(input, plan, undefined, stats).catch(console.error);
    return NextResponse.json(plan);
  } catch (error) {
    if (input) logTrip(input, undefined, error, undefined).catch(console.error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    if (error instanceof NoReliableTripError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof GoogleApiError) {
      console.error("Google Maps configuration error", {
        service: error.service,
        status: error.status,
        error: error.message
      });
      return NextResponse.json(
        {
          error:
            error.status === 403
              ? `${error.message}. Vérifie que cette API est activée, que la facturation est liée au projet et que la clé serveur n'utilise pas une restriction Websites.`
              : error.message
        },
        { status: 502 }
      );
    }
    console.error("Trip generation failed without logging exact coordinates", {
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "La génération a échoué. Réessaie dans un instant." }, { status: 500 });
  }
}
