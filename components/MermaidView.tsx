 "use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  code: string;
  title?: string;
};

export default function MermaidView({
  code,
  title = "Generated architecture",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!ref.current) return;

      setError("");
      ref.current.innerHTML = "";

      try {
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            primaryColor: "#eef2ff",
            primaryTextColor: "#0f172a",
            primaryBorderColor: "#64748b",
            lineColor: "#64748b",
            secondaryColor: "#f8fafc",
            tertiaryColor: "#ffffff",
          },
        });

        const id = `archlens-${Math.random().toString(36).slice(2)}`;
        const result = await mermaid.render(id, code);

        if (!cancelled && ref.current) {
          ref.current.innerHTML = result.svg;
          const svg = ref.current.querySelector("svg");
          if (svg) {
            svg.style.maxWidth = "100%";
            svg.style.height = "auto";
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not render Mermaid diagram."
          );
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="diagram-shell">
      <div className="diagram-header">
        <div>
          <div className="eyebrow">LIVE MERMAID RENDER</div>
          <h3>{title}</h3>
        </div>
        <span className="live-pill">Generated from repository</span>
      </div>

      {error ? (
        <div className="diagram-error">{error}</div>
      ) : (
        <div ref={ref} className="mermaid-canvas" />
      )}
    </div>
  );
}
