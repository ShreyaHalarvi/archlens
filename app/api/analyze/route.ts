import { NextRequest, NextResponse } from "next/server";
import { getRepositoryFiles } from "@/lib/github";
import { analyzeRepository } from "@/lib/analyzer";
import { analyzeWithGroq } from "@/lib/groq";
import type { Architecture, ArchitectureNode } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const url =
      typeof body?.url === "string"
        ? body.url.trim()
        : "";

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a GitHub repository URL.",
        },
        { status: 400 }
      );
    }

    if (
      !/^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(
        url
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please enter a valid GitHub repository URL.",
        },
        { status: 400 }
      );
    }

    /*
     * Step 1:
     * Fetch repository source files.
     */
    const repositoryFiles =
      await getRepositoryFiles(url);

    if (!repositoryFiles.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No supported source files were found in this repository.",
        },
        { status: 400 }
      );
    }

    /*
     * Step 2:
     * Run deterministic static analysis.
     */
    const analysis =
      analyzeRepository(repositoryFiles);

    /*
     * Step 3:
     * Send the STATIC ANALYSIS to Groq.
     *
     * IMPORTANT:
     * We send `analysis`, not `repositoryFiles`.
     */
    const architecture =
      await analyzeWithGroq(analysis);

    /*
     * Step 4:
     * Attach concrete static-analysis evidence.
     */
    const enrichedArchitecture: Architecture = {
      ...architecture,

      files: analysis.files ?? [],

      dependencies:
        analysis.dependencies ?? [],
    };

    /*
     * Safety fallback:
     * If Groq returns zero components,
     * create components from the detected layers.
     */
    if (
      !enrichedArchitecture.nodes ||
      enrichedArchitecture.nodes.length === 0
    ) {
      enrichedArchitecture.nodes =
        createFallbackNodes(analysis);
    }

    return NextResponse.json({
      success: true,

      repository: url,

      fileCount:
        repositoryFiles.length,

      architecture:
        enrichedArchitecture,
    });
  } catch (error) {
    console.error(
      "Repository analysis failed:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to analyze the repository.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

/**
 * Fallback architecture.
 *
 * Used only if Groq returns zero components.
 */
function createFallbackNodes(
  analysis: any
): ArchitectureNode[] {
  const groups =
    new Map<string, string[]>();

  for (const file of analysis.files ?? []) {
    const layer =
      typeof file.layer === "string" &&
      file.layer.trim()
        ? file.layer
        : "other";

    if (!groups.has(layer)) {
      groups.set(layer, []);
    }

    groups.get(layer)!.push(file.path);
  }

  /*
   * Explicitly type the array.
   *
   * This prevents TypeScript from widening
   * `type` into a generic string.
   */
  const nodes: ArchitectureNode[] = [];

  for (const [layer, files] of groups) {
    let type: ArchitectureNode["type"] =
      "other";

    if (layer === "api") {
      type = "api";
    } else if (layer === "service") {
      type = "service";
    } else if (layer === "model") {
      type = "model";
    } else if (layer === "middleware") {
      type = "middleware";
    } else if (layer === "utility") {
      type = "utility";
    } else if (layer === "test") {
      type = "test";
    } else if (layer === "data") {
      type = "database";
    }

    nodes.push({
      id: `fallback_${layer}`,

      label:
        layer.charAt(0).toUpperCase() +
        layer.slice(1),

      type,

      files,

      description:
        `${files.length} file${
          files.length === 1
            ? ""
            : "s"
        } detected in the ${layer} layer.`,
    });
  }

  /*
   * If layer detection produced nothing,
   * create one component from all files.
   */
  if (
    nodes.length === 0 &&
    analysis.files?.length
  ) {
    nodes.push({
      id: "fallback_codebase",

      label: "Codebase",

      type: "other",

      files: analysis.files.map(
        (file: any) => file.path
      ),

      description:
        "Files detected by static repository analysis.",
    });
  }

  return nodes;
}