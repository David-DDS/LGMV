import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  lgmvReadingsTable,
  readingPhotosTable,
  readingSessionsTable,
  startupReportsTable,
  vrfSystemsTable,
} from "@workspace/db";
import { GetSystemParams } from "@workspace/api-zod";
import { buildTechnicalReport, loadLgReferenceTable } from "../../lib/technical-report";

const router: IRouter = Router();

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

router.get("/systems/:systemId/technical-report", async (req, res): Promise<void> => {
  const params = GetSystemParams.safeParse(req.params);
  const systemId = params.success ? params.data.systemId : null;
  if (!systemId || !Number.isSafeInteger(systemId) || systemId <= 0) {
    res.status(400).json({ error: "Invalid systemId" });
    return;
  }

  const rawSessionId = req.query.sessionId;
  let sessionId: number | null = null;
  if (rawSessionId !== undefined) {
    if (Array.isArray(rawSessionId)) {
      res.status(400).json({ error: "sessionId must be a single positive integer" });
      return;
    }
    sessionId = parsePositiveInteger(rawSessionId);
    if (!sessionId) {
      res.status(400).json({ error: "sessionId must be a positive integer" });
      return;
    }
  }

  try {
    // Deleted systems must not be exportable. This also prevents access to
    // their sessions and attachments after they move to the trash.
    const [system] = await db
      .select()
      .from(vrfSystemsTable)
      .where(and(eq(vrfSystemsTable.id, systemId), isNull(vrfSystemsTable.deletedAt)));
    if (!system) {
      res.status(404).json({ error: "System not found" });
      return;
    }

    const sessions = sessionId
      ? await db
          .select()
          .from(readingSessionsTable)
          .where(and(eq(readingSessionsTable.id, sessionId), eq(readingSessionsTable.systemId, systemId)))
      : await db
          .select()
          .from(readingSessionsTable)
          .where(eq(readingSessionsTable.systemId, systemId))
          .orderBy(desc(readingSessionsTable.sessionDate), desc(readingSessionsTable.id));

    if (sessionId && sessions.length === 0) {
      res.status(404).json({ error: "Session not found for this system" });
      return;
    }

    const sessionData = [];
    for (const session of sessions) {
      const [photos, readings] = await Promise.all([
        db
          .select()
          .from(readingPhotosTable)
          .where(eq(readingPhotosTable.sessionId, session.id))
          .orderBy(asc(readingPhotosTable.uploadedAt), asc(readingPhotosTable.id)),
        db
          .select()
          .from(lgmvReadingsTable)
          .where(eq(lgmvReadingsTable.sessionId, session.id))
          .orderBy(asc(lgmvReadingsTable.id)),
      ]);
      sessionData.push({ session, photos, readings });
    }

    const startupReports = await db
      .select()
      .from(startupReportsTable)
      .where(eq(startupReportsTable.systemId, systemId))
      .orderBy(desc(startupReportsTable.uploadedAt), desc(startupReportsTable.id));
    const hasProcessedStartup = startupReports.some(
      (report) => report.processingStatus === "done" && Boolean(report.extractedData),
    );
    const lgReferenceRequired = !hasProcessedStartup && system.condensationType === "air";

    const { buffer } = await buildTechnicalReport({
      system,
      sessions: sessionData,
      startupReports,
      lgReferenceRequired,
      lgReferenceBuffer: lgReferenceRequired ? await loadLgReferenceTable() : null,
    });

    const filename = `relatorio-tecnico-vrf-${system.code || system.id}${sessionId ? `-sessao-${sessionId}` : ""}.docx`
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .toLowerCase();
    res.status(200);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.send(buffer);
  } catch (error) {
    req.log?.error({ err: error, systemId, sessionId }, "Failed to export technical report");
    res.status(500).json({ error: "Não foi possível gerar o relatório técnico." });
  }
});

export default router;