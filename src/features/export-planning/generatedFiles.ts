// ============================================================
// Tên file: src/features/export-planning/generatedFiles.ts
// Tên tiếng Việt: Lưu file app tự sinh (Lệnh xuất Word, SI Excel) làm file của chuyến
// Description: ba-spec 72 R6, R13 — uploads a generated file to the export file store and returns the ExportFile row
//              to save. No file store (local / demo) ⇒ a placeholder row (path prefixed like demo files), so the item
//              still counts as having its file; the user already downloaded the real file.
// ============================================================
import { DEMO_PLACEHOLDER_PREFIX, exportFilePath, uploadExportFile } from "@/lib/exportFileStorage";
import { newId } from "@/lib/store";
import type { ExportFile } from "@/types";

const MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function attachGeneratedFile(input: {
  bytes: Uint8Array;
  fileName: string;
  contractId: string;
  shipmentId: string;
  stepItemId: string;
  step: ExportFile["step"];
  by: string;
  filesAvailable: boolean;
}): Promise<{ file: ExportFile } | { error: string }> {
  const id = newId();
  let path = `${DEMO_PLACEHOLDER_PREFIX}${input.fileName}`;
  let fileName = input.fileName;
  if (input.filesAvailable) {
    const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";
    const blob = new File([input.bytes as BlobPart], input.fileName, { type: MIME[ext] ?? "application/octet-stream" });
    const r = await uploadExportFile(exportFilePath(input.contractId, "shipment", `${input.step}-${id}`, input.fileName), blob);
    if ("error" in r) return { error: r.error };
    path = r.path;
    fileName = r.fileName;
  }
  return {
    file: {
      id,
      contractId: input.contractId,
      shipmentId: input.shipmentId,
      stepItemId: input.stepItemId,
      step: input.step,
      path,
      fileName,
      layerNo: null,
      caption: "Lập trong app",
      uploadedBy: input.by,
      createdAt: new Date().toISOString(),
    },
  };
}
