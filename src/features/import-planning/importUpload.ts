// ============================================================
// Tên file: src/features/import-planning/importUpload.ts
// Tên tiếng Việt: Tải file hồ sơ nhập khẩu lên kho file (dùng chung các hộp ghi)
// Description: Upload a batch of files to bucket `import-files` and return the `import_files` rows;
//              any failure removes the files already uploaded in this batch.
// ============================================================
import { hasImportStorage, importFilePath, removeImportFiles, uploadImportFile } from "@/lib/importFileStorage";
import { newId } from "@/lib/store";
import type { ImportFile } from "@/types";

/** Chạy không nối máy chủ (không có kho file) ⇒ trả rỗng, hộp vẫn lưu được phần chữ. */
export async function uploadAll(files: File[], contractId: string, meta: Omit<ImportFile, "id" | "path" | "fileName" | "createdAt">): Promise<ImportFile[] | { error: string }> {
  if (!files.length || !hasImportStorage) return [];
  const done: ImportFile[] = [];
  for (const f of files) {
    const id = newId();
    const up = await uploadImportFile(importFilePath(contractId, id, f.name), f);
    if ("error" in up) {
      if (done.length) void removeImportFiles(done.map((x) => x.path));
      return { error: up.error };
    }
    done.push({ ...meta, id, path: up.path, fileName: up.fileName, createdAt: new Date().toISOString() });
  }
  return done;
}
