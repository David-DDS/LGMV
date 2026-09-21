import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);
const PDF_TOOL_TIMEOUT_MS = 120_000;

/**
 * Render PDF pages into JPEG buffers.
 *
 * Startup reports already use Poppler for extraction. Keeping the rasterizer
 * here makes the export use the same server capability while allowing the
 * report to include every page (rather than the first three pages sent to
 * Vision during extraction). Callers that only need an initial subset can
 * provide maxPages so Poppler does not rasterize the rest of the document.
 */
export async function renderPdfPagesToBuffers(
  filePath: string,
  maxPages?: number,
): Promise<Buffer[]> {
  const outDir = path.join(os.tmpdir(), `vrf-report-render-${randomUUID()}`);
  await fs.promises.mkdir(outDir, { recursive: true });

  try {
    const requestedMaxPages =
      maxPages === undefined || !Number.isFinite(maxPages)
        ? undefined
        : Math.max(1, Math.floor(maxPages));
    let pageCount: number | null = null;
    try {
      const { stdout } = await execFileAsync(
        "pdfinfo",
        [filePath],
        { timeout: PDF_TOOL_TIMEOUT_MS },
      );
      const match = stdout.match(/^\s*Pages:\s+(\d+)\s*$/m);
      pageCount = match ? Number(match[1]) : null;
    } catch {
      // pdftoppm below can still render when pdfinfo is not available.
    }

    const args = ["-jpeg", "-r", "120"];
    const lastPage =
      pageCount && pageCount > 0
        ? Math.min(pageCount, requestedMaxPages ?? pageCount)
        : requestedMaxPages;
    if (lastPage && lastPage > 0) {
      args.push("-f", "1", "-l", String(lastPage));
    }
    args.push(filePath, path.join(outDir, "page"));
    await execFileAsync("pdftoppm", args, { timeout: PDF_TOOL_TIMEOUT_MS });

    const files = (await fs.promises.readdir(outDir))
      .filter((file) => /\.(?:jpe?g)$/i.test(file))
      .sort((a, b) => {
        const pageA = Number(a.match(/(\d+)(?:\.[^.]+)$/)?.[1] ?? 0);
        const pageB = Number(b.match(/(\d+)(?:\.[^.]+)$/)?.[1] ?? 0);
        return pageA - pageB;
      });

    if (files.length === 0) {
      throw new Error("O PDF não produziu páginas rasterizadas.");
    }
    return Promise.all(files.map((file) => fs.promises.readFile(path.join(outDir, file))));
  } finally {
    await fs.promises.rm(outDir, { recursive: true, force: true }).catch(() => undefined);
  }
}