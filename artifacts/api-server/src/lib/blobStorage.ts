import { randomUUID } from "crypto";
import { Readable } from "stream";
import { objectStorageClient } from "./objectStorage";

function getBucket() {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) {
    throw new Error("PRIVATE_OBJECT_DIR not set");
  }
  const trimmed = dir.startsWith("/") ? dir.slice(1) : dir;
  const [bucketName, ...rest] = trimmed.split("/");
  return { bucketName, prefix: rest.join("/") };
}

export type BlobUploadResult = {
  objectPath: string;
  fileUrl: string;
};

export async function uploadBlob(params: {
  buffer: Buffer;
  contentType: string;
  folder: string;
}): Promise<BlobUploadResult> {
  const { bucketName, prefix } = getBucket();
  const id = randomUUID();
  const objectName = `${prefix}/uploads/${params.folder}/${id}`;
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(params.buffer, {
    contentType: params.contentType,
    resumable: false,
  });
  const objectPath = `/objects/uploads/${params.folder}/${id}`;
  return {
    objectPath,
    fileUrl: `/api/storage${objectPath}`,
  };
}

export async function downloadBlobBuffer(fileUrlOrPath: string): Promise<Buffer | null> {
  const objectName = parseObjectName(fileUrlOrPath);
  if (!objectName) return null;
  const { bucketName } = getBucket();
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buf] = await file.download();
  return buf;
}

export async function deleteBlob(fileUrlOrPath: string): Promise<void> {
  const objectName = parseObjectName(fileUrlOrPath);
  if (!objectName) return;
  const { bucketName } = getBucket();
  await objectStorageClient
    .bucket(bucketName)
    .file(objectName)
    .delete({ ignoreNotFound: true });
}

export async function streamBlob(
  fileUrlOrPath: string,
): Promise<{ stream: Readable; contentType: string; size?: number } | null> {
  const objectName = parseObjectName(fileUrlOrPath);
  if (!objectName) return null;
  const { bucketName } = getBucket();
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [meta] = await file.getMetadata();
  const ct = (meta.contentType as string | undefined) || "application/octet-stream";
  const size = typeof meta.size === "string" ? Number(meta.size) : (meta.size as number | undefined);
  return { stream: file.createReadStream(), contentType: ct, size };
}

// Accepts either a stored fileUrl ("/api/storage/objects/uploads/..."), an objectPath ("/objects/uploads/..."),
// or a legacy "/api/uploads/<filename>" (returns null — caller handles disk fallback).
function parseObjectName(input: string): string | null {
  if (!input) return null;
  const { prefix } = getBucket();
  let p = input;
  if (p.startsWith("/api/storage")) p = p.slice("/api/storage".length);
  if (p.startsWith("/objects/")) {
    return `${prefix}/${p.slice("/objects/".length)}`;
  }
  return null;
}

export function isObjectStorageUrl(fileUrl: string | null | undefined): boolean {
  if (!fileUrl) return false;
  return fileUrl.startsWith("/api/storage/objects/") || fileUrl.startsWith("/objects/");
}
