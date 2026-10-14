import { describe, it, expect } from "vitest";
import {
  generateLotCode,
  groupShipments,
  validateShipmentHeader,
  importLineHasData,
  isLineComplete,
  getFrequentSuppliers,
  getSupplierVehicles,
  getSupplierLineTemplates,
  applyNewSupplierTemplate,
  getSkippedSuggestedLines,
  getKnownVehicles,
  mergeOcrLines,
  buildSupplierHistory,
  defaultOcrSelection,
  applyOcrSelection,
  createEmptyImportLine,
  buildScrapDraft,
  applyScrapDraft,
  scrapDraftTotalKg,
  validateScrapDraft,
  type ShipmentHeader,
  type ImportLine,
} from "./importHelpers";
import type { ImportShipment, MaterialImportItem, ScrapItem } from "@/types";

// Logic gom chuyến / ghi bù / mã lô — CLAUDE.md xếp đây là chỗ đáng test nhất
// sau balancingCalc. Hàm thuần, tách khỏi màn 2026-09-21.

const makeShipment = (p: Partial<ImportShipment>): ImportShipment =>
  ({
    id: "c1",
    deliveryDate: "2026-09-02",
    postingDate: "2026-09-02",
    backdateReason: "",
    workshop: "Đông",
    supplierName: "Hồng Phú",
    driverName: "",
    licensePlate: "",
    note: "",
    ...p,
  }) as ImportShipment;

const row = (p: Partial<MaterialImportItem>): MaterialImportItem =>
  ({
    id: "r",
    shipmentId: "",
    deliveryDate: "2026-09-02",
    workshop: "Đông",
    supplierName: "Hồng Phú",
    driverName: "",
    licensePlate: "",
    note: "",
    quantityKg: 0,
    unitPrice: null,
    ...p,
  }) as MaterialImportItem;

describe("generateLotCode", () => {
  it("‹chữ xưởng›-‹yymmdd›-‹stt trong ngày›, stt đếm theo cùng ngày + cùng xưởng", () => {
    expect(generateLotCode("2026-09-02", "Đông", [])).toBe("Đ-260902-01");
    const existing = [
      makeShipment({ id: "a" }),
      makeShipment({ id: "b" }),
      makeShipment({ id: "c", workshop: "Cá" }), // xưởng khác — không đếm
      makeShipment({ id: "d", deliveryDate: "2026-09-01" }), // ngày khác — không đếm
    ];
    expect(generateLotCode("2026-09-02", "Đông", existing)).toBe("Đ-260902-03");
    expect(generateLotCode("2026-09-02", "Khô", existing)).toBe("K-260902-01");
  });
});

describe("groupShipments", () => {
  it("gom dòng theo chuyến THẬT (shipmentId), cộng kg + tiền, cờ ghi bù theo chuyến", () => {
    const cs = [makeShipment({ id: "c1", postingDate: "2026-09-05" })]; // ghi sổ SAU ngày về ⇒ ghi bù
    const rows = [
      row({ id: "r1", shipmentId: "c1", quantityKg: 100, unitPrice: 20 }),
      row({ id: "r2", shipmentId: "c1", quantityKg: 50, unitPrice: null }),
    ];
    const g = groupShipments(rows, cs);
    expect(g).toHaveLength(1);
    expect(g[0].groupKey).toBe("c1");
    expect(g[0].shipment?.id).toBe("c1");
    expect(g[0].rows).toHaveLength(2);
    expect(g[0].totalKg).toBe(150);
    expect(g[0].totalAmount).toBe(2000); // 100*20 + 50*0
    expect(g[0].isBackdated).toBe(true);
  });

  it("dòng CŨ không có shipmentId ⇒ gom ngầm theo (ngày|xưởng|đại lý|xe), chuyen=null, không ghi bù", () => {
    const rows = [
      row({ id: "r1", quantityKg: 10, licensePlate: "72C-1" }),
      row({ id: "r2", quantityKg: 20, licensePlate: "72C-1" }),
      row({ id: "r3", quantityKg: 5, licensePlate: "72C-2" }), // xe khác ⇒ nhóm khác
    ];
    const g = groupShipments(rows, []);
    expect(g).toHaveLength(2);
    const n1 = g.find((x) => x.licensePlate === "72C-1")!;
    expect(n1.shipment).toBeNull();
    expect(n1.groupKey.startsWith("ngam|")).toBe(true);
    expect(n1.totalKg).toBe(30);
    expect(n1.isBackdated).toBe(false);
  });

  it("sắp theo ngày về rồi tên đại lý", () => {
    const rows = [
      row({ id: "a", deliveryDate: "2026-09-03", supplierName: "Bé Ba" }),
      row({ id: "b", deliveryDate: "2026-09-01", supplierName: "Hiếu Phấn" }),
      row({ id: "c", deliveryDate: "2026-09-01", supplierName: "Bé Ba" }),
    ];
    const g = groupShipments(rows, []);
    expect(g.map((x) => `${x.deliveryDate}|${x.supplierName}`)).toEqual([
      "2026-09-01|Bé Ba",
      "2026-09-01|Hiếu Phấn",
      "2026-09-03|Bé Ba",
    ]);
  });
});

describe("validateShipmentHeader", () => {
  const ok: ShipmentHeader = {
    deliveryDate: "2026-09-02",
    postingDate: "2026-09-02",
    backdateReason: "",
    workshop: "Đông",
    supplierName: "Hồng Phú",
    driverName: "",
    licensePlate: "",
    note: "",
    ssccCode: "",
    scanPath: "",
  };
  const fieldsOf = (ls: ReturnType<typeof validateShipmentHeader>) =>
    ls.map((l) => l.field);

  it("đầu chuyến hợp lệ ⇒ không lỗi", () => {
    expect(validateShipmentHeader(ok, false)).toEqual([]);
  });
  it("thiếu đại lý", () => {
    expect(
      fieldsOf(validateShipmentHeader({ ...ok, supplierName: "  " }, false)),
    ).toContain("Đại lý");
  });
  it("ngày ghi sổ trước ngày hàng về ⇒ lỗi", () => {
    expect(
      fieldsOf(validateShipmentHeader({ ...ok, postingDate: "2026-09-01" }, false)),
    ).toContain("Ngày ghi sổ");
  });
  it("ghi sổ SAU ngày về mà không có lý do ⇒ bắt lý do ghi bù", () => {
    expect(
      fieldsOf(validateShipmentHeader({ ...ok, postingDate: "2026-09-05" }, false)),
    ).toContain("Lý do ghi bù");
    expect(
      validateShipmentHeader(
        { ...ok, postingDate: "2026-09-05", backdateReason: "chờ hóa đơn" },
        false,
      ),
    ).toEqual([]);
  });
  it("ngày đã CHỐT ⇒ bắt lý do dù cùng ngày", () => {
    const ls = validateShipmentHeader(ok, true);
    expect(fieldsOf(ls)).toContain("Lý do ghi bù");
    expect(ls[0].message).toMatch(/đã chốt/);
  });
});

describe("importLineHasData / isLineComplete", () => {
  const emptyRow: ImportLine = {
    key: "k",
    id: null,
    category: "Bạch tuộc",
    materialTypeName: "",
    quantityKg: 0,
    unitPrice: null,
  };
  it("dòng trống: chưa có data, chưa đủ", () => {
    expect(importLineHasData(emptyRow)).toBe(false);
    expect(isLineComplete(emptyRow)).toBe(false);
  });
  it("chỉ có giá ⇒ có data nhưng chưa đủ; có loại + kg>0 ⇒ đủ", () => {
    expect(importLineHasData({ ...emptyRow, unitPrice: 1 })).toBe(true);
    expect(isLineComplete({ ...emptyRow, unitPrice: 1 })).toBe(false);
    expect(
      isLineComplete({
        ...emptyRow,
        materialTypeName: "Bạch tuộc 2 da",
        quantityKg: 10,
      }),
    ).toBe(true);
  });
});

describe("gợi ý theo đại lý", () => {
  const ledgerRows: MaterialImportItem[] = [
    row({
      id: "1",
      shipmentId: "s1",
      deliveryDate: "2026-09-01",
      licensePlate: "72C-16603",
      driverName: "Toàn",
      materialTypeName: "BT 1 da",
      category: "Bạch tuộc",
      unitPrice: 150000,
      quantityKg: 10,
    }),
    row({
      id: "2",
      shipmentId: "s1",
      deliveryDate: "2026-09-01",
      licensePlate: "72C-16603",
      driverName: "Toàn",
      materialTypeName: "BT 2 da lớn",
      category: "Bạch tuộc",
      unitPrice: 134000,
      quantityKg: 10,
    }),
    row({
      id: "3",
      shipmentId: "s2",
      deliveryDate: "2026-09-03",
      licensePlate: "72c 16603",
      driverName: "toàn",
      materialTypeName: "BT 1 da",
      category: "Bạch tuộc",
      unitPrice: 158000,
      quantityKg: 10,
    }),
    row({
      id: "4",
      shipmentId: "s2",
      deliveryDate: "2026-09-03",
      licensePlate: "72c 16603",
      driverName: "toàn",
      materialTypeName: "BT 2 da nhỏ",
      category: "Bạch tuộc",
      unitPrice: null,
      quantityKg: 10,
    }),
    row({
      id: "5",
      shipmentId: "s3",
      deliveryDate: "2026-09-02",
      supplierName: "Hương Pháp",
      licensePlate: "86C-19355",
      driverName: "Phi",
      materialTypeName: "BT 1 da",
      category: "Bạch tuộc",
      unitPrice: 160000,
      quantityKg: 10,
    }),
    row({
      id: "6",
      shipmentId: "s4",
      deliveryDate: "2026-09-02",
      workshop: "Cá",
      supplierName: "Cá Ba",
      materialTypeName: "Cá đổng",
      category: "Cá",
      quantityKg: 10,
    }),
  ];

  it("getFrequentSuppliers: theo xưởng, nhiều lượt đứng trước", () => {
    expect(getFrequentSuppliers(ledgerRows, "Đông")).toEqual(["Hồng Phú", "Hương Pháp"]);
    expect(getFrequentSuppliers(ledgerRows, "Cá")).toEqual(["Cá Ba"]);
    expect(getFrequentSuppliers(ledgerRows, "Khô")).toEqual([]);
  });

  it("getSupplierVehicles: biển số + tài xế TÁCH riêng; gộp biển viết khác kiểu, hiển thị viết hoa", () => {
    expect(getSupplierVehicles(ledgerRows, "Hồng Phú")).toEqual({
      plates: [{ licensePlate: "72C 16603", driverName: "toàn" }],
      drivers: ["toàn"],
    });
    expect(getSupplierVehicles(ledgerRows, "")).toEqual({ plates: [], drivers: [] });
  });

  it("getSupplierLineTemplates: loại của lượt mới nhất trước, giá gần nhất, kg trống, cờ goiY", () => {
    const m = getSupplierLineTemplates(ledgerRows, "Hồng Phú", "Đông");
    expect(
      m.map((d) => [
        d.materialTypeName,
        d.unitPrice,
        d.priceDate,
        d.quantityKg,
        d.isSuggested,
      ]),
    ).toEqual([
      ["BT 1 da", 158000, "2026-09-03", 0, true],
      ["BT 2 da nhỏ", null, undefined, 0, true],
      ["BT 2 da lớn", 134000, "2026-09-01", 0, true],
    ]);
    expect(getSupplierLineTemplates(ledgerRows, "Đại lý lạ", "Đông")).toEqual([]);
  });

  it("dòng gợi ý chưa gõ kg KHÔNG tính là có dữ liệu (lưu tự bỏ qua, không nài lỗi)", () => {
    const [d] = getSupplierLineTemplates(ledgerRows, "Hồng Phú", "Đông");
    expect(importLineHasData(d)).toBe(false);
    expect(importLineHasData({ ...d, quantityKg: 5 })).toBe(true);
    expect(importLineHasData({ ...d, isSuggested: false })).toBe(true); // người dùng tự sửa loại/giá ⇒ dòng thường
  });

  it("applyNewSupplierTemplate: đổi đại lý giữ kg đã gõ nhưng KHÔNG giữ giá của đại lý cũ", () => {
    const prev = getSupplierLineTemplates(ledgerRows, "Hồng Phú", "Đông").map((d, i) => ({
      ...d,
      quantityKg: i === 0 ? 1200 : i === 2 ? 300 : 0, // BT 1 da = 1200, BT 2 da lớn = 300
    }));
    const userEntered: ImportLine = {
      key: "k",
      id: null,
      category: "Mực",
      materialTypeName: "Mực ống",
      quantityKg: 50,
      unitPrice: 99000,
    };
    const result = applyNewSupplierTemplate(
      [...prev, userEntered],
      getSupplierLineTemplates(ledgerRows, "Hương Pháp", "Đông"),
    );
    expect(
      result.map((d) => [d.materialTypeName, d.quantityKg, d.unitPrice]),
    ).toEqual([
      ["BT 1 da", 1200, 160000], // giá của Hương Pháp, kg giữ
      ["BT 2 da lớn", 300, null], // Hương Pháp chưa từng giao ⇒ giá trống
      ["Mực ống", 50, 99000], // tự nhập ⇒ giữ nguyên
    ]);
  });

  it("getSkippedSuggestedLines: đếm dòng điền sẵn chưa gõ kg", () => {
    const m = getSupplierLineTemplates(ledgerRows, "Hồng Phú", "Đông");
    expect(getSkippedSuggestedLines(m)).toHaveLength(3);
    expect(getSkippedSuggestedLines([{ ...m[0], quantityKg: 5 }, m[1]])).toHaveLength(1);
  });
});

describe("OCR phiếu nhập → bảng loại hàng", () => {
  it("getKnownVehicles: mọi đại lý, mới nhất trước, gộp biến thể biển số / tên", () => {
    const rows = [
      row({ id: "1", deliveryDate: "2026-09-01", supplierName: "A", licensePlate: "72c 16603", driverName: "toàn" }),
      row({ id: "2", deliveryDate: "2026-09-05", supplierName: "B", licensePlate: "72C-166.03", driverName: "Toàn" }),
      row({ id: "3", deliveryDate: "2026-09-03", supplierName: "C", licensePlate: "51D-12345", driverName: "" }),
    ];
    expect(getKnownVehicles(rows)).toEqual({ plates: ["72C-166.03", "51D-12345"], drivers: ["Toàn"] });
    expect(getKnownVehicles(rows, 1).plates).toEqual(["72C-166.03"]);
  });

  const templateLine = (name: string, unitPrice: number | null): ImportLine => ({
    ...createEmptyImportLine("Bạch tuộc"),
    materialTypeName: name,
    unitPrice,
    isSuggested: true,
    priceDate: "2026-09-01",
  });
  const categoryOf = (n: string) => (n.startsWith("Cá") ? ("Cá" as const) : undefined);

  it("điền kg vào dòng mẫu cùng loại; giá phiếu thay giá mẫu, không ghi giá thì giữ giá cũ", () => {
    const out = mergeOcrLines(
      [templateLine("BT 1 da", 150000), templateLine("BT 2 da lớn", 134000)],
      [
        { materialType: "BT 1 da", kg: 12, unitPrice: 155000 },
        { materialType: "BT 2 da lớn", kg: 8 },
      ],
      categoryOf,
      "Bạch tuộc",
    );
    expect(out.map((d) => [d.materialTypeName, d.quantityKg, d.unitPrice, d.isSuggested, d.priceDate])).toEqual([
      ["BT 1 da", 12, 155000, false, undefined],
      ["BT 2 da lớn", 8, 134000, false, "2026-09-01"],
    ]);
  });

  it("loại không có dòng mẫu ⇒ thêm dòng mới, bỏ dòng trống hẳn, giữ dòng mẫu chưa dùng", () => {
    const out = mergeOcrLines(
      [templateLine("BT 1 da", 150000), createEmptyImportLine("Bạch tuộc")],
      [{ materialType: "Cá thu", kg: 30, unitPrice: null }],
      categoryOf,
      "Bạch tuộc",
    );
    expect(out.map((d) => [d.materialTypeName, d.quantityKg, d.category])).toEqual([
      ["BT 1 da", 0, "Bạch tuộc"],
      ["Cá thu", 30, "Cá"],
    ]);
  });

  it("cùng loại đọc hai lần ⇒ dòng mẫu nhận lần đầu, lần sau thành dòng riêng", () => {
    const out = mergeOcrLines(
      [templateLine("BT 1 da", 150000)],
      [
        { materialType: "BT 1 da", kg: 5 },
        { materialType: "BT 1 da", kg: 7 },
      ],
      categoryOf,
      "Bạch tuộc",
    );
    expect(out.map((d) => d.quantityKg)).toEqual([5, 7]);
  });
});

describe("buildSupplierHistory — lịch sử giao gửi kèm OCR", () => {
  it("đại lý giao gần nhất trước, loại mới nhất trước, giá gần nhất, khử trùng", () => {
    const rows = [
      row({ id: "1", deliveryDate: "2026-08-20", supplierName: "Hồng Phú", materialTypeName: "Bạch tuộc 1 da", unitPrice: 150000 }),
      row({ id: "2", deliveryDate: "2026-08-22", supplierName: "Hồng Phú", materialTypeName: "Bạch tuộc 1 da", unitPrice: 158000 }),
      row({ id: "3", deliveryDate: "2026-08-22", supplierName: "Hồng Phú", materialTypeName: "Bạch tuộc 2 da lớn (80↑)", unitPrice: null }),
      row({ id: "4", deliveryDate: "2026-08-21", supplierName: "Phú Quý", materialTypeName: "Mực ống", unitPrice: 90000 }),
    ];
    expect(buildSupplierHistory(rows)).toEqual([
      "Hồng Phú: Bạch tuộc 2 da lớn (80↑) · Bạch tuộc 1 da (158.000)",
      "Phú Quý: Mực ống (90.000)",
    ]);
    expect(buildSupplierHistory(rows, 1)).toHaveLength(1);
  });
});

describe("bảng đối chiếu OCR — tick ô nào điền ô đó", () => {
  const r = {
    text: "",
    kgValues: [],
    materialTypes: [],
    date: "2026-08-22",
    supplier: "Hồng Phú",
    licensePlate: "51M-05772",
    lines: [
      { materialType: "Bạch tuộc 1 da", kg: 2014 },
      { materialType: "Bạch tuộc 2 da lớn (80↑)", kg: 11017 },
    ],
  };
  it("mặc định tick mọi ô đọc được + mọi dòng", () => {
    const sel = defaultOcrSelection(r);
    expect([...sel.header].sort()).toEqual(["date", "licensePlate", "supplier"]);
    expect([...sel.lines]).toEqual([0, 1]);
  });
  it("bỏ tick ⇒ ô đó coi như không đọc được, dòng bị loại", () => {
    const out = applyOcrSelection(r, { header: new Set(["date"]), lines: new Set([1]) });
    expect(out).toMatchObject({ date: "2026-08-22", supplier: undefined, licensePlate: undefined });
    expect(out.lines.map((l) => l.kg)).toEqual([11017]);
  });
});

describe("phế liệu cân cuối ngày — form một nút Lưu", () => {
  const scrap = (p: Partial<ScrapItem>): ScrapItem => ({
    id: "s1",
    periodId: "",
    name: "Nội tạng",
    quantityKg: 100,
    sellingPrice: null,
    date: "2026-10-14",
    workshop: "Đông",
    source: "Nhập hàng",
    ...p,
  });

  it("ngày chưa cân ⇒ có sẵn ô trống Nội tạng rồi Dạt", () => {
    const d = buildScrapDraft([]);
    expect(d.map((r) => [r.name, r.id, r.quantityKg])).toEqual([
      ["Nội tạng", null, null],
      ["Dạt", null, null],
    ]);
    expect(scrapDraftTotalKg(d)).toBe(0);
  });

  it("đã ghi Dạt + loại khác ⇒ giữ dòng đã ghi, chỉ thêm ô Nội tạng, loại hay gặp đứng trước", () => {
    const d = buildScrapDraft([scrap({ id: "a", name: "Vụn", quantityKg: 5 }), scrap({ id: "b", name: "dạt", quantityKg: 30 })]);
    expect(d.map((r) => [r.name, r.id])).toEqual([
      ["Nội tạng", null],
      ["dạt", "b"],
      ["Vụn", "a"],
    ]);
    expect(scrapDraftTotalKg(d)).toBe(35);
  });

  it("lưu: ô trống có kg ⇒ ghi mới đúng ngày/xưởng; ô để trống ⇒ không ghi", () => {
    const draft = buildScrapDraft([]);
    draft[0].quantityKg = 120;
    const r = applyScrapDraft([], draft, "2026-10-14", "Cá");
    expect(r.added).toBe(1);
    expect(r.next).toHaveLength(1);
    expect(r.next[0]).toMatchObject({ name: "Nội tạng", quantityKg: 120, date: "2026-10-14", workshop: "Cá", source: "Nhập hàng", periodId: "" });
  });

  it("lưu: sửa kg dòng cũ ⇒ cập nhật, xóa kg ⇒ bỏ dòng; dòng ngày khác không đụng", () => {
    const other = scrap({ id: "x", date: "2026-10-13" });
    const all = [scrap({ id: "a", quantityKg: 100 }), scrap({ id: "b", name: "Dạt", quantityKg: 30, periodId: "k1" }), other];
    const draft = buildScrapDraft(all.slice(0, 2));
    draft.find((r) => r.id === "a")!.quantityKg = 90;
    draft.find((r) => r.id === "b")!.quantityKg = null;
    const r = applyScrapDraft(all, draft, "2026-10-14", "Đông");
    expect([r.added, r.updated, r.removed]).toEqual([0, 1, 1]);
    expect(r.next.find((x) => x.id === "a")?.quantityKg).toBe(90);
    expect(r.next.some((x) => x.id === "b")).toBe(false);
    expect(r.next).toContain(other);
  });

  it("không đổi gì ⇒ changed = false (khỏi báo đã lưu)", () => {
    const all = [scrap({ id: "a" })];
    expect(applyScrapDraft(all, buildScrapDraft(all), "2026-10-14", "Đông").changed).toBe(false);
  });

  it("có kg mà chưa chọn loại ⇒ báo lỗi", () => {
    const draft = [...buildScrapDraft([]), { key: "n1", id: null, name: " ", quantityKg: 4, sellingPrice: null, periodId: "" }];
    expect(validateScrapDraft(draft)).toHaveLength(1);
    expect(validateScrapDraft(buildScrapDraft([]))).toHaveLength(0);
  });
});
