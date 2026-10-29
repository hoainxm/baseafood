import { describe, expect, it } from "vitest";
import type { AppRole, CompanyDocument, DocumentVersion } from "@/types";
import {
  DOCUMENT_EXPIRY_NOTICE_DAYS,
  activeVersionOf,
  buildDocumentWarnings,
  canDeleteDocument,
  canViewDocument,
  checkDocumentFile,
  departmentsOfRoles,
  documentState,
  documentViewerFor,
  expiryOf,
  findDocumentByCode,
  formatRevision,
  isPastRetention,
  nextRevisionNo,
  normalizeDocumentCode,
  recordPaperVersion,
  safeFileName,
  attachVersionFile,
  filePreviewKind,
} from "./documents";
import { DUE_OFFSET_DAYS, defaultDueDate, taskRequirements } from "./myTasks";

const doc = (p: Partial<CompanyDocument> = {}): CompanyDocument => ({
  id: "d1",
  code: "QTI-KH-01",
  title: "Quy trình quản lý đơn hàng",
  kind: "procedure",
  parentId: "",
  ownerDepartment: "planning",
  visibility: "departments",
  visibleDepartments: [],
  retentionYears: 2,
  expiresOn: "",
  isWithdrawn: false,
  note: "",
  createdAt: "",
  ...p,
});

const ver = (p: Partial<DocumentVersion> = {}): DocumentVersion => ({
  id: "v1",
  documentId: "d1",
  revisionNo: 1,
  effectiveDate: "2023-01-02",
  changeSummary: "",
  status: "active",
  approvalMode: "paper",
  preparedByName: "",
  reviewedByName: "",
  approvedByName: "Giám đốc",
  reviewerId: "",
  approverId: "",
  reviewedAt: "",
  approvedAt: "",
  returnReason: "",
  pdfPath: "",
  sourcePath: "",
  pdfFileName: "",
  sourceFileName: "",
  obsoletedOn: "",
  recordedByName: "",
  createdAt: "",
  ...p,
});

describe("phòng ban của người dùng (DOC-R6)", () => {
  it("vai trò hệ thống → phòng mặc định; nhiều vai trò ⇒ hợp", () => {
    expect(departmentsOfRoles(["accountant"])).toEqual(["accounting"]);
    expect(departmentsOfRoles(["frozen-workshop-manager", "accountant"]).sort()).toEqual(["accounting", "production-frozen"]);
    expect(departmentsOfRoles(["team-leader"]).sort()).toEqual(["production-dried", "production-fish", "production-frozen"]);
    expect(departmentsOfRoles([])).toEqual([]);
  });
  it("vai trò tự tạo / đã chỉnh lấy app_roles.department (thắng mặc định); phòng lạ bị bỏ", () => {
    const appRoles: AppRole[] = [
      { id: "role-kh", name: "Phòng Kế hoạch", description: "", homeRoute: "", sortOrder: 0, department: "planning" },
      { id: "accountant", name: "Kế toán", description: "", homeRoute: "", sortOrder: 1, department: "board" },
      { id: "role-x", name: "Lạ", description: "", homeRoute: "", sortOrder: 2, department: "khong-co" },
    ];
    expect(departmentsOfRoles(["role-kh"], appRoles)).toEqual(["planning"]);
    expect(departmentsOfRoles(["accountant"], appRoles)).toEqual(["board"]);
    expect(departmentsOfRoles(["role-x"], appRoles)).toEqual([]);
  });
});

describe("ai xem được tài liệu (DOC-R5)", () => {
  const planning = documentViewerFor({ roles: ["role-kh"], appRoles: [{ id: "role-kh", name: "", description: "", homeRoute: "", sortOrder: 0, department: "planning" }], isAdmin: false });
  const accountant = documentViewerFor({ roles: ["accountant"], isAdmin: false });
  const director = documentViewerFor({ roles: ["director"], isAdmin: false });
  const admin = documentViewerFor({ roles: [], isAdmin: true });
  const offline = documentViewerFor({ roles: [], isAdmin: false, isOffline: true });

  it("phòng sở hữu xem được, phòng khác thì không", () => {
    expect(canViewDocument(doc(), planning)).toBe(true);
    expect(canViewDocument(doc(), accountant)).toBe(false);
  });
  it("phòng được chọn thêm xem được", () => {
    expect(canViewDocument(doc({ visibleDepartments: ["accounting"] }), accountant)).toBe(true);
  });
  it("cả công ty ⇒ ai cũng xem", () => {
    expect(canViewDocument(doc({ visibility: "company" }), accountant)).toBe(true);
  });
  it("Ban giám đốc, admin, chạy không đăng nhập ⇒ xem hết", () => {
    for (const v of [director, admin, offline]) expect(canViewDocument(doc(), v)).toBe(true);
  });
  it("người chưa thuộc phòng nào chỉ thấy tài liệu cả công ty", () => {
    const nobody = documentViewerFor({ roles: ["role-x"], isAdmin: false });
    expect(canViewDocument(doc(), nobody)).toBe(false);
    expect(canViewDocument(doc({ visibility: "company" }), nobody)).toBe(true);
  });
});

describe("mã tài liệu (DOC-R10)", () => {
  it("chuẩn hoá: bỏ khoảng trắng thừa, viết hoa", () => {
    expect(normalizeDocumentCode("  qti-kh-01 ")).toBe("QTI-KH-01");
    expect(normalizeDocumentCode("QT  KH")).toBe("QT KH");
  });
  it("trùng mã không phân hoa thường; bỏ qua chính nó khi sửa", () => {
    const docs = [doc()];
    expect(findDocumentByCode(docs, "qti-kh-01")?.id).toBe("d1");
    expect(findDocumentByCode(docs, "qti-kh-01", "d1")).toBeUndefined();
    expect(findDocumentByCode(docs, "")).toBeUndefined();
  });
  it("lần ban hành in hai chữ số", () => {
    expect(formatRevision(1)).toBe("01");
    expect(formatRevision(12)).toBe("12");
  });
});

describe("lần ban hành (DOC-R1, R2, R3b)", () => {
  it("ghi bản đã ký ⇒ lần mới hiệu lực, lần cũ Hết hiệu lực từ ngày hiệu lực mới; KHÔNG ghi đè", () => {
    const old = ver();
    const other = ver({ id: "v9", documentId: "d2" });
    const { versions, version } = recordPaperVersion([old, other], {
      ...ver({ id: "v2", revisionNo: 2, effectiveDate: "2026-11-01" }),
    });
    expect(version.status).toBe("active");
    expect(version.approvalMode).toBe("paper");
    expect(versions).toHaveLength(3);
    expect(versions.find((v) => v.id === "v1")).toMatchObject({ status: "obsolete", obsoletedOn: "2026-11-01" });
    expect(versions.find((v) => v.id === "v9")?.status).toBe("active"); // tài liệu khác không bị đụng
    expect(versions.filter((v) => v.documentId === "d1" && v.status === "active")).toHaveLength(1);
    expect(activeVersionOf(versions, "d1")?.id).toBe("v2");
  });
  it("lần kế tiếp = lần lớn nhất + 1", () => {
    expect(nextRevisionNo([], "d1")).toBe(1);
    expect(nextRevisionNo([ver(), ver({ id: "v3", revisionNo: 3, status: "obsolete" })], "d1")).toBe(4);
  });
  it("trạng thái tài liệu", () => {
    expect(documentState(doc(), [])).toBe("not-issued");
    expect(documentState(doc(), [ver({ status: "draft" })])).toBe("draft");
    expect(documentState(doc(), [ver()])).toBe("active");
    expect(documentState(doc({ isWithdrawn: true }), [ver()])).toBe("withdrawn");
  });
});

describe("đính file cho lần ban hành còn thiếu file (ngoại lệ DOC-R2)", () => {
  it("điền ô file trống, giữ nguyên mọi thứ khác", () => {
    const next = attachVersionFile([ver(), ver({ id: "v2", documentId: "d2" })], "v1", "pdf", "bsf1/documents/d1/v1/pdf-a.pdf", "a.pdf");
    expect(next?.find((v) => v.id === "v1")).toMatchObject({ pdfPath: "bsf1/documents/d1/v1/pdf-a.pdf", pdfFileName: "a.pdf", status: "active", revisionNo: 1 });
    expect(next?.find((v) => v.id === "v2")?.pdfPath).toBe("");
    expect(attachVersionFile([ver()], "v1", "source", "p.docx", "p.docx")?.[0]).toMatchObject({ sourcePath: "p.docx", pdfPath: "" });
  });
  it("KHÔNG thay file đã có; lần không tồn tại / đường dẫn rỗng ⇒ null", () => {
    expect(attachVersionFile([ver({ pdfPath: "cu.pdf" })], "v1", "pdf", "moi.pdf", "moi.pdf")).toBeNull();
    expect(attachVersionFile([ver()], "x", "pdf", "a.pdf", "a.pdf")).toBeNull();
    expect(attachVersionFile([ver()], "v1", "pdf", "", "a.pdf")).toBeNull();
  });
});

describe("xóa và thời hạn lưu (DOC-R8, R9)", () => {
  it("chỉ xóa được tài liệu chưa từng hiệu lực", () => {
    expect(canDeleteDocument("d1", [])).toBe(true);
    expect(canDeleteDocument("d1", [ver({ status: "draft" })])).toBe(true);
    expect(canDeleteDocument("d1", [ver()])).toBe(false);
    expect(canDeleteDocument("d1", [ver({ status: "obsolete" })])).toBe(false);
  });
  it("quá hạn lưu: chỉ lần đã hết hiệu lực, tính từ ngày hết hiệu lực", () => {
    const old = ver({ status: "obsolete", obsoletedOn: "2024-01-02" });
    expect(isPastRetention(old, 2, "2026-01-01")).toBe(false);
    expect(isPastRetention(old, 2, "2026-01-02")).toBe(true);
    expect(isPastRetention(ver(), 2, "2099-01-01")).toBe(false);
    expect(isPastRetention(old, 0, "2099-01-01")).toBe(false);
  });
});

describe("hạn chứng nhận ⇒ Việc của tôi (DOC-R7)", () => {
  const cert = doc({ id: "c1", code: "BRC", title: "Chứng nhận BRC", kind: "certificate", expiresOn: "2026-12-31", visibility: "company" });
  const all = documentViewerFor({ roles: [], isAdmin: true });

  it("trạng thái hạn", () => {
    expect(expiryOf(doc(), "2026-10-19").state).toBe("none");
    expect(expiryOf(cert, "2026-10-01")).toEqual({ state: "ok", daysLeft: 91 });
    expect(expiryOf(cert, "2026-11-01").state).toBe("expiring");
    expect(expiryOf(cert, "2027-01-02")).toEqual({ state: "expired", daysLeft: -2 });
  });
  it("chỉ báo khi còn ≤ 60 ngày / đã hết hạn; hạn việc rơi đúng ngày hết hạn", () => {
    expect(buildDocumentWarnings([cert], "2026-10-01", all)).toEqual([]);
    const [w] = buildDocumentWarnings([cert], "2026-11-01", all);
    expect(w).toMatchObject({ kind: "document-expiring", level: "reminder", path: "/documents?doc=c1" });
    expect(defaultDueDate(w)).toBe("2026-12-31");
    expect(DUE_OFFSET_DAYS["document-expiring"]).toBe(DOCUMENT_EXPIRY_NOTICE_DAYS);
    expect(buildDocumentWarnings([cert], "2027-01-05", all)[0].level).toBe("error");
  });
  it("tài liệu đã thu hồi / không xem được thì không báo; việc thuộc quyền Sửa tài liệu", () => {
    expect(buildDocumentWarnings([{ ...cert, isWithdrawn: true }], "2026-11-01", all)).toEqual([]);
    const hidden = { ...cert, visibility: "departments" as const, ownerDepartment: "quality" };
    expect(buildDocumentWarnings([hidden], "2026-11-01", documentViewerFor({ roles: ["accountant"], isAdmin: false }))).toEqual([]);
    expect(taskRequirements({ kind: "document-expiring", path: "/documents" })).toEqual([["documents", "update"]]);
  });
});

describe("file tải lên", () => {
  it("giới hạn cỡ + đúng loại", () => {
    expect(checkDocumentFile({ name: "a.pdf", size: 1000 }, "pdf")).toBeNull();
    expect(checkDocumentFile({ name: "a.docx", size: 1000 }, "pdf")).toMatch(/chỉ PDF/);
    expect(checkDocumentFile({ name: "a.docx", size: 1000 }, "source")).toBeNull();
    expect(checkDocumentFile({ name: "a.pdf", size: 21 * 1024 * 1024 }, "pdf")).toMatch(/20 MB/);
  });
  it("cách xem: PDF / ảnh xem ngay, Word / Excel tải về", () => {
    expect(filePreviewKind("QT.PDF")).toBe("pdf");
    expect(filePreviewKind("scan.jpeg")).toBe("image");
    expect(filePreviewKind("mau.docx")).toBe("download");
    expect(filePreviewKind("khong-duoi")).toBe("download");
  });
  it("tên file an toàn cho đường dẫn (bỏ dấu, ký tự lạ)", () => {
    expect(safeFileName("Quy trình đơn hàng (bản ký).PDF")).toBe("Quy-trinh-don-hang-ban-ky.pdf");
    expect(safeFileName("???.docx")).toBe("file.docx");
  });
});
