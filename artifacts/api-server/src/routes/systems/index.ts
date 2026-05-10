import { Router, type IRouter } from "express";
import { eq, desc, count, sql } from "drizzle-orm";
import { db, vrfSystemsTable, readingSessionsTable } from "@workspace/db";
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

const router: IRouter = Router();

router.get("/systems/dashboard", async (_req, res): Promise<void> => {
  const systems = await db.select().from(vrfSystemsTable);

  const healthyCounts = {
    totalSystems: systems.length,
    healthySystems: systems.filter((s) => s.healthStatus === "healthy").length,
    warningSystems: systems.filter((s) => s.healthStatus === "warning").length,
    criticalSystems: systems.filter((s) => s.healthStatus === "critical").length,
    unknownSystems: systems.filter((s) => !s.healthStatus).length,
  };

  const recentSessions = await db
    .select()
    .from(readingSessionsTable)
    .orderBy(desc(readingSessionsTable.createdAt))
    .limit(5);

  res.json({
    ...healthyCounts,
    recentSessions,
  });
});

router.get("/systems", async (_req, res): Promise<void> => {
  const systems = await db.select().from(vrfSystemsTable).orderBy(desc(vrfSystemsTable.createdAt));
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
  const [system] = await db.select().from(vrfSystemsTable).where(eq(vrfSystemsTable.id, params.data.systemId));
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
  const [system] = await db
    .update(vrfSystemsTable)
    .set(parsed.data)
    .where(eq(vrfSystemsTable.id, params.data.systemId))
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
  const [deleted] = await db
    .delete(vrfSystemsTable)
    .where(eq(vrfSystemsTable.id, params.data.systemId))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "System not found" });
    return;
  }
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

  const latestSession = sessions[0];

  res.json({
    system,
    totalSessions: sessions.length,
    latestHealthStatus: latestSession?.healthStatus ?? null,
    latestAnalysis: latestSession?.analysisResult ?? null,
    parameterTrends: [],
  });
});

router.use(startupReportsRouter);
router.use(readingSessionsRouter);

export default router;
