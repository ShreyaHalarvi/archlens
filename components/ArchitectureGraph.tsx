"use client";

import { useEffect, useMemo, useState } from "react";
import mermaid from "mermaid";

import type {
  Architecture,
  ArchitectureNode,
} from "@/lib/types";

type ViewMode =
  | "system"
  | "dependencies"
  | "risks"
  | "codebase";

type Props = {
  architecture: Architecture;
};

type RiskSeverity = "high" | "medium" | "low";

const NODE_COLORS: Record<
  ArchitectureNode["type"],
  string
> = {
  api: "#dbeafe",
  service: "#dcfce7",
  database: "#fef3c7",
  model: "#fce7f3",
  middleware: "#ede9fe",
  utility: "#e0f2fe",
  test: "#f3f4f6",
  other: "#f5f5f5",
};

function safeId(value: string, prefix: string) {
  const cleaned = String(value ?? "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .slice(0, 60);

  return `${prefix}_${cleaned || "item"}`;
}

function uniqueId(
  value: string,
  prefix: string,
  used: Set<string>
) {
  const base = safeId(value, prefix);

  let id = base;
  let counter = 2;

  while (used.has(id)) {
    id = `${base}_${counter}`;
    counter++;
  }

  used.add(id);

  return id;
}

function cleanText(
  value: unknown,
  maxLength = 100
) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/"/g, "'")
    .replace(/\|/g, "/")
    .trim()
    .slice(0, maxLength);
}

function shortenFilePath(path: string) {
  const parts = String(path)
    .split("/")
    .filter(Boolean);

  if (parts.length <= 2) {
    return parts.join("/");
  }

  return `.../${parts.slice(-2).join("/")}`;
}

function riskColor(
  severity: RiskSeverity
) {
  if (severity === "high") {
    return "#fecaca";
  }

  if (severity === "medium") {
    return "#fed7aa";
  }

  return "#dcfce7";
}

function riskBorder(
  severity: RiskSeverity
) {
  if (severity === "high") {
    return "#dc2626";
  }

  if (severity === "medium") {
    return "#ea580c";
  }

  return "#16a34a";
}

function nodeColor(
  node: ArchitectureNode
) {
  return (
    NODE_COLORS[node.type] ??
    NODE_COLORS.other
  );
}

function buildComponentGraph(
  architecture: Architecture
) {
  const lines: string[] = [
    "flowchart LR",
  ];

  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();

  for (const node of architecture.nodes ?? []) {
    const id = uniqueId(
      node.id,
      "node",
      usedIds
    );

    idMap.set(node.id, id);

    const label = cleanText(
      node.label || node.id,
      80
    );

    lines.push(
      `${id}["${label}"]`
    );

    lines.push(
      `style ${id} fill:${nodeColor(
        node
      )},stroke:#64748b,stroke-width:1px`
    );
  }

  for (const edge of architecture.edges ?? []) {
    const source = idMap.get(
      edge.source
    );

    const target = idMap.get(
      edge.target
    );

    if (!source || !target) {
      continue;
    }

    if (source === target) {
      continue;
    }

    lines.push(
      `${source} --> ${target}`
    );
  }

  return lines.join("\n");
}

function buildDependencyGraph(
  architecture: Architecture
) {
  const lines: string[] = [
    "flowchart LR",
  ];

  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();

  for (const node of architecture.nodes ?? []) {
    const id = uniqueId(
      node.id,
      "dependency",
      usedIds
    );

    idMap.set(node.id, id);

    const label = cleanText(
      node.label || node.id,
      80
    );

    lines.push(
      `${id}["${label}"]`
    );

    lines.push(
      `style ${id} fill:${nodeColor(
        node
      )},stroke:#64748b,stroke-width:1px`
    );
  }

  for (const edge of architecture.edges ?? []) {
    const source = idMap.get(
      edge.source
    );

    const target = idMap.get(
      edge.target
    );

    if (!source || !target) {
      continue;
    }

    if (source === target) {
      continue;
    }

    const relationship = cleanText(
      edge.relationship,
      30
    );

    lines.push(
      `${source} -->|${relationship}| ${target}`
    );
  }

  return lines.join("\n");
}

function buildCodebaseGraph(
  architecture: Architecture
) {
  const lines: string[] = [
    "flowchart LR",
  ];

  const usedIds = new Set<string>();

  const componentIds =
    new Map<string, string>();

  const fileIds =
    new Map<string, string>();

  /*
   * Architectural components
   */

  for (const node of architecture.nodes ?? []) {
    const id = uniqueId(
      node.id,
      "component",
      usedIds
    );

    componentIds.set(
      node.id,
      id
    );

    const label = cleanText(
      node.label || node.id,
      80
    );

    lines.push(
      `${id}["${label}"]`
    );

    lines.push(
      `style ${id} fill:${nodeColor(
        node
      )},stroke:#475569,stroke-width:2px`
    );
  }

  /*
   * Concrete files
   */

  const files =
    architecture.files ?? [];

  files.forEach(
    (file, index) => {
      const id = uniqueId(
        `${index}_${file.path}`,
        "file",
        usedIds
      );

      fileIds.set(
        file.path,
        id
      );

      const path =
        shortenFilePath(file.path);

      const language =
        cleanText(
          file.language,
          20
        );

      const label = cleanText(
        `${path} (${language})`,
        100
      );

      lines.push(
        `${id}["${label}"]`
      );

      let fill =
        NODE_COLORS.other;

      if (file.isEntryPoint) {
        fill =
          NODE_COLORS.api;
      } else if (
        file.layer === "service"
      ) {
        fill =
          NODE_COLORS.service;
      } else if (
        file.layer === "model"
      ) {
        fill =
          NODE_COLORS.model;
      } else if (
        file.layer === "middleware"
      ) {
        fill =
          NODE_COLORS.middleware;
      } else if (
        file.layer === "test"
      ) {
        fill =
          NODE_COLORS.test;
      }

      lines.push(
        `style ${id} fill:${fill},stroke:#94a3b8,stroke-width:1px`
      );
    }
  );

  /*
   * Component -> file membership
   */

  for (const node of architecture.nodes ?? []) {
    const componentId =
      componentIds.get(node.id);

    if (!componentId) {
      continue;
    }

    for (const file of node.files ?? []) {
      const fileId =
        fileIds.get(file);

      if (!fileId) {
        continue;
      }

      lines.push(
        `${componentId} -.-> ${fileId}`
      );
    }
  }

  /*
   * File -> file dependencies
   */

  const seenEdges =
    new Set<string>();

  for (const dependency of architecture.dependencies ?? []) {
    if (
      dependency.type !==
      "internal"
    ) {
      continue;
    }

    const source =
      fileIds.get(
        dependency.source
      );

    const target =
      fileIds.get(
        dependency.target
      );

    if (
      !source ||
      !target ||
      source === target
    ) {
      continue;
    }

    const edgeKey =
      `${source}->${target}`;

    if (seenEdges.has(edgeKey)) {
      continue;
    }

    seenEdges.add(edgeKey);

    lines.push(
      `${source} --> ${target}`
    );
  }

  return lines.join("\n");
}

function getRiskReason(
  title: string
) {
  const lower =
    title.toLowerCase();

  if (
    lower.includes("fan-in") ||
    lower.includes("incoming")
  ) {
    return "Many other components depend on this area, so changes here may have a wider impact.";
  }

  if (
    lower.includes("fan-out") ||
    lower.includes("outgoing")
  ) {
    return "This component depends on many other areas, increasing coupling and change complexity.";
  }

  if (
    lower.includes("large") ||
    lower.includes("files")
  ) {
    return "This component contains many files, which can make ownership and maintenance harder to navigate.";
  }

  return "Static analysis identified this component as an area that deserves additional investigation.";
}

function getRiskIcon(
  severity: RiskSeverity
) {
  if (severity === "high") {
    return "!";
  }

  if (severity === "medium") {
    return "!";
  }

  return "i";
}

function getRiskLabel(
  severity: RiskSeverity
) {
  if (severity === "high") {
    return "High priority";
  }

  if (severity === "medium") {
    return "Medium priority";
  }

  return "Low priority";
}

export default function ArchitectureGraph({
  architecture,
}: Props) {
  const [view, setView] =
    useState<ViewMode>("system");

  const [svg, setSvg] =
    useState("");

  const [renderError, setRenderError] =
    useState("");

  const riskMap = useMemo(() => {
    const map = new Map<
      string,
      RiskSeverity
    >();

    const priority: Record<
      RiskSeverity,
      number
    > = {
      high: 3,
      medium: 2,
      low: 1,
    };

    for (const risk of architecture.risks ?? []) {
      const current =
        map.get(risk.component);

      if (
        !current ||
        priority[risk.severity] >
          priority[current]
      ) {
        map.set(
          risk.component,
          risk.severity
        );
      }
    }

    return map;
  }, [architecture.risks]);

  const sortedRisks = useMemo(() => {
    const priority: Record<
      RiskSeverity,
      number
    > = {
      high: 3,
      medium: 2,
      low: 1,
    };

    return [
      ...(architecture.risks ?? []),
    ].sort(
      (a, b) =>
        priority[b.severity] -
        priority[a.severity]
    );
  }, [architecture.risks]);

  const representedFileCount =
    architecture.files?.length ??
    architecture.nodes.reduce(
      (total, node) =>
        total +
        (node.files?.length ?? 0),
      0
    );

  const internalDependencyCount =
    (
      architecture.dependencies ??
      []
    ).filter(
      (dependency) =>
        dependency.type ===
        "internal"
    ).length;

  const highRiskCount =
    sortedRisks.filter(
      (risk) =>
        risk.severity === "high"
    ).length;

  const mediumRiskCount =
    sortedRisks.filter(
      (risk) =>
        risk.severity === "medium"
    ).length;

  useEffect(() => {
    let cancelled = false;

    async function renderGraph() {
      setSvg("");
      setRenderError("");

      /*
       * Risk Map intentionally does not use
       * Mermaid. It is a hotspot investigation
       * view rather than another dependency graph.
       */
      if (view === "risks") {
        return;
      }

      if (
        !architecture ||
        !architecture.nodes ||
        architecture.nodes.length === 0
      ) {
        setRenderError(
          "No architecture components were returned."
        );

        return;
      }

      let graph = "";

      try {
        if (view === "codebase") {
          graph =
            buildCodebaseGraph(
              architecture
            );
        } else if (
          view === "dependencies"
        ) {
          graph =
            buildDependencyGraph(
              architecture
            );
        } else {
          graph =
            buildComponentGraph(
              architecture
            );
        }

        console.log(
          "ArchLens Mermaid graph:",
          graph
        );

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          flowchart: {
            useMaxWidth: false,
            htmlLabels: false,
            nodeSpacing:
              view === "codebase"
                ? 45
                : 80,
            rankSpacing:
              view === "codebase"
                ? 65
                : 80,
            padding: 25,
            curve: "basis",
          },
        });

        const renderId =
          `archlens_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;

        const result =
          await mermaid.render(
            renderId,
            graph
          );

        if (cancelled) {
          return;
        }

        if (
          !result ||
          !result.svg
        ) {
          throw new Error(
            "Mermaid returned an empty SVG."
          );
        }

        setSvg(result.svg);
      } catch (error) {
        console.error(
          "ArchLens Mermaid rendering failed:",
          error
        );

        if (!cancelled) {
          setRenderError(
            error instanceof Error
              ? error.message
              : String(error)
          );

          setSvg("");
        }
      }
    }

    void renderGraph();

    return () => {
      cancelled = true;
    };
  }, [
    architecture,
    view,
  ]);

  const views: {
    id: ViewMode;
    label: string;
    description: string;
  }[] = [
    {
      id: "system",
      label: "System",
      description:
        "High-level architecture",
    },
    {
      id: "dependencies",
      label: "Dependencies",
      description:
        "Actual component relationships",
    },
    {
      id: "risks",
      label: "Risk Map",
      description:
        "Architectural hotspots",
    },
    {
      id: "codebase",
      label: "Codebase Map",
      description:
        "Files and real dependencies",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Architecture visualization
          </p>

          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Explore the codebase
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {views.map((item) => {
            const active =
              view === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setView(item.id)
                }
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="text-sm font-semibold">
                  {item.label}
                </div>

                <div
                  className={`text-[11px] ${
                    active
                      ? "text-slate-300"
                      : "text-slate-500"
                  }`}
                >
                  {item.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {view === "risks" ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total hotspots
              </div>

              <div className="mt-1 text-2xl font-bold text-slate-900">
                {sortedRisks.length}
              </div>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                High priority
              </div>

              <div className="mt-1 text-2xl font-bold text-red-800">
                {highRiskCount}
              </div>
            </div>

            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                Medium priority
              </div>

              <div className="mt-1 text-2xl font-bold text-orange-800">
                {mediumRiskCount}
              </div>
            </div>
          </div>

          {sortedRisks.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-lg font-bold text-emerald-700">
                ✓
              </div>

              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No structural hotspots detected
              </h3>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                ArchLens did not identify any
                high, medium, or low priority
                architectural risks from the
                available static-analysis evidence.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {sortedRisks.map(
                (risk) => {
                  const component =
                    architecture.nodes?.find(
                      (node) =>
                        node.id ===
                        risk.component
                    );

                  const evidence =
                    risk.evidence ??
                    [];

                  const reason =
                    getRiskReason(
                      risk.title
                    );

                  return (
                    <article
                      key={risk.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div
                        className="h-1.5"
                        style={{
                          backgroundColor:
                            riskBorder(
                              risk.severity
                            ),
                        }}
                      />

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                              style={{
                                backgroundColor:
                                  riskColor(
                                    risk.severity
                                  ),
                                color:
                                  riskBorder(
                                    risk.severity
                                  ),
                              }}
                            >
                              {getRiskIcon(
                                risk.severity
                              )}
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                                  style={{
                                    backgroundColor:
                                      riskColor(
                                        risk.severity
                                      ),
                                    color:
                                      riskBorder(
                                        risk.severity
                                      ),
                                  }}
                                >
                                  {getRiskLabel(
                                    risk.severity
                                  )}
                                </span>

                                <span className="text-xs text-slate-400">
                                  {risk.component}
                                </span>
                              </div>

                              <h3 className="mt-2 text-base font-semibold text-slate-900">
                                {risk.title}
                              </h3>
                            </div>
                          </div>
                        </div>

                        <p className="mt-4 text-sm leading-6 text-slate-600">
                          {risk.description}
                        </p>

                        <div className="mt-4 rounded-xl bg-slate-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Why flagged
                          </div>

                          <p className="mt-1 text-sm leading-5 text-slate-700">
                            {reason}
                          </p>
                        </div>

                        {component && (
                          <div className="mt-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Component
                            </div>

                            <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <span className="text-sm font-medium text-slate-800">
                                {component.label}
                              </span>

                              <span className="text-xs text-slate-500">
                                {component.files?.length ??
                                  0}{" "}
                                files
                              </span>
                            </div>
                          </div>
                        )}

                        {evidence.length >
                          0 && (
                          <div className="mt-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Evidence
                            </div>

                            <div className="mt-2 space-y-1.5">
                              {evidence
                                .slice(
                                  0,
                                  5
                                )
                                .map(
                                  (
                                    item,
                                    index
                                  ) => (
                                    <div
                                      key={`${risk.id}_evidence_${index}`}
                                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
                                    >
                                      {item}
                                    </div>
                                  )
                                )}
                            </div>
                          </div>
                        )}

                        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Recommendation
                          </div>

                          <p className="mt-1 text-sm leading-5 text-slate-700">
                            {risk.recommendation}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            Risk Map is an investigation view,
            not another dependency graph. It
            highlights where a developer should
            look more closely and explains the
            evidence behind each hotspot.
          </div>
        </section>
      ) : (
        <>
          {view === "codebase" && (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">
                Codebase Map
              </span>

              <span>
                {representedFileCount} files
              </span>

              <span>
                {internalDependencyCount}{" "}
                internal dependencies
              </span>

              <span>
                Dashed = component
                membership
              </span>

              <span>
                Solid = actual file
                dependency
              </span>
            </div>
          )}

          <div
            className={`overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ${
              view === "codebase"
                ? "min-h-[620px]"
                : "min-h-[480px]"
            }`}
          >
            {svg ? (
              <div
                className={`mx-auto ${
                  view === "codebase"
                    ? "min-w-[1200px]"
                    : "min-w-[850px]"
                } p-6`}
                dangerouslySetInnerHTML={{
                  __html: svg,
                }}
              />
            ) : renderError ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center px-6 text-center">
                <div className="text-sm font-semibold text-slate-700">
                  Unable to render architecture
                  graph.
                </div>

                <div className="mt-3 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-left text-xs leading-5 text-red-700">
                  <div className="font-semibold">
                    Mermaid error:
                  </div>

                  <pre className="mt-2 whitespace-pre-wrap break-words">
                    {renderError}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[480px] items-center justify-center text-sm text-slate-500">
                Rendering architecture...
              </div>
            )}
          </div>

          {view === "codebase" && (
            <p className="text-xs leading-5 text-slate-500">
              The Codebase Map uses concrete
              static-analysis evidence from the
              repository. Component-to-file links
              show which files belong to each
              architectural component, while solid
              arrows represent internal file
              dependencies detected by ArchLens.
            </p>
          )}

          {view === "dependencies" && (
            <p className="text-xs leading-5 text-slate-500">
              Dependency View answers one question:
              <span className="font-semibold text-slate-700">
                {" "}
                what depends on what?
              </span>{" "}
              Relationship labels show how the
              architecture model connects the major
              components.
            </p>
          )}

          {view === "system" && (
            <p className="text-xs leading-5 text-slate-500">
              System View provides a high-level
              picture of the architecture so a new
              developer can understand the major
              components before exploring individual
              dependencies.
            </p>
          )}
        </>
      )}
    </section>
  );
}