"use client";

import React from "react";
import { Sparkles, User } from "lucide-react";

export default function ChatSkeleton() {
  return (
    <div className="space-y-6 py-6 px-4 md:px-8 max-w-4xl mx-auto w-full animate-pulse">
      {/* User Bubble Skeleton */}
      <div className="flex justify-end">
        <div className="flex items-start gap-3 max-w-[70%]">
          <div className="space-y-2 text-right">
            <div className="h-4 bg-slate-800 rounded-xl w-48 ml-auto" />
            <div className="h-3 bg-slate-800/60 rounded-xl w-32 ml-auto" />
          </div>
          <div className="w-8 h-8 rounded-xl bg-slate-800 shrink-0" />
        </div>
      </div>

      {/* Assistant Bubble Skeleton */}
      <div className="flex justify-start">
        <div className="flex items-start gap-3 max-w-[85%] w-full">
          <div className="w-8 h-8 rounded-xl bg-indigo-900/40 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-400/50" />
          </div>
          <div className="flex-1 space-y-3 bg-slate-900/40 border border-white/5 p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="h-3 bg-indigo-500/20 rounded w-24" />
              <div className="h-3 bg-slate-800 rounded-full w-16" />
            </div>

            {/* Content line shimmers */}
            <div className="space-y-2">
              <div className="h-3.5 bg-slate-800 rounded w-full" />
              <div className="h-3.5 bg-slate-800 rounded w-11/12" />
              <div className="h-3.5 bg-slate-800 rounded w-4/5" />
              <div className="h-3.5 bg-slate-800/80 rounded w-3/5" />
            </div>

            {/* Citation pill shimmers */}
            <div className="flex items-center gap-2 pt-2">
              <div className="h-5 bg-slate-800/80 border border-white/5 rounded-lg w-28" />
              <div className="h-5 bg-slate-800/80 border border-white/5 rounded-lg w-32" />
            </div>
          </div>
        </div>
      </div>

      {/* Second User Bubble Skeleton */}
      <div className="flex justify-end">
        <div className="flex items-start gap-3 max-w-[60%]">
          <div className="space-y-1.5 text-right">
            <div className="h-4 bg-slate-800 rounded-xl w-36 ml-auto" />
          </div>
          <div className="w-8 h-8 rounded-xl bg-slate-800 shrink-0" />
        </div>
      </div>
    </div>
  );
}
