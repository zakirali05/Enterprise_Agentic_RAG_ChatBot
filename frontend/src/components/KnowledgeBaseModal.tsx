"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Database,
  Upload,
  FileText,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Cpu,
  Layers,
} from "lucide-react";
import { KnowledgeStats, DocumentInfo } from "@/lib/types";
import {
  uploadDocumentFile,
  addDocumentText,
  deleteDocumentFile,
  seedSampleKnowledge,
} from "@/lib/api";

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeStats: KnowledgeStats | null;
  onRefresh: () => void;
}

export default function KnowledgeBaseModal({
  isOpen,
  onClose,
  knowledgeStats,
  onRefresh,
}: KnowledgeBaseModalProps) {
  const [activeTab, setActiveTab] = useState<"inventory" | "upload" | "text">(
    "inventory"
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileCategory, setFileCategory] = useState("Enterprise Policy");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      onRefresh();
    }
  }, [isOpen]);

  // Raw text form state
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("Corporate Note");

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadMessage(null);
    setUploadError(null);
    try {
      const res = await uploadDocumentFile(selectedFile, fileCategory);
      setUploadMessage(
        `Successfully indexed "${res.filename}" into ${res.chunks_created} vector chunks!`
      );
      setSelectedFile(null);
      onRefresh();
      setTimeout(() => setActiveTab("inventory"), 1200);
    } catch (err: any) {
      setUploadError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadMessage(null);
      setUploadError(null);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle || !noteContent) return;

    setIsUploading(true);
    setUploadMessage(null);
    setUploadError(null);
    try {
      const res = await addDocumentText(noteTitle, noteContent, noteCategory);
      setUploadMessage(
        `Indexed text "${res.filename}" into ${res.chunks_created} chunks!`
      );
      setNoteTitle("");
      setNoteContent("");
      onRefresh();
      setTimeout(() => setActiveTab("inventory"), 1200);
    } catch (err: any) {
      setUploadError(`Note creation error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to remove "${filename}" and all its vector embeddings?`)) {
      return;
    }
    setDeletingFilename(filename);
    try {
      await deleteDocumentFile(filename);
      onRefresh();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    } finally {
      setDeletingFilename(null);
    }
  };

  const handleSeed = async () => {
    setIsUploading(true);
    setUploadMessage(null);
    setUploadError(null);
    try {
      const res = await seedSampleKnowledge();
      setUploadMessage(`Seeded ${res.documents_added} enterprise documents successfully!`);
      onRefresh();
    } catch (err: any) {
      setUploadError(`Error seeding documents: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-100">
                Enterprise Knowledge Base
              </h2>
              <p className="text-xs text-slate-400">
                {knowledgeStats?.provider || "Vector Store"} embedded with{" "}
                {knowledgeStats?.embedding_model || "nomic-embed-text"} (768d)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSeed}
              disabled={isUploading}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reload sample enterprise documents (Policies, SRE runbook, HR guidelines)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUploading ? "animate-spin" : ""}`} />
              <span>Seed Defaults</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-900/40 border-b border-white/5 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
            <span className="text-slate-400 text-[11px] block">Total Documents</span>
            <span className="text-base font-bold text-slate-200">
              {knowledgeStats?.total_documents ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
            <span className="text-slate-400 text-[11px] block">Indexed Chunks</span>
            <span className="text-base font-bold text-cyan-400">
              {knowledgeStats?.total_chunks ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
            <span className="text-slate-400 text-[11px] block">Embedding Model</span>
            <span className="text-base font-bold text-indigo-400 font-mono text-xs truncate block">
              nomic-embed-text
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-4 bg-slate-950">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "inventory"
                ? "border-cyan-400 text-cyan-300 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Documents ({knowledgeStats?.documents?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "upload"
                ? "border-cyan-400 text-cyan-300 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File (PDF / TXT / MD)</span>
          </button>
          <button
            onClick={() => setActiveTab("text")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "text"
                ? "border-cyan-400 text-cyan-300 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Text Note</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {uploadMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{uploadMessage}</span>
            </div>
          )}

          {uploadError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* TAB 1: Document Inventory */}
          {activeTab === "inventory" && (
            <div className="space-y-3">
              {knowledgeStats === null ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-slate-800" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3.5 bg-slate-800 rounded w-1/3" />
                          <div className="h-2.5 bg-slate-800/60 rounded w-1/4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (!knowledgeStats?.documents || knowledgeStats.documents.length === 0) ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No documents indexed yet. Click "Upload File" or "Seed Defaults" to start.
                </div>
              ) : (
                knowledgeStats.documents.map((doc, idx) => {
                  const isDeletingThis = deletingFilename === doc.filename;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-900/50 border border-white/5 hover:border-white/10 flex items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">
                            {doc.filename}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-white/5 text-slate-300">
                              {doc.category}
                            </span>
                            <span>•</span>
                            <span className="text-cyan-400 font-mono">
                              {doc.chunk_count} chunks
                            </span>
                            <span>•</span>
                            <span>{doc.uploaded_at}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(doc.filename)}
                        disabled={isDeletingThis}
                        className={`p-2 rounded-lg transition-colors cursor-pointer ${
                          isDeletingThis
                            ? "text-slate-600 bg-white/5 cursor-not-allowed"
                            : "text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                        }`}
                        title="Delete document and remove all vectors"
                      >
                        {isDeletingThis ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: File Upload */}
          {activeTab === "upload" && (
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`p-6 border-2 border-dashed rounded-2xl transition-all text-center bg-slate-900/30 ${
                  isDragging
                    ? "border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-500/10"
                    : selectedFile
                    ? "border-emerald-500/50 bg-emerald-950/10"
                    : "border-white/15 hover:border-cyan-500/50"
                }`}
              >
                <input
                  type="file"
                  id="doc-file-input"
                  accept=".pdf,.txt,.md,.markdown,.csv,.json"
                  onChange={(e) => {
                    setSelectedFile(e.target.files?.[0] || null);
                    setUploadMessage(null);
                    setUploadError(null);
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="doc-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className={`p-3 rounded-full transition-colors ${
                    selectedFile ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"
                  }`}>
                    <FileUp className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-medium text-slate-200">
                    {selectedFile ? (
                      <span className="text-emerald-300 font-semibold">{selectedFile.name}</span>
                    ) : (
                      "Choose a document or drag it here"
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {selectedFile ? (
                      <span>{(selectedFile.size / 1024).toFixed(1)} KB • Click to change file</span>
                    ) : (
                      "Supports PDF (with page splitting), Markdown, TXT, CSV"
                    )}
                  </div>
                </label>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="mt-3 text-[11px] text-slate-400 hover:text-rose-400 underline transition-colors cursor-pointer"
                  >
                    Remove selected file
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Category / Classification
                </label>
                <input
                  type="text"
                  value={fileCategory}
                  onChange={(e) => setFileCategory(e.target.value)}
                  placeholder="e.g. Legal, Engineering, HR, Product Specs"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedFile || isUploading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:opacity-95 disabled:opacity-50 text-white font-medium text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98] cursor-pointer"
              >
                {isUploading
                  ? `Chunking & Indexing into ${knowledgeStats?.provider || "Vector Database"}...`
                  : "Upload & Index Document"}
              </button>
            </form>
          )}

          {/* TAB 3: Add Raw Text Note */}
          {activeTab === "text" && (
            <form onSubmit={handleTextSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. API Security Token Rotation SOP"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value)}
                  placeholder="e.g. Runbook, Memo, Guidelines"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Content (Markdown or Plain Text)
                </label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={6}
                  placeholder="Paste internal documentation, policy updates, or architectural guidelines here..."
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={!noteTitle || !noteContent || isUploading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:opacity-95 disabled:opacity-50 text-white font-medium text-xs transition-all shadow-lg active:scale-[0.98]"
              >
                {isUploading ? "Processing Chunks..." : "Index Text Note"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
