"use client";

import type { Architecture, ArchitectureNode } from "@/lib/types";

type OnboardingGuideProps = {
  architecture: Architecture;
};

type Step = {
  number: string;
  title: string;
  component: ArchitectureNode;
  reason: string;
};

export default function OnboardingGuide({
  architecture,
}: OnboardingGuideProps) {
  const nodes = architecture.nodes;

  if (!nodes.length) {
    return null;
  }

  const findNode = (patterns: string[]) => {
    return nodes.find((node) => {
      const value =
        `${node.id} ${node.label} ${node.type}`.toLowerCase();

      return patterns.some((pattern) =>
        value.includes(pattern)
      );
    });
  };

  const entryNode =
    findNode([
      "api",
      "route",
      "controller",
      "endpoint",
      "entry",
    ]) ||
    nodes
      .filter((node) => node.type !== "test")
      .sort((a, b) => {
        const aOutgoing = architecture.edges.filter(
          (edge) => edge.source === a.id
        ).length;

        const bOutgoing = architecture.edges.filter(
          (edge) => edge.source === b.id
        ).length;

        return bOutgoing - aOutgoing;
      })[0] ||
    nodes[0];

  const connectedIds = new Set<string>();

  architecture.edges.forEach((edge) => {
    if (edge.source === entryNode.id) {
      connectedIds.add(edge.target);
    }

    if (edge.target === entryNode.id) {
      connectedIds.add(edge.source);
    }
  });

  const connectedNodes = nodes.filter(
    (node) =>
      connectedIds.has(node.id) &&
      node.id !== entryNode.id &&
      node.type !== "test"
  );

  const preferredOrder = [
    "model",
    "middleware",
    "service",
    "database",
    "utility",
    "other",
  ];

  const supportingNodes = connectedNodes.sort((a, b) => {
    const aIndex = preferredOrder.indexOf(a.type);
    const bIndex = preferredOrder.indexOf(b.type);

    return (
      (aIndex === -1 ? 99 : aIndex) -
      (bIndex === -1 ? 99 : bIndex)
    );
  });

  const testNode =
    nodes.find((node) => node.type === "test") ||
    findNode(["test", "tests"]);

  const selectedNodes = [
    entryNode,
    ...supportingNodes,
    ...(testNode ? [testNode] : []),
  ];

  const uniqueNodes = selectedNodes.filter(
    (node, index, array) =>
      array.findIndex((item) => item.id === node.id) ===
      index
  );

  const steps: Step[] = uniqueNodes
    .slice(0, 5)
    .map((node, index) => ({
      number: String(index + 1).padStart(2, "0"),
      title:
        index === 0
          ? "Start here"
          : index === uniqueNodes.length - 1 &&
              node.type === "test"
            ? "Validate your understanding"
            : `Understand ${node.label}`,
      component: node,
      reason: getReason(
        node,
        index,
        entryNode,
        architecture
      ),
    }));

  return (
    <section className="mt-12 border-t border-white/10 pt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel text="DEVELOPER ONBOARDING" />

          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            Know where to start.
          </h3>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            A guided exploration path generated from the analyzed
            architecture and dependency structure.
          </p>
        </div>

        <div className="rounded-full border border-green-400/10 bg-green-400/[0.05] px-3 py-1.5 text-xs text-green-400">
          {steps.length} steps
        </div>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-5">
        {steps.map((step) => (
          <div
            key={`${step.number}-${step.component.id}`}
            className="relative rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-gray-600">
                {step.number}
              </span>

              <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] uppercase tracking-wider text-gray-500">
                {step.component.type}
              </span>
            </div>

            <h4 className="mt-6 text-sm font-semibold">
              {step.title}
            </h4>

            <p className="mt-2 text-sm font-medium text-gray-300">
              {step.component.label}
            </p>

            <p className="mt-3 text-xs leading-5 text-gray-500">
              {step.reason}
            </p>

            {step.component.files.length > 0 && (
              <div className="mt-5 border-t border-white/5 pt-4">
                <p className="mb-2 text-[9px] font-medium tracking-wider text-gray-600">
                  FIRST FILE TO OPEN
                </p>

                <p
                  className="truncate font-mono text-[10px] text-gray-500"
                  title={step.component.files[0]}
                >
                  {step.component.files[0]}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.015] px-5 py-4">
        <div className="flex gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-black">
            →
          </div>

          <div>
            <p className="text-sm font-medium">
              Recommended exploration strategy
            </p>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              Start at the public-facing entry point, follow its
              connected components, then inspect tests to see how
              the architecture is actually exercised.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function getReason(
  node: ArchitectureNode,
  index: number,
  entryNode: ArchitectureNode,
  architecture: Architecture
) {
  if (index === 0) {
    return node.id === entryNode.id
      ? "The likely public entry point. Start here to understand how requests enter the system."
      : "The strongest available starting component based on the detected dependency structure.";
  }

  if (node.type === "test") {
    return "Tests reveal how the system is expected to behave and connect the major components.";
  }

  const incoming = architecture.edges.filter(
    (edge) => edge.target === node.id
  ).length;

  const outgoing = architecture.edges.filter(
    (edge) => edge.source === node.id
  ).length;

  if (node.type === "model") {
    return "Understand the data structures used by the surrounding components.";
  }

  if (node.type === "middleware") {
    return "Inspect this next to understand cross-cutting behavior such as authentication or request processing.";
  }

  if (node.type === "utility") {
    return "These helpers are reused by other components, so understanding them clarifies lower-level behavior.";
  }

  if (outgoing > incoming) {
    return "This component connects to several parts of the system, making it useful for understanding downstream behavior.";
  }

  if (incoming > outgoing) {
    return "Several components depend on this area, so understanding it explains an important part of the dependency structure.";
  }

  return (
    node.description ||
    "Inspect this component to understand its role in the overall architecture."
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[10px] font-medium tracking-[0.2em] text-gray-600">
      {text}
    </p>
  );
}