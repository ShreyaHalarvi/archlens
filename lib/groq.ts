import type {
  Architecture,
  ArchitectureMetrics,
  ArchitectureRisk,
} from "./types";

type GroqArchitectureResponse = {
  nodes: Architecture["nodes"];
  edges: Architecture["edges"];
  summary: string;
};

export async function analyzeWithGroq(
  repositoryData: unknown
): Promise<Architecture> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const compactData =
    createCompactRepositoryData(repositoryData);

  const prompt = `
You are ArchLens, a software architecture analyzer.

Analyze the provided static repository analysis and create a concise architecture model.

IMPORTANT:
- Always return nodes, edges, and summary.
- nodes must contain at least 1 item when repository files are provided.
- edges may be an empty array when no reliable relationship exists.
- summary must always be a non-empty string.
- Use ONLY the provided repository information.
- Do NOT invent files, components, dependencies, behavior, or technologies.
- Group related files into meaningful architectural components.
- Prefer a small number of useful components.
- Use the provided layers, entry points, imports, and dependencies.
- Component files must be real file paths from the repository analysis.
- Edge source and target must refer to existing component IDs.
- Keep descriptions short.
- Do not calculate health scores.
- Do not create risks.
- Do not discuss security.

Allowed component types:
api, service, database, model, middleware, utility, test, other

Allowed relationship types:
calls, imports, uses, stores, depends_on

Return ONLY JSON matching the required schema.

Repository analysis:
${JSON.stringify(compactData)}
`;

  const architecture =
    await requestGroq(
      apiKey,
      prompt
    );

  return enrichArchitecture(
    architecture,
    compactData
  );
}

async function requestGroq(
  apiKey: string,
  prompt: string
): Promise<GroqArchitectureResponse> {
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
              "You are a strict JSON-only software architecture analyzer. Always return nodes, edges, and summary.",
          },

          {
            role: "user",
            content: prompt,
          },
        ],

        temperature: 0,

        max_completion_tokens: 1800,

        reasoning_effort: "low",

        reasoning_format: "hidden",

        response_format: {
          type: "json_schema",

          json_schema: {
            name: "architecture",

            strict: true,

            schema: {
              type: "object",

              properties: {
                nodes: {
                  type: "array",

                  items: {
                    type: "object",

                    properties: {
                      id: {
                        type: "string",
                      },

                      label: {
                        type: "string",
                      },

                      type: {
                        type: "string",

                        enum: [
                          "api",
                          "service",
                          "database",
                          "model",
                          "middleware",
                          "utility",
                          "test",
                          "other",
                        ],
                      },

                      files: {
                        type: "array",

                        items: {
                          type: "string",
                        },
                      },

                      description: {
                        type: "string",
                      },
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
                      source: {
                        type: "string",
                      },

                      target: {
                        type: "string",
                      },

                      relationship: {
                        type: "string",

                        enum: [
                          "calls",
                          "imports",
                          "uses",
                          "stores",
                          "depends_on",
                        ],
                      },
                    },

                    required: [
                      "source",
                      "target",
                      "relationship",
                    ],

                    additionalProperties: false,
                  },
                },

                summary: {
                  type: "string",
                },
              },

              required: [
                "nodes",
                "edges",
                "summary",
              ],

              additionalProperties: false,
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Groq request failed: ${errorText}`
    );
  }

  const data =
    await response.json();

  const content =
    data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Groq returned an empty architecture response."
    );
  }

  return parseArchitectureResponse(
    content
  );
}

function parseArchitectureResponse(
  content: string
): GroqArchitectureResponse {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      `Groq returned invalid architecture JSON: ${content}`
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    throw new Error(
      "Groq returned an invalid architecture object."
    );
  }

  const architecture =
    parsed as Record<
      string,
      unknown
    >;

  if (
    !Array.isArray(
      architecture.nodes
    )
  ) {
    throw new Error(
      "Groq architecture response is missing 'nodes'."
    );
  }

  if (
    !Array.isArray(
      architecture.edges
    )
  ) {
    throw new Error(
      "Groq architecture response is missing 'edges'."
    );
  }

  if (
    typeof architecture.summary !==
      "string" ||
    !architecture.summary.trim()
  ) {
    throw new Error(
      "Groq architecture response is missing 'summary'."
    );
  }

  return {
    nodes:
      architecture.nodes as Architecture["nodes"],

    edges:
      architecture.edges as Architecture["edges"],

    summary:
      architecture.summary,
  };
}

/**
 * Keep the information sent to Groq intentionally small.
 */
function createCompactRepositoryData(
  repositoryData: unknown
) {
  if (
    !repositoryData ||
    typeof repositoryData !==
      "object"
  ) {
    return {};
  }

  const data =
    repositoryData as Record<
      string,
      any
    >;

  const files =
    Array.isArray(data.files)
      ? data.files
          .slice(0, 30)
          .map((file: any) => ({
            path: file.path,

            language:
              file.language,

            layer: file.layer,

            entry:
              Boolean(
                file.isEntryPoint
              ),

            internal:
              Array.isArray(
                file.internalImports
              )
                ? file.internalImports.slice(
                    0,
                    6
                  )
                : [],

            external:
              Array.isArray(
                file.externalImports
              )
                ? file.externalImports.slice(
                    0,
                    4
                  )
                : [],
          }))
      : [];

  const dependencies =
    Array.isArray(
      data.dependencies
    )
      ? data.dependencies
          .slice(0, 80)
          .map(
            (dependency: any) => ({
              source:
                dependency.source,

              target:
                dependency.target,

              type:
                dependency.type,
            })
          )
      : [];

  return {
    metrics:
      data.metrics || {},

    languages:
      data.languages || {},

    layers:
      Array.isArray(
        data.layers
      )
        ? data.layers
        : [],

    entryPoints:
      Array.isArray(
        data.entryPoints
      )
        ? data.entryPoints.slice(
            0,
            10
          )
        : [],

    externalDependencies:
      Array.isArray(
        data.externalDependencies
      )
        ? data.externalDependencies.slice(
            0,
            15
          )
        : [],

    files,

    dependencies,
  };
}

function enrichArchitecture(
  architecture: Architecture,
  repositoryData: any
): Architecture {
  const nodes =
    Array.isArray(
      architecture.nodes
    )
      ? architecture.nodes
      : [];

  const nodeIds =
    new Set(
      nodes.map(
        (node) => node.id
      )
    );

  const edges =
    Array.isArray(
      architecture.edges
    )
      ? architecture.edges.filter(
          (edge) =>
            nodeIds.has(
              edge.source
            ) &&
            nodeIds.has(
              edge.target
            )
        )
      : [];

  const risks =
    detectRisks(
      nodes,
      edges,
      repositoryData
    );

  const metrics =
    createMetrics(
      nodes.length,
      edges.length,
      risks,
      repositoryData
    );

  const health =
    calculateHealth(
      nodes,
      edges,
      risks,
      repositoryData
    );

  return {
    ...architecture,

    nodes,

    edges,

    risks,

    health,

    metrics,
  };
}

function createMetrics(
  componentCount: number,
  relationshipCount: number,
  risks: ArchitectureRisk[],
  repositoryData: any
): ArchitectureMetrics {
  const sourceMetrics =
    repositoryData?.metrics ||
    {};

  return {
    fileCount:
      typeof sourceMetrics.fileCount ===
      "number"
        ? sourceMetrics.fileCount
        : 0,

    componentCount,

    relationshipCount,

    externalDependencyCount:
      typeof sourceMetrics
        .externalDependencyCount ===
      "number"
        ? sourceMetrics.externalDependencyCount
        : 0,

    entryPointCount:
      typeof sourceMetrics.entryPointCount ===
      "number"
        ? sourceMetrics.entryPointCount
        : 0,

    layerCount:
      typeof sourceMetrics.layerCount ===
      "number"
        ? sourceMetrics.layerCount
        : 0,

    highRiskCount:
      risks.filter(
        (risk) =>
          risk.severity ===
          "high"
      ).length,

    mediumRiskCount:
      risks.filter(
        (risk) =>
          risk.severity ===
          "medium"
      ).length,
  };
}

function detectRisks(
  nodes: Architecture["nodes"],
  edges: Architecture["edges"],
  repositoryData: any
): ArchitectureRisk[] {
  const risks: ArchitectureRisk[] =
    [];

  const incoming =
    new Map<string, number>();

  const outgoing =
    new Map<string, number>();

  for (const edge of edges) {
    incoming.set(
      edge.target,
      (incoming.get(
        edge.target
      ) || 0) + 1
    );

    outgoing.set(
      edge.source,
      (outgoing.get(
        edge.source
      ) || 0) + 1
    );
  }

  for (const [
    component,
    count,
  ] of incoming) {
    if (count >= 8) {
      risks.push({
        id: `high-fan-in-${component}`,

        severity: "high",

        title:
          "Highly centralized dependency",

        component,

        description:
          "Many architectural components depend on this component, increasing its potential impact on changes.",

        evidence: [
          `${count} incoming architectural relationships were detected.`,
        ],

        recommendation:
          "Review whether this component contains too many responsibilities or should be split into smaller boundaries.",
      });
    } else if (count >= 5) {
      risks.push({
        id: `fan-in-${component}`,

        severity: "medium",

        title:
          "High dependency fan-in",

        component,

        description:
          "Several components depend on this component, so changes here may affect multiple areas.",

        evidence: [
          `${count} incoming architectural relationships were detected.`,
        ],

        recommendation:
          "Review the component's responsibilities and keep its public interface stable.",
      });
    }
  }

  for (const [
    component,
    count,
  ] of outgoing) {
    if (count >= 8) {
      risks.push({
        id: `high-fan-out-${component}`,

        severity: "high",

        title:
          "Highly coupled component",

        component,

        description:
          "This component depends on many other components, which can make changes harder to isolate.",

        evidence: [
          `${count} outgoing architectural relationships were detected.`,
        ],

        recommendation:
          "Consider separating orchestration responsibilities from domain logic.",
      });
    } else if (count >= 5) {
      risks.push({
        id: `fan-out-${component}`,

        severity: "medium",

        title:
          "High dependency fan-out",

        component,

        description:
          "This component depends on several other components.",

        evidence: [
          `${count} outgoing architectural relationships were detected.`,
        ],

        recommendation:
          "Review whether the component has too many responsibilities.",
      });
    }
  }

  for (const node of nodes) {
    if (
      node.files.length >= 12
    ) {
      risks.push({
        id: `large-component-${node.id}`,

        severity: "medium",

        title:
          "Large architectural component",

        component: node.id,

        description:
          "A large number of files have been grouped into this component.",

        evidence: [
          `${node.files.length} files belong to this component.`,
        ],

        recommendation:
          "Review whether the component contains multiple responsibilities that could be separated.",
      });
    }
  }

  return risks.slice(0, 8);
}

function calculateHealth(
  nodes: Architecture["nodes"],
  edges: Architecture["edges"],
  risks: ArchitectureRisk[],
  repositoryData: any
) {
  let score = 100;

  const highRisks =
    risks.filter(
      (risk) =>
        risk.severity ===
        "high"
    ).length;

  const mediumRisks =
    risks.filter(
      (risk) =>
        risk.severity ===
        "medium"
    ).length;

  score -=
    highRisks * 12;

  score -=
    mediumRisks * 5;

  if (nodes.length === 0) {
    score -= 30;
  }

  if (nodes.length > 20) {
    score -= 5;
  }

  if (
    edges.length === 0 &&
    nodes.length > 1
  ) {
    score -= 10;
  }

  score = Math.max(
    0,
    Math.min(100, score)
  );

  const strengths: string[] =
    [];

  const concerns: string[] =
    [];

  if (nodes.length > 0) {
    strengths.push(
      `${nodes.length} meaningful architectural components were identified.`
    );
  }

  if (edges.length > 0) {
    strengths.push(
      `${edges.length} architectural relationships were detected from the dependency structure.`
    );
  }

  if (
    repositoryData?.entryPoints
      ?.length
  ) {
    strengths.push(
      `${repositoryData.entryPoints.length} potential entry points were identified.`
    );
  }

  if (highRisks > 0) {
    concerns.push(
      `${highRisks} high-severity structural risk${
        highRisks === 1
          ? ""
          : "s"
      } detected.`
    );
  }

  if (mediumRisks > 0) {
    concerns.push(
      `${mediumRisks} medium-severity structural concern${
        mediumRisks === 1
          ? ""
          : "s"
      } detected.`
    );
  }

  if (
    edges.length === 0 &&
    nodes.length > 1
  ) {
    concerns.push(
      "Few or no relationships could be established between the detected components."
    );
  }

  let summary: string;

  if (score >= 90) {
    summary =
      "The analyzed repository shows a relatively clear architectural structure with limited detected coupling concerns.";
  } else if (score >= 75) {
    summary =
      "The analyzed repository is generally structured clearly, with some areas that deserve attention.";
  } else if (score >= 60) {
    summary =
      "The analyzed repository has moderate structural complexity and several areas worth reviewing.";
  } else {
    summary =
      "The analyzed repository shows significant structural complexity or coupling in the analyzed files.";
  }

  return {
    score,

    summary,

    strengths,

    concerns,
  };
}