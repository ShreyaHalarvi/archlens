import { NextResponse } from "next/server";
import type { Architecture } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const architecture = body.architecture as Architecture | undefined;

    if (!architecture) {
      return NextResponse.json(
        { error: "Architecture is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is missing." },
        { status: 500 }
      );
    }

    const compactArchitecture = {
      summary: architecture.summary,

      metrics: architecture.metrics,

      nodes: architecture.nodes.slice(0, 12).map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        description: node.description,
        files: node.files.slice(0, 8),
      })),

      edges: architecture.edges.slice(0, 30).map((edge) => ({
        source: edge.source,
        target: edge.target,
        relationship: edge.relationship,
      })),

      entryPoints: architecture.entryPoints.slice(0, 10),

      risks: architecture.risks.slice(0, 8).map((risk) => ({
        title: risk.title,
        severity: risk.severity,
        component: risk.component,
        description: risk.description,
      })),
    };

    const prompt = `
You are ArchLens, an architecture onboarding assistant.

Analyze the provided repository architecture evidence and create a concise developer briefing.

Your response MUST use exactly these Markdown sections:

## Architecture Pattern

Identify the overall architectural structure in 1-2 sentences.

## Request / Data Flow

Show the main flow as a short arrow chain using the actual components.

Example:
API → Service → Database → Response

## Key Components

Give 3-6 bullet points.

Each bullet should contain:
- component name
- role
- important files when useful

## Developer Starting Points

Give 3-5 numbered steps telling a new developer what to inspect first.

## Architecture Notes

Give 2-4 concise bullets about important dependencies, entry points, or structural risks.

Rules:
- Stay grounded in the supplied evidence.
- Do not invent files, components, dependencies, or behavior.
- Prefer actual component names from the evidence.
- Use actual file paths from the evidence.
- Do not write a generic software architecture tutorial.
- Do not include greetings or a conclusion.
- Keep the response under 700 words.
- Use Markdown formatting.
- Use inline code for file paths.
- If evidence is insufficient for a claim, omit the claim.

Repository architecture evidence:

${JSON.stringify(compactArchitecture, null, 2)}
`;

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
                "You are a concise software architecture onboarding assistant. Stay strictly grounded in the supplied repository evidence.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],

          temperature: 0,

          max_completion_tokens: 1400,

          reasoning_effort: "low",

          reasoning_format: "hidden",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Groq request failed: ${errorText}`
      );
    }

    const data = await response.json();

    const explanation =
      data.choices?.[0]?.message?.content;

    if (!explanation) {
      throw new Error(
        "Groq returned an empty architecture explanation."
      );
    }

    return NextResponse.json({
      explanation,
    });
  } catch (error) {
    console.error("Explain route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate architecture explanation.",
      },
      { status: 500 }
    );
  }
}