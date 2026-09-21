import { describe, it, expect } from "vitest";
import {
  sinhMaLo,
  gomChuyen,
  loiDauChuyen,
  dongCoData,
  dongDayDu,
  daiLyHayGiao,
  xeCuaDaiLy,
  mauDongCuaDaiLy,
  apMauDaiLyMoi,
  dongGoiYBoQua,
  type DauChuyen,
  type DongBang,
} from "./importHelpers";
import type { ImportShipment, MaterialImportItem } from "@/types";

// Logic gom chuyến / ghi bù / mã lô — CLAUDE.md xếp đây là chỗ đáng test nhất
// sau balancingCalc. Hàm thuần, tách khỏi màn 2026-09-21.

const chuyen = (p: Partial<ImportShipment>): ImportShipment =>
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

const dong = (p: Partial<MaterialImportItem>): MaterialImportItem =>
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

describe("sinhMaLo", () => {
  it("‹chữ xưởng›-‹yymmdd›-‹stt trong ngày›, stt đếm theo cùng ngày + cùng xưởng", () => {
    expect(sinhMaLo("2026-09-02", "Đông", [])).toBe("Đ-260902-01");
    const daCo = [
      chuyen({ id: "a" }),
      chuyen({ id: "b" }),
      chuyen({ id: "c", workshop: "Cá" }), // xưởng khác — không đếm
      chuyen({ id: "d", deliveryDate: "2026-09-01" }), // ngày khác — không đếm
    ];
    expect(sinhMaLo("2026-09-02", "Đông", daCo)).toBe("Đ-260902-03");
    expect(sinhMaLo("2026-09-02", "Khô", daCo)).toBe("K-260902-01");
  });
});

describe("gomChuyen", () => {
  it("gom dòng theo chuyến THẬT (shipmentId), cộng kg + tiền, cờ ghi bù theo chuyến", () => {
    const cs = [chuyen({ id: "c1", postingDate: "2026-09-05" })]; // ghi sổ SAU ngày về ⇒ ghi bù
    const rows = [
      dong({ id: "r1", shipmentId: "c1", quantityKg: 100, unitPrice: 20 }),
      dong({ id: "r2", shipmentId: "c1", quantityKg: 50, unitPrice: null }),
    ];
    const g = gomChuyen(rows, cs);
    expect(g).toHaveLength(1);
    expect(g[0].khoa).toBe("c1");
    expect(g[0].chuyen?.id).toBe("c1");
    expect(g[0].dong).toHaveLength(2);
    expect(g[0].tongKg).toBe(150);
    expect(g[0].tongTien).toBe(2000); // 100*20 + 50*0
    expect(g[0].ghiBu).toBe(true);
  });

  it("dòng CŨ không có shipmentId ⇒ gom ngầm theo (ngày|xưởng|đại lý|xe), chuyen=null, không ghi bù", () => {
    const rows = [
      dong({ id: "r1", quantityKg: 10, licensePlate: "72C-1" }),
      dong({ id: "r2", quantityKg: 20, licensePlate: "72C-1" }),
      dong({ id: "r3", quantityKg: 5, licensePlate: "72C-2" }), // xe khác ⇒ nhóm khác
    ];
    const g = gomChuyen(rows, []);
    expect(g).toHaveLength(2);
    const n1 = g.find((x) => x.licensePlate === "72C-1")!;
    expect(n1.chuyen).toBeNull();
    expect(n1.khoa.startsWith("ngam|")).toBe(true);
    expect(n1.tongKg).toBe(30);
    expect(n1.ghiBu).toBe(false);
  });

  it("sắp theo ngày về rồi tên đại lý", () => {
    const rows = [
      dong({ id: "a", deliveryDate: "2026-09-03", supplierName: "Bé Ba" }),
      dong({ id: "b", deliveryDate: "2026-09-01", supplierName: "Hiếu Phấn" }),
      dong({ id: "c", deliveryDate: "2026-09-01", supplierName: "Bé Ba" }),
    ];
    const g = gomChuyen(rows, []);
    expect(g.map((x) => `${x.deliveryDate}|${x.supplierName}`)).toEqual([
      "2026-09-01|Bé Ba",
      "2026-09-01|Hiếu Phấn",
      "2026-09-03|Bé Ba",
    ]);
  });
});

describe("loiDauChuyen", () => {
  const ok: DauChuyen = {
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
  const truong = (ls: ReturnType<typeof loiDauChuyen>) =>
    ls.map((l) => l.truong);

  it("đầu chuyến hợp lệ ⇒ không lỗi", () => {
    expect(loiDauChuyen(ok, false)).toEqual([]);
  });
  it("thiếu đại lý", () => {
    expect(
      truong(loiDauChuyen({ ...ok, supplierName: "  " }, false)),
    ).toContain("Đại lý");
  });
  it("ngày ghi sổ trước ngày hàng về ⇒ lỗi", () => {
    expect(
      truong(loiDauChuyen({ ...ok, postingDate: "2026-09-01" }, false)),
    ).toContain("Ngày ghi sổ");
  });
  it("ghi sổ SAU ngày về mà không có lý do ⇒ bắt lý do ghi bù", () => {
    expect(
      truong(loiDauChuyen({ ...ok, postingDate: "2026-09-05" }, false)),
    ).toContain("Lý do ghi bù");
    expect(
      loiDauChuyen(
        { ...ok, postingDate: "2026-09-05", backdateReason: "chờ hóa đơn" },
        false,
      ),
    ).toEqual([]);
  });
  it("ngày đã CHỐT ⇒ bắt lý do dù cùng ngày", () => {
    const ls = loiDauChuyen(ok, true);
    expect(truong(ls)).toContain("Lý do ghi bù");
    expect(ls[0].thongBao).toMatch(/đã chốt/);
  });
});

describe("dongCoData / dongDayDu", () => {
  const trong: DongBang = {
    key: "k",
    id: null,
    category: "Bạch tuộc",
    materialTypeName: "",
    quantityKg: 0,
    unitPrice: null,
  };
  it("dòng trống: chưa có data, chưa đủ", () => {
    expect(dongCoData(trong)).toBe(false);
    expect(dongDayDu(trong)).toBe(false);
  });
  it("chỉ có giá ⇒ có data nhưng chưa đủ; có loại + kg>0 ⇒ đủ", () => {
    expect(dongCoData({ ...trong, unitPrice: 1 })).toBe(true);
    expect(dongDayDu({ ...trong, unitPrice: 1 })).toBe(false);
    expect(
      dongDayDu({
        ...trong,
        materialTypeName: "Bạch tuộc 2 da",
        quantityKg: 10,
      }),
    ).toBe(true);
  });
});

describe("gợi ý theo đại lý", () => {
  const so: MaterialImportItem[] = [
    dong({
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
    dong({
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
    dong({
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
    dong({
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
    dong({
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
    dong({
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

  it("daiLyHayGiao: theo xưởng, nhiều lượt đứng trước", () => {
    expect(daiLyHayGiao(so, "Đông")).toEqual(["Hồng Phú", "Hương Pháp"]);
    expect(daiLyHayGiao(so, "Cá")).toEqual(["Cá Ba"]);
    expect(daiLyHayGiao(so, "Khô")).toEqual([]);
  });

  it("xeCuaDaiLy: biển số + tài xế TÁCH riêng; gộp biển viết khác kiểu, hiển thị viết hoa", () => {
    expect(xeCuaDaiLy(so, "Hồng Phú")).toEqual({
      bienSo: [{ licensePlate: "72C 16603", driverName: "toàn" }],
      taiXe: ["toàn"],
    });
    expect(xeCuaDaiLy(so, "")).toEqual({ bienSo: [], taiXe: [] });
  });

  it("mauDongCuaDaiLy: loại của lượt mới nhất trước, giá gần nhất, kg trống, cờ goiY", () => {
    const m = mauDongCuaDaiLy(so, "Hồng Phú", "Đông");
    expect(
      m.map((d) => [
        d.materialTypeName,
        d.unitPrice,
        d.giaNgay,
        d.quantityKg,
        d.goiY,
      ]),
    ).toEqual([
      ["BT 1 da", 158000, "2026-09-03", 0, true],
      ["BT 2 da nhỏ", null, undefined, 0, true],
      ["BT 2 da lớn", 134000, "2026-09-01", 0, true],
    ]);
    expect(mauDongCuaDaiLy(so, "Đại lý lạ", "Đông")).toEqual([]);
  });

  it("dòng gợi ý chưa gõ kg KHÔNG tính là có dữ liệu (lưu tự bỏ qua, không nài lỗi)", () => {
    const [d] = mauDongCuaDaiLy(so, "Hồng Phú", "Đông");
    expect(dongCoData(d)).toBe(false);
    expect(dongCoData({ ...d, quantityKg: 5 })).toBe(true);
    expect(dongCoData({ ...d, goiY: false })).toBe(true); // người dùng tự sửa loại/giá ⇒ dòng thường
  });

  it("apMauDaiLyMoi: đổi đại lý giữ kg đã gõ nhưng KHÔNG giữ giá của đại lý cũ", () => {
    const cu = mauDongCuaDaiLy(so, "Hồng Phú", "Đông").map((d, i) => ({
      ...d,
      quantityKg: i === 0 ? 1200 : i === 2 ? 300 : 0, // BT 1 da = 1200, BT 2 da lớn = 300
    }));
    const tuNhap: DongBang = {
      key: "k",
      id: null,
      category: "Mực",
      materialTypeName: "Mực ống",
      quantityKg: 50,
      unitPrice: 99000,
    };
    const kq = apMauDaiLyMoi(
      [...cu, tuNhap],
      mauDongCuaDaiLy(so, "Hương Pháp", "Đông"),
    );
    expect(
      kq.map((d) => [d.materialTypeName, d.quantityKg, d.unitPrice]),
    ).toEqual([
      ["BT 1 da", 1200, 160000], // giá của Hương Pháp, kg giữ
      ["BT 2 da lớn", 300, null], // Hương Pháp chưa từng giao ⇒ giá trống
      ["Mực ống", 50, 99000], // tự nhập ⇒ giữ nguyên
    ]);
  });

  it("dongGoiYBoQua: đếm dòng điền sẵn chưa gõ kg", () => {
    const m = mauDongCuaDaiLy(so, "Hồng Phú", "Đông");
    expect(dongGoiYBoQua(m)).toHaveLength(3);
    expect(dongGoiYBoQua([{ ...m[0], quantityKg: 5 }, m[1]])).toHaveLength(1);
  });
});
