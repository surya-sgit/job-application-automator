import { JdAnalysis, Profile, Project } from "./resumeSchema";

/**
 * Prompts are deliberately terse. We never send the whole profile to the paid
 * model — only the JD analysis + the matched project subset + trimmed
 * experience/skills. This keeps token usage low.
 */

export const ANALYZE_SYSTEM =
  "You extract structured hiring signals from a job description. " +
  "Return ONLY the requested fields. Be concise: short skill/keyword tokens, not sentences.";

export function analyzeUser(jd: string): string {
  return `Job description:\n"""\n${jd.slice(0, 3000)}\n"""\n\nExtract the job title, seniority, hard skills, soft skills, ATS keywords, key responsibilities, and recruiterEmail (if any).`;
}

export const RESUME_PARSE_SYSTEM =
  "You extract structured profile data from a resume/CV. Return ONLY the requested " +
  "fields: name, headline, contact info, links, summary, skills, certifications, achievements, projects, experience, " +
  "education. Preserve the resume's own wording for bullets. Never invent employers, " +
  "dates, degrees, or accomplishments not in the text. Leave a field empty if absent.";

export function resumeParseUser(text: string): string {
  return `Resume text:\n"""\n${text.slice(0, 10000)}\n"""\n\nExtract the structured profile now.`;
}

export const QUESTIONS_SYSTEM =
  "You are a resume-tailoring assistant. Given a JD analysis and the candidate's " +
  "relevant material, ask 3-6 short, specific clarifying questions whose answers " +
  "would most improve tailoring (e.g. metrics, missing skills, preferences). " +
  "Do NOT ask for info already present. Keep each question one line.";

export const TAILOR_SYSTEM =
  "You are an expert resume writer and ATS optimizer. Rewrite the candidate's " +
  "material into a tailored resume for the target job. CRITICAL RULES: " +
  "1. PRESERVE ALL bullet points from the candidate — never drop, remove, or reduce the number of bullets. " +
  "2. Keep bullets detailed and full-length — do NOT shorten or summarize them. " +
  "3. Rephrase bullets to naturally incorporate the JD's keywords and action verbs. " +
  "4. Add quantified metrics where the candidate provided them. " +
  "5. Do NOT invent employers, degrees, dates, or accomplishments. " +
  "6. Include ALL experience entries and ALL matched projects — do not skip any. " +
  "7. Do NOT worry about page length — the rendering system handles fitting to one page automatically. " +
  "8. For skills, organize them into logical categories (e.g. 'Languages: Python, Java', 'Frameworks: React, Node'). DO NOT output the literal word 'Category:'. " +
  "9. If the candidate provides certifications or achievements, include them.";

/** Compact context object sent to the tailor agent (agent 3). */
export function tailorContext(
  analysis: JdAnalysis,
  profile: Profile,
  matchedProjects: Project[],
  answers?: Record<string, string>
): string {
  const compactProfile = {
    name: profile.name,
    title: profile.title,
    contact: {
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      links: profile.links,
    },
    summary: profile.summary,
    skills: profile.skills,
    certifications: profile.certifications,
    achievements: profile.achievements,
    experience: profile.experience.map((e) => ({
      company: e.company,
      title: e.title,
      location: e.location,
      start: e.start,
      end: e.end,
      bullets: e.bullets,
    })),
    education: profile.education.map((e) => ({
      school: e.school,
      degree: e.degree,
      year: e.year,
      details: e.details,
    })),
  };

  const projects = matchedProjects.map((p) => ({
    title: p.title,
    stack: p.stack,
    description: p.description,
    bullets: p.bullets,
    link: p.link,
  }));

  return [
    `TARGET JOB ANALYSIS:\n${JSON.stringify(analysis)}`,
    `CANDIDATE (relevant subset only):\n${JSON.stringify(compactProfile)}`,
    `MATCHED PROJECTS:\n${JSON.stringify(projects)}`,
    answers && Object.keys(answers).length
      ? `USER ANSWERS TO CLARIFYING QUESTIONS:\n${JSON.stringify(answers)}`
      : "",
    "Produce the tailored resume now.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const EMAIL_SYSTEM =
  "You write concise, professional job-application emails to a recruiter/HR. " +
  "3-5 short sentences. Warm but not fluffy. Reference the specific role and 1-2 " +
  "of the strongest, most relevant qualifications. End with a call to action. " +
  "Do NOT include placeholders like [Name] — use the provided details or omit.";

export function emailUser(args: {
  jobTitle: string;
  company?: string;
  candidateName: string;
  topPoints: string[];
}): string {
  return `Role: ${args.jobTitle}${args.company ? ` at ${args.company}` : ""}
Candidate: ${args.candidateName}
Strongest relevant points:\n- ${args.topPoints.join("\n- ")}

Write the email subject and body. The resume will be attached as a PDF, so mention it briefly.`;
}

export const TWEAK_SYSTEM =
  "You are an expert resume writer. You will receive an EXISTING tailored resume and a NEW job description analysis. " +
  "Make MINIMAL changes to adapt the existing resume to the new JD. RULES: " +
  "1. Keep ALL bullet points — never drop any. " +
  "2. Only rephrase bullets slightly to incorporate the new JD's keywords. " +
  "3. Reorder skills/bullets to prioritize what the new JD values most. " +
  "4. Do NOT shorten any content. Do NOT remove any sections or entries. " +
  "5. Keep the same structure, same employers, same dates. " +
  "6. Update the summary to align with the new role. " +
  "This should be a MINOR tweak, not a rewrite.";

export function tweakContext(
  analysis: JdAnalysis,
  baseResume: any,
  answers?: Record<string, string>
): string {
  return [
    `NEW TARGET JOB ANALYSIS:\n${JSON.stringify(analysis)}`,
    `EXISTING RESUME TO TWEAK:\n${JSON.stringify(baseResume)}`,
    answers && Object.keys(answers).length
      ? `USER NOTES FOR TWEAKING:\n${JSON.stringify(answers)}`
      : "",
    "Produce the tweaked resume now. Make minimal changes — only adjust keywords and ordering.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const TAILOR_LATEX_SYSTEM =
  "You are an expert resume writer and LaTeX specialist. You will be given a candidate's existing LaTeX resume, a job description analysis, their relevant projects, and answers to clarifying questions. " +
  "Rewrite the LaTeX resume to tailor it to the target job. RULES: " +
  "1. STRICTLY preserve all existing LaTeX commands, structure, preamble, and styling. " +
  "2. Only modify the text content (e.g., bullet points, summary) and inject the matched projects into the appropriate section. " +
  "3. Return ONLY the raw, compile-ready LaTeX code, with no markdown formatting blocks (e.g., do not wrap in ```latex).";

export function tailorLatexContext(
  latexTemplate: string,
  analysis: JdAnalysis,
  matchedProjects: Project[],
  answers?: Record<string, string>
): string {
  const projects = matchedProjects.map((p) => ({
    title: p.title,
    stack: p.stack,
    description: p.description,
    bullets: p.bullets,
    link: p.link,
  }));

  return [
    `TARGET JOB ANALYSIS:\n${JSON.stringify(analysis)}`,
    `MATCHED PROJECTS TO INJECT:\n${JSON.stringify(projects)}`,
    answers && Object.keys(answers).length
      ? `USER ANSWERS TO CLARIFYING QUESTIONS:\n${JSON.stringify(answers)}`
      : "",
    `EXISTING LATEX TEMPLATE:\n"""\n${latexTemplate}\n"""`,
    "Produce the tailored LaTeX code now. Output ONLY valid LaTeX code.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
