"use client";

import { useMemo } from "react";
import { diffWordsWithSpace } from "diff";

interface Props {
  original: string;
  modified: string;
  className?: string;
}

export default function DiffViewer({ original, modified, className = "" }: Props) {
  const parts = useMemo(() => {
    return diffWordsWithSpace(original || "", modified || "");
  }, [original, modified]);

  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {parts.map((part, index) => {
        if (part.added) {
          return (
            <span key={index} className="bg-emerald-500/20 text-emerald-400 font-medium px-1 rounded-sm">
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span key={index} className="bg-red-500/20 text-red-400 line-through px-1 rounded-sm opacity-70">
              {part.value}
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
}
