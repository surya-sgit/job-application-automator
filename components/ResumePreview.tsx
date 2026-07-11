"use client";

import { useState, useRef, useEffect } from "react";
import type { TailoredResume } from "@/lib/resumeSchema";
import { renderResumeHtml, FIT_STEPS } from "@/templates/resume.html";

/** On-screen preview — renders the exact same HTML template used for the PDF. */
export default function ResumePreview({ r }: { r: TailoredResume }) {
  const [fitIndex, setFitIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset fit index when resume changes
  useEffect(() => {
    setFitIndex(0);
  }, [r]);

  // Handle responsive scaling so the iframe is ALWAYS 794px wide internally
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScale(entry.contentRect.width / 794);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const html = renderResumeHtml(r, FIT_STEPS[fitIndex]);

  function handleIframeLoad() {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentWindow?.document;
      if (!doc) return;
      
      // Wait for fonts to load before measuring height
      doc.fonts.ready.then(() => {
        const height = doc.body.scrollHeight;
        if (height > 1123 && fitIndex < FIT_STEPS.length - 1) {
          setFitIndex((prev) => prev + 1);
        }
      });
    } catch (e) {
      // ignore cross-origin errors if any
    }
  }

  return (
    <div 
      ref={containerRef} 
      className="mx-auto w-full shadow-lg bg-white relative overflow-hidden" 
      style={{ aspectRatio: "794/1123" }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: "794px", height: "1123px" }}>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          onLoad={handleIframeLoad}
          style={{ width: "794px", height: "1123px", border: "none" }}
          title="Resume Preview"
        />
      </div>
    </div>
  );
}
