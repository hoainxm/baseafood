// Oracle: docs/app-map/43-guided-tour.ba-spec.md (R3 bước theo quyền · R10 phủ nhãn · AC-11 văn phong)
// + docs/app-map/40-documents.md (trạng thái, lần ban hành, xem theo phòng ban, hạn chứng nhận).
import { describe, expect, it } from "vitest";
import { DOCUMENT_KINDS, DOCUMENT_STATE_LABELS } from "@/lib/documents";
import { buildDocumentsTour, type DocumentsTourContext } from "./documentsTour";

const full: DocumentsTourContext = { can: { create: true, write: true, delete: true } };
const viewOnly: DocumentsTourContext = { can: { create: false, write: false, delete: false } };
const textOf = (c: DocumentsTourContext) =>
  buildDocumentsTour(c)
    .steps.map((s) => `${s.title}\n${s.body}`)
    .join("\n");

describe("buildDocumentsTour", () => {
  it("phủ đủ nhãn trạng thái + loại tài liệu của lib (thêm nhãn mà quên lời ⇒ đỏ)", () => {
    const text = textOf(viewOnly);
    const labels = [...Object.values(DOCUMENT_STATE_LABELS), ...DOCUMENT_KINDS.map((k) => k.label)];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });

  it("phủ nhãn đang hiện trên màn: bộ lọc trạng thái, thẻ hạn, cột File, phạm vi xem, hộp chi tiết", () => {
    const text = textOf(viewOnly);
    const labels = [
      // STATUS_FILTERS (DocumentsScreen.tsx).
      "Đang dùng",
      "Tất cả",
      // Thẻ hạn + cột File.
      "Còn n ngày",
      "Hết hạn hôm nay",
      "Đã hết hạn",
      "Xem PDF",
      "Chưa có PDF",
      "Thiếu file PDF",
      // Ai được xem (DocumentFormDialog VISIBILITY_OPTIONS).
      "Chỉ phòng được chọn",
      "Cả công ty",
      // Hộp chi tiết.
      "Bản đang hiệu lực",
      "Các lần ban hành trước",
      "Quá hạn lưu",
      "Tải file gốc",
    ];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });

  it("bước ghi chỉ có khi có quyền; dòng Xóa chỉ khi có quyền xóa", () => {
    const writeIds = ["detail-actions", "add-document"];
    const ids = (c: DocumentsTourContext) => buildDocumentsTour(c).steps.map((s) => s.id);
    expect(ids(full).filter((id) => writeIds.includes(id))).toEqual(writeIds);
    expect(ids(viewOnly).filter((id) => writeIds.includes(id))).toEqual([]);
    const writeNoDelete = textOf({ can: { create: false, write: true, delete: false } });
    expect(writeNoDelete).toContain("Ghi lần ban hành mới");
    expect(writeNoDelete).not.toContain("• Xóa:");
    expect(ids({ can: { create: false, write: true, delete: false } })).not.toContain("add-document");
  });

  it("thứ tự công việc; mở đầu + kết thúc giữa trang; không bước nào đổi chỗ xem", () => {
    const steps = buildDocumentsTour(full).steps;
    expect(steps.map((s) => s.id)).toEqual(["intro", "visibility", "stats", "filters", "table", "status", "file", "detail", "detail-actions", "add-document", "outro"]);
    expect(steps[0].target ?? "").toBe("");
    expect(steps[steps.length - 1].target ?? "").toBe("");
    expect(steps.filter((s) => s.prepare)).toEqual([]);
  });

  it("văn phong: tiêu đề không chấm cuối, lời kết bằng dấu chấm, không bấm / nhấn / click", () => {
    const steps = [...buildDocumentsTour(full).steps, ...buildDocumentsTour(viewOnly).steps];
    expect(steps.filter((s) => s.title.trim().endsWith(".")).map((s) => s.id)).toEqual([]);
    expect(steps.filter((s) => !s.body.trim().endsWith(".")).map((s) => s.id)).toEqual([]);
    expect(steps.filter((s) => /(^|[^\p{L}])(bấm|nhấn|click)(?!\p{L})/iu.test(`${s.title} ${s.body}`)).map((s) => s.id)).toEqual([]);
  });
});
