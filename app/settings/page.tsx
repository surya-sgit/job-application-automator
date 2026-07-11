"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/clientFetch";

interface RedactedSettings {
  provider: string;
  model: string;
  cheapModel: string;
  ollamaBaseUrl?: string;
  gmailUser?: string;
  keys: { anthropic: string; openai: string; google: string; groq: string };
  gmailAppPasswordSet: boolean;
}

const PROVIDERS = [
  { id: "anthropic", label: "Claude (Anthropic)" },
  { id: "openai", label: "OpenAI (GPT)" },
  { id: "google", label: "Google Gemini" },
  { id: "groq", label: "Groq" },
  { id: "ollama", label: "Local / Ollama" },
];

export default function SettingsPage() {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-opus-4-8");
  const [cheapModel, setCheapModel] = useState("claude-haiku-4-5-20251001");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [gmailUser, setGmailUser] = useState("");

  // Key fields — placeholders show masked existing values; leaving blank keeps them.
  const [placeholders, setPlaceholders] = useState<RedactedSettings["keys"]>({
    anthropic: "",
    openai: "",
    google: "",
    groq: "",
  });
  const [gmailPwSet, setGmailPwSet] = useState(false);
  const [outlookPwSet, setOutlookPwSet] = useState(false);
  const [emailProvider, setEmailProvider] = useState<"gmail" | "outlook">("gmail");
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  const [outlookUser, setOutlookUser] = useState("");
  const [outlookAppPassword, setOutlookAppPassword] = useState("");
  const [keys, setKeys] = useState({ anthropic: "", openai: "", google: "", groq: "" });

  const [loadError, setLoadError] = useState("");

  function load() {
    setLoadError("");
    fetchJson<RedactedSettings>("/api/settings")
      .then((s: any) => {
        setProvider(s.provider);
        setModel(s.model);
        setCheapModel(s.cheapModel);
        setOllamaBaseUrl(s.ollamaBaseUrl || "http://localhost:11434");
        if (s.emailProvider) setEmailProvider(s.emailProvider);
        if (s.gmailUser) setGmailUser(s.gmailUser);
        if (s.gmailAppPasswordSet) {
          setGmailPwSet(true);
        }
        if (s.outlookUser) setOutlookUser(s.outlookUser);
        if (s.outlookAppPasswordSet) {
          setOutlookPwSet(true);
        }
        setPlaceholders(s.keys);
        setLoaded(true);
      })
      .catch((e: Error) => setLoadError(e.message));
  }

  useEffect(load, []);

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        model,
        cheapModel,
        ollamaBaseUrl,
        emailProvider,
        gmailUser,
        gmailAppPassword,
        outlookUser,
        outlookAppPassword,
        keys,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const s: any = await res.json();
      setPlaceholders(s.keys);
      setGmailPwSet(s.gmailAppPasswordSet);
      setOutlookPwSet(s.outlookAppPasswordSet);
      setKeys({ anthropic: "", openai: "", google: "", groq: "" });
      setGmailAppPassword("");
      setOutlookAppPassword("");
      setMsg("Saved. Keys are stored encrypted.");
    } else {
      setMsg("Failed to save.");
    }
  }

  if (loadError)
    return (
      <div className="card max-w-md space-y-3">
        <p className="text-sm text-red-700">Couldn&apos;t load settings: {loadError}</p>
        <button className="btn-ghost" onClick={load}>
          Retry
        </button>
      </div>
    );
  if (!loaded) return <p className="text-slate-500">Loading…</p>;

  const keyField = (id: keyof typeof keys, label: string) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="password"
        placeholder={placeholders[id] ? `Saved (${placeholders[id]}) — leave blank to keep` : "Not set"}
        value={keys[id]}
        onChange={(e) => setKeys({ ...keys, [id]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-slate-500">
          Choose your AI provider and paste your keys. Everything is stored locally and encrypted —
          nothing leaves your machine except the AI/Gmail calls you trigger.
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">AI Provider</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Provider</label>
            <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Main model</label>
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div>
            <label className="label">Cheap model (analysis)</label>
            <input
              className="input"
              value={cheapModel}
              onChange={(e) => setCheapModel(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">
          The cheap model handles JD analysis + questions (small, frequent calls). The main model
          writes the final resume. Using a cheaper model for analysis keeps token cost down.
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">API Keys</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {keyField("anthropic", "Anthropic API Key")}
          {keyField("openai", "OpenAI API Key")}
          {keyField("google", "Google Gemini API Key")}
          {keyField("groq", "Groq API Key")}
        </div>
        {provider === "ollama" && (
          <div>
            <label className="label">Ollama Base URL</label>
            <input
              className="input"
              value={ollamaBaseUrl}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Email Integration (for one-click sending)</h2>
        <div>
          <label className="label">Email Provider</label>
          <select
            className="input w-full md:w-1/2"
            value={emailProvider}
            onChange={(e) => setEmailProvider(e.target.value as "gmail" | "outlook")}
          >
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook / Office 365</option>
          </select>
        </div>
        
        {emailProvider === "gmail" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Gmail Address</label>
              <input
                className="input"
                type="email"
                value={gmailUser}
                onChange={(e) => setGmailUser(e.target.value)}
                placeholder="you@gmail.com"
              />
            </div>
            <div>
              <label className="label">Google App Password</label>
              <input
                className="input"
                type="password"
                value={gmailAppPassword}
                onChange={(e) => setGmailAppPassword(e.target.value)}
                placeholder={gmailPwSet ? "Saved — leave blank to keep" : "16-char app password"}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Outlook Address</label>
              <input
                className="input"
                type="email"
                value={outlookUser}
                onChange={(e) => setOutlookUser(e.target.value)}
                placeholder="you@outlook.com"
              />
            </div>
            <div>
              <label className="label">Outlook App Password</label>
              <input
                className="input"
                type="password"
                value={outlookAppPassword}
                onChange={(e) => setOutlookAppPassword(e.target.value)}
                placeholder={outlookPwSet ? "Saved — leave blank to keep" : "App password"}
              />
            </div>
          </div>
        )}

        {emailProvider === "gmail" ? (
          <p className="text-xs text-slate-400">
            Use a Google{" "}
            <a
              className="text-brand underline"
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
            >
              App Password
            </a>{" "}
            (requires 2-Step Verification), not your normal password.
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            Use a Microsoft{" "}
            <a
              className="text-brand underline"
              href="https://account.live.com/proofs/manage/additional"
              target="_blank"
              rel="noreferrer"
            >
              App Password
            </a>{" "}
            (requires 2-Step Verification), not your normal password.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
