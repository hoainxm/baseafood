// ============================================================
// Tên file: src/features/balancing/usePeriodGrid.ts
// Tên tiếng Việt: Hook dữ liệu + thao tác của một kỳ cân đối
// Description: Data + actions for one balancing period (grid screen)
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BalancingInputItem,
  BalancingOutputItem,
  BalancingPeriod,
  DailyQuantities,
  MaterialImportItem,
  MonthlyStockLine,
  WipProductionItem,
} from "@/types";
import { BSF1_WAREHOUSES } from "@/types";
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
  hoNguyenLieu,
  khoaMatHang,
  chuyenKyChoNhan,
  chuyenNhapTheoNgay,
  cungHoNguyenLieu,
  kyLienTruoc,
  kyTrungNgayCungHo,
  kyMauTP,
  loaiDongKho,
  dungDongMauTP,
  dongMauConThieu,
  goiYKhachGia,
  type DongMauTP,
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
  useBalancingPeriods,
  useMaterialImports,
  useMaterialOpeningStock,
  useMonthlyStock,
  useProductionLocks,
  useStorageLocations,
  useWipProductions,
} from "@/lib/catalogRepo";
import {
  danhSachKhoGui,
  danhSachLo,
  dongBoSoKho,
  soChoLechSoKho,
  tachKhoGui,
  thangCuaNgay,
  type LuaChonLo,
} from "@/lib/khoCanDoi";
import { conDoTheoNgay, tinhSoTonNL, type SoTonNLKy } from "@/lib/inventoryMaterial";

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
  /** Dòng trong khoảng ngày nhưng ĐANG thuộc kỳ khác — giải thích + kéo về. */
  nhapKyKhac: MaterialImportItem[];
  /** Tên loại NL của kỳ. */
  tenLoaiKy: string;
  /** Kỳ KHÁC cùng họ NL có khoảng ngày chồng lên kỳ này (tạo trùng kỳ). */
  kyTrungNgay: BalancingPeriod[];
  /** Dòng sổ nhập có cùng họ nguyên liệu với kỳ không (để hộp chọn tay chỉ tick sẵn dòng đúng loại). */
  cungHoKy: (r: MaterialImportItem) => boolean;
  /** Đếm để màn hình nói được vì sao trống. */
  chanDoanNhap: { tongTrongKhoang: number; chuaGan: number; kyKhac: number; lechTen: number };
  /** Ghi khối NL (kèm đồng bộ Sổ kho tháng cho 2 dòng kho). false = bị chặn (đã báo lỗi). */
  ghiNL: (rows: BalancingInputItem[]) => boolean;
  hutNhapHang: (ids?: string[]) => void;
  /** Ghi nhiều ô ngày về sổ Nhập hàng. Trả về false nếu bị từ chối. */
  ghiNhapNhieuNgay: (dsO: ONgay[]) => boolean;
  /** Tồn kho đông của họ NL này qua kỳ (tồn đầu · gửi đông · xả đông · tồn cuối) — sống theo từng phím gõ. */
  tonKhoDong: SoTonNLKy | null;
  /** Còn dở SX theo ngày chốt trong kỳ (cùng họ) — đối chiếu / điền nhanh dòng Gửi đông. */
  conDoSXTheoNgay: DailyQuantities;
  /** Đơn giá dòng Gửi đông gần nhất (kỳ trước, cùng họ) — gợi ý giá cho Lấy xả đông. */
  giaGuiDongTruoc: number | null;
  /** Lô (Sổ kho tháng) để chọn ĐÍCH DANH cho dòng Lấy xả đông — tháng của ngày đầu kỳ. */
  luaChonLo: (dangChon: string[]) => LuaChonLo[];
  /** Kho nhận cho dòng Gửi đông: "<sổ kho>|<vị trí>". */
  luaChonKhoGui: { value: string; label: string; phu?: string }[];
  /** Mô tả lô / kho của một dòng kho (bản in, nhãn). */
  moTaDongKho: (r: BalancingInputItem) => string;
  /** Số chỗ Sổ kho tháng lệch phần kho của kỳ (VD sổ bị nạp lại đè) — 0 là khớp. */
  lechSoKho: number;
  /** Ghi lại toàn bộ phần kho của kỳ vào Sổ kho tháng (sửa lệch). */
  ghiLaiSoKho: () => void;
  /* --- khối 2 --- */
  tp: BalancingOutputItem[];
  hangTP: HangLuoiTP[];
  sanXuatDaGan: WipProductionItem[];
  sanXuatChoHut: WipProductionItem[];
  ghiTP: (rows: BalancingOutputItem[]) => void;
  hutSanXuat: () => void;
  /** Kỳ làm mẫu cho khối 2 (kỳ gần nhất cùng họ NL có dòng) — null nếu chưa có. */
  kyMau: BalancingPeriod | null;
  /** Dòng mẫu CHƯA có trong kỳ — hiện ảo, gõ vào mới thành dòng thật. */
  mauConThieu: DongMauTP[];
  /** Toàn bộ dòng mẫu (để so "giá = kỳ trước"). */
  mauTP: DongMauTP[];
  /** Gợi ý khách · kênh · giá cho một mặt hàng mới vào kỳ (mẫu → kỳ gần nhất). */
  goiY: (productId: string, spec: string) => Pick<DongMauTP, "customerId" | "channel" | "unitPrice"> | null;
  /** Hút cả sổ nhập + sổ sản xuất trong một chạm (KHÔNG đụng sổ bán). */
  hutTatCaNguon: () => void;
  ghiSanXuatNhieuNgay: (dsO: ONgay[], lyDoGhiBu: string) => boolean;
  ngayDaChot: Set<string>;
  /* --- chuyển kỳ --- */
  kyTruoc: BalancingPeriod | null;
  soDongChuyenKy: number;
  nhanChuyenKy: () => void;
  /* --- chốt kỳ --- */
  daChot: boolean;
  /* --- hoàn tác --- */
  hoanTacDuoc: boolean;
  lamLaiDuoc: boolean;
  hoanTac: () => void;
  lamLai: () => void;
  /* --- kết quả --- */
  kq: BalancingResult;
}

/** Ảnh chụp bốn bảng mà một kỳ có quyền đụng tới. */
interface MocLichSu {
  nhom: string;
  nl: BalancingInputItem[];
  tp: BalancingOutputItem[];
  nhap: MaterialImportItem[];
  sanXuat: WipProductionItem[];
  /** Sổ kho tháng — hai dòng kho ghi thẳng vào đây nên hoàn tác phải trả cả sổ. */
  kho: MonthlyStockLine[];
}

/** Giữ tối đa ngần này bước lùi — đủ cho một ca nhập, không phình bộ nhớ. */
const SO_MOC_TOI_DA = 100;

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
  const [tatCaKy] = useBalancingPeriods();
  const [tonDauKhaiTay] = useMaterialOpeningStock();
  const [soKho, ghiSoKho] = useMonthlyStock();
  const [khoLuu] = useStorageLocations();

  /** Kỳ đã chốt ⇒ mọi ô khoá, mọi nút ghi ẩn. Mở lại ở thanh cuối màn. */
  const daChot = Boolean(ky.isLocked);

  const ngay = useMemo(() => ngayTrongKy(ky), [ky]);

  /* ---------- Ngăn xếp hoàn tác (Ctrl+Z / Ctrl+Y) ----------
     Người dùng đến từ Excel, ở đó Ctrl+Z lùi được MỌI thứ vừa làm chứ không chỉ
     ô số. Nút "Hoàn tác" trên toast vẫn còn cho người dùng chuột; hai đường
     cùng khôi phục từ ảnh chụp nên không đá nhau.

     Gộp theo `nhom`: gõ liên tiếp vào CÙNG một ô chỉ tạo MỘT mốc, nếu không mỗi
     phím là một bước lùi và Ctrl+Z thành vô dụng. */
  const lui = useRef<MocLichSu[]>([]);
  const tien = useRef<MocLichSu[]>([]);
  /* `lui`/`tien` là ref (không gây render, không được đọc lúc render), nên
     số mốc được chép sang state sau mỗi lần đổi để nút Hoàn tác / Làm lại
     bật-tắt đúng lúc. */
  const [demLichSu, setDemLichSu] = useState({ lui: 0, tien: 0 });
  const capNhatDem = useCallback(
    () => setDemLichSu({ lui: lui.current.length, tien: tien.current.length }),
    []
  );

  const chupHienTai = useCallback(
    (nhom: string): MocLichSu => ({
      nhom,
      nl: tatCaNL,
      tp: tatCaTP,
      nhap: tatCaNhap,
      sanXuat: tatCaSanXuat,
      kho: soKho,
    }),
    [tatCaNL, tatCaTP, tatCaNhap, tatCaSanXuat, soKho]
  );

  /** Đánh dấu "trước khi đổi" — gọi TRƯỚC mọi lần ghi. */
  const luuMoc = useCallback(
    (nhom: string) => {
      if (!nhom) return; // ghi tự động (đồng bộ tổng) — không phải việc người dùng làm
      const dinh = lui.current[lui.current.length - 1];
      if (dinh && dinh.nhom === nhom) return; // gõ tiếp cùng ô — không tạo mốc mới
      lui.current.push(chupHienTai(nhom));
      if (lui.current.length > SO_MOC_TOI_DA) lui.current.shift();
      tien.current = [];
      capNhatDem();
    },
    [chupHienTai, capNhatDem]
  );

  const apMoc = useCallback(
    (m: MocLichSu) => {
      ghiTatCaNL(m.nl);
      ghiTatCaTP(m.tp);
      ghiTatCaNhap(m.nhap);
      ghiTatCaSanXuat(m.sanXuat);
      if (m.kho !== soKho) ghiSoKho(m.kho);
    },
    [ghiTatCaNL, ghiTatCaTP, ghiTatCaNhap, ghiTatCaSanXuat, ghiSoKho, soKho]
  );

  const hoanTac = useCallback(() => {
    const m = lui.current.pop();
    if (!m) return;
    tien.current.push(chupHienTai(m.nhom));
    apMoc(m);
    capNhatDem();
    notify.daLuu("Đã hoàn tác");
  }, [apMoc, chupHienTai, capNhatDem]);

  const lamLai = useCallback(() => {
    const m = tien.current.pop();
    if (!m) return;
    lui.current.push(chupHienTai(m.nhom));
    apMoc(m);
    capNhatDem();
    notify.daLuu("Đã làm lại");
  }, [apMoc, chupHienTai, capNhatDem]);

  /* Repo trả về dòng của MỌI kỳ. Ghi mà quên ghép lại với kỳ khác = xoá sạch
     các kỳ đó (xem 04-tang-du-lieu.md). Bọc một lần ở đây. */
  const nlVao = useMemo(() => tatCaNL.filter((r) => r.periodId === ky.id), [tatCaNL, ky.id]);
  const tp = useMemo(() => tatCaTP.filter((r) => r.periodId === ky.id), [tatCaTP, ky.id]);

  /* Nhãn kỳ + họ NL để ghi vết / đặt tên lô gửi đông trong Sổ kho tháng. */
  const ngucanh = useMemo(
    () => ({
      nhanKy: `${ky.materialTypeName} ${ky.dateRangeDescription ?? ""}`.trim(),
      hoNL: hoNguyenLieu(ky.materialTypeName),
    }),
    [ky.materialTypeName, ky.dateRangeDescription]
  );

  /* MỘT chốt cho mọi lần ghi khối NL (gõ ô, dán khối, xoá dòng, gộp…): hai dòng kho
     (Lấy xả đông / Gửi đông) ghi THẲNG vào Sổ kho tháng theo kiểu đặt giá trị — xem
     lib/khoCanDoi.ts. Sổ kho từ chối (vượt tồn lô, chưa chọn lô/kho) ⇒ KHÔNG ghi gì. */
  const ghiNL = useCallback(
    (rows: BalancingInputItem[], nhom = "nl"): boolean => {
      const kq = dongBoSoKho(soKho, nlVao, rows, ngucanh);
      if (kq.loi) {
        notify.loi(kq.loi);
        return false;
      }
      luuMoc(nhom);
      ghiTatCaNL([...tatCaNL.filter((r) => r.periodId !== ky.id), ...rows]);
      if (kq.doi) ghiSoKho(kq.lines);
      if (kq.keThua > 0)
        notify.daLuu(`Sổ kho tháng: đã tự kế thừa ${kq.keThua} dòng tồn sang tháng mới`);
      return true;
    },
    [ghiTatCaNL, tatCaNL, ky.id, luuMoc, soKho, nlVao, ngucanh, ghiSoKho]
  );
  const ghiTP = useCallback(
    (rows: BalancingOutputItem[], nhom = "tp") => {
      luuMoc(nhom);
      ghiTatCaTP([...tatCaTP.filter((r) => r.periodId !== ky.id), ...rows]);
    },
    [ghiTatCaTP, tatCaTP, ky.id, luuMoc]
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

  /* Dòng đang bị kỳ KHÁC giữ. Không đếm được nhóm này thì khi người dùng lỡ hút
     vào nhầm kỳ, mọi kỳ sau chỉ thấy màn trống và không có manh mối nào. */
  const nhapKyKhac = useMemo(
    () =>
      chuyenNhapTheoNgay(ky, tatCaNhap).filter(
        (r) => r.balancingPeriodId && r.balancingPeriodId !== ky.id
      ),
    [ky, tatCaNhap]
  );

  const kyTrungNgay = useMemo(
    () => kyTrungNgayCungHo(ky, tatCaKy) as BalancingPeriod[],
    [ky, tatCaKy]
  );
  const cungHoKy = useCallback(
    (r: MaterialImportItem) => cungHoNguyenLieu(r.materialTypeName, ky.materialTypeName),
    [ky.materialTypeName]
  );

  const chanDoanNhap = useMemo(() => {
    const trong = chuyenNhapTheoNgay(ky, tatCaNhap);
    return {
      tongTrongKhoang: trong.length,
      chuaGan: nhapChoHut.length,
      kyKhac: nhapKyKhac.length,
      lechTen: nhapKhacLoai.length,
    };
  }, [ky, tatCaNhap, nhapChoHut, nhapKyKhac, nhapKhacLoai]);

  const hutNhapHang = useCallback(
    (ids?: string[]) => {
      /* Có `ids` = người dùng tự tick, kể cả dòng đang thuộc kỳ khác ⇒ KÉO VỀ
         kỳ này. Không có `ids` = lấy tự động, chỉ đụng dòng chưa kỳ nào giữ. */
      const chon = ids
        ? tatCaNhap.filter((r) => ids.includes(r.id) && r.balancingPeriodId !== ky.id)
        : nhapChoHut;
      if (chon.length === 0) return;
      const truocNhap = tatCaNhap;
      const truocNL = tatCaNL;
      luuMoc(`hut-nhap:${chon.length}:${chon[0].id}`);
      const bo = new Set(chon.map((r) => r.id));
      ghiTatCaNhap(
        tatCaNhap.map((r) => (bo.has(r.id) ? { ...r, balancingPeriodId: ky.id } : r))
      );

      /* Mỗi HỌ nguyên liệu một dòng lưới (lớn/nhỏ gộp chung); họ đã có dòng thì
         giữ nguyên. gomNhapTheoLoai trả key theo họ nên so theo họ. */
      const daCo = new Set(
        nlVao.filter((r) => r.autoSource === "imports").map((r) => hoNguyenLieu(r.name))
      );
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
      if (them.length > 0) ghiNL([...nlVao, ...them], "");
      notify.daLuu(`Đã lấy ${chon.length} dòng nhập hàng vào kỳ`, () => {
        ghiTatCaNhap(truocNhap);
        ghiTatCaNL(truocNL);
      });
    },
    [tatCaNhap, nhapChoHut, tatCaNL, nlVao, nhapDaGan, ghiTatCaNhap, ghiTatCaNL, ghiNL, luuMoc, ky.id]
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
        // Dòng lưới mang tên HỌ (lớn/nhỏ gộp) ⇒ tìm chuyến nhập theo HỌ; sửa ô
        // ngày gộp sẽ chỉnh chuyến size cuối cùng của ngày cho khớp tổng.
        const trongNgay = hienTai.filter(
          (r) => hoNguyenLieu(r.materialTypeName) === o.khoa && r.deliveryDate === o.ngay
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
          const mau = nhapDaGan.find((r) => hoNguyenLieu(r.materialTypeName) === o.khoa);
          const moi: MaterialImportItem = {
            id: uid(),
            shipmentId: "",
            deliveryDate: o.ngay,
            workshop: mau?.workshop ?? "Đông",
            category: mau?.category ?? "Khác",
            supplierName: mau?.supplierName ?? "",
            // Giữ tên size của chuyến mẫu để sổ Nhập hàng vẫn có size; chưa có mẫu
            // (thêm ngày mới) thì đành dùng tên họ.
            materialTypeName: mau?.materialTypeName ?? o.khoa,
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
      /* Gõ tiếp vào cùng một ô ⇒ cùng nhóm ⇒ một bước lùi cho cả lần gõ. */
      luuMoc(
        dsO.length === 1 ? `nhap:${dsO[0].khoa}:${dsO[0].ngay}` : `nhap-khoi:${dsO.length}`
      );
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
    [nhapDaGan, tatCaNhap, ghiTatCaNhap, luuMoc, ky.id]
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

  /* ---------- Dòng mẫu khối 2 (A) + gợi ý khách/giá (B) ---------- */
  const kyMau = useMemo(() => (daChot ? null : kyMauTP(ky, tatCaKy, tatCaTP)), [daChot, ky, tatCaKy, tatCaTP]);
  const mauTP = useMemo(
    () => (kyMau ? dungDongMauTP(tatCaTP.filter((r) => r.periodId === kyMau.id)) : []),
    [kyMau, tatCaTP]
  );
  const mauConThieu = useMemo(() => dongMauConThieu(mauTP, tp), [mauTP, tp]);
  const goiY = useCallback(
    (productId: string, spec: string) => goiYKhachGia(productId, spec, mauTP, tatCaTP, tatCaKy, ky.id),
    [mauTP, tatCaTP, tatCaKy, ky.id]
  );

  const hutSanXuat = useCallback(() => {
    if (sanXuatChoHut.length === 0) return;
    const truocSX = tatCaSanXuat;
    const truocTP = tatCaTP;
    luuMoc(`hut-sx:${sanXuatChoHut.length}:${sanXuatChoHut[0].id}`);
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
      /* (B) Khách · kênh · giá lấy theo dòng mẫu / kỳ gần nhất — trước đây để trống
         nên kỳ nào cũng phải chọn khách + gõ giá lại từ đầu. Không có gợi ý ⇒ trống. */
      const g = goiY(productId, spec ?? "");
      them.push({
        id: uid(),
        periodId: ky.id,
        productId,
        customerId: g?.customerId ?? "",
        channel: g?.channel ?? "Xuất khẩu",
        quantityKg: Object.values(o.theoNgay).reduce((s, v) => s + v, 0),
        unitPrice: g?.unitPrice ?? null,
        spec: spec ?? "",
        salesItemId: "",
        dailyQuantities: {},
        carryOverKg: 0,
        carryOverPeriodId: "",
        autoSource: "production",
      });
    }
    if (them.length > 0) ghiTP([...tp, ...them], "");
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
    luuMoc,
    ky.id,
    goiY,
  ]);

  /* Một chạm kéo CẢ HAI nguồn tự động (nhập + sản xuất) vào kỳ. KHÔNG gộp sổ bán
     — bán là seam đầu ra thay thế, kéo nhầm sẽ sai nguồn. Chỉ một nguồn có dòng
     thì uỷ thẳng cho hàm chuyên trách (giữ nguyên toast + undo của nó); cả hai
     thì chạy tuần tự — bốn bảng ghi RỜI nhau nên số không đè, Ctrl+Z một lần
     trả cả hai vì ảnh chụp lấy trước cả hai thao tác. */
  const hutTatCaNguon = useCallback(() => {
    const coNhap = nhapChoHut.length > 0;
    const coSX = sanXuatChoHut.length > 0;
    if (coNhap) hutNhapHang();
    if (coSX) hutSanXuat();
  }, [nhapChoHut.length, sanXuatChoHut.length, hutNhapHang, hutSanXuat]);

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
      luuMoc(dsO.length === 1 ? `sx:${dsO[0].khoa}:${dsO[0].ngay}` : `sx-khoi:${dsO.length}`);
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
    [sanXuatDaGan, tatCaSanXuat, ghiTatCaSanXuat, luuMoc, ky.id]
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
    if (nlChoTinh.some((r, i) => r !== nlVao[i])) ghiNL(nlChoTinh, "");
  }, [nlChoTinh, nlVao, ghiNL]);
  useEffect(() => {
    if (tpChoTinh.some((r, i) => r !== tp[i])) ghiTP(tpChoTinh, "");
  }, [tpChoTinh, tp, ghiTP]);

  /* Phế liệu không còn là đầu vào của kỳ (xem 31-can-doi-ky.md) — truyền []. */
  const kq = useMemo(
    () => calculateBalancing(ky, nlChoTinh, [], tpChoTinh),
    [ky, nlChoTinh, tpChoTinh]
  );

  /* ---------- Kho đông: dòng Lấy xả đông / Gửi đông ---------- */

  /* Cùng engine với sổ /nxt-nl (tinhSoTonNL) — gõ vào hai dòng kho là tồn đổi
     ngay, không có bản sao số nào phải đồng bộ. Nhập tươi không cần ở đây ⇒ []. */
  const tonKhoDong = useMemo(
    () =>
      tinhSoTonNL(tatCaKy, tatCaNL, [], tonDauKhaiTay, chotSanXuat).find(
        (r) => r.periodId === ky.id
      ) ?? null,
    [tatCaKy, tatCaNL, tonDauKhaiTay, chotSanXuat, ky.id]
  );
  const conDoSXTheoNgay = useMemo(() => conDoTheoNgay(chotSanXuat, ky), [chotSanXuat, ky]);

  const giaGuiDongTruoc = useMemo(() => {
    const ho = hoNguyenLieu(ky.materialTypeName);
    const kyTheoId = new Map(tatCaKy.map((k) => [k.id, k]));
    let ganNhat: { ngay: string; gia: number } | null = null;
    for (const r of tatCaNL) {
      if (r.periodId === ky.id || r.unitPrice == null || loaiDongKho(r) !== "gui-dong") continue;
      const k = kyTheoId.get(r.periodId);
      if (!k || hoNguyenLieu(k.materialTypeName) !== ho) continue;
      const d = k.endDate || k.startDate || "";
      if (ky.startDate && d >= ky.startDate) continue;
      if (!ganNhat || d > ganNhat.ngay) ganNhat = { ngay: d, gia: r.unitPrice };
    }
    return ganNhat?.gia ?? null;
  }, [tatCaNL, tatCaKy, ky.id, ky.materialTypeName, ky.startDate]);

  /* Sổ kho tháng: lô để Lấy xả đông (tháng của ngày đầu kỳ; tháng chưa mở ⇒ xem trước
     phần kế thừa) + kho nhận để Gửi đông + kiểm khớp. */
  const thangKy = thangCuaNgay(ngay[0] ?? ky.startDate ?? "");
  const luaChonLo = useCallback(
    (dangChon: string[]) => (thangKy ? danhSachLo(soKho, thangKy, ngucanh.hoNL, dangChon) : []),
    [soKho, thangKy, ngucanh.hoNL]
  );
  const luaChonKhoGui = useMemo(
    () =>
      danhSachKhoGui(
        soKho,
        BSF1_WAREHOUSES.filter((w) => w.type === "xi-nghiep").map((w) => w.name),
        khoLuu.map((k) => k.name)
      ),
    [soKho, khoLuu]
  );
  const moTaDongKho = useCallback(
    (r: BalancingInputItem) => {
      if (r.stockLineId) {
        const lo = luaChonLo([r.stockLineId]).find((x) => x.value === r.stockLineId);
        return lo ? lo.label : "lô đã chọn không còn trong sổ kho";
      }
      if (r.stockLocation) {
        const { warehouse, storageLocation } = tachKhoGui(r.stockLocation);
        return storageLocation || warehouse;
      }
      return "";
    },
    [luaChonLo]
  );
  const lechSoKho = useMemo(() => soChoLechSoKho(soKho, nlVao), [soKho, nlVao]);
  const ghiLaiSoKho = useCallback(() => {
    const truoc = soKho;
    const kq = dongBoSoKho(soKho, [], nlVao, ngucanh);
    if (kq.loi) {
      notify.loi(kq.loi);
      return;
    }
    if (!kq.doi) return;
    luuMoc(`ghi-lai-so-kho:${ky.id}`);
    ghiSoKho(kq.lines);
    notify.daLuu("Đã ghi lại phần lấy xả đông / gửi đông của kỳ vào Sổ kho tháng", () =>
      ghiSoKho(truoc)
    );
  }, [soKho, nlVao, ngucanh, luuMoc, ky.id, ghiSoKho]);

  /* ---------- Chuyển kỳ từ kỳ liền trước ---------- */

  const kyTruoc = useMemo(() => kyLienTruoc(ky, tatCaKy), [ky, tatCaKy]);

  const chuyenKyNL = useMemo(() => {
    if (!kyTruoc) return [];
    const dong = tatCaNL.filter((r) => r.periodId === kyTruoc.id);
    return chuyenKyChoNhan(dong, (r) => r.name);
  }, [kyTruoc, tatCaNL]);

  const chuyenKyTP = useMemo(() => {
    if (!kyTruoc) return [];
    const dong = tatCaTP.filter((r) => r.periodId === kyTruoc.id);
    return chuyenKyChoNhan(dong, (r) => r.productId);
  }, [kyTruoc, tatCaTP]);

  /**
   * Nhận phần chuyển kỳ ÂM của kỳ trước thành dòng chuyển kỳ DƯƠNG ở kỳ này,
   * và đánh dấu dòng nguồn đã được kỳ nào nhận để không lấy hai lần.
   * Đây là mắt xích khép vòng gối đầu: trước đó kỳ sau phải mở file kỳ cũ ra
   * chép tay, và chép tay là chỗ số bắt đầu lệch.
   */
  const nhanChuyenKy = useCallback(() => {
    if (!kyTruoc || (chuyenKyNL.length === 0 && chuyenKyTP.length === 0)) return;
    const truocNL = tatCaNL;
    const truocTP = tatCaTP;
    luuMoc(`nhan-chuyen-ky:${kyTruoc.id}`);

    const nhanNL = new Set(chuyenKyNL.map((d) => d.nguonId));
    const themNL: BalancingInputItem[] = chuyenKyNL.map((d) => ({
      id: uid(),
      periodId: ky.id,
      /* Hàng kỳ trước cất kho, kỳ này lấy ra dùng ⇒ đúng nhóm Xả đông. */
      groupName: "Xả đông",
      name: d.ten,
      quantityKg: d.kg,
      unitPrice: null,
      ratioPercentage: null,
      sourceWarehouse: "Kho mình",
      dailyQuantities: {},
      carryOverKg: d.kg,
      carryOverPeriodId: "",
      isReduction: false,
      reductionWarehouseId: "",
      autoSource: "",
    }));

    const nhanTP = new Set(chuyenKyTP.map((d) => d.nguonId));
    const mauTP = new Map(tatCaTP.map((r) => [r.id, r]));
    const themTP: BalancingOutputItem[] = chuyenKyTP.map((d) => {
      const mau = mauTP.get(d.nguonId);
      return {
        id: uid(),
        periodId: ky.id,
        productId: d.ten,
        customerId: mau?.customerId ?? "",
        channel: mau?.channel ?? "Xuất khẩu",
        quantityKg: d.kg,
        unitPrice: mau?.unitPrice ?? null,
        spec: mau?.spec ?? "",
        salesItemId: "",
        dailyQuantities: {},
        carryOverKg: d.kg,
        carryOverPeriodId: "",
        autoSource: "",
      };
    });

    ghiTatCaNL([
      ...tatCaNL.map((r) =>
        nhanNL.has(r.id) ? { ...r, carryOverPeriodId: ky.id } : r
      ),
      ...themNL,
    ]);
    ghiTatCaTP([
      ...tatCaTP.map((r) =>
        nhanTP.has(r.id) ? { ...r, carryOverPeriodId: ky.id } : r
      ),
      ...themTP,
    ]);
    notify.daLuu(
      `Đã nhận ${themNL.length + themTP.length} dòng chuyển từ kỳ ${kyTruoc.dateRangeDescription || "trước"}`,
      () => {
        ghiTatCaNL(truocNL);
        ghiTatCaTP(truocTP);
      }
    );
  }, [kyTruoc, chuyenKyNL, chuyenKyTP, tatCaNL, tatCaTP, ghiTatCaNL, ghiTatCaTP, luuMoc, ky.id]);

  return {
    kyId: ky.id,
    ngay,
    nlVao,
    hangNL,
    nhapDaGan,
    nhapChoHut,
    nhapKhacLoai,
    nhapKyKhac,
    tenLoaiKy: ky.materialTypeName,
    kyTrungNgay,
    cungHoKy,
    chanDoanNhap,
    ghiNL,
    hutNhapHang,
    ghiNhapNhieuNgay,
    tonKhoDong,
    conDoSXTheoNgay,
    giaGuiDongTruoc,
    luaChonLo,
    luaChonKhoGui,
    moTaDongKho,
    lechSoKho,
    ghiLaiSoKho,
    tp,
    hangTP,
    sanXuatDaGan,
    sanXuatChoHut,
    ghiTP,
    hutSanXuat,
    kyMau,
    mauConThieu,
    mauTP,
    goiY,
    hutTatCaNguon,
    ghiSanXuatNhieuNgay,
    ngayDaChot,
    kyTruoc,
    soDongChuyenKy: chuyenKyNL.length + chuyenKyTP.length,
    nhanChuyenKy,
    daChot,
    hoanTacDuoc: demLichSu.lui > 0,
    lamLaiDuoc: demLichSu.tien > 0,
    hoanTac,
    lamLai,
    kq,
  };
}
