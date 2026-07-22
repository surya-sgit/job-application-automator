"use client";
import Link from "next/link";
import { motion } from "framer-motion";

const STEPS = [
  {
    n: 1,
    title: "Paste the job description",
    text: "Drop in any JD. AI extracts the required skills and matches them against your saved projects — locally, costing zero tokens.",
  },
  {
    n: 2,
    title: "Review, approve & answer",
    text: "Approve which projects to feature, answer a few sharp clarifying questions, and the AI tailors your resume to the role.",
  },
  {
    n: 3,
    title: "Download & email HR",
    text: "Get a clean one-page PDF that never overflows, then send it straight to HR from your Gmail in one click.",
  },
];

const FEATURES = [
  {
    icon: "🧠",
    title: "Bring your own AI",
    text: "Claude, GPT, Gemini, Groq, or local Ollama — your key, your choice, switchable anytime in Settings.",
  },
  {
    icon: "🎯",
    title: "Smart project matching",
    text: "Store all your projects once. Each JD automatically pulls in only the most relevant ones — matched locally, 0 tokens.",
  },
  {
    icon: "📄",
    title: "One-page, ATS-friendly PDF",
    text: "Auto-fit layout with proper spacing that always lands on a single page. No overflow, ever.",
  },
  {
    icon: "📧",
    title: "One-click Gmail send",
    text: "AI drafts the cover email, you review and confirm, and it lands in HR's inbox with your resume attached.",
  },
  {
    icon: "🪙",
    title: "Token-efficient by design",
    text: "A multi-step pipeline sends the AI only the relevant slice of your profile — never the whole thing.",
  },
  {
    icon: "🔒",
    title: "Your keys stay yours",
    text: "API keys and Gmail credentials are encrypted at rest and only ever used for your own requests.",
  },
];

export default function LandingPage() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="space-y-24 py-12"
    >
      {/* Hero */}
      <section className="text-center">
        <p className="mb-4 text-5xl">🎯</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Paste a job description. Get a tailored resume. Email it — in minutes.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
          Job Application Automator turns any JD into a one-page, ATS-friendly resume built from
          your own projects and experience, then sends it to HR in one click.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Get started free
          </Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">
            Log in
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">How it works</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card space-y-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                {s.n}
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section>
        <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">
          Everything you need to apply faster
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card space-y-2">
              <p className="text-2xl">{f.icon}</p>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section>
        <div className="card space-y-4 py-10 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Your next application, tailored in minutes
          </h2>
          <p className="text-slate-500">
            Free to run — you only pay your own AI provider, and only for what you use.
          </p>
          <div>
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Create your account
            </Link>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
