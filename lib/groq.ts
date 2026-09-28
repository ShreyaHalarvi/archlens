import type { Architecture } from "./types";

export async function analyzeWithGroq(
  repositoryData: unknown
): Promise<Architecture> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const repositoryText = JSON.stringify(repositoryData).slice(0, 50000);

  const prompt = `
You are an expert software architect.

Analyze the repository information below.

Identify the major architectural components, their responsibilities,
the files that belong to each component, and the relationships between
the components.

Focus on meaningful architectural components rather than individual
functions.

Return the architecture using the required JSON schema.

Repository information:

${repositoryText}
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

        temperature: 0.1,

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
    const errorText = await response.text();

    throw new Error(`Groq request failed: ${errorText}`);
  }

  const data = await response.json();

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty architecture response.");
  }

  return JSON.parse(content);
}