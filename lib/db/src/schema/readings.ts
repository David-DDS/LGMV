import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vrfSystemsTable } from "./systems";

export const readingSessionsTable = pgTable("reading_sessions", {
  id: serial("id").primaryKey(),
  systemId: integer("system_id").notNull().references(() => vrfSystemsTable.id, { onDelete: "cascade" }),
  sessionDate: text("session_date").notNull(),
  mode: text("mode").notNull().default("cooling"),
  notes: text("notes"),
  healthStatus: text("health_status"),
  analysisResult: text("analysis_result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReadingSessionSchema = createInsertSchema(readingSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReadingSession = z.infer<typeof insertReadingSessionSchema>;
export type ReadingSession = typeof readingSessionsTable.$inferSelect;

export const readingPhotosTable = pgTable("reading_photos", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => readingSessionsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReadingPhotoSchema = createInsertSchema(readingPhotosTable).omit({ id: true, uploadedAt: true });
export type InsertReadingPhoto = z.infer<typeof insertReadingPhotoSchema>;
export type ReadingPhoto = typeof readingPhotosTable.$inferSelect;

export const lgmvReadingsTable = pgTable("lgmv_readings", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => readingSessionsTable.id, { onDelete: "cascade" }),
  parameter: text("parameter").notNull(),
  unit: text("unit").notNull(),
  value: real("value"),
  minNormal: real("min_normal"),
  maxNormal: real("max_normal"),
  status: text("status").notNull().default("unknown"),
  baselineValue: real("baseline_value"),
  deviationPercent: real("deviation_percent"),
  sourcePhotoId: integer("source_photo_id").references(() => readingPhotosTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLgmvReadingSchema = createInsertSchema(lgmvReadingsTable).omit({ id: true, createdAt: true });
export type InsertLgmvReading = z.infer<typeof insertLgmvReadingSchema>;
export type LgmvReading = typeof lgmvReadingsTable.$inferSelect;
