import { z } from "zod";
import { config } from "../config.js";
import { sha256 } from "../security/crypto.js";

export type CandidateInputFragment = {
  id: string;
  pageNumber: number | null;
  content: string;
};

const providerCandidateSchema = z.object({
  stableKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/),
  claimType: z.string().trim().min(2).max(120),
  confidence: z.number().min(0).max(1),
  explanation: z.string().trim().max(2000),
  translations: z.array(z.object({
    locale: z.enum(["en", "ar"]),
    wording: z.string().trim().min(2).max(5000)
  }).strict()).min(1).max(2),
  sources: z.array(z.object({
    fragmentId: z.string(),
    sourceExcerpt: z.string().trim().max(500).optional()
  }).strict()).min(1).max(10)
}).strict();

const providerOutputSchema = z.object({
  candidates: z.array(providerCandidateSchema).max(50)
}).strict();

export type GeneratedCandidate = z.infer<typeof providerCandidateSchema>;

export type CandidateGenerationResult = {
  provider: "gemini";
  model: string;
  promptVersion: string;
  inputHash: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  candidates: GeneratedCandidate[];
};

export class KnowledgeCandidateError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const promptVersion = "knowledge-candidates-v1";

export async function generateKnowledgeCandidates(fragments: CandidateInputFragment[]): Promise<CandidateGenerationResult> {
  if (!fragments.length) throw new KnowledgeCandidateError("NO_SOURCE_FRAGMENTS", "At least one source fragment is required");
  if (fragments.length > config.KNOWLEDGE_CANDIDATE_MAX_FRAGMENTS) {
    throw new KnowledgeCandidateError("FRAGMENT_LIMIT_EXCEEDED", "Too many source fragments were selected");
  }
  const sourcePayload = fragments.map((fragment) => ({
    fragmentId: fragment.id,
    pageNumber: fragment.pageNumber,
    text: fragment.content
  }));
  const serializedSource = JSON.stringify(sourcePayload);
  if (serializedSource.length > config.KNOWLEDGE_CANDIDATE_MAX_INPUT_CHARS) {
    throw new KnowledgeCandidateError("INPUT_LIMIT_EXCEEDED", "Selected source text exceeds the configured provider limit");
  }
  const prompt = [
    "You propose factual claim candidates for human review.",
    "Use only facts directly supported by the supplied fragments.",
    "Do not infer usage scope, applicability, approval, or missing translations.",
    "Every candidate must cite one or more supplied fragmentId values.",
    "Keep source excerpts short. Return no candidate when support is ambiguous.",
    "Arabic and English wording are unapproved suggestions and must remain faithful to the same fact.",
    "Source fragments:",
    serializedSource
  ].join("\n");
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.KNOWLEDGE_CANDIDATE_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(config.KNOWLEDGE_GEMINI_MODEL) + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": config.GEMINI_API_KEY },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                candidates: {
                  type: "ARRAY",
                  maxItems: config.KNOWLEDGE_CANDIDATE_MAX_COUNT,
                  items: {
                    type: "OBJECT",
                    properties: {
                      stableKey: { type: "STRING" },
                      claimType: { type: "STRING" },
                      confidence: { type: "NUMBER" },
                      explanation: { type: "STRING" },
                      translations: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: { locale: { type: "STRING", enum: ["en", "ar"] }, wording: { type: "STRING" } },
                          required: ["locale", "wording"]
                        }
                      },
                      sources: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: { fragmentId: { type: "STRING" }, sourceExcerpt: { type: "STRING" } },
                          required: ["fragmentId"]
                        }
                      }
                    },
                    required: ["stableKey", "claimType", "confidence", "explanation", "translations", "sources"]
                  }
                }
              },
              required: ["candidates"]
            }
          }
        })
      }
    );
  } catch (error) {
    throw new KnowledgeCandidateError(
      error instanceof Error && error.name === "AbortError" ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
      error instanceof Error && error.name === "AbortError" ? "Candidate generation timed out" : "Candidate provider is unavailable"
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new KnowledgeCandidateError("PROVIDER_REJECTED", "Candidate provider rejected the request");
  const raw = await response.json() as any;
  const text = raw.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? "").join("") ?? "";
  if (!text || text.length > 250000) throw new KnowledgeCandidateError("INVALID_PROVIDER_OUTPUT", "Candidate provider returned invalid output");
  let parsed: z.infer<typeof providerOutputSchema>;
  try {
    parsed = providerOutputSchema.parse(JSON.parse(text));
  } catch {
    throw new KnowledgeCandidateError("INVALID_PROVIDER_OUTPUT", "Candidate provider returned invalid structured output");
  }
  if (parsed.candidates.length > config.KNOWLEDGE_CANDIDATE_MAX_COUNT) {
    throw new KnowledgeCandidateError("CANDIDATE_LIMIT_EXCEEDED", "Candidate provider returned too many proposals");
  }
  const allowedIds = new Set(fragments.map((fragment) => fragment.id));
  for (const candidate of parsed.candidates) {
    if (new Set(candidate.translations.map((translation) => translation.locale)).size !== candidate.translations.length) {
      throw new KnowledgeCandidateError("INVALID_PROVIDER_OUTPUT", "Candidate provider repeated a locale");
    }
    if (candidate.sources.some((source) => !allowedIds.has(source.fragmentId))) {
      throw new KnowledgeCandidateError("INVALID_PROVENANCE", "Candidate provider cited an unknown source fragment");
    }
  }
  return {
    provider: "gemini",
    model: config.KNOWLEDGE_GEMINI_MODEL,
    promptVersion,
    inputHash: sha256(Buffer.from(serializedSource, "utf8")),
    inputTokens: Number.isInteger(raw.usageMetadata?.promptTokenCount) ? raw.usageMetadata.promptTokenCount : null,
    outputTokens: Number.isInteger(raw.usageMetadata?.candidatesTokenCount) ? raw.usageMetadata.candidatesTokenCount : null,
    durationMs: Date.now() - started,
    candidates: parsed.candidates
  };
}
