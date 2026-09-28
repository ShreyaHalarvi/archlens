"use client";

import { useState } from "react";
import type { Architecture } from "@/lib/types";
import ArchitectureGraph from "@/components/ArchitectureGraph";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const [architecture, setArchitecture] =
    useState<Architecture | null>(null);

  const [explanation, setExplanation] = useState("");
  const [explaining, setExplaining] = useState(false);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  async function analyzeRepository() {
    if (!repoUrl.trim()) {
      setError("Please enter a GitHub repository URL.");
      return;
    }

    setAnalyzing(true);
    setError("");
    setArchitecture(null);
    setExplanation("");
    setAnswer("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: repoUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setArchitecture(data.architecture);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while analyzing the repository."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function explainArchitecture() {
    if (!architecture) return;

    setExplaining(true);
    setError("");
    setExplanation("");

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          architecture,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to explain architecture"
        );
      }

      setExplanation(data.explanation);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while explaining the architecture."
      );
    } finally {
      setExplaining(false);
    }
  }

  async function askQuestion() {
    if (!architecture) return;

    if (!question.trim()) {
      setError("Please enter a question.");
      return;
    }

    setAsking(true);
    setError("");
    setAnswer("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          architecture,
          question,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to answer the question"
        );
      }

      setAnswer(data.answer);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while asking the question."
      );
    } finally {
      setAsking(false);
    }
  }

  const metrics = architecture?.metrics;
  const health = architecture?.health;
  const risks = architecture?.risks || [];

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#080808]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-bold text-black">
              A
            </div>

            <span className="text-lg font-semibold tracking-tight">
              ArchLens
            </span>
          </div>

          <div className="hidden items-center gap-6 text-sm text-gray-500 sm:flex">
            <span>AI Architecture</span>
            <span>•</span>
            <span>Codebase Intelligence</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-white/[0.035] blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-24 text-center sm:pt-32">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            AI-powered codebase understanding
          </div>

          <h1 className="text-5xl font-bold tracking-[-0.04em] sm:text-7xl">
            Understand any
            <br />
            <span className="text-gray-500">
              codebase faster.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-gray-400 sm:text-lg">
            ArchLens analyzes a GitHub repository, discovers its
            architecture, maps dependencies, detects structural risks,
            and explains how the system works.
          </p>

          {/* Repository Input */}
          <div className="mx-auto mt-10 max-w-3xl">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2 shadow-2xl shadow-black/40">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);

                    if (error) {
                      setError("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !analyzing) {
                      analyzeRepository();
                    }
                  }}
                  placeholder="Paste a public GitHub repository URL..."
                  className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-4 text-sm text-white outline-none placeholder:text-gray-600"
                />

                <button
                  onClick={analyzeRepository}
                  disabled={analyzing}
                  className="rounded-xl bg-white px-7 py-4 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {analyzing
                    ? "Analyzing..."
                    : "Analyze Repository →"}
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-left">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-red-400/30 text-xs text-red-400">
                  !
                </div>

                <p className="text-sm leading-6 text-red-300">
                  {error}
                </p>

                <button
                  onClick={() => setError("")}
                  className="ml-auto shrink-0 text-sm text-red-400/60 transition hover:text-red-300"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-gray-600">
            <span>Static analysis</span>
            <span>•</span>
            <span>Dependency mapping</span>
            <span>•</span>
            <span>AI architecture insights</span>
            <span>•</span>
            <span>Risk detection</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-white/10 bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-10">
            <p className="text-xs font-medium tracking-[0.2em] text-gray-600">
              HOW IT WORKS
            </p>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              From repository to architecture intelligence.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <ProcessCard
              number="01"
              title="Scan"
              description="Fetch repository files and inspect the project structure."
            />

            <ProcessCard
              number="02"
              title="Analyze"
              description="Extract imports, dependencies, layers, and entry points through static analysis."
            />

            <ProcessCard
              number="03"
              title="Understand"
              description="Groq AI identifies meaningful architectural components and relationships."
            />

            <ProcessCard
              number="04"
              title="Diagnose"
              description="ArchLens calculates architecture health and detects structural risks."
            />
          </div>
        </div>
      </section>

      {/* Results */}
      {architecture && (
        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#101010] shadow-2xl shadow-black/30">
            {/* Overview */}
            <div className="border-b border-white/10 p-7 sm:p-9">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-3 inline-flex rounded-full border border-green-400/10 bg-green-400/5 px-3 py-1 text-xs text-green-400">
                    Analysis complete
                  </div>

                  <h2 className="text-3xl font-semibold tracking-tight">
                    Architecture Intelligence
                  </h2>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-400">
                    {architecture.summary}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Stat
                    value={
                      metrics?.componentCount ??
                      architecture.nodes.length
                    }
                    label="components"
                  />

                  <Stat
                    value={
                      metrics?.relationshipCount ??
                      architecture.edges.length
                    }
                    label="relationships"
                  />
                </div>
              </div>
            </div>

            <div className="p-7 sm:p-9">
              {/* Health + Metrics */}
              <div className="grid gap-4 lg:grid-cols-[1.1fr_2fr]">
                {/* Health */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                  <SectionLabel text="ARCHITECTURE HEALTH" />

                  <div className="mt-5 flex items-center gap-6">
                    <HealthRing score={health?.score ?? 0} />

                    <div>
                      <p className="text-lg font-semibold">
                        {health
                          ? health.score >= 90
                            ? "Strong structure"
                            : health.score >= 75
                              ? "Generally healthy"
                              : health.score >= 60
                                ? "Moderate concerns"
                                : "Needs attention"
                          : "Unavailable"}
                      </p>

                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        {health?.summary ||
                          "Architecture health could not be determined."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                  <SectionLabel text="REPOSITORY METRICS" />

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MetricCard
                      value={metrics?.fileCount ?? 0}
                      label="Files analyzed"
                    />

                    <MetricCard
                      value={metrics?.componentCount ?? 0}
                      label="Components"
                    />

                    <MetricCard
                      value={metrics?.relationshipCount ?? 0}
                      label="Relationships"
                    />

                    <MetricCard
                      value={metrics?.externalDependencyCount ?? 0}
                      label="External deps"
                    />

                    <MetricCard
                      value={metrics?.entryPointCount ?? 0}
                      label="Entry points"
                    />

                    <MetricCard
                      value={metrics?.layerCount ?? 0}
                      label="Layers"
                    />
                  </div>
                </div>
              </div>

              {/* Strengths + Concerns */}
              {health && (
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <InsightPanel
                    title="Strengths"
                    items={health.strengths}
                    type="positive"
                  />

                  <InsightPanel
                    title="Concerns"
                    items={health.concerns}
                    type="warning"
                  />
                </div>
              )}

              {/* Risks */}
              <div className="mt-12 border-t border-white/10 pt-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <SectionLabel text="ARCHITECTURE DETECTIVE" />

                    <h3 className="mt-2 text-2xl font-semibold">
                      Structural Risks
                    </h3>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                      Evidence-based findings from the analyzed dependency
                      structure.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <RiskCount
                      count={metrics?.highRiskCount ?? 0}
                      label="high"
                      severity="high"
                    />

                    <RiskCount
                      count={metrics?.mediumRiskCount ?? 0}
                      label="medium"
                      severity="medium"
                    />
                  </div>
                </div>

                {risks.length > 0 ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {risks.map((risk) => (
                      <RiskCard key={risk.id} risk={risk} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-green-400/20 bg-green-400/5 text-green-400">
                        ✓
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          No major structural risks detected
                        </p>

                        <p className="mt-1 text-xs text-gray-600">
                          No significant fan-in, fan-out, or oversized
                          component patterns were detected in the analyzed
                          repository.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Components */}
              <div className="mt-12 border-t border-white/10 pt-10">
                <SectionLabel text="COMPONENTS" />

                <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {architecture.nodes.map((node) => {
                    const nodeRisks = risks.filter(
                      (risk) => risk.component === node.id
                    );

                    return (
                      <div
                        key={node.id}
                        className={`group rounded-2xl border p-5 transition ${
                          nodeRisks.some(
                            (risk) => risk.severity === "high"
                          )
                            ? "border-red-400/20 bg-red-400/[0.025]"
                            : nodeRisks.length > 0
                              ? "border-yellow-400/20 bg-yellow-400/[0.02]"
                              : "border-white/10 bg-white/[0.025]"
                        } hover:bg-white/[0.04]`}
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <h3 className="font-medium">
                            {node.label}
                          </h3>

                          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gray-500">
                            {node.type}
                          </span>
                        </div>

                        <p className="text-sm leading-6 text-gray-400">
                          {node.description ||
                            "No description available."}
                        </p>

                        {nodeRisks.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {nodeRisks.map((risk) => (
                              <span
                                key={risk.id}
                                className={`rounded-full px-2 py-1 text-[10px] ${
                                  risk.severity === "high"
                                    ? "bg-red-400/10 text-red-300"
                                    : "bg-yellow-400/10 text-yellow-300"
                                }`}
                              >
                                {risk.severity} risk
                              </span>
                            ))}
                          </div>
                        )}

                        {node.files.length > 0 && (
                          <div className="mt-5 border-t border-white/5 pt-4">
                            <p className="mb-2 text-[10px] font-medium tracking-wider text-gray-600">
                              FILES
                            </p>

                            <div className="space-y-1">
                              {node.files.slice(0, 6).map((file) => (
                                <p
                                  key={file}
                                  className="truncate font-mono text-[11px] text-gray-500"
                                  title={file}
                                >
                                  {file}
                                </p>
                              ))}

                              {node.files.length > 6 && (
                                <p className="pt-1 text-[10px] text-gray-700">
                                  +{node.files.length - 6} more files
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Architecture Graph */}
              <div className="mt-12 border-t border-white/10 pt-10">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <SectionLabel text="ARCHITECTURE GRAPH" />

                    <h3 className="mt-2 text-xl font-semibold">
                      System Architecture
                    </h3>

                    <p className="mt-2 text-sm text-gray-500">
                      A visual representation of the major components and
                      their relationships.
                    </p>
                  </div>

                  <button
                    onClick={explainArchitecture}
                    disabled={explaining}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {explaining
                      ? "Generating explanation..."
                      : "✦ Explain Architecture"}
                  </button>
                </div>

                <ArchitectureGraph
                  architecture={architecture}
                />
              </div>

              {/* AI Explanation */}
              {explanation && (
                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-7">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-black">
                      A
                    </div>

                    <div>
                      <p className="text-sm font-medium">
                        ArchLens AI
                      </p>

                      <p className="text-xs text-gray-600">
                        Architecture explanation
                      </p>
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap text-sm leading-7 text-gray-300">
                    {explanation}
                  </div>
                </div>
              )}

              {/* Codebase Q&A */}
              <div className="mt-12 border-t border-white/10 pt-10">
                <SectionLabel text="CODEBASE Q&A" />

                <h3 className="mt-2 text-2xl font-semibold">
                  Ask ArchLens
                </h3>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                  Ask questions about the analyzed architecture and get
                  practical answers for navigating the codebase.
                </p>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => {
                      setQuestion(e.target.value);

                      if (error) {
                        setError("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !asking) {
                        askQuestion();
                      }
                    }}
                    placeholder="How does authentication work?"
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.025] px-5 py-4 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/20"
                  />

                  <button
                    onClick={askQuestion}
                    disabled={asking}
                    className="rounded-xl bg-white px-6 py-4 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {asking ? "Thinking..." : "Ask →"}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "What are the main components?",
                    "How does data flow through the system?",
                    "Where should a new developer start?",
                    "How does authentication work?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setQuestion(suggestion);
                        setError("");
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-gray-500 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-gray-300"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {answer && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-bold text-black">
                        A
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          ArchLens AI
                        </p>

                        <p className="text-xs text-gray-600">
                          Based on analyzed architecture
                        </p>
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap text-sm leading-7 text-gray-300">
                      {answer}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Security */}
            <div className="border-t border-white/10 bg-white/[0.015] px-7 py-5 sm:px-9">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  🔒 ArchLens uses static analysis and does not execute
                  repository code.
                </p>

                <p className="text-xs text-gray-700">
                  Built for faster developer onboarding.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {!architecture && !analyzing && (
        <section className="mx-auto max-w-4xl px-6 pb-24">
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-xl">
              ⌘
            </div>

            <h2 className="mt-5 text-lg font-medium">
              Your architecture map will appear here
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              Paste a public GitHub repository above to discover its
              components, dependencies, architecture, structural risks,
              and codebase insights.
            </p>
          </div>
        </section>
      )}

      {/* Loading State */}
      {analyzing && (
        <section className="mx-auto max-w-4xl px-6 pb-24">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white" />

            <h2 className="mt-6 text-lg font-medium">
              Analyzing repository...
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Scanning files, mapping dependencies, understanding
              architecture, and detecting structural risks.
            </p>

            <div className="mx-auto mt-8 max-w-sm space-y-2 text-left">
              <LoadingStep
                label="Scanning repository"
                active
              />
              <LoadingStep
                label="Mapping dependencies"
                active
              />
              <LoadingStep
                label="Understanding architecture"
                active
              />
              <LoadingStep
                label="Detecting structural risks"
                active
              />
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-center text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span>
            ArchLens • AI-powered architecture intelligence
          </span>

          <span>
            Understand any codebase faster.
          </span>
        </div>
      </footer>
    </main>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[10px] font-medium tracking-[0.2em] text-gray-600">
      {text}
    </p>
  );
}

function ProcessCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-6 text-xs font-mono text-gray-600">
        {number}
      </div>

      <h3 className="font-medium">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-gray-600">
        {description}
      </p>
    </div>
  );
}

function Stat({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="min-w-[90px] rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-center">
      <p className="text-lg font-semibold">{value}</p>

      <p className="mt-1 text-[10px] uppercase tracking-wider text-gray-600">
        {label}
      </p>
    </div>
  );
}

function MetricCard({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4">
      <p className="text-xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-1 text-[10px] uppercase tracking-wider text-gray-600">
        {label}
      </p>
    </div>
  );
}

function HealthRing({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, score));

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (safeScore / 100) * circumference;

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full -rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="7"
        />

        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold">
            {safeScore}
          </p>

          <p className="text-[9px] uppercase tracking-wider text-gray-600">
            / 100
          </p>
        </div>
      </div>
    </div>
  );
}

function InsightPanel({
  title,
  items,
  type,
}: {
  title: string;
  items: string[];
  type: "positive" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
            type === "positive"
              ? "bg-green-400/10 text-green-300"
              : "bg-yellow-400/10 text-yellow-300"
          }`}
        >
          {type === "positive" ? "✓" : "!"}
        </div>

        <h3 className="font-medium">{title}</h3>
      </div>

      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex gap-3 text-sm leading-6 text-gray-400"
            >
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-600" />
              <span>{item}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-600">
            No additional observations were detected.
          </p>
        )}
      </div>
    </div>
  );
}

function RiskCount({
  count,
  label,
  severity,
}: {
  count: number;
  label: string;
  severity: "high" | "medium";
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-center ${
        severity === "high"
          ? "border-red-400/15 bg-red-400/[0.04]"
          : "border-yellow-400/15 bg-yellow-400/[0.04]"
      }`}
    >
      <p
        className={`text-lg font-semibold ${
          severity === "high"
            ? "text-red-300"
            : "text-yellow-300"
        }`}
      >
        {count}
      </p>

      <p className="text-[9px] uppercase tracking-wider text-gray-600">
        {label}
      </p>
    </div>
  );
}

function RiskCard({
  risk,
}: {
  risk: NonNullable<Architecture["risks"]>[number];
}) {
  const isHigh = risk.severity === "high";

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isHigh
          ? "border-red-400/15 bg-red-400/[0.025]"
          : "border-yellow-400/15 bg-yellow-400/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isHigh
                  ? "bg-red-400"
                  : "bg-yellow-400"
              }`}
            />

            <span
              className={`text-[10px] font-medium uppercase tracking-wider ${
                isHigh
                  ? "text-red-300"
                  : "text-yellow-300"
              }`}
            >
              {risk.severity} risk
            </span>
          </div>

          <h4 className="mt-2 font-medium">
            {risk.title}
          </h4>
        </div>

        <span className="max-w-[140px] truncate rounded-full border border-white/10 px-2.5 py-1 font-mono text-[9px] text-gray-600">
          {risk.component}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-gray-400">
        {risk.description}
      </p>

      {risk.evidence.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-600">
            Evidence
          </p>

          <div className="mt-2 space-y-1">
            {risk.evidence.map((item, index) => (
              <p
                key={`${item}-${index}`}
                className="text-xs leading-5 text-gray-500"
              >
                • {item}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-white/5 pt-4">
        <p className="text-[10px] uppercase tracking-wider text-gray-600">
          Recommendation
        </p>

        <p className="mt-2 text-xs leading-5 text-gray-500">
          {risk.recommendation}
        </p>
      </div>
    </div>
  );
}

function LoadingStep({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
      <div
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-white" : "bg-gray-700"
        }`}
      />

      <span className="text-xs text-gray-500">
        {label}
      </span>
    </div>
  );
}