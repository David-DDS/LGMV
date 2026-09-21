import { Router, type IRouter } from "express";
import { eq, desc, count, sql, and, isNull, isNotNull, lt } from "drizzle-orm";
import { db, vrfSystemsTable, readingSessionsTable, startupReportsTable } from "@workspace/db";
import { deleteBlob, isObjectStorageUrl } from "../../lib/blobStorage";
import {
  CreateSystemBody,
  GetSystemParams,
  UpdateSystemParams,
  UpdateSystemBody,
  DeleteSystemParams,
  GetSystemSummaryParams,
  ListStartupReportsParams,
  UploadStartupReportParams,
  GetStartupReportParams,
  ListReadingSessionsParams,
  CreateReadingSessionParams,
  CreateReadingSessionBody,
  GetReadingSessionParams,
  UploadReadingPhotoParams,
  AnalyzeReadingSessionParams,
} from "@workspace/api-zod";
import startupReportsRouter from "../startup-reports";
import readingSessionsRouter from "../reading-sessions";
import technicalReportRouter from "../technical-report";

const router: IRouter = Router();

// Auto-expire trashed systems after 30 days (lazy cleanup on any list query)
async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const expired = await db
    .select()
    .from(vrfSystemsTable)
    .where(and(isNotNull(vrfSystemsTable.deletedAt), lt(vrfSystemsTable.deletedAt, cutoff)));
  for (const sys of expired) {
    const reports = await db
      .select()
      .from(startupReportsTable)
      .where(eq(startupReportsTable.systemId, sys.id));
    for (const r of reports) {
      if (r.fileUrl && isObjectStorageUrl(r.fileUrl)) {
        await deleteBlob(r.fileUrl).catch(() => undefined);
      }
    }
    // Guarded delete: only remove if still trashed and still past cutoff at delete time.
    // Prevents race with a concurrent restore between the select and the delete.
    await db
      .delete(vrfSystemsTable)
      .where(
        and(
          eq(vrfSystemsTable.id, sys.id),
          isNotNull(vrfSystemsTable.deletedAt),
          lt(vrfSystemsTable.deletedAt, cutoff),
        ),
      );
  }
}

router.get("/systems/dashboard", async (_req, res): Promise<void> => {
  await purgeExpiredTrash().catch(() => undefined);
  const systems = await db.select().from(vrfSystemsTable).where(isNull(vrfSystemsTable.deletedAt));

  const healthyCounts = {
    totalSystems: systems.length,
    healthySystems: systems.filter((s) => s.healthStatus === "healthy").length,
    warningSystems: systems.filter((s) => s.healthStatus === "warning").length,
    criticalSystems: systems.filter((s) => s.healthStatus === "critical").length,
    unknownSystems: systems.filter((s) => !s.healthStatus).length,
  };

  // Group by building
  const buildingMap = new Map<string, typeof systems>();
  for (const s of systems) {
    const key = s.building?.trim() || "Sem Edificio";
    if (!buildingMap.has(key)) buildingMap.set(key, []);
    buildingMap.get(key)!.push(s);
  }

  const buildings = Array.from(buildingMap.entries())
    .map(([name, list]) => ({
      name,
      condensationType: list.find((s) => s.condensationType)?.condensationType ?? null,
      systemCount: list.length,
      healthySystems: list.filter((s) => s.healthStatus === "healthy").length,
      warningSystems: list.filter((s) => s.healthStatus === "warning").length,
      criticalSystems: list.filter((s) => s.healthStatus === "critical").length,
      unknownSystems: list.filter((s) => !s.healthStatus).length,
      systems: list,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const recentSessions = await db
    .select()
    .from(readingSessionsTable)
    .orderBy(desc(readingSessionsTable.createdAt))
    .limit(5);

  res.json({
    ...healthyCounts,
    buildings,
    recentSessions,
  });
});

router.get("/systems/trash", async (_req, res): Promise<void> => {
  await purgeExpiredTrash().catch(() => undefined);
  const systems = await db
    .select()
    .from(vrfSystemsTable)
    .where(isNotNull(vrfSystemsTable.deletedAt))
    .orderBy(desc(vrfSystemsTable.deletedAt));
  res.json(systems);
});

router.get("/systems", async (req, res): Promise<void> => {
  await purgeExpiredTrash().catch(() => undefined);
  const category = typeof req.query.category === "string" ? req.query.category : null;
  const conds = [isNull(vrfSystemsTable.deletedAt)];
  if (category === "escritorios_xp" || category === "espacos_xp") {
    conds.push(eq(vrfSystemsTable.category, category));
  }
  const systems = await db
    .select()
    .from(vrfSystemsTable)
    .where(and(...conds))
    .orderBy(desc(vrfSystemsTable.createdAt));
  res.json(systems);
});

router.post("/systems", async (req, res): Promise<void> => {
  const parsed = CreateSystemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [system] = await db.insert(vrfSystemsTable).values(parsed.data).returning();
  res.status(201).json(system);
});

router.get("/systems/:systemId", async (req, res): Promise<void> => {
  const params = GetSystemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [system] = await db
    .select()
    .from(vrfSystemsTable)
    .where(and(eq(vrfSystemsTable.id, params.data.systemId), isNull(vrfSystemsTable.deletedAt)));
  if (!system) {
    res.status(404).json({ error: "System not found" });
    return;
  }
  res.json(system);
});

router.patch("/systems/:systemId", async (req, res): Promise<void> => {
  const params = UpdateSystemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSystemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Block edits on trashed systems — must restore first.
  const [system] = await db
    .update(vrfSystemsTable)
    .set(parsed.data)
    .where(and(eq(vrfSystemsTable.id, params.data.systemId), isNull(vrfSystemsTable.deletedAt)))
    .returning();
  if (!system) {
    res.status(404).json({ error: "System not found" });
    return;
  }
  res.json(system);
});

router.delete("/systems/:systemId", async (req, res): Promise<void> => {
  const params = DeleteSystemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [updated] = await db
    .update(vrfSystemsTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(vrfSystemsTable.id, params.data.systemId), isNull(vrfSystemsTable.deletedAt)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "System not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/systems/:systemId/restore", async (req, res): Promise<void> => {
  const id = parseInt(req.params.systemId, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid systemId" });
    return;
  }
  // Only restore systems that are actually in the trash.
  const [restored] = await db
    .update(vrfSystemsTable)
    .set({ deletedAt: null })
    .where(and(eq(vrfSystemsTable.id, id), isNotNull(vrfSystemsTable.deletedAt)))
    .returning();
  if (!restored) {
    res.status(404).json({ error: "Sistema nao encontrado na lixeira." });
    return;
  }
  res.json(restored);
});

router.delete("/systems/:systemId/permanent", async (req, res): Promise<void> => {
  const id = parseInt(req.params.systemId, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid systemId" });
    return;
  }
  // Guard: only systems already in the trash can be permanently deleted.
  // Prevents bypassing the soft-delete + 30-day retention flow.
  const [existing] = await db
    .select()
    .from(vrfSystemsTable)
    .where(and(eq(vrfSystemsTable.id, id), isNotNull(vrfSystemsTable.deletedAt)));
  if (!existing) {
    res.status(404).json({ error: "Sistema nao encontrado na lixeira." });
    return;
  }
  const reports = await db
    .select()
    .from(startupReportsTable)
    .where(eq(startupReportsTable.systemId, id));
  for (const r of reports) {
    if (r.fileUrl && isObjectStorageUrl(r.fileUrl)) {
      await deleteBlob(r.fileUrl).catch(() => undefined);
    }
  }
  await db
    .delete(vrfSystemsTable)
    .where(and(eq(vrfSystemsTable.id, id), isNotNull(vrfSystemsTable.deletedAt)));
  res.sendStatus(204);
});

router.get("/systems/:systemId/summary", async (req, res): Promise<void> => {
  const params = GetSystemSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [system] = await db.select().from(vrfSystemsTable).where(eq(vrfSystemsTable.id, params.data.systemId));
  if (!system) {
    res.status(404).json({ error: "System not found" });
    return;
  }

  const sessions = await db
    .select()
    .from(readingSessionsTable)
    .where(eq(readingSessionsTable.systemId, params.data.systemId))
    .orderBy(desc(readingSessionsTable.sessionDate))
    .limit(10);

  const reports = await db
    .select({
      id: startupReportsTable.id,
      status: startupReportsTable.processingStatus,
      extractedData: startupReportsTable.extractedData,
    })
    .from(startupReportsTable)
    .where(eq(startupReportsTable.systemId, params.data.systemId));

  // Alinhado com a logica do endpoint analyze: so conta como baseline disponivel
  // se o relatorio foi processado E tem dados extraidos.
  const hasUsableReport = reports.some((r) => r.status === "done" && !!r.extractedData);
  const hasDoneReport = hasUsableReport;
  const usingLgReference = !hasUsableReport && system.condensationType === "air";

  const latestSession = sessions[0];

  res.json({
    system,
    totalSessions: sessions.length,
    latestHealthStatus: latestSession?.healthStatus ?? null,
    latestAnalysis: latestSession?.analysisResult ?? null,
    parameterTrends: [],
    hasStartupReport: hasDoneReport,
    usingLgReference,
  });
});

router.use(startupReportsRouter);
router.use(readingSessionsRouter);
router.use(technicalReportRouter);

export default router;
