import { NextRequest, NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/session";
import { readResumes, writeResumes, SavedResume } from "@/lib/store";
import { TailoredResumeSchema } from "@/lib/resumeSchema";
import { randomUUID } from "crypto";
import { z } from "zod";

export const runtime = "nodejs";

const SaveBodySchema = z.object({
  label: z.string().min(1).max(100),
  resume: TailoredResumeSchema,
  jdSnippet: z.string().default(""),
});

export async function GET() {
  try {
    const userId = await requireUserId();
    const resumes = await readResumes(userId);
    return NextResponse.json({ resumes });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = SaveBodySchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const resumes = await readResumes(userId);
    const newResume: SavedResume = {
      id: randomUUID(),
      label: body.data.label,
      resume: body.data.resume,
      createdAt: new Date().toISOString(),
      jdSnippet: body.data.jdSnippet.slice(0, 100),
    };
    resumes.unshift(newResume);
    await writeResumes(userId, resumes);

    return NextResponse.json({ saved: newResume });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
