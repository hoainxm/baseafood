// Oracle: docs/app-map/54-document-composer.ba-spec.md AC-17 — hộp "?" của Lệnh sản xuất nói đủ trạng thái bản soạn,
// cờ, nguồn ô của bộ soạn file LSX. Nhãn đọc thẳng từ code: đổi nhãn mà quên sửa hướng dẫn ⇒ đỏ.
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COMPOSED_STATUS_LABELS, fieldSourceLabel } from "@/lib/documentComposer";
import { productionOrderForm as F } from "@/lib/documentTypes/productionOrderForm";
import { OrderFileGuideSection } from "./productionOrderGuide";

describe("AC-17 — hướng dẫn file LSX nhắc đủ nhãn", () => {
  test("3 trạng thái + 3 cờ + 5 nguồn ô, thiếu == 0", () => {
    const text = renderToStaticMarkup(<OrderFileGuideSection />).replace(/<[^>]+>/g, "");
    const labels = [
      ...Object.values(COMPOSED_STATUS_LABELS),
      F.labels.differs,
      F.labels.stale,
      F.labels.sourceCancelled,
      ...(["source", "default", "manual", "empty"] as const).map((kind) => fieldSourceLabel(F, { kind })),
      fieldSourceLabel(F, { kind: "previous", ref: "" }).trim(),
    ];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });
});
