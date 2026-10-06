// ============================================================
// Tên file: src/features/balancing/MaterialGrid.tsx
// Tên tiếng Việt: Khối 1 — lưới nguyên liệu vào theo ngày
// Description: Balancing block 1 — material input day grid
// ============================================================
import { useMemo, useState } from "react";
import type { BalancingInputItem, DailyQuantities, InputGroup, MaterialType } from "@/types";
import { BSF1_WAREHOUSES, INPUT_GROUPS, sumGridRow } from "@/types";
import { uid } from "@/lib/db";
import {
  KHO_MINH,
  TEN_DONG_KHO,
  hoNguyenLieu,
  loaiDongKho,
  nhanNgay,
  type HangLuoiNL,
  type LoaiDongKho,
} from "@/lib/balancingGrid";
import {
  TEN_DONG_BAN_NOI_DIA,
  amTheoNgay,
  doiChieuBanNoiDia,
  laDongBanNoiDia,
} from "@/lib/banNoiDia";
import type { ONgay, PeriodGrid } from "./usePeriodGrid";
import { HopChonDongNhap, HopDongNhapTay, HopThemDongNL } from "./gridDialogs";
import {
  Button,
  Combobox,
  LuoiNhap,
  Nhan,
  notify,
  type CotLuoi,
  type HangLuoi,
} from "@/design-system";
import { num, viDate } from "@/lib/format";
import { ChevronsLeftRight, Combine, Download, ListChecks, Pencil, Plus } from "lucide-react";

const KHO_XUONG = BSF1_WAREHOUSES.filter((w) => w.type === "phan-xuong");

/** Cắt hậu tố size để gom "2 da lớn"/"2 da nhỏ" về một họ — CHỈ dùng cho nút Gộp,
    KHÔNG đổi `hoNguyenLieu` (logic hút) để tránh đụng khớp họ khi hút. */
const hoGop = (ten: string) =>
  ten.replace(/\s*(lớn|nhỏ)(\s*\([^)]*\))?\s*$/iu, "").replace(/\s+/g, " ").trim();

export function LuoiNguyenLieu({
  luoi,
  loaiNLDanhMuc,
  onThemLoaiNL,
  suaLoaiNL,
  anNgay,
  onDoiAnNgay,
}: {
  luoi: PeriodGrid;
  loaiNLDanhMuc: MaterialType[];
  onThemLoaiNL: (ten: string) => string;
  /** Bút chì sửa nhanh loại NL ở hộp thêm dòng (useSuaDanhMuc của màn, theo TÊN). */
  suaLoaiNL?: { moSua: (v: string) => void; suaDuoc: (v: string) => boolean; nhanSua: string };
  anNgay: boolean;
  onDoiAnNgay: () => void;
}) {
  const {
    ngay,
    nlVao,
    hangNL,
    nhapChoHut,
    nhapKhacLoai,
    nhapKyKhac,
    chanDoanNhap,
    ghiNL,
    hutNhapHang,
    ghiNhapNhieuNgay,
    tonKhoDong,
    conDoSXTheoNgay,
    banNoiDiaSX,
  } = luoi;
  const [suaTayMo, setSuaTayMo] = useState(false);
  const [themMo, setThemMo] = useState<InputGroup | "giam" | null>(null);
  const [chonNhapMo, setChonNhapMo] = useState(false);
  /** id dòng kho ẢO (chưa lưu) — dòng thật tạo ra DÙNG LẠI đúng id này, nên ô đang gõ
      không bị dựng lại (mất con trỏ, rơi các phím sau) khi phím đầu biến nó thành thật.
      Suy từ id kỳ ⇒ không bao giờ trùng giữa hai kỳ. */
  const idAo = (loai: LoaiDongKho) => `${luoi.kyId}-${loai}`;

  const theoId = useMemo(() => new Map(nlVao.map((r) => [r.id, r])), [nlVao]);

  /* ---------- Hai dòng kho cố định: Lấy xả đông (đầu) · Gửi đông (cuối) ----------
     Kỳ chưa có dòng nào thì hiện dòng ẢO; gõ số / giá vào là thành dòng thật. Tồn
     kho đông đọc từ engine sổ NXT nên cộng trừ ngay theo từng phím. */
  /** Đơn giá bình quân NL thủy sản của kỳ — gợi ý giá cho phần gửi đông. */
  const giaBinhQuanNL = useMemo(() => {
    const ts = hangNL.filter((h) => !h.loaiKho && !h.laGiam && h.nhom === "Thủy sản" && h.donGia != null);
    const kg = ts.reduce((s, h) => s + h.tong, 0);
    return kg > 0 ? Math.round(ts.reduce((s, h) => s + h.tong * (h.donGia ?? 0), 0) / kg) : null;
  }, [hangNL]);

  const mauDongKho = (loai: LoaiDongKho): BalancingInputItem => ({
    id: idAo(loai),
    periodId: luoi.kyId,
    groupName: "Xả đông",
    name: TEN_DONG_KHO[loai],
    quantityKg: 0,
    unitPrice: loai === "lay-xa-dong" ? luoi.giaGuiDongTruoc : giaBinhQuanNL,
    ratioPercentage: null,
    sourceWarehouse: KHO_MINH,
    dailyQuantities: {},
    carryOverKg: 0,
    isReduction: loai === "gui-dong",
    reductionWarehouseId: loai === "gui-dong" ? (KHO_XUONG[0]?.id ?? "") : "",
    autoSource: "",
  });
  const hangAo = (loai: LoaiDongKho): HangLuoiNL => {
    const m = mauDongKho(loai);
    return {
      id: m.id,
      ten: m.name,
      loaiKho: loai,
      nhom: m.groupName,
      theoNgay: {},
      chuyenKy: 0,
      tong: 0,
      donGia: m.unitPrice,
      tyLe: null,
      laGiam: m.isReduction ?? false,
      khoGiam: m.reductionWarehouseId ?? "",
      tuSoNhap: false,
      nguonIds: [],
    };
  };
  const dongLay = hangNL.filter((h) => h.loaiKho === "lay-xa-dong");
  const dongGui = hangNL.filter((h) => h.loaiKho === "gui-dong");
  const hangLay = dongLay.length ? dongLay : [hangAo("lay-xa-dong")];
  const hangGui = dongGui.length ? dongGui : [hangAo("gui-dong")];
  const aoTheoId = new Map<string, BalancingInputItem>(
    (["lay-xa-dong", "gui-dong"] as LoaiDongKho[])
      .filter((l) => (l === "lay-xa-dong" ? !dongLay.length : !dongGui.length))
      .map((l) => [idAo(l), mauDongKho(l)])
  );
  const layGoc = (id: string) => theoId.get(id) ?? aoTheoId.get(id);

  /** Dòng ảo ⇒ dựng dòng thật (giữ id ảo) từ mẫu + patch. */
  const tuAo = (ao: BalancingInputItem, patch: Partial<BalancingInputItem>): BalancingInputItem => {
    const moi = { ...ao, ...patch };
    moi.quantityKg = sumGridRow(moi.dailyQuantities, moi.carryOverKg);
    return moi;
  };

  /** Sửa một dòng lưới + giữ `quantityKg` khớp tổng (công thức đọc trường này). */
  const ghiDong = (id: string, patch: Partial<BalancingInputItem>) => {
    const ao = aoTheoId.get(id);
    if (ao) {
      ghiNL([...nlVao, tuAo(ao, patch)]);
      return;
    }
    ghiNL(
      nlVao.map((r) => {
        if (r.id !== id) return r;
        const moi = { ...r, ...patch };
        /* Dòng hút lấy ngày từ sổ nhập → tổng tính ở chỗ khác, đừng đè. */
        if (moi.autoSource !== "imports") {
          moi.quantityKg = sumGridRow(moi.dailyQuantities, moi.carryOverKg);
        }
        return moi;
      })
    );
  };

  /** Gõ vào ô ngày. Dòng hút thì ghi thẳng về sổ Nhập hàng, dòng tay thì ghi tại chỗ. */
  const ghiONgay = (r: BalancingInputItem, iso: string, v: number | null) => {
    const kg = v ?? 0;
    if (r.autoSource === "imports") {
      ghiNhapNhieuNgay([{ khoa: r.name, ngay: iso, kg }]);
      return;
    }
    const daily: DailyQuantities = { ...(r.dailyQuantities ?? {}) };
    if (kg === 0) delete daily[iso];
    /* Dòng Giảm / Gửi đông: người dùng gõ số dương, hệ ghi số ÂM — bắt tổ trưởng
       gõ dấu trừ ở xưởng lạnh là cách chắc chắn nhất để có số sai. */
    else daily[iso] = r.isReduction ? -Math.abs(kg) : kg;
    ghiDong(r.id, { dailyQuantities: daily });
  };

  /**
   * Gõ thẳng SỐ LƯỢNG (khi đang thu cột ngày). Tổng vẫn là Σ ngày (+ chuyển kỳ cũ),
   * nên phần chênh được dồn vào NGÀY CUỐI đang có số (chưa có ngày nào ⇒ ngày đầu
   * kỳ). Giữ nguyên các ngày khác ⇒ mở cột ngày ra vẫn thấy đúng số đã gõ theo ngày.
   */
  const ghiSoLuong = (r: BalancingInputItem, h: HangLuoiNL, v: number | null) => {
    if (!ngay.length) {
      notify.loi("Kỳ chưa có ngày tiếp nhận — sửa ngày của kỳ trước khi nhập số lượng.");
      return;
    }
    const muonTong = r.isReduction ? -Math.abs(v ?? 0) : (v ?? 0);
    const coSo = ngay.filter((iso) => (h.theoNgay[iso] ?? 0) !== 0);
    const iso = coSo.length ? coSo[coSo.length - 1] : ngay[0];
    const moi = (h.theoNgay[iso] ?? 0) + (muonTong - h.tong);
    /* Đã tính dấu ở trên ⇒ gọi thẳng, không qua lớp "dương → âm" của ghiONgay. */
    if (r.autoSource === "imports") {
      ghiNhapNhieuNgay([{ khoa: r.name, ngay: iso, kg: moi }]);
      return;
    }
    const daily: DailyQuantities = { ...(r.dailyQuantities ?? {}) };
    if (moi === 0) delete daily[iso];
    else daily[iso] = moi;
    ghiDong(r.id, { dailyQuantities: daily });
  };

  /* ---------- Bán nội địa (mig 0054): dòng GIẢM "Bán nội địa" ⇄ sổ /wip ----------
     NL bán thẳng cho khách trong nước (bảng giấy: −987). Tổ trưởng ghi ở Sản xuất;
     ở đây chỉ điền / đối chiếu theo từng ngày — dòng giảm âm sẵn đúng công thức. */
  const laBanNoiDia = (h: HangLuoiNL) => h.laGiam && laDongBanNoiDia({ name: h.ten });
  const dongBanNoiDia = nlVao.find((r) => laDongBanNoiDia(r));
  const dienBanNoiDia = () => {
    const daily = amTheoNgay(banNoiDiaSX.theoNgay);
    if (dongBanNoiDia) {
      // Dòng cũ (Thủy sản kg âm thường) chuyển luôn thành dòng giảm — một dòng, không trừ đôi.
      ghiDong(dongBanNoiDia.id, {
        dailyQuantities: daily,
        unitPrice: banNoiDiaSX.giaBinhQuan ?? dongBanNoiDia.unitPrice,
        isReduction: true,
        reductionWarehouseId: "",
      });
    } else {
      ghiNL([
        ...nlVao,
        {
          id: uid(),
          periodId: luoi.kyId,
          groupName: "Thủy sản",
          name: TEN_DONG_BAN_NOI_DIA,
          quantityKg: sumGridRow(daily, 0),
          unitPrice: banNoiDiaSX.giaBinhQuan,
          ratioPercentage: null,
          sourceWarehouse: "",
          dailyQuantities: daily,
          carryOverKg: 0,
          isReduction: true,
          reductionWarehouseId: "", // bán đi, không vào kho nào
          autoSource: "",
        },
      ]);
    }
    notify.daLuu(`Đã ghi Bán nội địa ${num(banNoiDiaSX.tongKg)} kg theo sổ Sản xuất`);
  };
  const phuBanNoiDia = (h: HangLuoiNL) => {
    if (banNoiDiaSX.tongKg <= 0) return undefined;
    const kq = doiChieuBanNoiDia(h.theoNgay, banNoiDiaSX.theoNgay);
    if (kq === "khop") return <Nhan loai="xong" className="mt-0.5">khớp sổ SX</Nhan>;
    return (
      <span className="mt-0.5 inline-flex flex-wrap items-center gap-1">
        {kq === "lech" && (
          <Nhan loai="luu-y">
            SX ghi {num(banNoiDiaSX.tongKg)} · lệch {num(Math.abs(h.tong) - banNoiDiaSX.tongKg)}
          </Nhan>
        )}
        {!luoi.daChot && (
          <Button
            variant="outline"
            size="sm"
            onClick={dienBanNoiDia}
            title="Điền dòng Bán nội địa đúng từng ngày bằng số tổ trưởng ghi ở màn Sản xuất thành phẩm (ghi đè số đang có của dòng này)."
          >
            {kq === "lech" ? "Lấy lại từ SX" : `Lấy ${num(banNoiDiaSX.tongKg)} kg từ SX`}
          </Button>
        )}
      </span>
    );
  };

  /* ---------- Thứ tự dòng trên màn = thứ tự dán khối ----------
     Lấy xả đông → các nhóm (Thủy sản · Xả đông mua về · Bột) → Giảm → Gửi đông. */
  const nhomCoDong = INPUT_GROUPS.map((nhom) => ({
    nhom,
    dong: hangNL.filter((h) => !h.loaiKho && h.nhom === nhom && !h.laGiam),
  })).filter((g) => g.dong.length > 0);
  const dongGiam = hangNL.filter((h) => !h.loaiKho && h.laGiam);
  const hangHien: HangLuoiNL[] = [
    ...hangLay,
    ...nhomCoDong.flatMap((g) => g.dong),
    ...dongGiam,
    ...hangGui,
  ];

  const ghiO = (rowId: string, colKey: string, v: number | null) => {
    const r = layGoc(rowId);
    if (!r) return;
    if (colKey === "soLuong") {
      const h = hangHien.find((x) => x.id === rowId);
      if (h) ghiSoLuong(r, h, v);
      return;
    }
    if (colKey === "chuyenKy") return ghiDong(rowId, { carryOverKg: v ?? 0 });
    if (colKey === "donGia") return ghiDong(rowId, { unitPrice: v });
    if (colKey === "tyLe") return ghiDong(rowId, { ratioPercentage: v });
    if (colKey.startsWith("ngay:")) ghiONgay(r, colKey.slice(5), v);
  };

  /**
   * Dán một khối số từ Excel. Gộp mọi ô vào MỘT lần ghi cho mỗi đích — dán 5×10
   * ô rồi gọi 50 lần thì 49 lần đầu bị ghi đè, chỉ ô cuối sống. Dòng tính theo
   * THỨ TỰ TRÊN MÀN (hangHien), không theo thứ tự lưu.
   */
  const danKhoi = (rowId: string, colKey: string, khoi: (number | null)[][]) => {
    if (!colKey.startsWith("ngay:")) return;
    const cotNgay = ngay.map((iso) => `ngay:${iso}`);
    const iH = hangHien.findIndex((h) => h.id === rowId);
    const iC = cotNgay.indexOf(colKey);
    if (iH < 0 || iC < 0) return;

    const veSoNhap: ONgay[] = [];
    const doiTay = new Map<string, DailyQuantities>();
    khoi.forEach((dong, i) =>
      dong.forEach((v, j) => {
        if (v == null) return;
        const h = hangHien[iH + i];
        const cot = cotNgay[iC + j];
        if (!h || !cot) return;
        const goc = layGoc(h.id);
        if (!goc) return;
        const iso = cot.slice(5);
        if (goc.autoSource === "imports") {
          veSoNhap.push({ khoa: goc.name, ngay: iso, kg: v });
          return;
        }
        const daily = doiTay.get(h.id) ?? { ...(goc.dailyQuantities ?? {}) };
        if (v === 0) delete daily[iso];
        else daily[iso] = goc.isReduction ? -Math.abs(v) : v;
        doiTay.set(h.id, daily);
      })
    );

    if (doiTay.size > 0) {
      const moiTuAo = [...aoTheoId.entries()]
        .filter(([id]) => doiTay.has(id))
        .map(([id, ao]) => tuAo(ao, { dailyQuantities: doiTay.get(id)! }));
      ghiNL([
        ...nlVao.map((r) => {
          const daily = doiTay.get(r.id);
          if (!daily) return r;
          return { ...r, dailyQuantities: daily, quantityKg: sumGridRow(daily, r.carryOverKg) };
        }),
        ...moiTuAo,
      ]);
    }
    if (veSoNhap.length > 0) ghiNhapNhieuNgay(veSoNhap);
  };

  const themDong = (nhom: InputGroup | "giam", ten: string) => {
    const laGiam = nhom === "giam";
    ghiNL([
      ...nlVao,
      {
        id: uid(),
        periodId: luoi.kyId,
        groupName: laGiam ? "Thủy sản" : nhom,
        name: ten,
        quantityKg: 0,
        unitPrice: null,
        ratioPercentage: null,
        sourceWarehouse: "",
        dailyQuantities: {},
        carryOverKg: 0,
        isReduction: laGiam,
        reductionWarehouseId: laGiam ? (KHO_XUONG[0]?.id ?? "") : "",
        autoSource: "",
      },
    ]);
    setThemMo(null);
    notify.daLuu(laGiam ? `Đã thêm dòng giảm "${ten}"` : `Đã thêm "${ten}"`);
  };

  const xoaDong = (id: string) => {
    const truoc = nlVao;
    const d = theoId.get(id);
    ghiNL(nlVao.filter((r) => r.id !== id));
    notify.daXoa(`Đã xóa dòng "${d?.name ?? ""}"`, () => ghiNL(truoc));
  };

  /* Các dòng nhập TAY cùng HỌ (2 da lớn + nhỏ) — để bật nút "Gộp cùng loại". */
  const nhomGopDuoc = useMemo(() => {
    const m = new Map<string, BalancingInputItem[]>();
    for (const r of nlVao) {
      if (r.autoSource === "imports") continue; // dòng hút đã một-dòng-mỗi-họ
      if (loaiDongKho(r)) continue; // dòng kho mỗi dòng một lô / một kho — không gộp
      const k = `${r.groupName} ${r.isReduction ? 1 : 0} ${r.sourceWarehouse ?? ""} ${hoGop(r.name).toLowerCase()}`;
      const g = m.get(k);
      if (g) g.push(r);
      else m.set(k, [r]);
    }
    return [...m.values()].filter((g) => g.length > 1);
  }, [nlVao]);

  /**
   * GỘP MỘT LẦN (bấm nút): dồn các dòng nhập tay cùng họ thành một dòng — cộng kg
   * + chuyển kỳ, đơn giá BÌNH QUÂN GIA QUYỀN nên Giá trị NL (Σ kg×giá) giữ nguyên.
   * Một lần ghi (atomic), có Hoàn tác. KHÔNG chạy tự động lúc mở kỳ để tránh đua
   * ghi bất đồng bộ làm cộng đôi (đã thử auto → bỏ).
   */
  const gopSize = () => {
    if (nhomGopDuoc.length === 0) {
      notify.daLuu("Không có dòng cùng loại để gộp");
      return;
    }
    const truoc = nlVao;
    const boId = new Set<string>();
    const them: BalancingInputItem[] = [];
    let soDongCu = 0;
    for (const g of nhomGopDuoc) {
      soDongCu += g.length;
      const neo = g[0];
      const daily: DailyQuantities = {};
      let kgTong = 0;
      let giaTri = 0;
      let carry = 0;
      for (const r of g) {
        for (const [d, v] of Object.entries(r.dailyQuantities ?? {}))
          daily[d] = (daily[d] ?? 0) + v;
        // Cân theo TỔNG mỗi dòng (kể cả chuyển kỳ) để Σ kg×giá GIỮ NGUYÊN chính xác.
        const kg = sumGridRow(r.dailyQuantities ?? {}, r.carryOverKg ?? 0);
        kgTong += kg;
        giaTri += kg * (r.unitPrice ?? 0);
        carry += r.carryOverKg ?? 0;
        boId.add(r.id);
      }
      them.push({
        ...neo,
        name: hoGop(neo.name),
        dailyQuantities: daily,
        carryOverKg: carry,
        quantityKg: sumGridRow(daily, carry),
        // Bình quân gia quyền, KHÔNG làm tròn ⇒ Giá trị NL (Σ kg×giá) không lệch.
        unitPrice: kgTong !== 0 ? giaTri / kgTong : neo.unitPrice,
      });
    }
    ghiNL([...nlVao.filter((r) => !boId.has(r.id)), ...them]);
    notify.daLuu(`Đã gộp ${soDongCu} dòng thành ${them.length} dòng cùng loại`, () =>
      ghiNL(truoc)
    );
  };

  /* Cột "Chuyển kỳ" đã bỏ khỏi khối NL (ra/vào kho đi bằng hai dòng kho). Chỉ còn
     hiện khi kỳ CŨ lỡ có số ở đó — giấu đi thì Số lượng ≠ Σ ngày mà không ai hiểu vì sao. */
  const coChuyenKyCu = hangNL.some((h) => h.chuyenKy !== 0);

  /* Thứ tự cột theo file cân đối của kế toán (cột A–E): Loại hàng · Số lượng · Đơn giá
     VNĐ · T.tiền · tỷ lệ đứng SÁT tên — số chính luôn thấy, không phải cuộn ngang; phần
     chia ngày (khi mở) dời ra SAU CÙNG như cột ngày của bảng giấy. */
  const cot: CotLuoi<HangLuoiNL>[] = [
    /* Hai cột "Số lượng" loại trừ nhau: đang MỞ ngày ⇒ ô tính (Σ ngày, gõ ở ô ngày);
       đang THU ngày ⇒ gõ thẳng (ghiSoLuong). */
    { key: "tong", header: "Số lượng", nhan: "Số lượng", kieu: "tinh", nhom: "khi-mo-ngay", rong: 104, lay: (h) => h.tong || null },
    { key: "soLuong", header: "Số lượng", nhan: "Số lượng", kieu: "so", nhom: "khi-thu-ngay", rong: 104, lay: (h) => (h.laGiam ? Math.abs(h.tong) : h.tong) || null },
    { key: "donGia", header: "Đơn giá VNĐ", nhan: "Đơn giá", kieu: "so", rong: 104, lay: (h) => h.donGia },
    {
      key: "thanhTien",
      header: "T.tiền (đồng)",
      nhan: "Thành tiền",
      kieu: "tinh",
      rong: 136,
      lay: (h) => h.tong * (h.donGia ?? 0) || null,
    },
    { key: "tyLe", header: "Tỷ lệ", nhan: "Tỷ lệ phần trăm", kieu: "so", rong: 72, lay: (h) => h.tyLe },
    ...ngay.map<CotLuoi<HangLuoiNL>>((iso) => ({
      key: `ngay:${iso}`,
      header: nhanNgay(iso),
      nhan: `Ngày ${viDate(iso)}`,
      kieu: "so",
      nhom: "ngay",
      rong: 88,
      lay: (h) => h.theoNgay[iso] ?? null,
    })),
    ...(coChuyenKyCu
      ? [
          {
            key: "chuyenKy",
            header: "Chuyển kỳ (cũ)",
            nhan: "Chuyển kỳ (số cũ)",
            kieu: "so",
            nhom: "ngay",
            toNen: "chuyen-ky",
            rong: 112,
            lay: (h) => h.chuyenKy || null,
          } satisfies CotLuoi<HangLuoiNL>,
        ]
      : []),
  ];

  /* Kỳ đã chốt ⇒ khoá TOÀN BỘ ô + gỡ ô điều khiển. Khoá ở một chỗ thay vì rải
     `disabled` khắp nơi: thêm cột mới về sau tự động được khoá theo. */
  const cotHienThi: CotLuoi<HangLuoiNL>[] = luoi.daChot
    ? cot.map((c) => ({
        ...c,
        oRieng: undefined,
        khoa: () => true,
        lyDoKhoa: () => "Kỳ đã chốt — mở lại ở cuối màn mới sửa được",
      }))
    : cot;

  /* Gửi đông ⇄ còn dở khai ở Sản xuất: cả hai cùng ghi, màn đối chiếu. Gửi đông có
     số thì là số chuẩn của tồn kho đông; chưa có thì tồn tạm lấy còn dở SX. */
  const conDoSX = tonKhoDong?.conDoSX ?? 0;
  const guiDongCanDoi = tonKhoDong?.guiDongCanDoi ?? 0;
  const dienTuSX = () => {
    const daily: DailyQuantities = {};
    for (const [iso, kg] of Object.entries(conDoSXTheoNgay)) if (kg) daily[iso] = -Math.abs(kg);
    ghiDong(hangGui[0].id, { dailyQuantities: daily });
    notify.daLuu(`Đã ghi Gửi đông ${num(conDoSX)} kg theo còn dở của sổ Sản xuất`);
  };

  /* Chọn ĐÍCH DANH lô để lấy / kho để gửi — gõ số là Sổ kho tháng đổi ngay theo lựa
     chọn này (cột xuất của lô · lô gửi đông theo ngày, xem lib/khoCanDoi.ts). Đổi lô khi
     đã có số ⇒ trả lô cũ, trừ lô mới; lô mới không đủ ⇒ chặn, không ghi gì. */
  const chonLo = (h: HangLuoiNL, loId: string) => {
    const goc = layGoc(h.id);
    if (!goc) return;
    const lo = luoi.luaChonLo([loId]).find((x) => x.value === loId);
    /* Giá lấy xả đông = đơn giá của lô (đúng giá vốn); lô chưa có giá thì giữ giá đang có. */
    ghiDong(h.id, { stockLineId: loId, unitPrice: lo?.gia ?? goc.unitPrice });
  };

  const phuDongKho = (h: HangLuoiNL, dauNhom: boolean) => {
    const goc = layGoc(h.id);
    if (luoi.daChot) {
      const mt = goc ? luoi.moTaDongKho(goc) : "";
      return mt ? <span className="mt-0.5 block">{mt}</span> : undefined;
    }
    return (
      <span className="mt-1 block space-y-1">
        {h.loaiKho === "lay-xa-dong" ? (
          <Combobox
            label={`Lô lấy xả đông — ${h.ten}`}
            anNhan
            value={goc?.stockLineId ?? ""}
            onChange={(v) => chonLo(h, v)}
            options={luoi.luaChonLo(goc?.stockLineId ? [goc.stockLineId] : [])}
            placeholder="Chọn kho · lô"
            emptyText="Sổ kho tháng không còn lô nào có tồn."
            choPhepXoa={false}
          />
        ) : (
          <Combobox
            label={`Kho gửi đông — ${h.ten}`}
            anNhan
            value={goc?.stockLocation ?? ""}
            onChange={(v) => ghiDong(h.id, { stockLocation: v })}
            options={luoi.luaChonKhoGui}
            placeholder="Chọn kho gửi"
            choPhepXoa={false}
          />
        )}
        {h.loaiKho === "gui-dong" && dauNhom && conDoSX > 0 && (
          <span className="inline-flex flex-wrap items-center gap-1">
            {guiDongCanDoi === 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={dienTuSX}
                title="Điền dòng Gửi đông đúng từng ngày bằng số NL còn dở tổ trưởng khai khi chốt ngày ở Sản xuất."
              >
                Lấy {num(conDoSX)} kg còn dở SX
              </Button>
            ) : guiDongCanDoi === conDoSX ? (
              <Nhan loai="xong">khớp còn dở SX</Nhan>
            ) : (
              <Nhan loai="luu-y">
                SX còn dở {num(conDoSX)} · lệch {num(guiDongCanDoi - conDoSX)}
              </Nhan>
            )}
          </span>
        )}
      </span>
    );
  };

  /** Thêm một dòng kho nữa (lấy thêm lô khác / gửi thêm kho khác). */
  const themDongKho = (loai: LoaiDongKho) => {
    if (ghiNL([...nlVao, { ...mauDongKho(loai), id: uid() }]))
      notify.daLuu(loai === "lay-xa-dong" ? "Đã thêm dòng Lấy xả đông — chọn lô" : "Đã thêm dòng Gửi đông — chọn kho");
  };
  const duLo = dongLay.length > 0 && dongLay.every((h) => layGoc(h.id)?.stockLineId);
  const duKho = dongGui.length > 0 && dongGui.every((h) => layGoc(h.id)?.stockLocation);

  const dongKho = (ds: HangLuoiNL[]): HangLuoi<HangLuoiNL>[] =>
    ds.map((h, i) => ({
      id: h.id,
      du: h,
      /* Chuỗi (không JSX) để nhãn đọc của từng ô mang tên dòng. */
      ten: h.ten === TEN_DONG_KHO[h.loaiKho!] ? h.ten : `${TEN_DONG_KHO[h.loaiKho!]} · ${h.ten}`,
      kieu: h.loaiKho === "gui-dong" ? "giam" : undefined,
      phu: phuDongKho(h, i === 0),
    }));

  /* Không có dòng tiêu đề nhóm — bảng giấy cũng không: tên loại hàng tự nói nhóm
     ("x.đ Cò May", "Bột 24v"), dòng Giảm tô đỏ nhạt. Thứ tự vẫn theo nhóm. */
  const hang: HangLuoi<HangLuoiNL>[] = [...dongKho(hangLay)];
  for (const g of nhomCoDong) {
    for (const h of g.dong) hang.push({ id: h.id, du: h, ten: h.ten });
  }
  if (dongGiam.length > 0) {
    for (const h of dongGiam) {
      hang.push({
        id: h.id,
        du: h,
        ten: h.ten,
        kieu: "giam",
        phu: laBanNoiDia(h) ? phuBanNoiDia(h) : KHO_XUONG.some((k) => k.id === h.khoGiam) ? undefined : (
          <Nhan loai="loi" className="mt-0.5">
            chưa chọn kho
          </Nhan>
        ),
      });
    }
  }
  hang.push(...dongKho(hangGui));

  /* Dòng lệch tên + dòng đang thuộc kỳ khác đều chọn tay được từ một chỗ. */
  const dongChonDuoc = useMemo(
    () => [...nhapKhacLoai, ...nhapKyKhac],
    [nhapKhacLoai, nhapKyKhac]
  );

  const tongKg = hangNL.reduce((s, h) => s + h.tong, 0);
  const tongTien = hangNL.reduce((s, h) => s + h.tong * (h.donGia ?? 0), 0);

  /** Gợi ý cho hộp thêm dòng: danh mục + tên các dòng đã có trong kỳ. */
  const goiYLoai = useMemo(() => {
    const ten = new Set<string>([
      ...loaiNLDanhMuc.map((l) => l.name),
      ...hangNL.filter((h) => !h.laGiam && !h.loaiKho).map((h) => h.ten),
    ]);
    return [...ten].filter(Boolean).map((t) => ({ value: t, label: t }));
  }, [loaiNLDanhMuc, hangNL]);

  /* Chẩn đoán sổ nhập — chỉ nói khi có việc cần làm (chuyến khác loại / thuộc kỳ khác);
     số "chờ lấy" đã nằm trên nút Lấy. */
  const lyDoLech = [
    chanDoanNhap.lechTen > 0 && `${chanDoanNhap.lechTen} chuyến khác loại`,
    chanDoanNhap.kyKhac > 0 && `${chanDoanNhap.kyKhac} chuyến thuộc kỳ khác`,
  ].filter(Boolean);

  return (
    <section className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Nguyên liệu vào</h2>
        <div className="flex flex-wrap gap-2">
          {nhapChoHut.length > 0 && (
            <Button
              title="Hút mọi dòng nhập nguyên liệu trong khoảng ngày của kỳ từ sổ nhập hàng vào lưới này." onClick={() => hutNhapHang()}>
              <Download />
              Lấy {nhapChoHut.length} dòng từ sổ nhập
            </Button>
          )}
          {!luoi.daChot && !dongBanNoiDia?.isReduction && banNoiDiaSX.tongKg > 0 && (
            <Button
              title="Tạo dòng giảm Bán nội địa và điền đúng từng ngày bằng số tổ trưởng ghi ở màn Sản xuất thành phẩm (NL bán thẳng, không chế biến)."
              variant="outline"
              size="lg"
              onClick={dienBanNoiDia}
            >
              <Download />
              Lấy bán nội địa từ SX ({num(banNoiDiaSX.tongKg)} kg)
            </Button>
          )}
          {dongChonDuoc.length > 0 && (
            <Button
              title="Tự chọn từng dòng nhập muốn đưa vào kỳ, thay vì lấy hết." variant="outline" onClick={() => setChonNhapMo(true)}>
              <ListChecks />
              Chọn dòng nhập ({dongChonDuoc.length})
            </Button>
          )}
          {!luoi.daChot && nhomGopDuoc.length > 0 && (
            <Button
              title="Gộp các dòng cùng loại nguyên liệu lại thành một dòng cho gọn bảng." variant="outline" onClick={gopSize}>
              <Combine />
              Gộp cùng loại ({nhomGopDuoc.reduce((s, g) => s + g.length, 0)})
            </Button>
          )}
          <Button
            title="Ẩn / hiện các cột chia theo ngày. Ẩn đi thì bảng gọn, gõ thẳng cột Số lượng." variant="outline" onClick={onDoiAnNgay}>
            <ChevronsLeftRight />
            {anNgay ? "Mở cột ngày" : "Thu cột ngày"}
          </Button>
        </div>
      </div>

      {/* Màn trống phải nói được vì sao trống — nhưng chỉ nói khi có chuyện. */}
      {lyDoLech.length > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          Sổ nhập trong khoảng ngày còn {lyDoLech.join(" · ")} — bấm “Chọn dòng nhập” nếu cần lấy.
        </p>
      )}
      {/* Sổ kho tháng bị sửa / nạp lại ngoài cân đối ⇒ phần lấy-gửi của kỳ không còn khớp. */}
      {luoi.lechSoKho > 0 && !luoi.daChot && (
        <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-warning-surface px-4 py-2 text-sm font-medium text-destructive">
          ⚠ Sổ kho tháng lệch {luoi.lechSoKho} chỗ so với dòng Lấy xả đông / Gửi đông của kỳ.
          <Button
            size="sm"
            variant="outline"
            onClick={luoi.ghiLaiSoKho}
            title="Ghi lại phần lấy xả đông / gửi đông của kỳ vào Sổ kho tháng cho khớp (có Hoàn tác)."
          >
            Ghi lại vào sổ kho
          </Button>
        </p>
      )}
      {luoi.kyTrungNgay.length > 0 && (
        <p className="mb-3 rounded-lg bg-warning-surface px-4 py-2 text-sm font-medium text-destructive">
          ⚠ Trùng ngày với kỳ {hoNguyenLieu(luoi.tenLoaiKy)}{" "}
          {luoi.kyTrungNgay.map((k) => k.dateRangeDescription || `${k.startDate} – ${k.endDate}`).join("; ")}
          {" "}— chuyến nhập những ngày đó đã thuộc kỳ kia.
        </p>
      )}
      {chanDoanNhap.tongTrongKhoang === 0 && ngay.length > 0 && tongKg === 0 && (
        <p className="mb-3 rounded-lg bg-warning-surface px-4 py-2 text-sm text-warning">
          Sổ nhập không có chuyến nào ngày {nhanNgay(ngay[0])}–{nhanNgay(ngay[ngay.length - 1])} —
          kiểm lại ngày của kỳ (theo ngày hàng về xưởng).
        </p>
      )}

      <LuoiNhap
        moTa="Lưới nguyên liệu vào theo ngày trong kỳ"
        tenCotDau="Loại hàng"
        cot={cotHienThi}
        hang={hang}
        toMau="can-doi-nl"
        nhomAn={anNgay ? ["ngay", "khi-mo-ngay"] : ["khi-thu-ngay"]}
        onGhiO={ghiO}
        onDanKhoi={danKhoi}
        cuoiBang={
          <tr className="bg-muted font-semibold">
            <th
              scope="row"
              className="sticky left-0 z-10 border-t-2 border-r-2 border-border bg-muted px-4 py-3 text-left"
            >
              T. CỘNG
            </th>
            <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
              {num(tongKg)}
            </td>
            <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
              {tongKg > 0 ? num(Math.round(tongTien / tongKg)) : "—"}
            </td>
            <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
              {num(tongTien)}
            </td>
            <td className="border-t-2 border-l border-border" />
            {!anNgay &&
              ngay.map((iso) => (
                <td key={iso} className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                  {num(hangNL.reduce((s, h) => s + (h.theoNgay[iso] ?? 0), 0)) || "—"}
                </td>
              ))}
            {!anNgay && coChuyenKyCu && (
              <td className="tnum border-t-2 border-l border-border bg-warning-surface px-3 py-3 text-right">
                {num(hangNL.reduce((s, h) => s + h.chuyenKy, 0)) || "—"}
              </td>
            )}
          </tr>
        }
      />

      {!luoi.daChot && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            title="Thêm dòng xả đông hàng mua về (cấp đông ở kho khác). Xả đông hàng kho mình gõ thẳng vào dòng Lấy xả đông." variant="outline" onClick={() => setThemMo("Xả đông")}>
            <Plus />
            Xả đông mua về
          </Button>
          <Button
            title="Thêm dòng bột / phụ gia dùng trong kỳ." variant="outline" onClick={() => setThemMo("Bột phụ gia")}>
            <Plus />
            Bột phụ gia
          </Button>
          <Button
            title="Thêm một dòng giảm trừ nguyên liệu (bán nội địa, hao hụt, trả lại…)." variant="outline" onClick={() => setThemMo("giam")}>
            <Plus />
            Dòng giảm
          </Button>
          {duLo && (
            <Button
              title="Thêm một dòng Lấy xả đông nữa để lấy từ lô / kho khác." variant="outline" onClick={() => themDongKho("lay-xa-dong")}>
              <Plus />
              Lấy thêm lô
            </Button>
          )}
          {duKho && (
            <Button
              title="Thêm một dòng Gửi đông nữa để gửi vào kho khác." variant="outline" onClick={() => themDongKho("gui-dong")}>
              <Plus />
              Gửi thêm kho
            </Button>
          )}
          {hangNL.some((h) => !h.tuSoNhap) && (
            <Button
              title="Xoá dòng nhập tay hoặc đổi kho nhận của dòng giảm."
              variant="ghost"
              onClick={() => setSuaTayMo(true)}
            >
              <Pencil />
              Sửa / xoá dòng tay
            </Button>
          )}
        </div>
      )}

      {suaTayMo && (
        <HopDongNhapTay
          dong={hangNL.filter((h) => !h.tuSoNhap)}
          tenDong={(h) => (h.loaiKho ? TEN_DONG_KHO[h.loaiKho] : h.ten)}
          khoXuong={KHO_XUONG.map((k) => ({ value: k.id, label: k.name }))}
          coKho={(h) => !laBanNoiDia(h)}
          onDoiKho={(id, kho) => ghiDong(id, { reductionWarehouseId: kho })}
          onXoa={xoaDong}
          onClose={() => setSuaTayMo(false)}
        />
      )}

      {themMo && (
        <HopThemDongNL
          laGiam={themMo === "giam"}
          tieuDe={themMo === "giam" ? "Thêm dòng giảm" : `Thêm dòng ${themMo}`}
          goiY={
            themMo === "giam" && !dongBanNoiDia
              ? [{ value: TEN_DONG_BAN_NOI_DIA, label: TEN_DONG_BAN_NOI_DIA }, ...goiYLoai]
              : goiYLoai
          }
          onThemLoaiNL={onThemLoaiNL}
          suaLoai={suaLoaiNL}
          onClose={() => setThemMo(null)}
          onLuu={(ten) => themDong(themMo, ten)}
        />
      )}

      {chonNhapMo && (
        <HopChonDongNhap
          dong={dongChonDuoc}
          kyDangGiu={new Set(nhapKyKhac.map((r) => r.id))}
          cungHo={luoi.cungHoKy}
          tenLoaiKy={hoNguyenLieu(luoi.tenLoaiKy)}
          onClose={() => setChonNhapMo(false)}
          onLuu={(ids) => {
            hutNhapHang(ids);
            setChonNhapMo(false);
          }}
        />
      )}
    </section>
  );
}
