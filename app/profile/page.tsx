"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/clientFetch";
import type { Profile, Project, Experience, Education } from "@/lib/resumeSchema";

const EMPTY: Profile = {
  name: "",
  title: "",
  email: "",
  phone: "",
  location: "",
  links: [],
  summary: "",
  skills: [],
  certifications: [],
  achievements: [],
  projects: [],
  experience: [],
  education: [],
  latexTemplate: "",
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

// Parse comma / newline separated text into a trimmed array.
const toList = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

const norm = (s: string) => s.trim().toLowerCase();

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = norm(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

interface MergeSummary {
  projects: number;
  experience: number;
  education: number;
}

/**
 * Merges freshly-parsed resume data into the existing profile as an edit,
 * not a replace: blank scalar fields get filled in, lists get deduped and
 * appended to, and only genuinely new projects/experience/education entries
 * (by title / company+title / school+degree) are added.
 */
function mergeProfile(
  existing: Profile,
  parsed: Profile,
  replaceBasics: boolean
): { profile: Profile; summary: MergeSummary } {
  const pick = (a: string, b: string) => (replaceBasics ? b || a : a || b);

  const newProjects = parsed.projects.filter(
    (np) => !existing.projects.some((ep) => norm(ep.title) === norm(np.title))
  );
  const newExperience = parsed.experience.filter(
    (ne) =>
      !existing.experience.some(
        (ee) => norm(ee.company) === norm(ne.company) && norm(ee.title) === norm(ne.title)
      )
  );
  const newEducation = parsed.education.filter(
    (nd) =>
      !existing.education.some(
        (ed) => norm(ed.school) === norm(nd.school) && norm(ed.degree) === norm(nd.degree)
      )
  );

  return {
    profile: {
      name: pick(existing.name, parsed.name),
      title: pick(existing.title, parsed.title),
      email: pick(existing.email, parsed.email),
      phone: pick(existing.phone, parsed.phone),
      location: pick(existing.location, parsed.location),
      summary: pick(existing.summary, parsed.summary),
      links: dedupeStrings([...existing.links, ...parsed.links]),
      skills: dedupeStrings([...existing.skills, ...parsed.skills]),
      certifications: dedupeStrings([...existing.certifications, ...parsed.certifications]),
      achievements: dedupeStrings([...existing.achievements, ...parsed.achievements]),
      projects: [...existing.projects, ...newProjects],
      experience: [...existing.experience, ...newExperience],
      education: [...existing.education, ...newEducation],
      latexTemplate: pick(existing.latexTemplate, parsed.latexTemplate),
    },
    summary: {
      projects: newProjects.length,
      experience: newExperience.length,
      education: newEducation.length,
    },
  };
}

export default function ProfilePage() {
  const [p, setP] = useState<Profile>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [replaceBasics, setReplaceBasics] = useState(false);

  const [loadError, setLoadError] = useState("");

  function load() {
    setLoadError("");
    fetchJson<Profile>("/api/profile")
      .then((data) => {
        setP({ ...EMPTY, ...data });
        setLoaded(true);
      })
      .catch((e: Error) => setLoadError(e.message));
  }

  useEffect(load, []);

  function set<K extends keyof Profile>(key: K, val: Profile[K]) {
    setP((prev) => ({ ...prev, [key]: val }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    setSaving(false);
    setMsg(res.ok ? "Profile saved." : "Failed to save.");
  }

  async function importResume() {
    setImportError("");
    setImportMsg("");
    setImportBusy(true);
    try {
      let res: Response;
      if (importMode === "file") {
        if (!importFile) {
          setImportError("Choose a file first.");
          setImportBusy(false);
          return;
        }
        const form = new FormData();
        form.append("file", importFile);
        res = await fetch("/api/profile/parse", { method: "POST", body: form });
      } else {
        if (importText.trim().length < 40) {
          setImportError("Paste more of your resume text first.");
          setImportBusy(false);
          return;
        }
        res = await fetch("/api/profile/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: importText }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Couldn't parse that resume.");
        return;
      }
      const parsed: Profile = { ...EMPTY, ...data.profile };
      const { profile: merged, summary } = mergeProfile(p, parsed, replaceBasics);
      setP(merged);

      const parts = [
        summary.projects && `${summary.projects} new project(s)`,
        summary.experience && `${summary.experience} new experience entr${summary.experience === 1 ? "y" : "ies"}`,
        summary.education && `${summary.education} new education entr${summary.education === 1 ? "y" : "ies"}`,
      ].filter(Boolean);
      const addedText = parts.length ? `Added ${parts.join(", ")}.` : "No new projects/experience/education found.";
      const tokenText = data.usage?.totalTokens ? ` (~${data.usage.totalTokens} tokens)` : "";
      setImportMsg(`${addedText}${tokenText} Review below, then click Save profile.`);
    } catch {
      setImportError("Couldn't parse that resume.");
    } finally {
      setImportBusy(false);
    }
  }

  // ---- project helpers ----
  const addProject = () =>
    set("projects", [
      ...p.projects,
      { id: uid(), title: "", role: "", stack: [], description: "", bullets: [], link: "" },
    ]);
  const updateProject = (id: string, patch: Partial<Project>) =>
    set("projects", p.projects.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeProject = (id: string) =>
    set("projects", p.projects.filter((x) => x.id !== id));

  // ---- experience helpers ----
  const addExp = () =>
    set("experience", [
      ...p.experience,
      { id: uid(), company: "", title: "", location: "", start: "", end: "", bullets: [] },
    ]);
  const updateExp = (id: string, patch: Partial<Experience>) =>
    set("experience", p.experience.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeExp = (id: string) =>
    set("experience", p.experience.filter((x) => x.id !== id));

  // ---- education helpers ----
  const addEdu = () =>
    set("education", [...p.education, { id: uid(), school: "", degree: "", year: "", details: "" }]);
  const updateEdu = (id: string, patch: Partial<Education>) =>
    set("education", p.education.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeEdu = (id: string) =>
    set("education", p.education.filter((x) => x.id !== id));

  if (loadError)
    return (
      <div className="card max-w-md space-y-3">
        <p className="text-sm text-red-700">Couldn&apos;t load your profile: {loadError}</p>
        <button className="btn-ghost" onClick={load}>
          Retry
        </button>
      </div>
    );
  if (!loaded) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Profile</h1>
        <p className="text-sm text-slate-500">
          Fill this once. Add all your projects — the tool automatically picks the ones that match
          each job description.
        </p>
      </div>

      {/* Import from resume */}
      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold">Import from an existing resume</h2>
          <p className="text-sm text-slate-500">
            Upload a resume or paste its text — AI merges it into your profile below using your
            own API key (configured in Settings). Existing entries are kept; new projects,
            experience, and education are added alongside them. Nothing is saved until you click
            Save profile.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            className={importMode === "file" ? "btn-primary" : "btn-ghost"}
            onClick={() => setImportMode("file")}
          >
            Upload file
          </button>
          <button
            className={importMode === "paste" ? "btn-primary" : "btn-ghost"}
            onClick={() => setImportMode("paste")}
          >
            Paste text
          </button>
        </div>
        {importMode === "file" ? (
          <input
            className="input"
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          />
        ) : (
          <textarea
            className="input min-h-[140px] font-mono text-sm"
            placeholder="Paste your resume text here…"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={replaceBasics}
            onChange={(e) => setReplaceBasics(e.target.checked)}
          />
          Also replace basic info (name, title, contact, summary) with the parsed values
        </label>
        <button className="btn-primary" onClick={importResume} disabled={importBusy}>
          {importBusy ? "Parsing…" : "Parse & merge into profile"}
        </button>
        {importError && <p className="text-sm text-red-600">{importError}</p>}
        {importMsg && <p className="text-sm text-green-700">{importMsg}</p>}
      </div>

      {/* Basics */}
      <div className="card space-y-4">
        <h2 className="font-semibold">Basics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={p.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label">Headline / title</label>
            <input className="input" value={p.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={p.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={p.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              value={p.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Links (comma separated)</label>
            <input
              className="input"
              value={p.links.join(", ")}
              onChange={(e) => set("links", toList(e.target.value))}
              placeholder="github.com/you, linkedin.com/in/you"
            />
          </div>
        </div>
        <div>
          <label className="label">Professional summary</label>
          <textarea
            className="input min-h-[80px]"
            value={p.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Skills (comma separated)</label>
          <textarea
            className="input min-h-[60px]"
            value={p.skills.join(", ")}
            onChange={(e) => set("skills", toList(e.target.value))}
            placeholder="React, TypeScript, Node.js, PostgreSQL, AWS"
          />
        </div>
      </div>

      {/* Projects */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Projects ({p.projects.length})</h2>
          <button className="btn-ghost" onClick={addProject}>
            + Add project
          </button>
        </div>
        {p.projects.length === 0 && (
          <p className="text-sm text-slate-400">No projects yet. Add a few — the more the better.</p>
        )}
        {p.projects.map((proj) => (
          <div key={proj.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Project title"
                value={proj.title}
                onChange={(e) => updateProject(proj.id, { title: e.target.value })}
              />
              <input
                className="input"
                placeholder="Your role (optional)"
                value={proj.role}
                onChange={(e) => updateProject(proj.id, { role: e.target.value })}
              />
            </div>
            <input
              className="input"
              placeholder="Tech stack (comma separated)"
              value={proj.stack.join(", ")}
              onChange={(e) => updateProject(proj.id, { stack: toList(e.target.value) })}
            />
            <textarea
              className="input min-h-[50px]"
              placeholder="Short description"
              value={proj.description}
              onChange={(e) => updateProject(proj.id, { description: e.target.value })}
            />
            <textarea
              className="input min-h-[70px]"
              placeholder="Bullet points (one per line)"
              value={proj.bullets.join("\n")}
              onChange={(e) =>
                updateProject(proj.id, {
                  bullets: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean),
                })
              }
            />
            <div className="flex items-center gap-3">
              <input
                className="input"
                placeholder="Link (optional)"
                value={proj.link}
                onChange={(e) => updateProject(proj.id, { link: e.target.value })}
              />
              <button
                className="btn-ghost text-red-600"
                onClick={() => removeProject(proj.id)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Experience */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Experience ({p.experience.length})</h2>
          <button className="btn-ghost" onClick={addExp}>
            + Add experience
          </button>
        </div>
        {p.experience.map((exp) => (
          <div key={exp.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Company"
                value={exp.company}
                onChange={(e) => updateExp(exp.id, { company: e.target.value })}
              />
              <input
                className="input"
                placeholder="Job title"
                value={exp.title}
                onChange={(e) => updateExp(exp.id, { title: e.target.value })}
              />
              <input
                className="input"
                placeholder="Start (e.g. Jan 2022)"
                value={exp.start}
                onChange={(e) => updateExp(exp.id, { start: e.target.value })}
              />
              <input
                className="input"
                placeholder="End (e.g. Present)"
                value={exp.end}
                onChange={(e) => updateExp(exp.id, { end: e.target.value })}
              />
            </div>
            <textarea
              className="input min-h-[70px]"
              placeholder="Bullet points (one per line)"
              value={exp.bullets.join("\n")}
              onChange={(e) =>
                updateExp(exp.id, {
                  bullets: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean),
                })
              }
            />
            <button className="btn-ghost text-red-600" onClick={() => removeExp(exp.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Education */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Education ({p.education.length})</h2>
          <button className="btn-ghost" onClick={addEdu}>
            + Add education
          </button>
        </div>
        {p.education.map((edu) => (
          <div key={edu.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                className="input"
                placeholder="School"
                value={edu.school}
                onChange={(e) => updateEdu(edu.id, { school: e.target.value })}
              />
              <input
                className="input"
                placeholder="Degree"
                value={edu.degree}
                onChange={(e) => updateEdu(edu.id, { degree: e.target.value })}
              />
              <input
                className="input"
                placeholder="Year"
                value={edu.year}
                onChange={(e) => updateEdu(edu.id, { year: e.target.value })}
              />
            </div>
            <textarea
              className="input min-h-[50px]"
              placeholder="Details (e.g. CGPA, awards, minor)"
              value={edu.details || ""}
              onChange={(e) => updateEdu(edu.id, { details: e.target.value })}
            />
            <button className="btn-ghost text-red-600" onClick={() => removeEdu(edu.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Certifications */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Certifications ({p.certifications.length})</h2>
          <button
            className="btn-ghost"
            onClick={() => set("certifications", [...p.certifications, ""])}
          >
            + Add certification
          </button>
        </div>
        {p.certifications.map((cert, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Certification title (e.g. AWS Certified Solutions Architect)"
              value={cert}
              onChange={(e) => {
                const arr = [...p.certifications];
                arr[i] = e.target.value;
                set("certifications", arr);
              }}
            />
            <button
              className="btn-ghost text-red-600"
              onClick={() => {
                const arr = [...p.certifications];
                arr.splice(i, 1);
                set("certifications", arr);
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Achievements */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Achievements ({p.achievements.length})</h2>
          <button
            className="btn-ghost"
            onClick={() => set("achievements", [...p.achievements, ""])}
          >
            + Add achievement
          </button>
        </div>
        {p.achievements.map((ach, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Achievement (e.g. 1st Place at National Hackathon)"
              value={ach}
              onChange={(e) => {
                const arr = [...p.achievements];
                arr[i] = e.target.value;
                set("achievements", arr);
              }}
            />
            <button
              className="btn-ghost text-red-600"
              onClick={() => {
                const arr = [...p.achievements];
                arr.splice(i, 1);
                set("achievements", arr);
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* LaTeX Template */}
      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold">LaTeX Template (Optional)</h2>
          <p className="text-sm text-slate-500">
            Paste your raw `.tex` resume code here. If provided, you can choose to generate a tailored LaTeX file instead of the standard PDF.
          </p>
        </div>
        <textarea
          className="input min-h-[300px] font-mono text-xs whitespace-pre"
          value={p.latexTemplate}
          onChange={(e) => set("latexTemplate", e.target.value)}
          placeholder="\documentclass{article}&#10;\begin{document}&#10;..."
        />
      </div>

      <div className="sticky bottom-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
