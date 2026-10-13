"use client";

import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const getStyle = () => {
    switch (toast.type) {
      case "success":
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
          border: "border-emerald-500/30",
          bg: "bg-emerald-950/80",
          glow: "shadow-emerald-500/10",
          titleColor: "text-emerald-200",
        };
      case "error":
        return {
          icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />,
          border: "border-rose-500/30",
          bg: "bg-rose-950/80",
          glow: "shadow-rose-500/10",
          titleColor: "text-rose-200",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
          border: "border-amber-500/30",
          bg: "bg-amber-950/80",
          glow: "shadow-amber-500/10",
          titleColor: "text-amber-200",
        };
      case "info":
      default:
        return {
          icon: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
          border: "border-cyan-500/30",
          bg: "bg-slate-900/90",
          glow: "shadow-cyan-500/10",
          titleColor: "text-cyan-200",
        };
    }
  };

  const style = getStyle();

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-slide-up ${style.border} ${style.bg} ${style.glow}`}
      role="alert"
    >
      <div className="pt-0.5">{style.icon}</div>
      <div className="flex-1 min-w-0 pr-1">
        {toast.title && (
          <h4 className={`text-xs font-semibold ${style.titleColor} mb-0.5`}>
            {toast.title}
          </h4>
        )}
        <p className="text-xs text-slate-200 leading-relaxed break-words">
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
