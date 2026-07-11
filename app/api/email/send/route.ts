import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { readSecrets } from "@/lib/store";
import { requireUserId, UnauthorizedError } from "@/lib/session";
import { TailoredResumeSchema } from "@/lib/resumeSchema";
import { renderResumePdf, resumeFilename } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  to: z.string().email("Please enter a valid recipient email."),
  subject: z.string().min(1),
  body: z.string().min(1),
  resume: TailoredResumeSchema,
  cc: z.string().email().optional(),
});

/**
 * One-click send via Gmail (Nodemailer + App Password). Generates the PDF fresh
 * from the tailored resume JSON and attaches it, so the sent resume always
 * matches the preview.
 */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request." },
      { status: 400 }
    );
  }
  const { to, subject, body, resume, cc } = parsed.data;

  try {
    const userId = await requireUserId();
    const secrets = await readSecrets(userId);
    const pdf = await renderResumePdf(resume);

    let transporter;
    const provider = secrets.emailProvider || "gmail";
    let fromEmail = "";

    if (provider === "outlook") {
      if (!secrets.outlookUser || !secrets.outlookAppPassword) {
        return NextResponse.json({ error: "Outlook is not configured. Add your Outlook address + App Password in Settings." }, { status: 400 });
      }
      fromEmail = secrets.outlookUser;
      transporter = nodemailer.createTransport({
        host: "smtp-mail.outlook.com",
        port: 587,
        secure: false, // TLS
        auth: { user: secrets.outlookUser, pass: secrets.outlookAppPassword },
      });
    } else {
      if (!secrets.gmailUser || !secrets.gmailAppPassword) {
        return NextResponse.json({ error: "Gmail is not configured. Add your Gmail address + App Password in Settings." }, { status: 400 });
      }
      fromEmail = secrets.gmailUser;
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: secrets.gmailUser, pass: secrets.gmailAppPassword },
      });
    }

    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      cc,
      subject,
      text: body,
      attachments: [
        { filename: resumeFilename(resume), content: pdf, contentType: "application/pdf" },
      ],
    });

    console.log(`[email/send] sent to ${to} id=${info.messageId}`);
    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    console.error("[email/send] error", err);
    const msg = (err as Error).message || "Failed to send email.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
