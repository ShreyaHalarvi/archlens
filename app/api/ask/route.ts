import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const architecture = body.architecture;
    const question = body.question;

    if (!architecture) {
      return NextResponse.json(
        { error: "Architecture data is required" },
        { status: 400 }
      );
    }

    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
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
You are ArchLens, an AI software architecture assistant.

A developer is exploring an existing codebase and has asked a question
about its architecture.

Use ONLY the architecture information provided below.

Do not invent files, components, dependencies, or behavior that is not
supported by the provided information.

Architecture:
${JSON.stringify(architecture, null, 2)}

Developer question:
${question}

Answer clearly and practically.

If the architecture information is not sufficient to answer the
question with confidence, explicitly say that the available
architecture information is insufficient.

Mention relevant components and files when they are available.
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

    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error("Groq returned an empty answer.");
    }

    return NextResponse.json({
      success: true,
      answer,
    });
  } catch (error) {
    console.error("Codebase Q&A error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to answer the question",
      },
      { status: 500 }
    );
  }
}