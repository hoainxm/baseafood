// ============================================================
// Tên file: src/lib/documentTypes/index.ts
// Tên tiếng Việt: Sổ đăng ký loại văn bản của bộ soạn
// Description: One entry per document type (ba-spec 54 R1, DC5): the type definition + its built-in template.
//              A new document type = a new file in this folder + one line here; the composer itself stays the same.
// ============================================================
import { PRODUCTION_ORDER_FORM, productionOrderForm } from "./productionOrderForm";
import { buildProductionOrderTemplate } from "./productionOrderTemplate";

export const BUILTIN_TEMPLATES: Record<string, { name: string; fileName: string; build: () => Uint8Array }> = {
  [PRODUCTION_ORDER_FORM]: { name: productionOrderForm.name, fileName: "Khuon-goc-LSX-QTI-KH-01-04.docx", build: buildProductionOrderTemplate },
};
