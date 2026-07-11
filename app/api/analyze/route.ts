import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { getModel, MissingKeyError, describeConfig } from "@/lib/ai";
import { readSecrets } from "@/lib/store";
import { requireUserId, UnauthorizedError } from "@/lib/session";
import { JdAnalysisSchema } from "@/lib/resumeSchema";
import { ANALYSIS_SYSTEM, analyzeUser } from "@/lib/prompts";

export const runtime = "nodejs";

/** Agent 1 — JD analyzer. Uses the cheap model. Small in, small out. */
export async function POST(req: NextRequest) {
  const { jd } = await req.json();
  if (!jd || typeof jd !== "string" || jd.trim().length < 20) {
    return NextResponse.json({ error: "Please paste a fuller job description." }, { status: 400 });
  }

  try {
    const userId = await requireUserId();
    const secrets = await readSecrets(userId);
    const { object, usage } = await generateObject({
      model: await getModel({ cheap: true, secrets }),
      schema: JdAnalysisSchema,
      system: ANALYSIS_SYSTEM,
      prompt: analyzeUser(jd),
    });
    console.log(`[analyze] ${describeConfig(secrets)} tokens=`, usage);
    return NextResponse.json({ analysis: object, usage });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    if (err instanceof MissingKeyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[analyze] error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
