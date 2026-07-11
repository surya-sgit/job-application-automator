"use client";

import { useEffect, useState } from "react";
import ResumePreview from "@/components/ResumePreview";
import { fetchJson } from "@/lib/clientFetch";
import type { JdAnalysis, TailoredResume, Project } from "@/lib/resumeSchema";

interface Matched {
  id: string;
  title: string;
  score: number;
  matched: string[];
}

interface SavedResume {
  id: string;
  label: string;
  resume: TailoredResume;
  createdAt: string;
  jdSnippet: string;
}

type Step = "input" | "review" | "questions" | "resume";

const STEPS: { key: Step; label: string }[] = [
  { key: "input", label: "Job description" },
  { key: "review", label: "Review & approve" },
  { key: "questions", label: "Questions" },
  { key: "resume", label: "Resume & email" },
];

export default function TailorApp() {
  const [step, setStep] = useState<Step>("input");
  const [jd, setJd] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [profileEmpty, setProfileEmpty] = useState(false);

  const [analysis, setAnalysis] = useState<JdAnalysis | null>(null);
  const [matched, setMatched] = useState<Matched[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [approvedProjects, setApprovedProjects] = useState<Project[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resume, setResume] = useState<TailoredResume | null>(null);
  const [useLatex, setUseLatex] = useState(false);
  const [latexOutput, setLatexOutput] = useState("");

  // email panel
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signature, setSignature] = useState("");
  const [emailStage, setEmailStage] = useState<"compose" | "confirm">("compose");
  const [sendResult, setSendResult] = useState("");

  // saved resumes
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [saveLabel, setSaveLabel] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [selectedBaseId, setSelectedBaseId] = useState<string>("");
  const [showSaved, setShowSaved] = useState(false);

  // Best-effort empty-profile guard — never blocks the flow.
  useEffect(() => {
    fetchJson<{ projects: unknown[]; experience: unknown[] }>("/api/profile")
      .then((p) => setProfileEmpty(p.projects.length === 0 && p.experience.length === 0))
      .catch(() => {});
  }, []);

  // Load saved resumes on mount
  useEffect(() => {
    fetchJson<{ resumes: SavedResume[] }>("/api/resumes")
      .then((r) => setSavedResumes(r.resumes || []))
      .catch(() => {});
  }, []);

  async function post(url: string, payload: any) {
    return fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  // Step 1 → 2: analyze the JD + match projects locally, then stop for review.
  async function analyze() {
    setError("");
    setSendResult("");
    try {
      setBusy("Analyzing job description…");
      const a = await post("/api/analyze", { jd });
      setAnalysis(a.analysis);
      if (a.analysis.recruiterEmail) {
        setTo(a.analysis.recruiterEmail);
      }
      if (a.analysis.companyName) {
        setCompany(a.analysis.companyName);
      }

      setBusy("Matching your projects (local, 0 tokens)…");
      const m = await post("/api/match", { analysis: a.analysis, topN: 4 });
      setMatched(m.selected);
      setProjects(m.projects);
      setCheckedIds(new Set(m.selected.map((s: Matched) => s.id)));
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function toggleProject(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Step 2 → 3: user approved the analysis + project selection.
  async function approveAndGetQuestions() {
    if (!analysis) return;
    setError("");
    const approved = projects.filter((p) => checkedIds.has(p.id));
    setApprovedProjects(approved);
    try {
      setBusy("Preparing clarifying questions…");
      const q = await post("/api/tailor", {
        action: "questions",
        analysis,
        projects: approved,
      });
      setQuestions(q.questions);
      setAnswers(Object.fromEntries(q.questions.map((x: string) => [x, ""])));
      setStep("questions");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  // Step 3 → 4: generate the tailored resume from answers + approved projects.
  async function generateResume() {
    setError("");
    try {
      const baseResume = savedResumes.find((s) => s.id === selectedBaseId)?.resume;
      const mode = useLatex ? "latex" : baseResume ? "tweak" : "json";

      setBusy(
        baseResume
          ? "Tweaking existing resume for new JD…"
          : "Writing your tailored resume…"
      );

      const r = await post("/api/tailor", {
        action: "generate",
        mode,
        analysis,
        projects: approvedProjects,
        answers,
        ...(baseResume ? { baseResume } : {}),
      });

      if (r.latex) {
        setLatexOutput(r.latex);
        setResume(null);
      } else {
        setResume(r.resume);
        setLatexOutput("");
      }
      setStep("resume");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function downloadPdf() {
    if (!resume) return;
    setError("");
    setBusy("Rendering PDF…");
    try {
      const res = await fetch("/api/resume/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resume),
      });
      if (!res.ok) throw new Error((await res.json()).error || "PDF failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(resume.name || "resume").replace(/[^a-z0-9]+/gi, "_")}_resume.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function draftEmail() {
    if (!resume || !analysis) return;
    setError("");
    setBusy("Drafting email…");
    try {
      const d = await post("/api/email/draft", { analysis, resume, company });
      setSubject(d.draft.subject);
      setBody(d.draft.body);
      if (!signature && resume) {
        const c = resume.contact || {};
        let sig = `Best regards,\n${resume.name}`;
        if (c.email) sig += `\nEmail: ${c.email}`;
        if (c.phone) sig += `\nPhone: ${c.phone}`;
        c.links?.forEach((link: string) => {
          if (link.toLowerCase().includes("linkedin")) sig += `\nLinkedIn: https://${link.replace(/^https?:\/\//, "")}`;
          else if (link.toLowerCase().includes("github")) sig += `\nGitHub: https://${link.replace(/^https?:\/\//, "")}`;
          else sig += `\nLink: https://${link.replace(/^https?:\/\//, "")}`;
        });
        setSignature(sig);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function sendEmail() {
    if (!resume) return;
    setError("");
    setSendResult("");
    setBusy("Sending…");
    try {
      await post("/api/email/send", {
        to,
        subject,
        body: signature ? `${body}\n\n${signature}` : body,
        resume,
      });
      setSendResult(`✅ Sent to ${to} with your resume attached.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEmailStage("compose");
      setBusy("");
    }
  }

  async function saveResume() {
    if (!resume || !saveLabel.trim()) return;
    setError("");
    setSaveSuccess("");
    try {
      setBusy("Saving…");
      const r = await post("/api/resumes", {
        label: saveLabel.trim(),
        resume,
        jdSnippet: jd.slice(0, 100),
      });
      setSavedResumes((prev) => [r.saved, ...prev]);
      setSaveSuccess(`✅ Saved as "${saveLabel.trim()}"`);
      setSaveLabel("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function deleteSavedResume(id: string) {
    try {
      await fetchJson(`/api/resumes/${id}`, { method: "DELETE" });
      setSavedResumes((prev) => prev.filter((r) => r.id !== id));
      if (selectedBaseId === id) setSelectedBaseId("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function loadSavedResume(saved: SavedResume) {
    setResume(saved.resume);
    setLatexOutput("");
    setStep("resume");
    setShowSaved(false);
  }

  function reset() {
    setStep("input");
    setAnalysis(null);
    setMatched([]);
    setProjects([]);
    setCheckedIds(new Set());
    setApprovedProjects([]);
    setQuestions([]);
    setAnswers({});
    setResume(null);
    setLatexOutput("");
    setSubject("");
    setBody("");
    setEmailStage("compose");
    setSendResult("");
    setSaveSuccess("");
    setSaveLabel("");
    setSelectedBaseId("");
    setError("");
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step === s.key ? "bg-brand text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              {i + 1}
            </span>
            <span className={step === s.key ? "font-medium" : "text-slate-400"}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="text-slate-300">→</span>}
          </div>
        ))}

        {/* Saved resumes toggle */}
        {savedResumes.length > 0 && (
          <button
            className="ml-auto text-xs text-brand underline"
            onClick={() => setShowSaved(!showSaved)}
          >
            📂 Saved Resumes ({savedResumes.length})
          </button>
        )}
      </div>

      {/* Saved resumes panel */}
      {showSaved && savedResumes.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-semibold">📂 Saved Resumes</h2>
          <p className="text-sm text-slate-500">
            Load a saved version to view/download, or select one as a base for tweaking.
          </p>
          {savedResumes.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
            >
              <div className="flex-1">
                <span className="font-medium text-sm">{s.label}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
                {s.jdSnippet && (
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {s.jdSnippet}…
                  </p>
                )}
              </div>
              <button
                className="text-xs text-brand underline"
                onClick={() => loadSavedResume(s)}
              >
                Load
              </button>
              <button
                className="text-xs text-red-500 underline"
                onClick={() => deleteSavedResume(s.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {busy && (
        <div className="rounded-lg bg-brand/10 px-4 py-2 text-sm text-brand-dark">{busy}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* STEP 1: JD input */}
      {step === "input" && (
        <div className="card space-y-4">
          <h1 className="text-xl font-bold">Paste a job description</h1>
          {profileEmpty && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Your profile is empty — add your projects and experience on the{" "}
              <a className="font-medium underline" href="/profile">Profile page</a>{" "}
              first so the resume has something to tailor.
            </div>
          )}
          <textarea
            className="input min-h-[240px] font-mono text-sm"
            placeholder="Paste the full job description here…"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Company name (optional, for the email)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <button
            className="btn-primary"
            disabled={!!busy || jd.trim().length < 20}
            onClick={analyze}
          >
            Analyze JD →
          </button>
          <p className="text-xs text-slate-400">
            Make sure your <a className="text-brand underline" href="/profile">profile</a> and{" "}
            <a className="text-brand underline" href="/settings">AI settings</a> are filled first.
          </p>
        </div>
      )}

      {/* STEP 2: review analysis + approve project selection */}
      {step === "review" && analysis && (
        <div className="space-y-6">
          <div className="card space-y-3">
            <h2 className="font-semibold">What we found in the JD</h2>
            {(analysis.jobTitle || analysis.seniority) && (
              <p className="text-sm text-slate-600">
                {analysis.jobTitle && <span className="font-medium">{analysis.jobTitle}</span>}
                {analysis.jobTitle && analysis.seniority && " · "}
                {analysis.seniority}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {analysis.hardSkills.map((s) => (
                <span key={s} className="chip">{s}</span>
              ))}
            </div>
          </div>

          <div className="card space-y-4">
            <div>
              <h2 className="font-semibold">Projects to use for this application</h2>
              <p className="text-sm text-slate-500">
                Matched locally against the JD (0 tokens). Untick any you don&apos;t want in this
                resume, then approve.
              </p>
            </div>
            {matched.length === 0 && (
              <p className="text-sm text-slate-400">
                No projects in your profile matched — add some on the{" "}
                <a className="text-brand underline" href="/profile">Profile page</a> for better
                tailoring, or continue without.
              </p>
            )}
            {matched.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                title={`matched: ${m.matched.join(", ")}`}
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(m.id)}
                  onChange={() => toggleProject(m.id)}
                />
                <span className="flex-1 text-sm">{m.title}</span>
                <span className="text-xs text-slate-400">score {m.score}</span>
              </label>
            ))}
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" disabled={!!busy} onClick={approveAndGetQuestions}>
                Approve & get questions →
              </button>
              <button className="btn-ghost" disabled={!!busy} onClick={() => setStep("input")}>
                ← Back
              </button>
              <button className="btn-ghost" disabled={!!busy} onClick={reset}>
                Start over
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: clarifying questions */}
      {step === "questions" && (
        <div className="card space-y-4">
          <h2 className="font-semibold">A few quick questions</h2>
          <p className="text-sm text-slate-500">
            Answer what you can — blanks are fine. These sharpen the tailoring.
          </p>
          {questions.map((q) => (
            <div key={q}>
              <label className="label">{q}</label>
              <textarea
                className="input min-h-[52px]"
                value={answers[q] || ""}
                onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })}
              />
            </div>
          ))}

          {/* Tweak from existing resume */}
          {savedResumes.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
              <label className="text-sm font-medium text-slate-700">
                🔄 Start from an existing resume (optional — saves tokens)
              </label>
              <select
                className="input text-sm"
                value={selectedBaseId}
                onChange={(e) => setSelectedBaseId(e.target.value)}
              >
                <option value="">Generate fresh from profile</option>
                {savedResumes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({new Date(s.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
              {selectedBaseId && (
                <p className="text-xs text-slate-500">
                  The AI will make minor keyword tweaks to this resume instead of regenerating from scratch.
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-600 mt-4 mb-2">
            <input type="checkbox" checked={useLatex} onChange={(e) => setUseLatex(e.target.checked)} />
            Generate tailored LaTeX code instead of ATS PDF (requires LaTeX template in Profile)
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" disabled={!!busy} onClick={generateResume}>
              {selectedBaseId ? "Tweak resume →" : "Generate tailored resume →"}
            </button>
            <button className="btn-ghost" disabled={!!busy} onClick={() => setStep("review")}>
              ← Back
            </button>
            <button className="btn-ghost" disabled={!!busy} onClick={reset}>
              Start over
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: resume + email */}
      {step === "resume" && (resume || latexOutput) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{latexOutput ? "Tailored LaTeX Code" : "Tailored Resume"}</h2>
              <div className="flex gap-2">
                {resume && (
                  <button className="btn-primary" disabled={!!busy} onClick={downloadPdf}>
                    ⬇ Download PDF
                  </button>
                )}
                <button className="btn-ghost" disabled={!!busy} onClick={() => setStep("questions")}>
                  ← Back
                </button>
                <button className="btn-ghost" onClick={reset}>
                  New JD
                </button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4">
              {latexOutput ? (
                <textarea
                  className="input min-h-[500px] w-full font-mono text-xs whitespace-pre"
                  value={latexOutput}
                  readOnly
                />
              ) : (
                <ResumePreview r={resume!} />
              )}
            </div>

            {/* Save resume version */}
            {resume && (
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder="Label (e.g., AI Engineer, Web Dev)"
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                />
                <button
                  className="btn-ghost text-sm"
                  disabled={!!busy || !saveLabel.trim()}
                  onClick={saveResume}
                >
                  💾 Save version
                </button>
              </div>
            )}
            {saveSuccess && <p className="text-sm text-green-700">{saveSuccess}</p>}
          </div>

          <div className="space-y-4">
            <div className="card space-y-4">
              <h2 className="font-semibold">Email to HR</h2>

              {latexOutput && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                  Emailing via the app is only supported for ATS PDF resumes. You can copy your LaTeX code above and compile/send it yourself!
                </div>
              )}

              {!latexOutput && emailStage === "compose" && (
                <>
                  <div>
                    <label className="label">Recipient (HR / company email)</label>
                    <input
                      className="input"
                      type="email"
                      placeholder="hr@company.com"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </div>
                  <button className="btn-ghost" disabled={!!busy} onClick={draftEmail}>
                    ✨ Draft with AI
                  </button>
                  <div>
                    <label className="label">Subject</label>
                    <input
                      className="input"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Body</label>
                    <textarea
                      className="input min-h-[150px]"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Signature</label>
                    <textarea
                      className="input min-h-[120px]"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn-primary"
                    disabled={!!busy || !to || !subject || !body}
                    onClick={() => setEmailStage("confirm")}
                  >
                    Review & send →
                  </button>
                </>
              )}

              {!latexOutput && emailStage === "confirm" && (
                <>
                  <p className="text-sm text-slate-500">
                    Double-check before sending — this goes straight to HR with your resume PDF
                    attached.
                  </p>
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p><span className="font-medium">To:</span> {to}</p>
                    <p><span className="font-medium">Subject:</span> {subject}</p>
                    <p className="whitespace-pre-wrap border-t border-slate-200 pt-2">{body}</p>
                    <p className="text-xs text-slate-400">
                      📎 {(resume?.name || "resume").replace(/[^a-z0-9]+/gi, "_")}_resume.pdf
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button className="btn-primary" disabled={!!busy} onClick={sendEmail}>
                      📧 Confirm send
                    </button>
                    <button
                      className="btn-ghost"
                      disabled={!!busy}
                      onClick={() => setEmailStage("compose")}
                    >
                      Edit
                    </button>
                  </div>
                </>
              )}

              {sendResult && <p className="text-sm text-green-700">{sendResult}</p>}
              <p className="text-xs text-slate-400">
                Sends from your Gmail (configured in Settings). The PDF is attached automatically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
