 "use client";

import { FormEvent, useState } from "react";
import ArchitectureWorkspace from "@/components/ArchitectureWorkspace";
import type { Architecture } from "@/lib/types";

const examples = [
  "https://github.com/psf/requests",
  "https://github.com/expressjs/express",
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [architecture, setArchitecture] = useState<Architecture | null>(null);
  const [repository, setRepository] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze(event?: FormEvent) {
    event?.preventDefault();
    if (!url.trim()) {
      setError("Paste a GitHub repository URL.");
      return;
    }

    setLoading(true);
    setError("");
    setArchitecture(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      setArchitecture(data.architecture);
      setRepository(
        `${data.repository.owner}/${data.repository.name}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the repository."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand">
            <div className="brand-mark">A</div>
            <span>ArchLens</span>
          </div>
          <div className="nav-caption">
            Code → Dependencies → Architecture → Mermaid
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="status-dot" />
            CODE-TO-DIAGRAM ARCHITECTURE VISUALIZER
          </div>

          <h1>
            Turn a backend repository
            <br />
            into an architecture you can see.
          </h1>

          <p className="hero-copy">
            ArchLens scans a GitHub repository, maps concrete dependencies,
            uses AI for semantic architecture understanding, generates
            Mermaid.js, and renders the result for developer onboarding.
          </p>

          <form className="repo-form" onSubmit={analyze}>
            <div className="url-input-wrap">
              <span>⌘</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://github.com/owner/repository"
              />
            </div>
            <button className="primary-button analyze-button" disabled={loading}>
              {loading ? "Analyzing…" : "Analyze repository →"}
            </button>
          </form>

          <div className="example-row">
            <span>Try:</span>
            {examples.map((example) => (
              <button
                key={example}
                onClick={() => setUrl(example)}
                type="button"
              >
                {example.includes("requests") ? "Python / Requests" : "Node / Express"}
              </button>
            ))}
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="support-row">
            <div>
              <strong>Python</strong>
              <span>Static imports</span>
            </div>
            <div>
              <strong>JavaScript</strong>
              <span>Node.js / Express</span>
            </div>
            <div>
              <strong>TypeScript</strong>
              <span>TS / TSX</span>
            </div>
            <div>
              <strong>Mermaid</strong>
              <span>Generated source</span>
            </div>
          </div>
        </div>
      </section>

      {!architecture && (
        <section className="how-section">
          <div className="section-kicker">THE PIPELINE</div>
          <h2>From code to architecture in one pass.</h2>

          <div className="pipeline">
            <PipelineStep
              number="01"
              title="Repository scanner"
              description="Reads the repository tree and source files without executing repository code."
            />
            <PipelineStep
              number="02"
              title="Static analysis"
              description="Extracts languages, layers, imports, entry points and concrete dependencies."
            />
            <PipelineStep
              number="03"
              title="AI architecture"
              description="Groq groups evidence into meaningful architectural components and relationships."
            />
            <PipelineStep
              number="04"
              title="Mermaid output"
              description="Generates Mermaid.js source and renders a live architecture diagram."
            />
          </div>
        </section>
      )}

      {architecture && (
        <section className="results-section">
          <div className="results-bar">
            <div>
              <div className="section-kicker">ANALYZED REPOSITORY</div>
              <h2>{repository}</h2>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                setArchitecture(null);
                setRepository("");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Analyze another repository
            </button>
          </div>

          <ArchitectureWorkspace architecture={architecture} />

          <div className="method-note">
            <strong>Evidence-grounded pipeline</strong>
            <span>
              Static analysis supplies concrete repository evidence. The LLM
              provides semantic grouping. Mermaid visualizes the resulting
              architecture. ArchLens never executes the analyzed repository.
            </span>
          </div>
        </section>
      )}

      <footer>
        ArchLens · AI-powered architecture intelligence · Built for faster developer onboarding
      </footer>
    </main>
  );
}

function PipelineStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <article className="pipeline-card">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
