import path from "node:path";
import { config } from "../config.js";

const allowed = {
  pdf: { mimeType: "application/pdf", declared: ["application/pdf"] },
  txt: { mimeType: "text/plain", declared: ["text/plain"] },
  csv: { mimeType: "text/csv", declared: ["text/csv", "application/csv"] },
  png: { mimeType: "image/png", declared: ["image/png"] },
  jpg: { mimeType: "image/jpeg", declared: ["image/jpeg", "image/jpg"] },
  jpeg: { mimeType: "image/jpeg", declared: ["image/jpeg", "image/jpg"] },
  webp: { mimeType: "image/webp", declared: ["image/webp"] }
} as const;

export const knowledgeFileExtensions = Object.keys(allowed);
export const knowledgeFileMimeTypes = [...new Set(Object.values(allowed).flatMap((entry) => [...entry.declared]))];

export type VerifiedKnowledgeFile = {
  originalName: string;
  extension: keyof typeof allowed;
  declaredMimeType: string;
  detectedMimeType: string;
  securityStatus: "SCAN_UNAVAILABLE";
};

export function verifyKnowledgeFile(buffer: Buffer, originalName: string, declaredMimeType: string): VerifiedKnowledgeFile {
  if (!buffer.length) throw new Error("Uploaded file is empty");
  if (buffer.length > config.MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`File exceeds the ${config.MAX_UPLOAD_MB} MB upload limit`);

  const leafName = originalName.replace(/\\/g, "/").split("/").pop() || "document";
  const extension = path.extname(leafName).slice(1).toLowerCase() as keyof typeof allowed;
  const rule = allowed[extension];
  if (!rule) throw new Error("Unsupported file extension");

  const normalizedDeclared = declaredMimeType.trim().toLowerCase();
  if (!(rule.declared as readonly string[]).includes(normalizedDeclared)) {
    throw new Error("Declared MIME type does not match the file extension");
  }

  const detectedMimeType = detectMimeType(buffer, extension);
  if (detectedMimeType !== rule.mimeType) throw new Error("Detected file type does not match the declared MIME type");

  return {
    originalName: sanitizeOriginalFilename(leafName, extension),
    extension,
    declaredMimeType: normalizedDeclared,
    detectedMimeType,
    securityStatus: "SCAN_UNAVAILABLE"
  };
}

function detectMimeType(buffer: Buffer, extension: keyof typeof allowed) {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (extension === "txt" || extension === "csv") {
    assertSafeUtf8Text(buffer);
    return extension === "csv" ? "text/csv" : "text/plain";
  }
  return "application/octet-stream";
}

function assertSafeUtf8Text(buffer: Buffer) {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new Error("Text files must contain valid UTF-8");
  }
  if (text.includes("\0")) throw new Error("Text file contains binary content");
  const unsafeControls = [...text].filter((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && !["\n", "\r", "\t"].includes(character);
  });
  if (unsafeControls.length) throw new Error("Text file contains unsafe control characters");
}

function sanitizeOriginalFilename(originalName: string, extension: keyof typeof allowed) {
  const withoutExtension = originalName.slice(0, Math.max(0, originalName.length - path.extname(originalName).length));
  const safeBase = withoutExtension
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._() -]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 100) || "document";
  return `${safeBase}.${extension}`;
}
