import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vrfSystemsTable = pgTable("vrf_systems", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("escritorios_xp"),
  location: text("location"),
  floor: text("floor"),
  servedArea: text("served_area"),
  model: text("model"),
  vrfType: text("vrf_type").notNull().default("multi_v_5"),
  startupDate: text("startup_date"),
  building: text("building"),
  condensationType: text("condensation_type"),
  notes: text("notes"),
  healthStatus: text("health_status"),
  lastReadingDate: text("last_reading_date"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVrfSystemSchema = createInsertSchema(vrfSystemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVrfSystem = z.infer<typeof insertVrfSystemSchema>;
export type VrfSystem = typeof vrfSystemsTable.$inferSelect;

export const startupReportsTable = pgTable("startup_reports", {
  id: serial("id").primaryKey(),
  systemId: integer("system_id").notNull().references(() => vrfSystemsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  fileUrl: text("file_url"),
  mimeType: text("mime_type"),
  processingStatus: text("processing_status").notNull().default("pending"),
  extractedData: text("extracted_data"),
  errorMessage: text("error_message"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStartupReportSchema = createInsertSchema(startupReportsTable).omit({ id: true, uploadedAt: true });
export type InsertStartupReport = z.infer<typeof insertStartupReportSchema>;
export type StartupReport = typeof startupReportsTable.$inferSelect;
