import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { getModel, MissingKeyError, describeConfig } from "@/lib/ai";
import { readSecrets } from "@/lib/store";
import { requireUserId, UnauthorizedError } from "@/lib/session";
import { EmailDraftSchema, JdAnalysisSchema, TailoredResumeSchema } from "@/lib/resumeSchema";
import { EMAIL_SYSTEM, emailUser } from "@/lib/prompts";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  analysis: JdAnalysisSchema,
  resume: TailoredResumeSchema,
  company: z.string().optional(),
});

/** Draft the application email. Uses the cheap model — it's a short output. */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
  const { analysis, resume, company } = parsed.data;

  // Derive top points locally to keep the prompt tiny.
  const topPoints: string[] = [];
  if (resume.summary) topPoints.push(`Professional Summary: ${resume.summary}`);
  if (resume.experience[0]?.bullets?.[0]) {
    topPoints.push(`Previous Role (${resume.experience[0].company}): ${resume.experience[0].bullets[0]}`);
  }
  if (resume.projects[0]?.bullets?.[0]) {
    topPoints.push(`Personal Project (${resume.projects[0].title}): ${resume.projects[0].bullets[0]}`);
  }

  try {
    const userId = await requireUserId();
    const secrets = await readSecrets(userId);
    const { object, usage } = await generateObject({
      model: await getModel({ cheap: true, secrets }),
      schema: EmailDraftSchema,
      system: EMAIL_SYSTEM,
      prompt: emailUser({
        jobTitle: analysis.jobTitle || resume.title,
        company,
        candidateName: resume.name,
        contact: resume.contact,
        topPoints,
      }),
    });
    console.log(`[email/draft] ${describeConfig(secrets)} tokens=`, usage);
    return NextResponse.json({ draft: object, usage });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    if (err instanceof MissingKeyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[email/draft] error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
