// ============================================================
// Tên file: src/features/balancing/usePeriodGrid.ts
// Tên tiếng Việt: Hook dữ liệu + thao tác của một kỳ cân đối
// Description: Data + actions for one balancing period (grid screen)
// ============================================================
import { useCallback, useEffect, useMemo } from "react";
import type {
  BalancingInputItem,
  BalancingOutputItem,
  BalancingPeriod,
  MaterialImportItem,
  WipProductionItem,
} from "@/types";
import { uid } from "@/lib/db";
import { num, todayISO, viDate } from "@/lib/format";
import { notify } from "@/design-system";
import { calculateBalancing, type BalancingResult } from "@/lib/balancingCalc";
import {
  dungHangNL,
  dungHangTP,
  ghiNguocNhapNgay,
  ghiNguocSanLuongNgay,
  gomNhapTheoLoai,
  gomSanXuatTheoMatHang,
  khoaMatHang,
  nhapHangHopLe,
  nhapTrongKhoangNgay,
  ngayTrongKy,
  sanXuatHopLe,
  type HangLuoiNL,
  type HangLuoiTP,
} from "@/lib/balancingGrid";
import {
  useBalancingInputs,
  useBalancingOutputs,
  useMaterialImports,
  useProductionLocks,
  useWipProductions,
} from "@/lib/catalogRepo";

/** Một ô ngày cần ghi về sổ nguồn. */
export interface ONgay {
  /** Khoá dòng lưới: tên loại NL (khối 1) hoặc mặt hàng|quy cách (khối 2). */
  khoa: string;
  ngay: string;
  kg: number;
}

export interface PeriodGrid {
  kyId: string;
  ngay: string[];
  /* --- khối 1 --- */
  nlVao: BalancingInputItem[];
  hangNL: HangLuoiNL[];
  nhapDaGan: MaterialImportItem[];
  nhapChoHut: MaterialImportItem[];
  /** Dòng sổ nhập trong khoảng ngày nhưng KHÁC họ nguyên liệu — chọn tay. */
  nhapKhacLoai: MaterialImportItem[];
  ghiNL: (rows: BalancingInputItem[]) => void;
  hutNhapHang: (ids?: string[]) => void;
  /** Ghi nhiều ô ngày về sổ Nhập hàng. Trả về false nếu bị từ chối. */
  ghiNhapNhieuNgay: (dsO: ONgay[]) => boolean;
  /* --- khối 2 --- */
  tp: BalancingOutputItem[];
  hangTP: HangLuoiTP[];
  sanXuatDaGan: WipProductionItem[];
  sanXuatChoHut: WipProductionItem[];
  ghiTP: (rows: BalancingOutputItem[]) => void;
  hutSanXuat: () => void;
  ghiSanXuatNhieuNgay: (dsO: ONgay[], lyDoGhiBu: string) => boolean;
  ngayDaChot: Set<string>;
  /* --- kết quả --- */
  kq: BalancingResult;
}

/**
 * Tất cả dữ liệu + thao tác của MỘT kỳ cân đối.
 *
 * Gom vào một chỗ vì màn cân đối đụng năm nguồn dữ liệu (hai bảng của kỳ, hai
 * sổ nguồn, bảng chốt ngày) và ba luật dễ sai: ghép lại danh sách con khi ghi,
 * hút bằng cách gán kỳ chứ không chép số, ghi ngược theo LÔ chứ không từng ô.
 * Để rải trong component thì mỗi lần thêm một cột lại phải nhớ lại cả ba.
 */
export function usePeriodGrid(ky: BalancingPeriod): PeriodGrid {
  const [tatCaNL, ghiTatCaNL] = useBalancingInputs();
  const [tatCaTP, ghiTatCaTP] = useBalancingOutputs();
  const [tatCaNhap, ghiTatCaNhap] = useMaterialImports();
  const [tatCaSanXuat, ghiTatCaSanXuat] = useWipProductions();
  const [chotSanXuat] = useProductionLocks();

  const ngay = useMemo(() => ngayTrongKy(ky), [ky]);

  /* Repo trả về dòng của MỌI kỳ. Ghi mà quên ghép lại với kỳ khác = xoá sạch
     các kỳ đó (xem 04-tang-du-lieu.md). Bọc một lần ở đây. */
  const nlVao = useMemo(() => tatCaNL.filter((r) => r.periodId === ky.id), [tatCaNL, ky.id]);
  const tp = useMemo(() => tatCaTP.filter((r) => r.periodId === ky.id), [tatCaTP, ky.id]);

  const ghiNL = useCallback(
    (rows: BalancingInputItem[]) =>
      ghiTatCaNL([...tatCaNL.filter((r) => r.periodId !== ky.id), ...rows]),
    [ghiTatCaNL, tatCaNL, ky.id]
  );
  const ghiTP = useCallback(
    (rows: BalancingOutputItem[]) =>
      ghiTatCaTP([...tatCaTP.filter((r) => r.periodId !== ky.id), ...rows]),
    [ghiTatCaTP, tatCaTP, ky.id]
  );

  /* ---------- Sổ Nhập hàng ---------- */

  const nhapDaGan = useMemo(
    () => tatCaNhap.filter((r) => r.balancingPeriodId === ky.id),
    [tatCaNhap, ky.id]
  );
  const nhapChoHut = useMemo(
    () => nhapHangHopLe(ky, tatCaNhap).filter((r) => !r.balancingPeriodId),
    [ky, tatCaNhap]
  );
  /* Khớp theo tên loại NL hay trượt vì sổ nhập ghi tên tự do. Giữ sẵn danh sách
     "trong khoảng ngày nhưng khác loại" để người dùng tự tick, thay vì màn hình
     báo "không có gì để lấy" trong khi sổ đầy số. */
  const nhapKhacLoai = useMemo(() => {
    const daGoiY = new Set(nhapChoHut.map((r) => r.id));
    return nhapTrongKhoangNgay(ky, tatCaNhap).filter((r) => !daGoiY.has(r.id));
  }, [ky, tatCaNhap, nhapChoHut]);

  const hutNhapHang = useCallback(
    (ids?: string[]) => {
      const chon = ids
        ? tatCaNhap.filter((r) => ids.includes(r.id) && !r.balancingPeriodId)
        : nhapChoHut;
      if (chon.length === 0) return;
      const truocNhap = tatCaNhap;
      const truocNL = tatCaNL;
      const bo = new Set(chon.map((r) => r.id));
      ghiTatCaNhap(
        tatCaNhap.map((r) => (bo.has(r.id) ? { ...r, balancingPeriodId: ky.id } : r))
      );

      /* Mỗi loại NL một dòng lưới; loại đã có dòng thì giữ nguyên. */
      const daCo = new Set(nlVao.filter((r) => r.autoSource === "imports").map((r) => r.name));
      const them: BalancingInputItem[] = [];
      for (const [loai, o] of gomNhapTheoLoai([...nhapDaGan, ...chon])) {
        if (daCo.has(loai)) continue;
        them.push({
          id: uid(),
          periodId: ky.id,
          groupName: "Thủy sản",
          name: loai,
          quantityKg: Object.values(o.theoNgay).reduce((s, v) => s + v, 0),
          unitPrice: o.donGia,
          ratioPercentage: null,
          sourceWarehouse: "",
          dailyQuantities: {},
          carryOverKg: 0,
          isReduction: false,
          reductionWarehouseId: "",
          autoSource: "imports",
        });
      }
      if (them.length > 0) ghiNL([...nlVao, ...them]);
      notify.daLuu(`Đã lấy ${chon.length} dòng nhập hàng vào kỳ`, () => {
        ghiTatCaNhap(truocNhap);
        ghiTatCaNL(truocNL);
      });
    },
    [tatCaNhap, nhapChoHut, tatCaNL, nlVao, nhapDaGan, ghiTatCaNhap, ghiTatCaNL, ghiNL, ky.id]
  );

  /**
   * Ghi nhiều ô ngày về sổ Nhập hàng trong MỘT lần. Khoá dòng là TÊN loại
   * nguyên liệu vì sổ nhập lưu theo tên (xem 30-nhap-hang.md).
   */
  const ghiNhapNhieuNgay = useCallback(
    (dsO: ONgay[]): boolean => {
      if (dsO.length === 0) return true;
      const sua = new Map<string, number>();
      const them: MaterialImportItem[] = [];
      let hienTai = nhapDaGan;
      for (const o of dsO) {
        const trongNgay = hienTai.filter(
          (r) => r.materialTypeName === o.khoa && r.deliveryDate === o.ngay
        );
        const kq = ghiNguocNhapNgay(trongNgay, o.kg);
        if (kq.loai === "tuChoi") {
          notify.loi(kq.lyDo);
          return false;
        }
        if (kq.loai === "sua") {
          sua.set(kq.id, kq.kg);
          hienTai = hienTai.map((r) => (r.id === kq.id ? { ...r, quantityKg: kq.kg } : r));
        } else {
          if (kq.kg === 0) continue;
          const mau = nhapDaGan.find((r) => r.materialTypeName === o.khoa);
          const moi: MaterialImportItem = {
            id: uid(),
            shipmentId: "",
            deliveryDate: o.ngay,
            workshop: mau?.workshop ?? "Đông",
            category: mau?.category ?? "Khác",
            supplierName: mau?.supplierName ?? "",
            materialTypeName: o.khoa,
            quantityKg: kq.kg,
            unitPrice: mau?.unitPrice ?? null,
            driverName: "",
            licensePlate: "",
            note: "Ghi từ lưới cân đối",
            balancingPeriodId: ky.id,
          };
          them.push(moi);
          hienTai = [...hienTai, moi];
        }
      }
      if (sua.size === 0 && them.length === 0) return true;
      const truoc = tatCaNhap;
      ghiTatCaNhap([
        ...tatCaNhap.map((r) => {
          const kg = sua.get(r.id);
          return kg == null ? r : { ...r, quantityKg: kg };
        }),
        ...them,
      ]);
      notify.daLuu(
        dsO.length === 1
          ? `Đã ghi ${num(dsO[0].kg)} kg ngày ${viDate(dsO[0].ngay)} vào sổ nhập hàng`
          : `Đã ghi ${dsO.length} ô vào sổ nhập hàng`,
        () => ghiTatCaNhap(truoc)
      );
      return true;
    },
    [nhapDaGan, tatCaNhap, ghiTatCaNhap, ky.id]
  );

  /* ---------- Sổ Sản xuất ---------- */

  const sanXuatDaGan = useMemo(
    () => tatCaSanXuat.filter((r) => r.balancingPeriodId === ky.id),
    [tatCaSanXuat, ky.id]
  );
  const sanXuatChoHut = useMemo(
    () => sanXuatHopLe(ky, tatCaSanXuat).filter((r) => !r.balancingPeriodId),
    [ky, tatCaSanXuat]
  );

  const hutSanXuat = useCallback(() => {
    if (sanXuatChoHut.length === 0) return;
    const truocSX = tatCaSanXuat;
    const truocTP = tatCaTP;
    const bo = new Set(sanXuatChoHut.map((r) => r.id));
    ghiTatCaSanXuat(
      tatCaSanXuat.map((r) => (bo.has(r.id) ? { ...r, balancingPeriodId: ky.id } : r))
    );
    const daCo = new Set(
      tp
        .filter((r) => r.autoSource === "production")
        .map((r) => khoaMatHang(r.productId, r.spec ?? ""))
    );
    const them: BalancingOutputItem[] = [];
    for (const [khoa, o] of gomSanXuatTheoMatHang([...sanXuatDaGan, ...sanXuatChoHut])) {
      if (daCo.has(khoa)) continue;
      const [productId, spec] = khoa.split("|");
      them.push({
        id: uid(),
        periodId: ky.id,
        productId,
        customerId: "",
        channel: "Xuất khẩu",
        quantityKg: Object.values(o.theoNgay).reduce((s, v) => s + v, 0),
        unitPrice: null,
        spec: spec ?? "",
        salesItemId: "",
        dailyQuantities: {},
        carryOverKg: 0,
        carryOverPeriodId: "",
        autoSource: "production",
      });
    }
    if (them.length > 0) ghiTP([...tp, ...them]);
    notify.daLuu(`Đã lấy ${sanXuatChoHut.length} dòng sản xuất vào kỳ`, () => {
      ghiTatCaSanXuat(truocSX);
      ghiTatCaTP(truocTP);
    });
  }, [
    sanXuatChoHut,
    sanXuatDaGan,
    tatCaSanXuat,
    tatCaTP,
    tp,
    ghiTatCaSanXuat,
    ghiTatCaTP,
    ghiTP,
    ky.id,
  ]);

  const ngayDaChot = useMemo(
    () => new Set(chotSanXuat.filter((c) => c.isLocked).map((c) => c.lockDate)),
    [chotSanXuat]
  );

  const ghiSanXuatNhieuNgay = useCallback(
    (dsO: ONgay[], lyDoGhiBu: string): boolean => {
      if (dsO.length === 0) return true;
      const sua = new Map<string, number>();
      const them: WipProductionItem[] = [];
      let hienTai = sanXuatDaGan;
      for (const o of dsO) {
        const [matHangId, quyCach = ""] = o.khoa.split("|");
        const trongNgay = hienTai.filter(
          (r) =>
            r.productId === matHangId && r.spec === quyCach && r.productionDate === o.ngay
        );
        const kq = ghiNguocSanLuongNgay(trongNgay, o.kg);
        if (kq.loai === "tuChoi") {
          notify.loi(kq.lyDo);
          return false;
        }
        if (kq.loai === "sua") {
          sua.set(kq.id, kq.kg);
          hienTai = hienTai.map((r) => (r.id === kq.id ? { ...r, quantityKg: kq.kg } : r));
        } else {
          if (kq.kg === 0) continue;
          const moi: WipProductionItem = {
            id: uid(),
            productionDate: o.ngay,
            postingDate: todayISO(),
            backdateReason: lyDoGhiBu,
            workshop: "Đông",
            productId: matHangId,
            spec: quyCach,
            quantityKg: kq.kg,
            blocksCount: 0,
            warehouse: "",
            status: "cho-nhap",
            note: "Ghi từ lưới cân đối",
            balancingPeriodId: ky.id,
          };
          them.push(moi);
          hienTai = [...hienTai, moi];
        }
      }
      if (sua.size === 0 && them.length === 0) return true;
      const truoc = tatCaSanXuat;
      ghiTatCaSanXuat([
        ...tatCaSanXuat.map((r) => {
          const kg = sua.get(r.id);
          if (kg == null) return r;
          return {
            ...r,
            quantityKg: kg,
            backdateReason: lyDoGhiBu || r.backdateReason,
            postingDate: lyDoGhiBu ? todayISO() : r.postingDate,
          };
        }),
        ...them,
      ]);
      notify.daLuu(
        dsO.length === 1
          ? `Đã ghi ${num(dsO[0].kg)} kg ngày ${viDate(dsO[0].ngay)} vào sổ sản xuất`
          : `Đã ghi ${dsO.length} ô vào sổ sản xuất`,
        () => ghiTatCaSanXuat(truoc)
      );
      return true;
    },
    [sanXuatDaGan, tatCaSanXuat, ghiTatCaSanXuat, ky.id]
  );

  /* ---------- Dòng lưới + kết quả ---------- */

  const hangNL = useMemo(() => dungHangNL(nlVao, nhapDaGan), [nlVao, nhapDaGan]);
  const hangTP = useMemo(() => dungHangTP(tp, sanXuatDaGan), [tp, sanXuatDaGan]);

  /* Dòng hút đọc sản lượng thẳng từ sổ nguồn, nhưng `calculateBalancing` (bất
     biến, không sửa) đọc `quantityKg`. Tính kết quả từ bản đã đồng bộ thay vì
     ghi ngược xuống kho rồi chờ vòng render sau — số trên màn khớp ngay lúc gõ. */
  const nlChoTinh = useMemo(
    () =>
      nlVao.map((r) => {
        const h = hangNL.find((x) => x.id === r.id);
        return h && h.tong !== r.quantityKg ? { ...r, quantityKg: h.tong } : r;
      }),
    [nlVao, hangNL]
  );
  const tpChoTinh = useMemo(
    () =>
      tp.map((r) => {
        const h = hangTP.find((x) => x.id === r.id);
        return h && h.tong !== r.quantityKg ? { ...r, quantityKg: h.tong } : r;
      }),
    [tp, hangTP]
  );

  /* …và ghi con số đã đồng bộ xuống kho để bản in và màn khác đọc đúng. Chạy
     trong effect (không phải lúc render) và chỉ ghi khi thật sự lệch nên hội tụ
     sau đúng một vòng. */
  useEffect(() => {
    if (nlChoTinh.some((r, i) => r !== nlVao[i])) ghiNL(nlChoTinh);
  }, [nlChoTinh, nlVao, ghiNL]);
  useEffect(() => {
    if (tpChoTinh.some((r, i) => r !== tp[i])) ghiTP(tpChoTinh);
  }, [tpChoTinh, tp, ghiTP]);

  /* Phế liệu không còn là đầu vào của kỳ (xem 31-can-doi-ky.md) — truyền []. */
  const kq = useMemo(
    () => calculateBalancing(ky, nlChoTinh, [], tpChoTinh),
    [ky, nlChoTinh, tpChoTinh]
  );

  return {
    kyId: ky.id,
    ngay,
    nlVao,
    hangNL,
    nhapDaGan,
    nhapChoHut,
    nhapKhacLoai,
    ghiNL,
    hutNhapHang,
    ghiNhapNhieuNgay,
    tp,
    hangTP,
    sanXuatDaGan,
    sanXuatChoHut,
    ghiTP,
    hutSanXuat,
    ghiSanXuatNhieuNgay,
    ngayDaChot,
    kq,
  };
}
