"use client";

import { useState } from "react";
import type { TailoredResume, ParsedProfile } from "@/lib/resumeSchema";
import TextareaAutosize from "react-textarea-autosize";
import { Lock, Sparkles, Undo2, ChevronDown, ChevronUp, Eye, Edit2 } from "lucide-react";
import DiffViewer from "./DiffViewer";

interface Props {
  draftResume: TailoredResume;
  originalResume: TailoredResume | ParsedProfile | null;
  onSave: (edited: TailoredResume) => void;
  onCancel: () => void;
}

export default function ResumeEditor({ draftResume, originalResume, onSave, onCancel }: Props) {
  const [edited, setEdited] = useState<TailoredResume>(JSON.parse(JSON.stringify(draftResume)));
  const [viewMode, setViewMode] = useState<"diff" | "edit">("diff");
  
  // Accordion state
  const [expandedRoles, setExpandedRoles] = useState<Set<number>>(new Set(edited.experience.map((_, i) => i)));
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set(edited.projects.map((_, i) => i)));

  const getOriginalExpBullets = (company: string, originalObj: any) => {
    if (!originalObj || !originalObj.experience) return [];
    const exp = originalObj.experience.find((e: any) => e.company === company);
    return exp?.bullets || [];
  };

  const getOriginalProjBullets = (title: string, originalObj: any) => {
    if (!originalObj || !originalObj.projects) return [];
    const proj = originalObj.projects.find((p: any) => p.title === title);
    return proj?.bullets || [];
  };

  const toggleRole = (index: number) => {
    const next = new Set(expandedRoles);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExpandedRoles(next);
  };

  const toggleProject = (index: number) => {
    const next = new Set(expandedProjects);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExpandedProjects(next);
  };

  // Revert Helpers
  const revertSummary = () => {
    if (originalResume?.summary) {
      setEdited({ ...edited, summary: originalResume.summary });
    }
  };

  const revertSkills = () => {
    if (originalResume?.skills) {
      setEdited({ ...edited, skills: [...originalResume.skills] });
    }
  };

  const revertExpBullet = (expIndex: number, bIndex: number, originalBullet: string) => {
    const newExp = [...edited.experience];
    newExp[expIndex].bullets[bIndex] = originalBullet;
    setEdited({ ...edited, experience: newExp });
  };

  const revertProjBullet = (projIndex: number, bIndex: number, originalBullet: string) => {
    const newProj = [...edited.projects];
    newProj[projIndex].bullets[bIndex] = originalBullet;
    setEdited({ ...edited, projects: newProj });
  };

  return (
    <div className="space-y-8 pb-28 relative max-w-5xl mx-auto">
      <div className="card space-y-8 border-slate-200/60 shadow-xl shadow-slate-200/40">
        <div>
          <h2 className="font-bold text-2xl text-slate-900 mb-2">Review & Edit Draft</h2>
          <p className="text-base text-slate-500">
            Compare your original text on the left with the AI's proposed tweaks on the right. 
            If the AI hallucinated or made a mistake, click the <Undo2 className="inline w-4 h-4 text-slate-400 mx-1" /> icon to instantly revert it.
          </p>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 hidden md:grid items-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-400 uppercase tracking-wider pl-1">
            <Lock className="w-4 h-4" /> Original Profile
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand uppercase tracking-wider pl-1">
              <Sparkles className="w-4 h-4" /> AI Draft
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
              <button
                onClick={() => setViewMode("diff")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === "diff" 
                    ? "bg-white text-brand-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Diff
              </button>
              <button
                onClick={() => setViewMode("edit")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === "edit" 
                    ? "bg-white text-brand-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg text-slate-800 border-b pb-2">Professional Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Original Left */}
            <div className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl text-slate-500 text-sm leading-relaxed shadow-inner">
              <p>{originalResume?.summary || "No summary provided."}</p>
            </div>
            
            {/* Editable Right */}
            <div className="relative group">
              {originalResume?.summary && originalResume.summary !== edited.summary && viewMode === "edit" && (
                <div className="absolute -top-3 right-3 flex items-center gap-2 z-10">
                  <button 
                    onClick={revertSummary}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-[11px] font-medium rounded-full border shadow-sm transition-all opacity-0 group-hover:opacity-100"
                    title="Revert to original"
                  >
                    <Undo2 className="w-3 h-3" /> Revert
                  </button>
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 text-[11px] font-semibold rounded-full border border-indigo-100 shadow-sm">
                    <Sparkles className="w-3 h-3" /> AI Tweaked
                  </div>
                </div>
              )}
              {viewMode === "diff" ? (
                <div className="w-full text-sm leading-relaxed p-4 rounded-xl border border-indigo-200 bg-white ring-4 ring-indigo-50/50">
                  <DiffViewer original={originalResume?.summary || ""} modified={edited.summary} />
                </div>
              ) : (
                <TextareaAutosize
                  minRows={3}
                  className={`input w-full text-sm leading-relaxed p-4 rounded-xl resize-none transition-shadow ${
                    originalResume?.summary && originalResume.summary !== edited.summary
                      ? "border-indigo-200 bg-white ring-4 ring-indigo-50/50 focus:border-brand focus:ring-brand/20"
                      : "bg-white"
                  }`}
                  value={edited.summary}
                  onChange={(e) => setEdited({ ...edited, summary: e.target.value })}
                />
              )}
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-4 pt-4">
          <h3 className="font-semibold text-lg text-slate-800 border-b pb-2">Skills</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl text-slate-500 text-sm leading-relaxed shadow-inner">
              <p>{originalResume?.skills.join(", ") || "No skills provided."}</p>
            </div>
            
            <div className="relative group">
              {originalResume?.skills && originalResume.skills.join(", ") !== edited.skills.join(", ") && viewMode === "edit" && (
                <div className="absolute -top-3 right-3 flex items-center gap-2 z-10">
                  <button 
                    onClick={revertSkills}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-[11px] font-medium rounded-full border shadow-sm transition-all opacity-0 group-hover:opacity-100"
                    title="Revert to original"
                  >
                    <Undo2 className="w-3 h-3" /> Revert
                  </button>
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 text-[11px] font-semibold rounded-full border border-indigo-100 shadow-sm">
                    <Sparkles className="w-3 h-3" /> AI Tweaked
                  </div>
                </div>
              )}
              {viewMode === "diff" ? (
                <div className="w-full text-sm leading-relaxed p-4 rounded-xl border border-indigo-200 bg-white ring-4 ring-indigo-50/50">
                  <DiffViewer original={originalResume?.skills.join(", ") || ""} modified={edited.skills.join(", ")} />
                </div>
              ) : (
                <TextareaAutosize
                  minRows={2}
                  className={`input w-full text-sm leading-relaxed p-4 rounded-xl resize-none transition-shadow ${
                    originalResume?.skills && originalResume.skills.join(", ") !== edited.skills.join(", ")
                      ? "border-indigo-200 bg-white ring-4 ring-indigo-50/50 focus:border-brand focus:ring-brand/20"
                      : "bg-white"
                  }`}
                  value={edited.skills.join(", ")}
                  onChange={(e) => setEdited({ ...edited, skills: e.target.value.split(",").map(s => s.trim()) })}
                />
              )}
            </div>
          </div>
        </div>

        {/* Experience */}
        {edited.experience.length > 0 && (
          <div className="space-y-4 pt-4">
            <h3 className="font-semibold text-lg text-slate-800 border-b pb-2">Experience</h3>
            {edited.experience.map((exp, expIndex) => {
              const origBullets = getOriginalExpBullets(exp.company, originalResume);
              const isExpanded = expandedRoles.has(expIndex);
              
              return (
                <div key={expIndex} className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                  <button 
                    className="w-full flex items-center justify-between p-5 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
                    onClick={() => toggleRole(expIndex)}
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">{exp.title}</h4>
                      <p className="text-sm font-medium text-brand/80">{exp.company}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="p-5 space-y-6 border-t border-slate-100 bg-white">
                      {exp.bullets.map((bullet, bIndex) => {
                        const originalBullet = origBullets[bIndex];
                        const isModified = originalBullet && originalBullet !== bullet;
                        
                        return (
                          <div key={bIndex} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start relative group">
                            {/* Left: Original */}
                            <div className={`p-4 rounded-xl border text-sm leading-relaxed transition-all ${
                              isModified 
                                ? 'bg-slate-50/50 border-slate-200/80 text-slate-500 shadow-inner' 
                                : 'bg-transparent border-transparent text-slate-400'
                            }`}>
                              {originalBullet || <span className="italic text-slate-300">No original bullet point</span>}
                            </div>
                            
                            {/* Right: Editable */}
                            <div className="relative">
                              {isModified && viewMode === "edit" && (
                                <div className="absolute -top-3 right-3 flex items-center gap-2 z-10">
                                  <button 
                                    onClick={() => revertExpBullet(expIndex, bIndex, originalBullet)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-[11px] font-medium rounded-full border shadow-sm transition-all opacity-0 group-hover:opacity-100"
                                    title="Revert to original"
                                  >
                                    <Undo2 className="w-3 h-3" /> Revert
                                  </button>
                                  <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 text-[11px] font-semibold rounded-full border border-indigo-100 shadow-sm">
                                    <Sparkles className="w-3 h-3" /> AI Tweaked
                                  </div>
                                </div>
                              )}
                              {viewMode === "diff" ? (
                                <div className={`w-full text-sm leading-relaxed p-4 rounded-xl border ${isModified ? 'border-indigo-200 bg-white ring-4 ring-indigo-50/50' : 'border-transparent bg-white/50'}`}>
                                  <DiffViewer original={originalBullet || ""} modified={bullet} />
                                </div>
                              ) : (
                                <TextareaAutosize
                                  minRows={2}
                                  className={`input w-full text-sm leading-relaxed p-4 rounded-xl resize-none transition-shadow ${
                                    isModified 
                                      ? 'border-indigo-200 bg-white ring-4 ring-indigo-50/50 focus:border-brand focus:ring-brand/20' 
                                      : 'bg-white hover:border-slate-300'
                                  }`}
                                  value={bullet}
                                  onChange={(e) => {
                                    const newExp = [...edited.experience];
                                    newExp[expIndex].bullets[bIndex] = e.target.value;
                                    setEdited({ ...edited, experience: newExp });
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Projects */}
        {edited.projects.length > 0 && (
          <div className="space-y-4 pt-4">
            <h3 className="font-semibold text-lg text-slate-800 border-b pb-2">Projects</h3>
            {edited.projects.map((proj, projIndex) => {
              const origBullets = getOriginalProjBullets(proj.title, originalResume);
              const isExpanded = expandedProjects.has(projIndex);
              
              return (
                <div key={projIndex} className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                  <button 
                    className="w-full flex items-center justify-between p-5 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
                    onClick={() => toggleProject(projIndex)}
                  >
                    <h4 className="font-bold text-slate-800 text-lg">{proj.title}</h4>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="p-5 space-y-6 border-t border-slate-100 bg-white">
                      {proj.bullets.map((bullet, bIndex) => {
                        const originalBullet = origBullets[bIndex];
                        const isModified = originalBullet && originalBullet !== bullet;
                        
                        return (
                          <div key={bIndex} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start relative group">
                            {/* Left: Original */}
                            <div className={`p-4 rounded-xl border text-sm leading-relaxed transition-all ${
                              isModified 
                                ? 'bg-slate-50/50 border-slate-200/80 text-slate-500 shadow-inner' 
                                : 'bg-transparent border-transparent text-slate-400'
                            }`}>
                              {originalBullet || <span className="italic text-slate-300">No original bullet point</span>}
                            </div>
                            
                            {/* Right: Editable */}
                            <div className="relative">
                              {isModified && viewMode === "edit" && (
                                <div className="absolute -top-3 right-3 flex items-center gap-2 z-10">
                                  <button 
                                    onClick={() => revertProjBullet(projIndex, bIndex, originalBullet)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-[11px] font-medium rounded-full border shadow-sm transition-all opacity-0 group-hover:opacity-100"
                                    title="Revert to original"
                                  >
                                    <Undo2 className="w-3 h-3" /> Revert
                                  </button>
                                  <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 text-[11px] font-semibold rounded-full border border-indigo-100 shadow-sm">
                                    <Sparkles className="w-3 h-3" /> AI Tweaked
                                  </div>
                                </div>
                              )}
                              {viewMode === "diff" ? (
                                <div className={`w-full text-sm leading-relaxed p-4 rounded-xl border ${isModified ? 'border-indigo-200 bg-white ring-4 ring-indigo-50/50' : 'border-transparent bg-white/50'}`}>
                                  <DiffViewer original={originalBullet || ""} modified={bullet} />
                                </div>
                              ) : (
                                <TextareaAutosize
                                  minRows={2}
                                  className={`input w-full text-sm leading-relaxed p-4 rounded-xl resize-none transition-shadow ${
                                    isModified 
                                      ? 'border-indigo-200 bg-white ring-4 ring-indigo-50/50 focus:border-brand focus:ring-brand/20' 
                                      : 'bg-white hover:border-slate-300'
                                  }`}
                                  value={bullet}
                                  onChange={(e) => {
                                    const newProj = [...edited.projects];
                                    newProj[projIndex].bullets[bIndex] = e.target.value;
                                    setEdited({ ...edited, projects: newProj });
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="text-sm font-medium text-slate-500 hidden md:block">
            Take a moment to review the changes. You can revert any hallucinated bullets!
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <button className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn-primary shadow-lg shadow-brand/30 px-8 py-2.5 font-semibold" onClick={() => onSave(edited)}>
              Approve & Finalize PDF →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
