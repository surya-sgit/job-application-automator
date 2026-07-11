import { TailoredResume } from "@/lib/resumeSchema";

/**
 * Resume HTML template — pixel-perfect reproduction of the user's own
 * HTML/CSS design using Inter font, CSS grid headings, and exact spacing.
 *
 * FitVars allow the auto-fit routine in pdf.ts to tighten spacing in steps
 * without touching markup. The default step (index 0) uses the user's
 * original values exactly.
 */

export interface FitVars {
  basePx: number;     // body font-size in px (user's original: 14)
  h1Px: number;       // name heading in px (user's original: 38)
  h2Px: number;       // section heading in px (user's original: 24)
  h2Pb: number;       // section heading padding-bottom in px (user's original: 6)
  h2Mb: number;       // section heading margin-bottom in px (user's original: 16)
  h3Px: number;       // item heading in px (user's original: 18)
  sectionMt: number;  // section margin-top in px (user's original: 28)
  articleMb: number;  // article margin-bottom in px (user's original: 22)
  liMb: number;       // li margin-bottom in px (user's original: 8)
  headerMb: number;   // header margin-bottom in px (user's original: 30)
  padding: number;    // .resume padding in px (user's original: 50)
}

export const FIT_STEPS: FitVars[] = [
  // Step 0: User's EXACT original values
  { basePx: 14, h1Px: 38, h2Px: 24, h2Pb: 6, h2Mb: 16, h3Px: 18, sectionMt: 28, articleMb: 22, liMb: 8, headerMb: 30, padding: 50 },
  // Step 1: Slightly tighter
  { basePx: 13.5, h1Px: 36, h2Px: 22, h2Pb: 5, h2Mb: 14, h3Px: 17, sectionMt: 24, articleMb: 18, liMb: 7, headerMb: 26, padding: 45 },
  // Step 2: Compact
  { basePx: 13, h1Px: 34, h2Px: 21, h2Pb: 4, h2Mb: 12, h3Px: 16, sectionMt: 20, articleMb: 16, liMb: 6, headerMb: 22, padding: 40 },
  // Step 3: Tight
  { basePx: 12.5, h1Px: 32, h2Px: 20, h2Pb: 3, h2Mb: 10, h3Px: 15.5, sectionMt: 18, articleMb: 14, liMb: 5, headerMb: 20, padding: 36 },
  // Step 4: Very tight
  { basePx: 12, h1Px: 30, h2Px: 19, h2Pb: 2, h2Mb: 8, h3Px: 15, sectionMt: 16, articleMb: 12, liMb: 4, headerMb: 18, padding: 32 },
  // Step 5: Minimum
  { basePx: 11.5, h1Px: 28, h2Px: 18, h2Pb: 1, h2Mb: 6, h3Px: 14.5, sectionMt: 14, articleMb: 10, liMb: 3, headerMb: 16, padding: 28 },
  // Step 6: Micro
  { basePx: 11, h1Px: 26, h2Px: 17, h2Pb: 0, h2Mb: 4, h3Px: 14, sectionMt: 12, articleMb: 8, liMb: 2, headerMb: 14, padding: 24 },
  // Step 7: Nano
  { basePx: 10.5, h1Px: 24, h2Px: 16, h2Pb: 0, h2Mb: 3, h3Px: 13.5, sectionMt: 10, articleMb: 6, liMb: 1, headerMb: 12, padding: 20 },
  // Step 8: Pico
  { basePx: 9.5, h1Px: 22, h2Px: 15, h2Pb: 0, h2Mb: 2, h3Px: 13, sectionMt: 8, articleMb: 4, liMb: 0, headerMb: 10, padding: 16 },
];

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</, "&lt;")
    .replace(/>/, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

function parseSkills(skillsList: string[]): string {
  if (!skillsList || skillsList.length === 0) return "";

  const categories: Record<string, string[]> = {};
  const ungrouped: string[] = [];

  for (const s of skillsList) {
    if (s.includes(":")) {
      const [cat, val] = s.split(":");
      const c = cat.trim();
      if (!categories[c]) categories[c] = [];
      categories[c].push(val.trim());
    } else {
      ungrouped.push(s.trim());
    }
  }

  let html = "";
  for (const [cat, vals] of Object.entries(categories)) {
    html += `            <p><strong>${esc(cat)}</strong> ${esc(vals.join(", "))}</p>\n`;
  }
  if (ungrouped.length > 0) {
    html += `            <p><strong>Skills</strong> ${esc(ungrouped.join(", "))}</p>\n`;
  }
  return html;
}

function getIcon(type: string): string {
  const base = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;">`;
  if (type === "phone") {
    return base + `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  }
  if (type === "mail") {
    return base + `<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
  }
  if (type === "linkedin") {
    return base + `<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>`;
  }
  if (type === "github") {
    return base + `<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>`;
  }
  return base + `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`; // default generic icon (info)
}

function contactLine(r: TailoredResume): string {
  const parts: string[] = [];
  if (r.contact.links) {
    for (const link of r.contact.links) {
      const type = link.toLowerCase().includes("linkedin") ? "linkedin" : link.toLowerCase().includes("github") ? "github" : "link";
      const url = link.startsWith("http") ? link : `https://${link}`;
      parts.push(`<span>${type !== "link" ? getIcon(type) : ""}<a href="${esc(url)}" target="_blank" style="color: inherit; text-decoration: none;">${esc(link)}</a></span>`);
    }
  }
  if (r.contact.email) parts.push(`<span>${getIcon("mail")}<a href="mailto:${esc(r.contact.email)}" style="color: inherit; text-decoration: none;">${esc(r.contact.email)}</a></span>`);
  if (r.contact.phone) {
    const safePhone = r.contact.phone.replace(/[^0-9+]/g, '');
    parts.push(`<span>${getIcon("phone")}<a href="tel:${esc(safePhone)}" style="color: inherit; text-decoration: none;">${esc(r.contact.phone)}</a></span>`);
  }
  return parts.join("\n            ");
}

function bullets(items: string[]): string {
  if (!items?.length) return "";
  return (
    "            <ul>\n" +
    items.map((b) => `                <li>${esc(b)}</li>`).join("\n") +
    "\n            </ul>"
  );
}

export function renderResumeHtml(r: TailoredResume, fit: FitVars = FIT_STEPS[0]): string {
  // --- Experience ---
  const experience = (r.experience || [])
    .map(
      (e) => `
        <article>
            <div class="heading">
                <h3>${esc(e.title)} <span style="font-weight: 400; margin: 0 4px;">|</span> <span class="company" style="font-weight: 500;">${esc(e.company)}</span></h3>
                <span>${esc([e.start, e.end].filter(Boolean).join(" – "))}${e.location ? `, ${esc(e.location)}` : ""}</span>
            </div>
${bullets(e.bullets)}
        </article>`
    )
    .join("\n");

  // --- Projects ---
  const projects = (r.projects || [])
    .map((p) => {
      return `
        <article>
            <div class="heading">
                <h3>${esc(p.title)}</h3>
            </div>
${bullets(p.bullets)}
        </article>`;
    })
    .join("\n");

  // --- Education ---
  const education = (r.education || [])
    .map(
      (e) => `
        <div class="edu">
            <div>
                <h3>${esc(e.school)}</h3>
                ${e.degree ? `<p>${esc(e.degree)}</p>` : ""}
            </div>
            <div class="right">
                ${e.year ? `<span>${esc(e.year)}</span>` : ""}
                ${e.details ? `<span>${esc(e.details)}</span>` : ""}
            </div>
        </div>`
    )
    .join("\n");

  // --- Skills ---
  const skillsHtml = parseSkills(r.skills || []);

  // --- Certifications & Achievements ---
  const certifications = (r.certifications || [])
    .map((c) => `<li>${esc(c)}</li>`)
    .join("\n");
  
  const achievements = (r.achievements || [])
    .map((a) => `<li>${esc(a)}</li>`)
    .join("\n");

  // --- Full HTML (user's exact structure & CSS) ---
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(r.name)} Resume</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        @page {
            size: A4;
            margin: 0;
        }
        body {
            background: white;
            font-family: Inter, sans-serif;
            color: #222;
            font-size: ${fit.basePx}px;
            padding: 0;
        }
        .resume {
            width: 100%;
            margin: auto;
            background: white;
            padding: ${fit.padding}px;
        }
        header {
            text-align: center;
            margin-bottom: ${fit.headerMb}px;
        }
        h1 {
            font-size: ${fit.h1Px}px;
            font-weight: 800;
            letter-spacing: -1px;
        }
        .contact {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 20px;
            margin: 15px 0;
            font-size: ${fit.basePx}px;
            color: #555;
        }
        .summary {
            color: #444;
            line-height: 1.6;
            text-align: justify;
        }
        section {
            margin-top: ${fit.sectionMt}px;
        }
        section h2 {
            font-size: ${fit.h2Px}px;
            border-bottom: 2px solid #222;
            padding-bottom: ${fit.h2Pb}px;
            margin-bottom: ${fit.h2Mb}px;
        }
        .heading {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 10px;
        }
        .heading h3 {
            font-size: ${fit.h3Px}px;
        }
        .company {
            color: #666;
        }
        .heading span {
            color: #666;
        }
        article {
            margin-bottom: ${fit.articleMb}px;
        }
        ul {
            margin-top: 10px;
            padding-left: 22px;
        }
        li {
            margin-bottom: ${fit.liMb}px;
            line-height: 1.6;
        }
        .skills p {
            margin-bottom: ${fit.liMb}px;
            line-height: 1.7;
        }
        .edu {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 16px;
        }
        .edu > div:first-child {
            flex-shrink: 0;
            max-width: 60%;
        }
        .edu h3 {
            font-size: ${fit.h3Px}px;
            margin-bottom: 4px;
        }
        .right {
            text-align: right;
            display: flex;
            flex-direction: column;
            gap: 4px;
            color: #666;
            flex: 1;
        }
    </style>
</head>
<body>

<div class="resume">

    <header>
        <h1>${esc(r.name)}</h1>
        <div class="contact">
            ${contactLine(r)}
        </div>
${r.summary ? `        <p class="summary">${esc(r.summary)}</p>` : ""}
    </header>

${experience ? `    <section>
        <h2>Work Experience</h2>
${experience}
    </section>` : ""}

${projects ? `    <section>
        <h2>Projects</h2>
${projects}
    </section>` : ""}

${skillsHtml ? `    <section>
        <h2>Skills</h2>
        <div class="skills">
${skillsHtml}        </div>
    </section>` : ""}

${education ? `    <section>
        <h2>Education</h2>
${education}
    </section>` : ""}

${(certifications || achievements) ? `    <section>
        <h2>Certifications & Achievements</h2>
        <ul>
${certifications ? certifications + (achievements ? '\n' : '') : ''}${achievements}
        </ul>
    </section>` : ""}

</div>

</body>
</html>`;
}
