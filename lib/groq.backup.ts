import type {
  Architecture,
  ArchitectureEdge,
  ArchitectureNode,
} from "./types";
import { buildMermaid } from "./mermaid";

type RepositoryAnalysis = {
  metrics: Record<string, number>;
  languages: Record<string, number>;
  layers: string[];
  entryPoints: string[];
  externalDependencies: string[];
  files: any[];
  dependencies: any[];
  issues?: {
    circularDependencies: string[][];
    deadFiles: string[];
  };
};

type GroqResponse = {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  summary: string;
};

const NODE_TYPES = [
  "api",
  "service",
  "database",
  "model",
  "middleware",
  "utility",
  "test",
  "other",
] as const;

const EDGE_TYPES = [
  "calls",
  "imports",
  "uses",
  "stores",
  "depends_on",
] as const;

export async function analyzeWithGroq(
  analysis: RepositoryAnalysis
): Promise<Architecture> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const compact = {
    metrics: analysis.metrics,
    languages: analysis.languages,
    layers: analysis.layers,
    entryPoints: analysis.entryPoints.slice(0, 12),
    externalDependencies: analysis.externalDependencies.slice(0, 20),

    issues: {
      circularDependencies:
        analysis.issues?.circularDependencies ?? [],
      deadFiles: analysis.issues?.deadFiles ?? [],
    },

    files: analysis.files.slice(0, 60).map((file) => ({
      path: file.path,
      language: file.language,
      layer: file.layer,
      entry: file.isEntryPoint,
      internal: file.internalImports.slice(0, 8),
      external: file.externalImports.slice(0, 8),
    })),

    dependencies: analysis.dependencies.slice(0, 120),
  };

  const prompt = `
You are ArchLens, an architecture extraction engine.

Turn the supplied STATIC repository evidence into a high-level architecture
for developer onboarding.

This is NOT a file browser. Group related files into meaningful components.
Do not create one node per file.

For example, if many example files demonstrate authentication, create one
"Authentication Examples" component. If several files implement routing,
create a "Routing" or "Routing & Middleware" component. If the repository
contains a real framework/core implementation, use its actual repository
concept as a component, such as "Express Core" when the evidence supports it.

Do not create a generic "Core Library", "Miscellaneous", or "Application"
component when a specific evidence-based name is possible.

Every file listed inside a node MUST exist in the supplied file list.
Every edge MUST be supported by the supplied dependency evidence or by a
clear shared framework dependency.

STRICT NODE TYPE RULE:
node.type MUST be exactly one of:
api, service, database, model, middleware, utility, test, other

NEVER use:
data, controller, route, router, repository, config, application,
handler, component, module.

If something represents data storage, persistence, a database, an in-memory
store, or a data layer, use "database".

STRICT EDGE RULE:
edge.relationship MUST be exactly one of:
calls, imports, uses, stores, depends_on

Keep the graph readable: approximately 4-10 meaningful components for a
normal repository. Include a test component when test files are present.

The supplied issue information is also important.

If circular dependencies are detected, preserve the corresponding files
inside meaningful architecture components so ArchLens can visually flag them.

If potentially unused files are detected, do not remove them from the
architecture evidence. They should remain available for issue visualization.

Return a concise summary that explains the architecture and its main flow.

Return ONLY JSON matching the schema.
`;

  try {
    const response = await requestGroq(
      apiKey,
      prompt +
        "\nSTATIC REPOSITORY EVIDENCE:\n" +
        JSON.stringify(compact)
    );

    const normalized = normalizeArchitecture(response, analysis);
    return finalizeArchitecture(normalized, analysis);
  } catch (error) {
    console.error("Groq architecture analysis failed:", error);

    // The static analyzer is still a valid working fallback. This keeps the
    // core hackathon flow alive if the LLM quota/schema is temporarily hit.
    return finalizeArchitecture(
      createDeterministicArchitecture(analysis),
      analysis
    );
  }
}

async function requestGroq(
  apiKey: string,
  prompt: string
): Promise<GroqResponse> {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content:
              "You are a strict JSON-only architecture extraction engine. Never output prose outside JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_completion_tokens: 3500,
        reasoning_effort: "low",
        reasoning_format: "hidden",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "archlens_architecture",
            strict: true,
            schema: {
              type: "object",
              properties: {
                nodes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      label: { type: "string" },
                      type: {
                        type: "string",
                        enum: [...NODE_TYPES],
                      },
                      files: {
                        type: "array",
                        items: { type: "string" },
                      },
                      description: { type: "string" },
                    },
                    required: [
                      "id",
                      "label",
                      "type",
                      "files",
                      "description",
                    ],
                    additionalProperties: false,
                  },
                },
                edges: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      source: { type: "string" },
                      target: { type: "string" },
                      relationship: {
                        type: "string",
                        enum: [...EDGE_TYPES],
                      },
                    },
                    required: ["source", "target", "relationship"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string" },
              },
              required: ["nodes", "edges", "summary"],
              additionalProperties: false,
            },
          },
        },
      }),
    }
  );

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`Groq request failed: ${bodyText}`);
  }

  const data = JSON.parse(bodyText);
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty architecture response.");
  }

  const parsed = JSON.parse(content);

  if (
    !parsed ||
    !Array.isArray(parsed.nodes) ||
    !Array.isArray(parsed.edges) ||
    typeof parsed.summary !== "string"
  ) {
    throw new Error("Groq returned an invalid architecture object.");
  }

  return parsed;
}

function normalizeArchitecture(
  response: GroqResponse,
  analysis: RepositoryAnalysis
): GroqResponse {
  const validFiles = new Set(
    analysis.files.map((file) => file.path)
  );

  const nodeIds = new Set<string>();

  const nodes = response.nodes
    .map((node, index) => {
      const type = NODE_TYPES.includes(node.type as any)
        ? node.type
        : "other";

      const files = node.files.filter((file) =>
        validFiles.has(file)
      );

      const id =
        node.id.trim() ||
        `component-${index + 1}`;

      nodeIds.add(id);

      return {
        id,
        label: node.label.trim() || `Component ${index + 1}`,
        type,
        files,
        description:
          node.description?.trim() ||
          "Architecture component.",
      };
    })
    .filter(
      (node) => node.files.length > 0 || node.type === "other"
    );

  const validEdgeKeys = new Set<string>();

  const edges = response.edges.filter((edge) => {
    if (
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target) ||
      edge.source === edge.target
    ) {
      return false;
    }

    if (!EDGE_TYPES.includes(edge.relationship as any)) {
      return false;
    }

    const key = `${edge.source}|${edge.target}|${edge.relationship}`;

    if (validEdgeKeys.has(key)) return false;

    validEdgeKeys.add(key);

    return true;
  });

  return {
    nodes,
    edges,
    summary:
      response.summary.trim() ||
      "Architecture extracted from the repository evidence.",
  };
}

function createDeterministicArchitecture(
  analysis: RepositoryAnalysis
): GroqResponse {
  const groups = new Map<
    string,
    {
      label: string;
      type: ArchitectureNode["type"];
      files: string[];
    }
  >();

  const groupFor = (file: any) => {
    if (file.layer === "api")
      return ["api", "API Layer"] as const;

    if (file.layer === "service")
      return ["service", "Services"] as const;

    if (file.layer === "database")
      return ["database", "Data Layer"] as const;

    if (file.layer === "model")
      return ["model", "Models"] as const;

    if (file.layer === "middleware")
      return ["middleware", "Middleware"] as const;

    if (file.layer === "test")
      return ["test", "Tests"] as const;

    if (file.layer === "utility")
      return ["utility", "Utilities"] as const;

    return ["other", "Supporting Modules"] as const;
  };

  for (const file of analysis.files) {
    const [type, label] = groupFor(file);

    if (!groups.has(label)) {
      groups.set(label, {
        label,
        type,
        files: [],
      });
    }

    groups.get(label)!.files.push(file.path);
  }

  const nodes: ArchitectureNode[] = [...groups.entries()].map(
    ([label, value]) => ({
      id: slug(label),
      label,
      type: value.type,
      files: value.files,
      description:
        `Files identified in the ${label.toLowerCase()} layer.`,
    })
  );

  const fileToNode = new Map<string, string>();

  for (const node of nodes) {
    for (const file of node.files) {
      fileToNode.set(file, node.id);
    }
  }

  const edges: ArchitectureEdge[] = [];
  const seen = new Set<string>();

  for (const dependency of analysis.dependencies) {
    if (dependency.type !== "internal") continue;

    const source = fileToNode.get(dependency.source);
    const target = fileToNode.get(dependency.target);

    if (!source || !target || source === target) continue;

    const key = `${source}|${target}|imports`;

    if (seen.has(key)) continue;

    seen.add(key);

    edges.push({
      source,
      target,
      relationship: "imports",
    });
  }

  const framework = detectFramework(
    analysis.externalDependencies
  );

  if (framework) {
    const id = slug(`${framework} Core`);

    if (!nodes.some((node) => node.id === id)) {
      nodes.push({
        id,
        label: `${framework} Core`,
        type: "other",
        files: [],
        description:
          `Shared ${framework} dependency detected from external imports.`,
      });
    }

    for (
      const node of nodes
        .filter((node) => node.id !== id)
        .slice(0, 8)
    ) {
      edges.push({
        source: node.id,
        target: id,
        relationship: "depends_on",
      });
    }
  }

  return {
    nodes,
    edges,
    summary:
      "Architecture grouped from deterministic file, layer, import, and dependency evidence. The LLM semantic pass was unavailable for this analysis.",
  };
}

function detectFramework(dependencies: string[]) {
  const known: Record<string, string> = {
    express: "Express",
    fastify: "Fastify",
    koa: "Koa",
    next: "Next.js",
    react: "React",
    vue: "Vue",
    "@nestjs/common": "NestJS",
    flask: "Flask",
    django: "Django",
    fastapi: "FastAPI",
  };

  return dependencies
    .map((value) => value.toLowerCase())
    .map((value) => known[value])
    .find(Boolean);
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function finalizeArchitecture(
  base: GroqResponse,
  analysis: RepositoryAnalysis
): Architecture {
  const nodes = base.nodes;
  const edges = base.edges;

  const issues = analysis.issues ?? {
    circularDependencies: [],
    deadFiles: [],
  };

  const risks = calculateRisks(
    nodes,
    edges,
    issues
  );

  const health = calculateHealth(
    nodes,
    edges,
    risks
  );

  const metrics = {
    fileCount:
      analysis.metrics.fileCount ||
      analysis.files.length,

    componentCount: nodes.length,

    relationshipCount: edges.length,

    externalDependencyCount:
      analysis.metrics.externalDependencyCount || 0,

    entryPointCount:
      analysis.metrics.entryPointCount ||
      analysis.entryPoints.length,

    layerCount:
      analysis.metrics.layerCount ||
      analysis.layers.length,

    highRiskCount:
      risks.filter(
        (risk) => risk.severity === "high"
      ).length,

    mediumRiskCount:
      risks.filter(
        (risk) => risk.severity === "medium"
      ).length,
  };

  const architecture: Architecture = {
    nodes,
    edges,
    summary: base.summary,
    mermaid: "",
    health,
    risks,
    metrics,
    issues,
    files: analysis.files,
    dependencies: analysis.dependencies,
    languages: analysis.languages,
    layers: analysis.layers,
    entryPoints: analysis.entryPoints,
    externalDependencies:
      analysis.externalDependencies,
  };

  architecture.mermaid = buildMermaid(architecture);

  return architecture;
}

function calculateRisks(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  issues: {
    circularDependencies: string[][];
    deadFiles: string[];
  }
) {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  for (const edge of edges) {
    incoming.set(
      edge.target,
      (incoming.get(edge.target) || 0) + 1
    );

    outgoing.set(
      edge.source,
      (outgoing.get(edge.source) || 0) + 1
    );
  }

  const risks: Architecture["risks"] = [];

  for (const node of nodes) {
    const inCount = incoming.get(node.id) || 0;
    const outCount = outgoing.get(node.id) || 0;

    if (inCount >= 7) {
      risks.push({
        id: `fan-in-${node.id}`,
        severity: "high",
        title: "Central dependency hotspot",
        component: node.id,
        description:
          "Many components depend on this component, so changes here can have a wide impact.",
        evidence: [
          `${inCount} incoming relationships detected.`,
        ],
        recommendation:
          "Review responsibilities and consider whether the boundary is too broad.",
      });
    } else if (inCount >= 4) {
      risks.push({
        id: `fan-in-${node.id}`,
        severity: "medium",
        title: "High dependency fan-in",
        component: node.id,
        description:
          "Several components depend on this component.",
        evidence: [
          `${inCount} incoming relationships detected.`,
        ],
        recommendation:
          "Keep the component interface stable and review its responsibilities.",
      });
    }

    if (outCount >= 7) {
      risks.push({
        id: `fan-out-${node.id}`,
        severity: "high",
        title: "Highly coupled component",
        component: node.id,
        description:
          "This component depends on many other components.",
        evidence: [
          `${outCount} outgoing relationships detected.`,
        ],
        recommendation:
          "Review orchestration responsibilities and possible separation.",
      });
    }

    if (node.files.length >= 15) {
      risks.push({
        id: `large-${node.id}`,
        severity: "medium",
        title: "Large component boundary",
        component: node.id,
        description:
          "A large number of files were grouped into this component.",
        evidence: [
          `${node.files.length} files belong to the component.`,
        ],
        recommendation:
          "Check whether the group contains multiple responsibilities.",
      });
    }
  }

  // Surprise challenge: circular dependency risks
  for (
    const cycle of issues.circularDependencies
  ) {
    risks.push({
      id: `cycle-${cycle.join("-")}`,
      severity: "high",
      title: "Circular dependency detected",
      component: cycle.join(" → "),
      description:
        "A dependency cycle was detected in the repository.",
      evidence: [
        `${cycle.join(" → ")} → ${cycle[0]}`,
      ],
      recommendation:
        "Review the dependency direction and consider introducing a cleaner boundary between the modules.",
    });
  }

  // Surprise challenge: potentially unused files
  for (const file of issues.deadFiles) {
    risks.push({
      id: `dead-${file}`,
      severity: "medium",
      title: "Potentially unused module",
      component: file,
      description:
        "This file has no detected incoming internal dependency and is not identified as an entry point or test.",
      evidence: [
        `${file} has no detected incoming internal dependency.`,
      ],
      recommendation:
        "Verify whether the module is still required, dynamically loaded, or used outside the analyzed dependency graph.",
    });
  }

  return risks.slice(0, 20);
}

function calculateHealth(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  risks: Architecture["risks"]
) {
  let score = 100;

  score -=
    risks.filter(
      (risk) => risk.severity === "high"
    ).length * 12;

  score -=
    risks.filter(
      (risk) => risk.severity === "medium"
    ).length * 5;

  if (
    nodes.length > 0 &&
    edges.length === 0
  ) {
    score -= 10;
  }

  score = Math.max(
    0,
    Math.min(100, score)
  );

  return {
    score,

    summary:
      score >= 85
        ? "The extracted architecture has relatively clear boundaries."
        : score >= 70
          ? "The extracted architecture is understandable with some coupling hotspots."
          : "The extracted architecture contains several structural hotspots.",

    strengths: [
      `${nodes.length} architecture components identified.`,
      `${edges.length} component relationships identified.`,
    ],

    concerns: risks
      .slice(0, 3)
      .map((risk) => risk.title),
  };
}