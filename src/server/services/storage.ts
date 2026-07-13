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

export const storageNamespaces = ["default", "knowledge-base"] as const;
export type StorageNamespace = (typeof storageNamespaces)[number];

export type SaveFileOptions =
  | { namespace?: "default" }
  | { namespace: "knowledge-base"; documentId: string; versionId: string; extension: string };

const allowedMime = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json"
]);

export async function saveFile(buffer: Buffer, originalName: string, mimeType: string, options: SaveFileOptions = {}): Promise<StoredFile> {
  if (!allowedMime.has(mimeType)) throw new Error("Unsupported file type");
  if (buffer.length > config.MAX_UPLOAD_MB * 1024 * 1024) throw new Error("File too large");
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const namespace = options.namespace ?? "default";
  if (!storageNamespaces.includes(namespace)) throw new Error("Unsupported storage namespace");
  let storageKey: string;
  if (options.namespace === "knowledge-base") {
    assertStorageSegment(options.documentId, "document ID");
    assertStorageSegment(options.versionId, "version ID");
    const extension = options.extension.toLowerCase();
    if (!/^[a-z0-9]{1,10}$/.test(extension)) throw new Error("Invalid file extension");
    const now = new Date();
    storageKey = ["knowledge-base", String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"), options.documentId, options.versionId, `${nanoid(24)}.${extension}`].join("/");
  } else {
    const category = mimeType.startsWith("image/") ? "images" : mimeType.startsWith("video/") ? "videos" : "files";
    storageKey = `${category}/${new Date().toISOString().slice(0, 10)}/${nanoid(16)}-${safeName}`;
  }
  if (config.FILE_STORAGE_DRIVER === "mock") {
    return { storageKey: `mock://${storageKey}`, originalName, mimeType, sizeBytes: buffer.length, sha256Hash: sha256(buffer) };
  }
  const target = path.resolve(config.FILE_STORAGE_PATH, storageKey);
  const root = path.resolve(config.FILE_STORAGE_PATH);
  if (!isWithinStorageRoot(root, target)) throw new Error("Invalid storage path");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return { storageKey, originalName, mimeType, sizeBytes: buffer.length, sha256Hash: sha256(buffer) };
}

function assertStorageSegment(value: string, label: string) {
  if (!/^[a-zA-Z0-9_-]{1,191}$/.test(value)) throw new Error(`Invalid ${label}`);
}

export function isWithinStorageRoot(root: string, target: string) {
  const windowsPath = /^[a-zA-Z]:[\\/]/.test(root) || /^\\\\/.test(root);
  const posixPath = root.startsWith("/");
  const pathApi = windowsPath ? path.win32 : posixPath ? path.posix : null;
  if (!pathApi) return false;
  const targetMatchesRootFormat = windowsPath
    ? /^[a-zA-Z]:[\\/]/.test(target) || /^\\\\/.test(target)
    : target.startsWith("/") && !/^[a-zA-Z]:[\\/]/.test(target);
  if (!targetMatchesRootFormat || !pathApi.isAbsolute(root) || !pathApi.isAbsolute(target)) return false;
  const relative = pathApi.relative(pathApi.resolve(root), pathApi.resolve(target));
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(relative);
}

export async function readFile(storageKey: string): Promise<Buffer> {
  if (config.FILE_STORAGE_DRIVER !== "local") throw new Error("Stored file preview is unavailable for this storage driver");
  const root = path.resolve(config.FILE_STORAGE_PATH);
  const target = path.resolve(root, storageKey);
  if (!isWithinStorageRoot(root, target)) throw new Error("Invalid storage path");
  return fs.readFile(target);
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (config.FILE_STORAGE_DRIVER === "mock") return;
  if (config.FILE_STORAGE_DRIVER !== "local") throw new Error("Stored file deletion is unavailable for this storage driver");
  const root = path.resolve(config.FILE_STORAGE_PATH);
  const target = path.resolve(root, storageKey);
  if (!isWithinStorageRoot(root, target)) throw new Error("Invalid storage path");
  try {
    await fs.unlink(target);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
}
