import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { contractText } = await req.json();
  if (!contractText || contractText.trim().length < 50) {
    return NextResponse.json({ error: "Contract text too short" }, { status: 400 });
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are an expert contract lawyer. Analyze this contract and return a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary",
  "overallRisk": "low",
  "risks": [
    {
      "clause": "exact quote from contract (max 100 chars)",
      "severity": "low",
      "issue": "what is wrong with this clause",
      "suggestion": "how to fix or redline it"
    }
  ],
  "missingClauses": ["list of important clauses that are absent"],
  "positives": ["list of well-drafted provisions"]
}

overallRisk must be one of: low, medium, high
severity must be one of: low, medium, high, critical

Return ONLY valid JSON, no markdown, no explanation.

CONTRACT:
${contractText.slice(0, 8000)}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") return NextResponse.json({ error: "Unexpected response" }, { status: 500 });

  try {
    const result = JSON.parse(content.text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to parse analysis" }, { status: 500 });
  }
}
