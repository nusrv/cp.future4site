import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { config } from "../config.js";
import { sha256 } from "../security/crypto.js";

export type StoredFile = {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
};

const allowedMime = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "application/pdf",
  "text/plain",
  "application/json"
]);

export async function saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile> {
  if (!allowedMime.has(mimeType)) throw new Error("Unsupported file type");
  if (buffer.length > config.MAX_UPLOAD_MB * 1024 * 1024) throw new Error("File too large");
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storageKey = `${new Date().toISOString().slice(0, 10)}/${nanoid(16)}-${safeName}`;
  if (config.FILE_STORAGE_DRIVER === "mock") {
    return { storageKey: `mock://${storageKey}`, originalName, mimeType, sizeBytes: buffer.length, sha256Hash: sha256(buffer) };
  }
  const target = path.resolve(config.FILE_STORAGE_PATH, storageKey);
  const root = path.resolve(config.FILE_STORAGE_PATH);
  if (!target.startsWith(root)) throw new Error("Invalid storage path");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return { storageKey, originalName, mimeType, sizeBytes: buffer.length, sha256Hash: sha256(buffer) };
}

export async function readFile(storageKey: string): Promise<Buffer> {
  if (config.FILE_STORAGE_DRIVER !== "local") throw new Error("Stored file preview is unavailable for this storage driver");
  const root = path.resolve(config.FILE_STORAGE_PATH);
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) throw new Error("Invalid storage path");
  return fs.readFile(target);
}
