"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";
import type { Architecture } from "@/lib/types";

type ArchitectureGraphProps = {
  architecture: Architecture;
};

export default function ArchitectureGraph({
  architecture,
}: ArchitectureGraphProps) {
  const graphRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!graphRef.current) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",

      flowchart: {
        htmlLabels: true,
        curve: "basis",

        // Keep the diagram tall and spacious.
        nodeSpacing: 90,
        rankSpacing: 120,

        padding: 30,
        useMaxWidth: false,
      },
    });

    async function renderGraph() {
      if (!graphRef.current) return;

      const graphDefinition =
        createMermaidGraph(architecture);

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
          svgElement.style.display = "block";
          svgElement.style.margin = "0 auto";
          svgElement.style.width = "auto";
          svgElement.style.height = "auto";
          svgElement.style.minWidth = "850px";
        }
      } catch (error) {
        console.error(
          "Mermaid rendering error:",
          error
        );

        if (graphRef.current) {
          graphRef.current.innerHTML = `
            <div style="
              color:#9ca3af;
              padding:40px;
              text-align:center;
            ">
              Unable to render architecture diagram.
            </div>
          `;
        }
      }
    }

    renderGraph();
  }, [architecture]);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0b0b0b] p-8">
      <div
        ref={graphRef}
        className="flex min-h-[520px] min-w-[900px] items-center justify-center"
      />
    </div>
  );
}

function createMermaidGraph(
  architecture: Architecture
) {
  const lines: string[] = [
    "flowchart TD",
  ];

  const validNodeIds = new Set(
    architecture.nodes.map((node) =>
      sanitizeId(node.id)
    )
  );

  // Nodes
  for (const node of architecture.nodes) {
    const safeId = sanitizeId(node.id);

    if (!safeId) continue;

    const label = escapeLabel(node.label);

    lines.push(
      `    ${safeId}["${label}"]`
    );
  }

  // Relationships
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

    const relationship =
      escapeLabel(edge.relationship);

    lines.push(
      `    ${source} -->|${relationship}| ${target}`
    );
  }

  // Styling
  lines.push("");

  lines.push(
    "    classDef default fill:#111111,stroke:#555555,stroke-width:1.5px,color:#ffffff;"
  );

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