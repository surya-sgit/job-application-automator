import { NextRequest, NextResponse } from "next/server";
import { generateObject, generateText } from "ai";
import { getModel, MissingKeyError, describeConfig } from "@/lib/ai";
import { readProfile, readSecrets } from "@/lib/store";
import { requireUserId, UnauthorizedError } from "@/lib/session";
import {
  JdAnalysisSchema,
  QuestionsSchema,
  TailoredResumeSchema,
  ProjectSchema,
} from "@/lib/resumeSchema";
import {
  QUESTIONS_SYSTEM,
  TAILOR_SYSTEM,
  TAILOR_LATEX_SYSTEM,
  tailorContext,
  tailorLatexContext,
} from "@/lib/prompts";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * Agent 3 — resume tailor. Two actions:
 *   action="questions" -> 3-6 clarifying questions (cheap-ish, small output)
 *   action="generate"  -> the tailored resume JSON, using the user's answers
 *
 * Only the JD analysis + matched project subset + trimmed profile reach the
 * model — never the whole profile store.
 */

const BodySchema = z.object({
  action: z.enum(["questions", "generate"]),
  mode: z.enum(["json", "latex"]).default("json"),
  analysis: JdAnalysisSchema,
  projects: z.array(ProjectSchema).default([]),
  answers: z.record(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
  const { action, analysis, projects, answers } = parsed.data;

  try {
    const userId = await requireUserId();
    const profile = await readProfile(userId);
    const secrets = await readSecrets(userId);

    if (action === "questions") {
      const context = tailorContext(analysis, profile, projects, answers);
      const { object, usage } = await generateObject({
        model: await getModel({ cheap: true, secrets }),
        schema: QuestionsSchema,
        system: QUESTIONS_SYSTEM,
        prompt: context,
      });
      console.log(`[tailor:questions] ${describeConfig(secrets)} tokens=`, usage);
      return NextResponse.json({ questions: object.questions, usage });
    }

    // action === "generate"
    if (parsed.data.mode === "latex" && profile.latexTemplate) {
      const context = tailorLatexContext(profile.latexTemplate, analysis, projects, answers);
      const { text, usage } = await generateText({
        model: await getModel({ secrets }),
        system: TAILOR_LATEX_SYSTEM,
        prompt: context,
      });
      console.log(`[tailor:generate:latex] ${describeConfig(secrets)} tokens=`, usage);
      return NextResponse.json({ latex: text, usage });
    } else {
      const context = tailorContext(analysis, profile, projects, answers);
      const { object, usage } = await generateObject({
        model: await getModel({ secrets }),
        schema: TailoredResumeSchema,
        system: TAILOR_SYSTEM,
        prompt: context,
      });
      console.log(`[tailor:generate:json] ${describeConfig(secrets)} tokens=`, usage);
      return NextResponse.json({ resume: object, usage });
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    if (err instanceof MissingKeyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[tailor] error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
