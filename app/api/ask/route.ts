import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { architecture, question } = await request.json();

    if (!architecture) {
      return NextResponse.json(
        { success: false, error: "Architecture data is required." },
        { status: 400 }
      );
    }

    if (!question?.trim()) {
      return NextResponse.json(
        { success: false, error: "Question is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GROQ_API_KEY is missing." },
        { status: 500 }
      );
    }

    const context = {
      summary: architecture.summary,
      nodes: (architecture.nodes || []).slice(0, 25).map((node: any) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        files: (node.files || []).slice(0, 8),
        description: node.description,
      })),
      edges: (architecture.edges || []).slice(0, 50),
      metrics: architecture.metrics,
      risks: (architecture.risks || []).slice(0, 8),
    };

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
                "You are ArchLens, a precise software architecture assistant. Answer only from the supplied architecture.",
            },
            {
              role: "user",
              content: `Developer question:\n${question}\n\nArchitecture evidence:\n${JSON.stringify(context)}\n\nDo not invent files, components, dependencies, or implementation details. If the evidence is insufficient, say so.`,
            },
          ],
          temperature: 0.2,
          max_completion_tokens: 1000,
          reasoning_effort: "low",
          reasoning_format: "hidden",
        }),
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: extractGroqError(text),
        },
        { status: response.status }
      );
    }

    const data = JSON.parse(text);
    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error("Groq returned an empty answer.");
    }

    return NextResponse.json({
      success: true,
      answer: answer.trim(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to answer the question.",
      },
      { status: 500 }
    );
  }
}

function extractGroqError(text: string) {
  try {
    return JSON.parse(text)?.error?.message || "Groq request failed.";
  } catch {
    return "Groq request failed.";
  }
}
