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
    });

    async function renderGraph() {
      if (!graphRef.current) return;

      const graphDefinition = createMermaidGraph(architecture);

      try {
        const { svg } = await mermaid.render(
          `archlens-${Date.now()}`,
          graphDefinition
        );

        if (graphRef.current) {
          graphRef.current.innerHTML = svg;
        }
      } catch (error) {
        console.error("Mermaid rendering error:", error);

        if (graphRef.current) {
          graphRef.current.innerHTML = `
            <div style="color:#9ca3af;padding:20px;text-align:center;">
              Unable to render architecture diagram.
            </div>
          `;
        }
      }
    }

    renderGraph();
  }, [architecture]);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0b0b0b] p-6">
      <div
        ref={graphRef}
        className="flex min-h-[400px] items-center justify-center"
      />
    </div>
  );
}

function createMermaidGraph(architecture: Architecture) {
  const lines: string[] = ["flowchart TD"];

  // Only allow edges between components that
  // actually exist in the architecture nodes.
  const validNodeIds = new Set(
    architecture.nodes.map((node) => sanitizeId(node.id))
  );

  // Create declared architecture nodes
  for (const node of architecture.nodes) {
    const safeId = sanitizeId(node.id);
    const label = escapeLabel(node.label);

    if (!safeId) continue;

    lines.push(`    ${safeId}["${label}"]`);
  }

  // Create only valid internal architecture relationships
  for (const edge of architecture.edges) {
    const source = sanitizeId(edge.source);
    const target = sanitizeId(edge.target);

    if (!source || !target) continue;

    // Ignore external libraries or undeclared components
    if (!validNodeIds.has(source) || !validNodeIds.has(target)) {
      continue;
    }

    const relationship = escapeLabel(edge.relationship);

    lines.push(
      `    ${source} -->|${relationship}| ${target}`
    );
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