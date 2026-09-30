"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidView from "./MermaidView";
import type { Architecture } from "@/lib/types";

type Props = {
  architecture: Architecture;
};

type Tab =
  | "architecture"
  | "dependencies"
  | "codebase"
  | "risks"
  | "mermaid";

export default function ArchitectureWorkspace({
  architecture,
}: Props) {
  const [tab, setTab] = useState<Tab>("architecture");
  const [explanation, setExplanation] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState("");

  const tabs: { id: Tab; label: string }[] = [
    { id: "architecture", label: "Architecture" },
    { id: "dependencies", label: "Dependencies" },
    { id: "codebase", label: "Codebase Map" },
    { id: "risks", label: "Risk Map" },
    { id: "mermaid", label: "Mermaid Source" },
  ];

  async function explain() {
    setBusy("explain");
    setExplanation("");

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ architecture }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setExplanation(data.explanation);
    } catch (error) {
      setExplanation(
        error instanceof Error
          ? error.message
          : "Failed to explain architecture."
      );
    } finally {
      setBusy("");
    }
  }

  async function ask() {
    if (!question.trim()) return;

    setBusy("ask");
    setAnswer("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ architecture, question }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setAnswer(data.answer);
    } catch (error) {
      setAnswer(
        error instanceof Error
          ? error.message
          : "Failed to answer question."
      );
    } finally {
      setBusy("");
    }
  }

  const dependencyCount = architecture.dependencies.filter(
    (item) => item.type === "internal"
  ).length;

  const cycleCount =
    architecture.issues.circularDependencies.length;

  const unusedCount =
    architecture.issues.deadFiles.length;

  const codebaseGroups = useMemo(
    () =>
      architecture.nodes.map((node) => ({
        ...node,
        fileObjects: architecture.files.filter((file) =>
          node.files.includes(file.path)
        ),
      })),
    [architecture]
  );

  async function copyMermaid() {
    try {
      await navigator.clipboard.writeText(
        architecture.mermaid
      );
    } catch {
      // Clipboard access can be blocked by browser permissions.
    }
  }

  function downloadMermaid() {
    const blob = new Blob([architecture.mermaid], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "archlens-architecture.mmd";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <div className="eyebrow">
            ARCHITECTURE VISUALIZATION
          </div>

          <h2>Explore the codebase</h2>

          <p>{architecture.summary}</p>
        </div>

        <button
          className="secondary-button"
          onClick={explain}
          disabled={busy === "explain"}
        >
          {busy === "explain"
            ? "Explaining…"
            : "Explain Architecture"}
        </button>
      </div>

      <div className="stats-row">
        <Stat
          value={architecture.metrics.fileCount}
          label="Files"
        />

        <Stat
          value={architecture.metrics.componentCount}
          label="Components"
        />

        <Stat
          value={architecture.metrics.relationshipCount}
          label="Relations"
        />

        <Stat
          value={architecture.metrics.externalDependencyCount}
          label="External deps"
        />

        <Stat
          value={architecture.metrics.entryPointCount}
          label="Entry points"
        />

        <Stat
          value={cycleCount}
          label="Cycles"
          warning={cycleCount > 0}
        />

        <Stat
          value={unusedCount}
          label="Unused candidates"
          warning={unusedCount > 0}
        />
      </div>

      {(cycleCount > 0 || unusedCount > 0) && (
        <div className="issue-banner">
          <div>
            <div className="eyebrow">
              SURPRISE CHALLENGE DETECTION
            </div>

            <h3>
              Architecture issues detected
            </h3>

            <p>
              ArchLens found structural issues in the
              repository and visually flagged them in
              the generated Mermaid architecture.
            </p>
          </div>

          <div className="issue-summary">
            {cycleCount > 0 && (
              <span className="issue-pill cycle">
                🔴 {cycleCount} cycle
                {cycleCount !== 1 ? "s" : ""}
              </span>
            )}

            {unusedCount > 0 && (
              <span className="issue-pill dead">
                🟠 {unusedCount} unused candidate
                {unusedCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="tabs">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={
              tab === item.id
                ? "tab active"
                : "tab"
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "architecture" && (
        <div className="panel-stack">
          <MermaidView
            code={architecture.mermaid}
          />

          <div className="component-grid">
            {architecture.nodes.map((node) => (
              <article
                className="component-card"
                key={node.id}
              >
                <div className="component-top">
                  <span
                    className={`type-badge ${node.type}`}
                  >
                    {node.type}
                  </span>

                  <span className="file-count">
                    {node.files.length} files
                  </span>
                </div>

                <h3>{node.label}</h3>

                <p>{node.description}</p>

                <div className="file-list">
                  {node.files
                    .slice(0, 4)
                    .map((file) => (
                      <code key={file}>
                        {file}
                      </code>
                    ))}

                  {node.files.length > 4 && (
                    <span>
                      + {node.files.length - 4} more
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "dependencies" && (
        <div className="panel">
          <div className="panel-title-row">
            <div>
              <div className="eyebrow">
                CONCRETE EVIDENCE
              </div>

              <h3>
                Internal file dependencies
              </h3>
            </div>

            <span className="count-pill">
              {dependencyCount} imports
            </span>
          </div>

          <div className="dependency-list">
            {architecture.dependencies
              .filter(
                (item) =>
                  item.type === "internal"
              )
              .slice(0, 80)
              .map((dependency, index) => (
                <div
                  className="dependency-row"
                  key={`${dependency.source}-${dependency.target}-${index}`}
                >
                  <code>
                    {dependency.source}
                  </code>

                  <span>
                    → imports →
                  </span>

                  <code>
                    {dependency.target}
                  </code>
                </div>
              ))}
          </div>
        </div>
      )}

      {tab === "codebase" && (
        <div className="component-grid">
          {codebaseGroups.map((group) => (
            <article
              className="component-card"
              key={group.id}
            >
              <div className="component-top">
                <span
                  className={`type-badge ${group.type}`}
                >
                  {group.type}
                </span>

                <span className="file-count">
                  {group.files.length} files
                </span>
              </div>

              <h3>{group.label}</h3>

              <p>{group.description}</p>

              <div className="file-list expanded">
                {group.fileObjects.map((file) => (
                  <div
                    className="file-row"
                    key={file.path}
                  >
                    <code>{file.path}</code>
                    <span>{file.layer}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === "risks" && (
        <div className="risk-grid">
          {architecture.risks.length === 0 ? (
            <div className="empty-panel">
              No structural hotspots detected.
            </div>
          ) : (
            architecture.risks.map((risk) => (
              <article
                className="risk-card"
                key={risk.id}
              >
                <div className="risk-top">
                  <span
                    className={`severity ${risk.severity}`}
                  >
                    {risk.severity}
                  </span>

                  <code>
                    {risk.component}
                  </code>
                </div>

                <h3>{risk.title}</h3>

                <p>{risk.description}</p>

                <div className="evidence">
                  {risk.evidence.map((item) => (
                    <span key={item}>
                      • {item}
                    </span>
                  ))}
                </div>

                <strong>
                  Recommendation
                </strong>

                <p>
                  {risk.recommendation}
                </p>
              </article>
            ))
          )}
        </div>
      )}

      {tab === "mermaid" && (
        <div className="panel">
          <div className="panel-title-row">
            <div>
              <div className="eyebrow">
                CHALLENGE OUTPUT
              </div>

              <h3>
                Generated Mermaid.js source
              </h3>

              <p>
                This source was generated from the
                analyzed repository architecture.
              </p>
            </div>

            <div className="button-row">
              <button
                className="secondary-button"
                onClick={copyMermaid}
              >
                Copy Mermaid
              </button>

              <button
                className="primary-button"
                onClick={downloadMermaid}
              >
                Download .mmd
              </button>
            </div>
          </div>

          <pre className="code-block">
            {architecture.mermaid}
          </pre>
        </div>
      )}

      {explanation && (
        <div className="ai-card">
          <div className="eyebrow">
            ARCHLENS AI
          </div>

          <h3>
            Architecture explanation
          </h3>

          <div className="ai-text">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
            >
              {explanation}
            </ReactMarkdown>
          </div>
        </div>
      )}

      <div className="ask-card">
        <div>
          <div className="eyebrow">
            CODEBASE Q&A
          </div>

          <h3>Ask ArchLens</h3>

          <p>
            Ask questions using only the analyzed
            architecture evidence.
          </p>
        </div>

        <div className="ask-row">
          <input
            value={question}
            onChange={(event) =>
              setQuestion(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                ask();
              }
            }}
            placeholder="How does data flow through the system?"
          />

          <button
            className="primary-button"
            onClick={ask}
            disabled={busy === "ask"}
          >
            {busy === "ask"
              ? "Thinking…"
              : "Ask"}
          </button>
        </div>

        {answer && (
          <div className="answer">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
            >
              {answer}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  warning = false,
}: {
  value: number;
  label: string;
  warning?: boolean;
}) {
  return (
    <div
      className={
        warning
          ? "stat-card warning"
          : "stat-card"
      }
    >
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}