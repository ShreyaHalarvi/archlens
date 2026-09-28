import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const architecture = body.architecture;

    if (!architecture) {
      return NextResponse.json(
        { error: "Architecture data is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is missing" },
        { status: 500 }
      );
    }

    const prompt = `
You are an expert software architect.

Explain the following software architecture to a developer
who is new to this codebase.

Architecture:

${JSON.stringify(architecture, null, 2)}

Provide a concise explanation covering:

1. Overall architecture
2. Main components and their responsibilities
3. How the components interact
4. Important dependencies or data flow
5. Where a new developer should start exploring the codebase

Keep the explanation practical and easy to understand.

Do not invent components or behavior that are not present
in the provided architecture.
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
              role: "user",
              content: prompt,
            },
          ],

          temperature: 0.2,

          reasoning_effort: "low",

          reasoning_format: "hidden",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Groq request failed: ${errorText}`);
    }

    const data = await response.json();

    const explanation = data.choices?.[0]?.message?.content;

    if (!explanation) {
      throw new Error("Groq returned an empty explanation.");
    }

    return NextResponse.json({
      success: true,
      explanation,
    });
  } catch (error) {
    console.error("Architecture explanation error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to explain architecture",
      },
      { status: 500 }
    );
  }
}