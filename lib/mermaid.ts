import type { Architecture } from "./types";

export function buildMermaid(
  architecture: Pick<Architecture, "nodes" | "edges">
) {
  const lines = ["flowchart LR"];

  const groups = groupNodes(architecture.nodes);

  for (const group of groups) {
    if (group.nodes.length === 0) continue;

    lines.push(`  subgraph ${group.id}["${group.label}"]`);
    lines.push(`    direction TB`);

    for (const node of group.nodes) {
      const id = safeId(node.id);
      const label = escapeLabel(node.label);
      const shape = shapeFor(node.type);

      lines.push(`    ${id}${shape.open}"${label}"${shape.close}`);
    }

    lines.push("  end");
  }

  const nodeTypes = new Map(
    architecture.nodes.map((node) => [node.id, node.type])
  );

  for (const edge of architecture.edges) {
    const source = safeId(edge.source);
    const target = safeId(edge.target);

    const sourceType = nodeTypes.get(edge.source);
    const targetType = nodeTypes.get(edge.target);

    // Test relationships are shown as subtle dotted connections.
    // They represent validation/coverage rather than production flow.
    if (sourceType === "test" || targetType === "test") {
      lines.push(`  ${source} -.- ${target}`);
      continue;
    }

    switch (edge.relationship) {
      case "imports":
      case "depends_on":
        lines.push(`  ${source} -.-> ${target}`);
        break;

      case "stores":
        lines.push(`  ${source} ==> ${target}`);
        break;

      case "calls":
      case "uses":
      default:
        lines.push(`  ${source} --> ${target}`);
        break;
    }
  }

  lines.push("");

  lines.push(
    "  classDef api fill:#dbeafe,stroke:#2563eb,color:#0f172a,stroke-width:2px;"
  );
  lines.push(
    "  classDef service fill:#ede9fe,stroke:#7c3aed,color:#0f172a,stroke-width:2px;"
  );
  lines.push(
    "  classDef database fill:#dcfce7,stroke:#16a34a,color:#0f172a,stroke-width:2px;"
  );
  lines.push(
    "  classDef model fill:#fef3c7,stroke:#d97706,color:#0f172a,stroke-width:2px;"
  );
  lines.push(
    "  classDef middleware fill:#fce7f3,stroke:#db2777,color:#0f172a,stroke-width:2px;"
  );
  lines.push(
    "  classDef utility fill:#e0f2fe,stroke:#0284c7,color:#0f172a,stroke-width:2px;"
  );
  lines.push(
    "  classDef test fill:#f1f5f9,stroke:#64748b,color:#0f172a,stroke-width:2px;"
  );
  lines.push(
    "  classDef other fill:#f8fafc,stroke:#475569,color:#0f172a,stroke-width:2px;"
  );

  for (const node of architecture.nodes) {
    lines.push(`  ${safeId(node.id)}:::${node.type}`);
  }

  return lines.join("\n");
}

export function buildDependencyMermaid(
  architecture: Pick<Architecture, "files" | "dependencies">
) {
  const internal = architecture.dependencies.filter(
    (dependency) => dependency.type === "internal"
  );

  const fileSet = new Set<string>();

  for (const dependency of internal) {
    fileSet.add(dependency.source);
    fileSet.add(dependency.target);
  }

  const files = architecture.files.filter((file) => fileSet.has(file.path));

  const lines = ["flowchart LR"];

  for (const file of files) {
    lines.push(
      `  ${safeId(file.path)}["${escapeLabel(shortPath(file.path))}"]`
    );
  }

  for (const dependency of internal) {
    lines.push(
      `  ${safeId(dependency.source)} -.-> ${safeId(dependency.target)}`
    );
  }

  return lines.join("\n");
}

function groupNodes(nodes: Architecture["nodes"]) {
  const groups = [
    {
      id: "entry_layer",
      label: "Entry & API",
      types: ["api", "middleware"],
      nodes: [] as Architecture["nodes"],
    },
    {
      id: "core_layer",
      label: "Core Logic",
      types: ["service", "model"],
      nodes: [] as Architecture["nodes"],
    },
    {
      id: "data_layer",
      label: "Data & Storage",
      types: ["database"],
      nodes: [] as Architecture["nodes"],
    },
    {
      id: "support_layer",
      label: "Utilities & Supporting Code",
      types: ["utility", "other"],
      nodes: [] as Architecture["nodes"],
    },
    {
      id: "test_layer",
      label: "Tests",
      types: ["test"],
      nodes: [] as Architecture["nodes"],
    },
  ];

  for (const node of nodes) {
    const group =
      groups.find((candidate) => candidate.types.includes(node.type)) ??
      groups.find((candidate) => candidate.id === "support_layer");

    group?.nodes.push(node);
  }

  return groups;
}

function shapeFor(type: string) {
  if (type === "database") {
    return { open: "[(", close: ")]" };
  }

  if (type === "api") {
    return { open: "[", close: "]" };
  }

  if (type === "model") {
    return { open: "([", close: "])" };
  }

  if (type === "middleware") {
    return { open: "{{", close: "}}" };
  }

  if (type === "test") {
    return { open: "[/", close: "/]" };
  }

  return { open: "[", close: "]" };
}

export function safeId(value: string) {
  return (
    "n_" +
    value
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^_+/, "")
      .slice(0, 70)
  );
}

function escapeLabel(value: string) {
  return value.replace(/"/g, "'").replace(/\n/g, " ");
}

function shortPath(value: string) {
  return value.length > 42 ? `…${value.slice(-40)}` : value;
}