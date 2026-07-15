import { spawn } from "node:child_process";
import { config } from "../config.js";
import { sha256 } from "../security/crypto.js";

export type ExtractedFragment = {
  ordinal: number;
  pageNumber: number | null;
  sectionHeading: string | null;
  content: string;
  contentHash: string;
  characterCount: number;
};

export type ExtractionResult = {
  extractorName: string;
  extractorVersion: string;
  pageCount: number | null;
  contentHash: string;
  characterCount: number;
  fragments: ExtractedFragment[];
};

export class KnowledgeExtractionError extends Error {
  constructor(public code: string, message: string, public unsupported = false) {
    super(message);
  }
}

export async function extractKnowledgeText(buffer: Buffer, extension: string): Promise<ExtractionResult> {
  const normalizedExtension = extension.toLowerCase();
  if (normalizedExtension === "txt" || normalizedExtension === "csv") {
    return buildResult(decodeUtf8(buffer), normalizedExtension === "csv" ? "builtin-csv" : "builtin-text", "1", false);
  }
  if (normalizedExtension === "pdf") {
    const text = await extractPdfWithPoppler(buffer);
    return buildResult(text, "poppler-pdftotext", "external", true);
  }
  throw new KnowledgeExtractionError("UNSUPPORTED_FILE_TYPE", "This file type does not support deterministic text extraction", true);
}

function decodeUtf8(buffer: Buffer) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  if (text.includes("\0")) throw new KnowledgeExtractionError("BINARY_TEXT", "The text file contains binary data");
  return text;
}

function buildResult(raw: string, extractorName: string, extractorVersion: string, pageAware: boolean): ExtractionResult {
  const normalized = raw.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim();
  if (!normalized) throw new KnowledgeExtractionError("NO_TEXT", "No usable text was found");
  if (normalized.length > config.KNOWLEDGE_EXTRACTION_MAX_CHARS) {
    throw new KnowledgeExtractionError("TEXT_LIMIT_EXCEEDED", "Extracted text exceeds the configured character limit");
  }
  const pages = pageAware ? normalized.split(/\f+/) : [normalized];
  const fragments = pages.map((page, pageIndex) => ({ content: page.trim(), pageIndex }))
    .filter(({ content }) => Boolean(content))
    .map(({ content, pageIndex }, fragmentIndex) => ({
    ordinal: fragmentIndex + 1,
    pageNumber: pageAware ? pageIndex + 1 : null,
    sectionHeading: null,
    content,
    contentHash: sha256(Buffer.from(content, "utf8")),
    characterCount: content.length
  }));
  if (!fragments.length) throw new KnowledgeExtractionError("NO_TEXT", "No usable text was found");
  return {
    extractorName,
    extractorVersion,
    pageCount: pageAware ? pages.length : null,
    contentHash: sha256(Buffer.from(normalized, "utf8")),
    characterCount: normalized.length,
    fragments
  };
}

function extractPdfWithPoppler(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.KNOWLEDGE_PDFTOTEXT_PATH, ["-layout", "-enc", "UTF-8", "-", "-"], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    let errorBytes = 0;
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
      finish(() => reject(new KnowledgeExtractionError("EXTRACTION_TIMEOUT", "PDF extraction timed out")));
    }, config.KNOWLEDGE_EXTRACTION_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > config.KNOWLEDGE_EXTRACTION_MAX_CHARS * 4) {
        child.kill();
        finish(() => reject(new KnowledgeExtractionError("OUTPUT_LIMIT_EXCEEDED", "PDF extraction output exceeded the configured limit")));
        return;
      }
      output.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (errorBytes >= 4096) return;
      const retained = chunk.subarray(0, 4096 - errorBytes);
      errors.push(retained);
      errorBytes += retained.length;
    });
    child.on("error", () => finish(() => reject(new KnowledgeExtractionError(
      "PDF_EXTRACTOR_UNAVAILABLE",
      "The configured PDF text extractor is unavailable",
      true
    ))));
    child.on("close", (code) => finish(() => {
      if (code !== 0) {
        reject(new KnowledgeExtractionError("PDF_EXTRACTION_FAILED", "PDF text extraction failed"));
        return;
      }
      resolve(Buffer.concat(output).toString("utf8"));
    }));
    child.stdin.on("error", () => undefined);
    child.stdin.end(buffer);
  });
}
