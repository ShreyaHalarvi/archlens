"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import type { Architecture } from "@/lib/types";

type ViewMode = "system" | "dependencies" | "risks";

type ArchitectureGraphProps = {
  architecture: Architecture;
};

export default function ArchitectureGraph({
  architecture,
}: ArchitectureGraphProps) {
  const graphRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewMode>("system");
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!graphRef.current) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      flowchart: {
        curve: view === "system" ? "basis" : "linear",
        nodeSpacing: 100,
        rankSpacing: 100,
        padding: 30,
        htmlLabels: true,
      },
    });

    async function renderGraph() {
      if (!graphRef.current) return;

      setRenderError(false);

      const graphDefinition = createMermaidGraph(
        architecture,
        view
      );

      try {
        const { svg } = await mermaid.render(
          `archlens-${Date.now()}`,
          graphDefinition
        );

        if (!graphRef.current) return;

        graphRef.current.innerHTML = svg;

        const svgElement =
          graphRef.current.querySelector("svg");

        if (svgElement) {
          svgElement.style.maxWidth = "none";
          svgElement.style.width = "100%";
          svgElement.style.height = "auto";
          svgElement.style.minWidth = "850px";
        }
      } catch (error) {
        console.error("Mermaid rendering error:", error);

        setRenderError(true);

        if (graphRef.current) {
          graphRef.current.innerHTML = "";
        }
      }
    }

    renderGraph();
  }, [architecture, view]);

  const risks = architecture.risks || [];

  const highRiskCount = risks.filter(
    (risk) => risk.severity === "high"
  ).length;

  const mediumRiskCount = risks.filter(
    (risk) => risk.severity === "medium"
  ).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#080808]">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.015] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">
            Architecture view
          </p>

          <p className="mt-1 text-xs text-gray-600">
            Explore the repository from different perspectives.
          </p>
        </div>

        <div className="flex rounded-xl border border-white/10 bg-black/40 p-1">
          <ViewButton
            active={view === "system"}
            onClick={() => setView("system")}
          >
            System
          </ViewButton>

          <ViewButton
            active={view === "dependencies"}
            onClick={() => setView("dependencies")}
          >
            Dependencies
          </ViewButton>

          <ViewButton
            active={view === "risks"}
            onClick={() => setView("risks")}
          >
            Risk Map
          </ViewButton>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 border-b border-white/5 px-5 py-3">
        {view === "system" && (
          <>
            <LegendItem
              label="Architecture component"
              className="bg-white"
            />

            <span className="text-[10px] text-gray-700">
              Relationships simplified for readability
            </span>
          </>
        )}

        {view === "dependencies" && (
          <>
            <LegendItem
              label="Dependency relationship"
              className="bg-gray-400"
            />

            <span className="text-[10px] text-gray-700">
              Imports and architectural dependencies
            </span>
          </>
        )}

        {view === "risks" && (
          <>
            <LegendItem
              label="High risk"
              className="bg-red-400"
            />

            <LegendItem
              label="Medium risk"
              className="bg-yellow-400"
            />

            <LegendItem
              label="No detected risk"
              className="bg-gray-600"
            />
          </>
        )}
      </div>

      {/* Graph */}
      <div className="overflow-x-auto p-5 sm:p-8">
        {renderError ? (
          <div className="flex min-h-[440px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-red-400/20 bg-red-400/5 text-red-300">
                !
              </div>

              <p className="mt-4 text-sm font-medium text-gray-300">
                Unable to render architecture graph.
              </p>

              <p className="mt-2 text-xs text-gray-600">
                The architecture analysis is still available above.
              </p>
            </div>
          </div>
        ) : (
          <div
            ref={graphRef}
            className="flex min-h-[460px] min-w-[850px] items-center justify-center"
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 bg-white/[0.015] px-5 py-4">
        <div className="flex flex-col gap-2 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {architecture.nodes.length} components
            {" · "}
            {architecture.edges.length} relationships
          </span>

          {view === "system" && (
            <span>
              High-level system structure
            </span>
          )}

          {view === "dependencies" && (
            <span>
              Detailed dependency relationships
            </span>
          )}

          {view === "risks" && (
            <span>
              {highRiskCount} high · {mediumRiskCount} medium
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-xs font-medium transition ${
        active
          ? "bg-white text-black"
          : "text-gray-500 hover:bg-white/[0.05] hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function LegendItem({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-gray-500">
      <span
        className={`h-1.5 w-1.5 rounded-full ${className}`}
      />

      {label}
    </div>
  );
}

function createMermaidGraph(
  architecture: Architecture,
  view: ViewMode
) {
  const lines: string[] = ["flowchart TD"];

  const validNodes = architecture.nodes.filter(
    (node) => sanitizeId(node.id)
  );

  const validNodeIds = new Set(
    validNodes.map((node) => sanitizeId(node.id))
  );

  const risks = architecture.risks || [];

  const riskMap = new Map<
    string,
    "high" | "medium" | "low"
  >();

  for (const risk of risks) {
    const existing = riskMap.get(risk.component);

    if (
      !existing ||
      (existing !== "high" &&
        risk.severity === "high")
    ) {
      riskMap.set(
        risk.component,
        risk.severity
      );
    }
  }

  /*
   * SYSTEM VIEW
   *
   * Focuses on architecture structure.
   * Relationship labels are removed so the graph
   * remains visually clean.
   */
  if (view === "system") {
    for (const node of validNodes) {
      const id = sanitizeId(node.id);

      lines.push(
        `    ${id}["${escapeLabel(node.label)}"]`
      );
    }

    for (const edge of architecture.edges) {
      const source = sanitizeId(edge.source);
      const target = sanitizeId(edge.target);

      if (!source || !target) continue;

      if (
        !validNodeIds.has(source) ||
        !validNodeIds.has(target)
      ) {
        continue;
      }

      lines.push(
        `    ${source} --> ${target}`
      );
    }

    lines.push("");

    lines.push(
      "    classDef component fill:#111111,stroke:#555555,stroke-width:1.5px,color:#ffffff;"
    );

    for (const node of validNodes) {
      lines.push(
        `    class ${sanitizeId(node.id)} component`
      );
    }
  }

  /*
   * DEPENDENCY VIEW
   *
   * Shows relationship labels.
   */
  if (view === "dependencies") {
    for (const node of validNodes) {
      const id = sanitizeId(node.id);

      lines.push(
        `    ${id}["${escapeLabel(node.label)}"]`
      );
    }

    for (const edge of architecture.edges) {
      const source = sanitizeId(edge.source);
      const target = sanitizeId(edge.target);

      if (!source || !target) continue;

      if (
        !validNodeIds.has(source) ||
        !validNodeIds.has(target)
      ) {
        continue;
      }

      const relationship = escapeLabel(
        edge.relationship
      );

      lines.push(
        `    ${source} -->|${relationship}| ${target}`
      );
    }

    lines.push("");

    lines.push(
      "    classDef component fill:#111111,stroke:#555555,stroke-width:1.5px,color:#ffffff;"
    );

    for (const node of validNodes) {
      lines.push(
        `    class ${sanitizeId(node.id)} component`
      );
    }
  }

  /*
   * RISK VIEW
   *
   * Highlights components based on detected
   * structural risk.
   */
  if (view === "risks") {
    for (const node of validNodes) {
      const id = sanitizeId(node.id);
      const severity = riskMap.get(node.id);

      let label = node.label;

      if (severity === "high") {
        label = `⚠ ${label}`;
      }

      if (severity === "medium") {
        label = `! ${label}`;
      }

      lines.push(
        `    ${id}["${escapeLabel(label)}"]`
      );
    }

    for (const edge of architecture.edges) {
      const source = sanitizeId(edge.source);
      const target = sanitizeId(edge.target);

      if (!source || !target) continue;

      if (
        !validNodeIds.has(source) ||
        !validNodeIds.has(target)
      ) {
        continue;
      }

      lines.push(
        `    ${source} --> ${target}`
      );
    }

    lines.push("");

    lines.push(
      "    classDef highRisk fill:#241010,stroke:#ef4444,stroke-width:3px,color:#fecaca;"
    );

    lines.push(
      "    classDef mediumRisk fill:#241d08,stroke:#eab308,stroke-width:3px,color:#fef08a;"
    );

    lines.push(
      "    classDef normal fill:#111111,stroke:#444444,stroke-width:1px,color:#eeeeee;"
    );

    for (const node of validNodes) {
      const id = sanitizeId(node.id);
      const severity = riskMap.get(node.id);

      if (severity === "high") {
        lines.push(
          `    class ${id} highRisk`
        );
      } else if (severity === "medium") {
        lines.push(
          `    class ${id} mediumRisk`
        );
      } else {
        lines.push(
          `    class ${id} normal`
        );
      }
    }
  }

  return lines.join("\n");
}

function sanitizeId(value: string) {
  return value
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^(\d)/, "_$1");
}

function escapeLabel(value: string) {
  return value
    .replace(/"/g, "'")
    .replace(/\n/g, " ")
    .trim();
}