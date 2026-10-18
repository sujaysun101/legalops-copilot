import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CONTRACT_TEXT_MAX, CONTRACT_TEXT_MIN } from "@/lib/contract-limits";
import { capMaxTokens, formatZodError, guardDemoRequest, MAX_OUTPUT_TOKENS } from "@/lib/demo-guard";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z
  .object({
    contractText: z
      .string()
      .trim()
      .min(CONTRACT_TEXT_MIN, "Contract text too short")
      .max(CONTRACT_TEXT_MAX, "Contract text is too long"),
  })
  .strict();

export async function POST(req: NextRequest) {
  const blocked = await guardDemoRequest(req);
  if (blocked) return blocked;

  let json: unknown;
  try {
    const raw = await req.text();
    // JSON escaping can expand the body. Reject anything well above one contract.
    if (raw.length > CONTRACT_TEXT_MAX * 6 + 1_024) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 400 });
    }
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { contractText } = parsed.data;

  let message: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: capMaxTokens(MAX_OUTPUT_TOKENS),
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
${contractText}`,
        },
      ],
    });
  } catch {
    // Do not log this error. Provider failures can echo request metadata or credentials.
    return NextResponse.json(
      { error: "The contract analysis could not be completed" },
      { status: 502 },
    );
  }

  const content = message.content[0];
  if (!content || content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    const result = JSON.parse(content.text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to parse analysis" }, { status: 500 });
  }
}
