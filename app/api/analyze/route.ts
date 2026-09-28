import { NextResponse } from "next/server";
import { getRepositoryFiles } from "@/lib/github";
import { analyzeRepository } from "@/lib/analyzer";
import { analyzeWithGroq } from "@/lib/groq";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = body.url;

    if (!url) {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    // Step 1: Fetch repository files
    const files = await getRepositoryFiles(url);

    // Step 2: Analyze imports and dependencies
    const analysis = analyzeRepository(files);

    // Step 3: Ask Groq to understand the architecture
    const architecture = await analyzeWithGroq(analysis);

    return NextResponse.json({
      success: true,
      repository: url,
      fileCount: files.length,
      architecture,
    });
  } catch (error) {
    console.error("Repository analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze repository",
      },
      { status: 500 }
    );
  }
}