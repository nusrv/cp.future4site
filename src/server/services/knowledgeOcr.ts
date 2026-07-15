import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { sha256 } from "../security/crypto.js";

export type OcrLanguage = "eng" | "ara" | "eng+ara";

export type OcrPageResult = {
  pageNumber: number;
  content: string;
  contentHash: string;
  characterCount: number;
  confidence: number | null;
  lowConfidence: boolean;
};

export type OcrResult = {
  engineName: string;
  engineVersion: string;
  languages: OcrLanguage;
  durationMs: number;
  averageConfidence: number | null;
  characterCount: number;
  pages: OcrPageResult[];
};

export class KnowledgeOcrError extends Error {
  constructor(public code: string, message: string, public unsupported = false) {
    super(message);
  }
}

export async function runKnowledgeOcr(buffer: Buffer, extension: string, languages: OcrLanguage): Promise<OcrResult> {
  const started = Date.now();
  const normalizedExtension = extension.toLowerCase();
  if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(normalizedExtension)) {
    throw new KnowledgeOcrError("UNSUPPORTED_FILE_TYPE", "OCR supports PDF, PNG, JPEG, and WebP source versions", true);
  }
  const versionOutput = await runCommand(config.KNOWLEDGE_TESSERACT_PATH, ["--version"], null, 8192);
  const engineVersion = versionOutput.toString("utf8").split(/\r?\n/, 1)[0]?.trim() || "unknown";
  const pageBuffers = normalizedExtension === "pdf" ? await rasterizePdf(buffer) : [buffer];
  if (!pageBuffers.length) throw new KnowledgeOcrError("NO_PAGES", "No pages were available for OCR");
  const pages: OcrPageResult[] = [];
  let characterCount = 0;
  for (let index = 0; index < pageBuffers.length; index += 1) {
    const output = await runCommand(
      config.KNOWLEDGE_TESSERACT_PATH,
      ["stdin", "stdout", "-l", languages, "tsv"],
      pageBuffers[index],
      config.KNOWLEDGE_OCR_MAX_CHARS * 8
    );
    const parsed = parseTesseractTsv(output.toString("utf8"), index + 1);
    characterCount += parsed.characterCount;
    if (characterCount > config.KNOWLEDGE_OCR_MAX_CHARS) {
      throw new KnowledgeOcrError("TEXT_LIMIT_EXCEEDED", "OCR text exceeds the configured character limit");
    }
    pages.push(parsed);
  }
  if (characterCount === 0) throw new KnowledgeOcrError("NO_TEXT", "OCR did not find usable text");
  const confidenceValues = pages.map((page) => page.confidence).filter((value): value is number => value !== null);
  return {
    engineName: "tesseract",
    engineVersion,
    languages,
    durationMs: Date.now() - started,
    averageConfidence: confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null,
    characterCount,
    pages
  };
}

function parseTesseractTsv(tsv: string, pageNumber: number): OcrPageResult {
  const lines = new Map<string, string[]>();
  const confidences: number[] = [];
  for (const row of tsv.replace(/\r\n?/g, "\n").split("\n").slice(1)) {
    const fields = row.split("\t");
    if (fields.length < 12) continue;
    const word = fields.slice(11).join("\t").trim();
    const confidence = Number(fields[10]);
    if (!word || !Number.isFinite(confidence) || confidence < 0) continue;
    const lineKey = fields.slice(1, 5).join(":");
    const words = lines.get(lineKey) ?? [];
    words.push(word);
    lines.set(lineKey, words);
    confidences.push(confidence);
  }
  const content = [...lines.values()].map((words) => words.join(" ")).join("\n").trim();
  const confidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : null;
  return {
    pageNumber,
    content,
    contentHash: sha256(Buffer.from(content, "utf8")),
    characterCount: content.length,
    confidence,
    lowConfidence: confidence === null || confidence < config.KNOWLEDGE_OCR_LOW_CONFIDENCE
  };
}

async function rasterizePdf(buffer: Buffer): Promise<Buffer[]> {
  const directory = await mkdtemp(join(tmpdir(), "ff-ocr-"));
  const prefix = join(directory, "page");
  try {
    await runCommand(
      config.KNOWLEDGE_PDFTOPPM_PATH,
      ["-png", "-r", "200", "-f", "1", "-l", String(config.KNOWLEDGE_OCR_MAX_PAGES), "-", prefix],
      buffer,
      8192
    );
    const files = (await readdir(directory))
      .filter((file) => /^page-\d+\.png$/.test(file))
      .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0]));
    let rasterBytes = 0;
    for (const file of files) {
      rasterBytes += (await stat(join(directory, file))).size;
      if (rasterBytes > config.KNOWLEDGE_OCR_MAX_RASTER_BYTES) {
        throw new KnowledgeOcrError("RASTER_LIMIT_EXCEEDED", "Rasterized PDF pages exceed the configured byte limit");
      }
    }
    return Promise.all(files.map((file) => readFile(join(directory, file))));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runCommand(executable: string, args: string[], input: Buffer | null, maxOutputBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const output: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new KnowledgeOcrError("OCR_TIMEOUT", "OCR processing timed out")));
    }, config.KNOWLEDGE_OCR_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        child.kill();
        finish(() => reject(new KnowledgeOcrError("OUTPUT_LIMIT_EXCEEDED", "OCR process output exceeded its configured limit")));
        return;
      }
      output.push(chunk);
    });
    child.stderr.on("data", () => undefined);
    child.on("error", () => finish(() => reject(new KnowledgeOcrError(
      "OCR_ENGINE_UNAVAILABLE",
      "The configured OCR engine is unavailable",
      true
    ))));
    child.on("close", (code) => finish(() => {
      if (code !== 0) {
        reject(new KnowledgeOcrError("OCR_PROCESS_FAILED", "OCR processing failed"));
        return;
      }
      resolve(Buffer.concat(output));
    }));
    child.stdin.on("error", () => undefined);
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}
