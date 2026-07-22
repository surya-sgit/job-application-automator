"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import ResumePreview from "@/components/ResumePreview";
import ResumeEditor from "@/components/ResumeEditor";
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

type Step = "input" | "review" | "questions" | "edit" | "resume";

const STEPS: { key: Step; label: string }[] = [
  { key: "input", label: "Job description" },
  { key: "review", label: "Review & approve" },
  { key: "questions", label: "Questions" },
  { key: "edit", label: "Review & edit draft" },
  { key: "resume", label: "Resume & email" },
];

export default function TailorApp() {
  const [step, setStep] = useState<Step>("input");
  const [jd, setJd] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [profileEmpty, setProfileEmpty] = useState(false);
  const [rawProfile, setRawProfile] = useState<any>(null);

  const [analysis, setAnalysis] = useState<JdAnalysis | null>(null);
  const [matched, setMatched] = useState<Matched[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [approvedProjects, setApprovedProjects] = useState<Project[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draftResume, setDraftResume] = useState<TailoredResume | null>(null);
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
    fetchJson<any>("/api/profile")
      .then((p) => {
        setProfileEmpty(p.projects.length === 0 && p.experience.length === 0);
        setRawProfile(p);
      })
      .catch(() => {});
  }, []);

  // Load saved resumes on mount
  useEffect(() => {
    fetchJson<{ resumes: SavedResume[] }>("/api/resumes")
      .then((r) => {
        const res = r.resumes || [];
        setSavedResumes(res);
        if (res.length > 0) {
          // Pre-select the first resume for Tweak Mode by default
          setSelectedBaseId((prev) => prev || res[0].id);
        }
      })
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
    const next = new Set(checkedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCheckedIds(next);
  }

  function toggleExpandedProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = new Set(expandedProjectIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedProjectIds(next);
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
        setStep("resume");
      } else {
        setDraftResume(r.resume);
        setLatexOutput("");
        setStep("edit");
      }
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
    <div className="space-y-8">
      {/* Animated Step Indicator */}
      <div className="card mb-8 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm relative">
          <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full -translate-y-1/2 bg-white/5"></div>
          {STEPS.map((s, i) => {
            const isActive = step === s.key;
            const isPast = STEPS.findIndex(x => x.key === step) > i;
            
            return (
              <div key={s.key} className="flex flex-col items-center gap-2 relative z-10 bg-dark-800/80 px-2 rounded-lg">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: isActive ? "#6366f1" : isPast ? "#10b981" : "rgba(255,255,255,0.05)",
                    scale: isActive ? 1.1 : 1,
                    borderColor: isActive ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)",
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-xs font-bold shadow-lg transition-colors ${
                    isActive || isPast ? "text-white" : "text-slate-400"
                  }`}
                >
                  {isPast ? <Check size={14} className="text-white" /> : i + 1}
                </motion.div>
                <span className={`text-xs font-medium transition-colors ${isActive ? "text-white" : "text-slate-500"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 backdrop-blur-md flex items-center gap-3">
              <span className="text-xl">⚠️</span> {error}
            </div>
          )}

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: JD Insights */}
          <div className="lg:col-span-4 space-y-4">
            <div className="card space-y-4 sticky top-6">
              <div>
                <h2 className="font-bold text-lg text-brand mb-1">JD Insights</h2>
                <p className="text-xs text-slate-500">Key details extracted by the AI</p>
              </div>

              {(analysis.jobTitle || analysis.seniority || analysis.companyName) && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700 space-y-1">
                  {analysis.jobTitle && <div className="font-semibold text-base">{analysis.jobTitle}</div>}
                  {analysis.companyName && <div className="text-slate-500">{analysis.companyName}</div>}
                  {analysis.seniority && <div className="text-xs font-medium px-2 py-0.5 bg-slate-200 rounded inline-block mt-1">{analysis.seniority}</div>}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Target Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.hardSkills.map((s) => (
                    <span key={s} className="chip bg-brand/10 text-brand-dark border-brand/20">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Projects */}
          <div className="lg:col-span-8 space-y-4">
            <div className="card space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-bold text-lg">Select Projects</h2>
                  <p className="text-sm text-slate-500">
                    Matched against JD skills. Approve the ones to include.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost" disabled={!!busy} onClick={() => setStep("input")}>
                    ← Back
                  </button>
                  <button className="btn-primary" disabled={!!busy} onClick={approveAndGetQuestions}>
                    Approve Selection →
                  </button>
                </div>
              </div>
              
              {matched.length === 0 && (
                <p className="text-sm text-slate-400 p-4 border border-dashed rounded text-center">
                  No projects in your profile matched — add some on the{" "}
                  <a className="text-brand underline" href="/profile">Profile page</a>.
                </p>
              )}
              
              <div className="space-y-3">
                {matched.map((m) => {
                  const isExpanded = expandedProjectIds.has(m.id);
                  const isChecked = checkedIds.has(m.id);
                  // Find full project details
                  const fullProj = projects.find(p => p.id === m.id);
                  
                  // Visual match indicator
                  const matchLabel = m.score > 20 ? "🔥 High Match" : m.score > 10 ? "🟡 Med Match" : "⚪ Low Match";
                  const matchColor = m.score > 20 ? "text-orange-600 bg-orange-50 border-orange-200" : m.score > 10 ? "text-yellow-700 bg-yellow-50 border-yellow-200" : "text-slate-500 bg-slate-50 border-slate-200";

                  return (
                    <div
                      key={m.id}
                      className={`border rounded-xl transition-all ${isChecked ? 'border-brand shadow-sm ring-1 ring-brand/20' : 'border-slate-200 opacity-70 hover:opacity-100'}`}
                    >
                      <label className="flex items-start gap-3 p-4 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={isChecked}
                          onChange={() => toggleProject(m.id)}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-800">{m.title}</span>
                            <span className={`text-xs px-2 py-1 rounded-md border font-medium ${matchColor}`}>
                              {matchLabel} ({m.score})
                            </span>
                          </div>
                          
                          {m.matched.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="text-xs text-slate-400 mr-1">Matched:</span>
                              {m.matched.map(skill => (
                                <span key={skill} className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-100">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button 
                          className="p-1 hover:bg-slate-100 rounded mt-0.5" 
                          onClick={(e) => toggleExpandedProject(m.id, e)}
                        >
                          {isExpanded ? "▲" : "▼"}
                        </button>
                      </label>
                      
                      {isExpanded && fullProj && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50 rounded-b-xl text-sm">
                          <p className="text-slate-600 mb-2">{fullProj.description}</p>
                          <ul className="list-disc pl-4 space-y-1 text-slate-500 text-xs">
                            {fullProj.bullets.map((b, i) => <li key={i}>{b}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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

      {/* STEP 3.5: Edit Draft */}
      {step === "edit" && draftResume && (
        <ResumeEditor
          draftResume={draftResume}
          originalResume={selectedBaseId ? savedResumes.find(s => s.id === selectedBaseId)?.resume || null : rawProfile}
          onSave={async (edited) => {
            setResume(edited);
            setStep("resume");
            // Auto-save the first resume so the user has a baseline for future tweaks
            if (savedResumes.length === 0) {
              try {
                const savedRes = await post("/api/resumes", {
                  label: "Base Resume (Auto-saved)",
                  resume: edited,
                  jdSnippet: jd.slice(0, 100),
                });
                setSavedResumes((prev) => [savedRes.saved, ...prev]);
                setSelectedBaseId(savedRes.saved.id);
              } catch (autoSaveErr) {
                console.error("Failed to auto-save initial resume", autoSaveErr);
              }
            }
          }}
          onCancel={() => setStep("questions")}
        />
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
      </motion.div>
      </AnimatePresence>

      {/* Busy Overlay Loader */}
      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-dark-900/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4 card w-72 text-center border-brand-500/30">
              <div className="h-10 w-10 animate-spin-slow rounded-full border-2 border-brand-500 border-t-transparent shadow-[0_0_15px_rgba(79,70,229,0.5)]"></div>
              <p className="animate-pulse font-medium text-white">{busy}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
