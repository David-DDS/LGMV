import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import { streamBlob } from "../lib/blobStorage";

const router: IRouter = Router();

const uploadsDir = path.join(process.cwd(), "uploads");

// Serve objects stored in Object Storage (persistent across deploys/restarts).
router.get(/^\/storage\/objects\/(.+)$/, async (req, res): Promise<void> => {
  const rest = (req.params as unknown as Record<string, string>)[0];
  const objectPath = `/objects/${rest}`;
  try {
    const blob = await streamBlob(objectPath);
    if (!blob) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.setHeader("Content-Type", blob.contentType);
    if (blob.size) res.setHeader("Content-Length", String(blob.size));
    res.setHeader("Cache-Control", "private, max-age=3600");
    blob.stream.on("error", () => res.end()).pipe(res);
  } catch (err) {
    req.log?.error({ err, objectPath }, "Failed to stream object from storage");
    res.status(500).json({ error: "Failed to load file" });
  }
});

// Legacy disk-backed uploads (for files uploaded before object storage).
router.get("/uploads/:filename", async (req, res): Promise<void> => {
  const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  if (!filename || /[/\\]/.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(filePath);
});

export default router;
