import { NextResponse } from "next/server";
import { getRepositoryFiles } from "@/lib/github";
import { analyzeRepository } from "@/lib/analyzer";
import { analyzeWithGroq } from "@/lib/groq";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = String(body?.url || "").trim();

    if (!url) {
      return NextResponse.json(
        { success: false, error: "GitHub repository URL is required." },
        { status: 400 }
      );
    }

    const repository = await getRepositoryFiles(url);
    const staticAnalysis = analyzeRepository(repository.files);
    const architecture = await analyzeWithGroq(staticAnalysis);

    return NextResponse.json({
      success: true,
      repository: {
        owner: repository.owner,
        name: repository.repo,
        url,
      },
      architecture,
    });
  } catch (error) {
    console.error("Analyze error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze repository.",
      },
      { status: 500 }
    );
  }
}
