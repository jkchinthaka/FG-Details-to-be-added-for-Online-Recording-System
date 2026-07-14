import { z } from "zod";
import {
  ALL_CLEANING_ITEMS,
  CHECK_ITEM_RESULTS,
  FREEZER_TRUCK_CHECK_ITEMS,
  LOADING_DECISIONS,
  WORK_SHIFTS,
} from "./records";

const checkItemResultSchema = z.enum(CHECK_ITEM_RESULTS);

const cleaningItemIdSchema = z.enum(
  ALL_CLEANING_ITEMS.map((item) => item.id) as [
    (typeof ALL_CLEANING_ITEMS)[number]["id"],
    ...(typeof ALL_CLEANING_ITEMS)[number]["id"][],
  ],
);

const freezerTruckCheckIdSchema = z.enum(
  FREEZER_TRUCK_CHECK_ITEMS.map((item) => item.id) as [
    (typeof FREEZER_TRUCK_CHECK_ITEMS)[number]["id"],
    ...(typeof FREEZER_TRUCK_CHECK_ITEMS)[number]["id"][],
  ],
);

export const cleaningLineSchema = z
  .object({
    itemId: cleaningItemIdSchema,
    result: checkItemResultSchema,
    /** Required when result is FAIL — exception-based corrective detail */
    failureNote: z.string().trim().max(500).optional(),
    correctiveAction: z.string().trim().max(500).optional(),
  })
  .superRefine((line, ctx) => {
    if (line.result === "FAIL") {
      if (!line.failureNote || line.failureNote.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Describe the failure for this item",
          path: ["failureNote"],
        });
      }
    }
  });

export const dailyCleaningVerificationSchema = z.object({
  documentCode: z.literal("NMS/PPU/CL/24"),
  recordedAt: z.string().datetime(),
  shift: z.enum(WORK_SHIFTS),
  lines: z.array(cleaningLineSchema).length(ALL_CLEANING_ITEMS.length, {
    message: "All cleaning checklist items must be recorded",
  }),
});

export type DailyCleaningVerificationInput = z.infer<
  typeof dailyCleaningVerificationSchema
>;

export const freezerTruckLineSchema = z
  .object({
    itemId: freezerTruckCheckIdSchema,
    result: checkItemResultSchema,
    failureNote: z.string().trim().max(500).optional(),
  })
  .superRefine((line, ctx) => {
    if (line.result === "FAIL" && (!line.failureNote || line.failureNote.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the issue found",
        path: ["failureNote"],
      });
    }
  });

export const freezerTruckInspectionSchema = z
  .object({
    documentCode: z.literal("NMS/PPU/CL/30"),
    recordedAt: z.string().datetime(),
    shift: z.enum(WORK_SHIFTS),
    freezerTruckNumber: z.string().trim().min(1, "Enter freezer truck number").max(50),
    vehicleNumber: z.string().trim().min(1, "Enter vehicle number").max(50),
    lines: z.array(freezerTruckLineSchema).length(FREEZER_TRUCK_CHECK_ITEMS.length),
    correctiveAction: z.string().trim().max(1000).optional(),
    loadingDecision: z.enum(LOADING_DECISIONS),
  })
  .superRefine((data, ctx) => {
    const hasFail = data.lines.some((line) => line.result === "FAIL");
    if (hasFail && (!data.correctiveAction || data.correctiveAction.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Corrective action is required when any check fails",
        path: ["correctiveAction"],
      });
    }
    if (hasFail && data.loadingDecision === "APPROVED_FOR_LOADING") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cannot approve loading while failed checks remain",
        path: ["loadingDecision"],
      });
    }
  });

export type FreezerTruckInspectionInput = z.infer<typeof freezerTruckInspectionSchema>;

/** Marks every checklist line acceptable — low-click happy path */
export function markAllCleaningAcceptable(): DailyCleaningVerificationInput["lines"] {
  return ALL_CLEANING_ITEMS.map((item) => ({
    itemId: item.id,
    result: "ACCEPTABLE" as const,
  }));
}

export function markAllFreezerTruckAcceptable(): FreezerTruckInspectionInput["lines"] {
  return FREEZER_TRUCK_CHECK_ITEMS.map((item) => ({
    itemId: item.id,
    result: "ACCEPTABLE" as const,
  }));
}
