import { useMemo, useState } from "react";
import type {
  KyCanDoi,
  DongNLVao,
  DongPheLieu,
  DongTP,
  MatHang,
  KhachHang,
  NhomNL,
  Kenh,
} from "@/types";
import { NHOM_NL, KENH } from "@/types";
import { KEYS, load, save, uid } from "@/lib/db";
import { tinhCanDoi } from "@/lib/canDoi";
import { Button, Card, Input, Select, Label, Badge } from "@/components/ui";
import { num } from "@/lib/format";
import { Plus, Trash2, ChevronLeft, FileText } from "lucide-react";
import BangCanDoi from "@/features/BangCanDoi";

export default function CanDoiScreen() {
  const [kyList, setKyList] = useState<KyCanDoi[]>(() => load(KEYS.ky));
  const [selId, setSelId] = useState<string | null>(null);
  const [loaiNL, setLoaiNL] = useState("");
  const [ngayList, setNgayList] = useState("");

  const persistKy = (next: KyCanDoi[]) => {
    setKyList(next);
    save(KEYS.ky, next);
  };

  const taoKy = () => {
    if (!loaiNL.trim()) return;
    const ky: KyCanDoi = {
      id: uid(),
      loaiNL: loaiNL.trim(),
      ngayList: ngayList.trim(),
      tongNLNhan: null,
      tiGia: 26000,
      chiPhiCB: null,
      createdAt: new Date().toISOString(),
    };
    persistKy([ky, ...kyList]);
    setLoaiNL("");
    setNgayList("");
    setSelId(ky.id);
  };

  const sel = kyList.find((k) => k.id === selId) || null;

  if (sel) {
    return (
      <KyDetail
        ky={sel}
        onBack={() => setSelId(null)}
        onChangeKy={(patch) =>
          persistKy(kyList.map((k) => (k.id === sel.id ? { ...k, ...patch } : k)))
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Cân đối 5 ngày (xưởng Đông)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mỗi bảng = một lô nguyên liệu theo loại. Cân đối nguyên liệu vào với thành phẩm ra → định mức, lãi/lỗ.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Loại nguyên liệu *</Label>
            <Input value={loaiNL} onChange={(e) => setLoaiNL(e.target.value)} placeholder="VD: Bạch tuộc 2 da" />
          </div>
          <div className="sm:col-span-2">
            <Label>Các ngày tiếp nhận</Label>
            <Input value={ngayList} onChange={(e) => setNgayList(e.target.value)} placeholder="VD: 19-22-23-24-26-27-29/07/2026" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={taoKy} disabled={!loaiNL.trim()}>
            <Plus className="size-4" />
            Tạo kỳ cân đối
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Loại nguyên liệu</th>
                <th className="px-4 py-2.5 font-medium">Các ngày</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kyList.map((k) => (
                <tr key={k.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelId(k.id)}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{k.loaiNL}</td>
                  <td className="px-4 py-2.5 text-slate-500">{k.ngayList || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-cyan-700">Mở →</td>
                </tr>
              ))}
              {kyList.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-slate-400">
                    Chưa có kỳ cân đối nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Chi tiết một kỳ ---------- */

function KyDetail({
  ky,
  onBack,
  onChangeKy,
}: {
  ky: KyCanDoi;
  onBack: () => void;
  onChangeKy: (patch: Partial<KyCanDoi>) => void;
}) {
  const [nlVao, setNlVao] = useState<DongNLVao[]>(() =>
    load<DongNLVao>(KEYS.nlVao).filter((r) => r.kyId === ky.id),
  );
  const [pheLieu, setPheLieu] = useState<DongPheLieu[]>(() =>
    load<DongPheLieu>(KEYS.pheLieu).filter((r) => r.kyId === ky.id),
  );
  const [tp, setTp] = useState<DongTP[]>(() =>
    load<DongTP>(KEYS.tp).filter((r) => r.kyId === ky.id),
  );
  const matHang = load<MatHang>(KEYS.matHang);
  const khach = load<KhachHang>(KEYS.khachHang);
  const [showBang, setShowBang] = useState(false);

  // Lưu: gộp lại toàn bộ collection (thay phần của kỳ này).
  const saveColl = <T extends { kyId: string }>(key: string, kyRows: T[]) => {
    const others = load<T>(key).filter((r) => r.kyId !== ky.id);
    save(key, [...others, ...kyRows]);
  };
  const persistNL = (n: DongNLVao[]) => { setNlVao(n); saveColl(KEYS.nlVao, n); };
  const persistPL = (n: DongPheLieu[]) => { setPheLieu(n); saveColl(KEYS.pheLieu, n); };
  const persistTP = (n: DongTP[]) => { setTp(n); saveColl(KEYS.tp, n); };

  const kq = useMemo(() => tinhCanDoi(ky, nlVao, pheLieu, tp), [ky, nlVao, pheLieu, tp]);
  const tenMatHang = (id: string) => matHang.find((m) => m.id === id)?.ten || "—";
  const tenKhach = (id: string) => khach.find((k) => k.id === id)?.ten || "—";

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-cyan-700">
        <ChevronLeft className="size-4" /> Danh sách kỳ
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cân đối: {ky.loaiNL}</h1>
          <p className="mt-1 text-sm text-slate-500">{ky.ngayList || "Chưa ghi ngày"}</p>
        </div>
        <Button variant="outline" onClick={() => setShowBang(true)}>
          <FileText className="size-4" /> Xem / in bảng
        </Button>
      </div>

      {/* Thông số kỳ */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>Tổng NL nhận (kg)</Label>
            <Input type="number" className="tnum" value={ky.tongNLNhan ?? ""}
              onChange={(e) => onChangeKy({ tongNLNhan: e.target.value ? Number(e.target.value) : null })} placeholder="bảng phụ" />
          </div>
          <div>
            <Label>Chi phí CB / kg TP</Label>
            <Input type="number" className="tnum" value={ky.chiPhiCB ?? ""}
              onChange={(e) => onChangeKy({ chiPhiCB: e.target.value ? Number(e.target.value) : null })} placeholder="VD: 30000" />
          </div>
          <div>
            <Label>Tỉ giá (VND/USD)</Label>
            <Input type="number" className="tnum" value={ky.tiGia ?? ""}
              onChange={(e) => onChangeKy({ tiGia: e.target.value ? Number(e.target.value) : null })} placeholder="26000" />
          </div>
          <div>
            <Label>Các ngày</Label>
            <Input value={ky.ngayList} onChange={(e) => onChangeKy({ ngayList: e.target.value })} />
          </div>
        </div>
      </Card>

      {/* Khối 1: Nguyên liệu vào */}
      <KhoiNLVao rows={nlVao} onChange={persistNL} kyId={ky.id} />

      {/* Khối 2: Phế liệu */}
      <KhoiPheLieu rows={pheLieu} onChange={persistPL} kyId={ky.id} />

      {/* Khối 3: Thành phẩm ra */}
      <KhoiTP rows={tp} onChange={persistTP} kyId={ky.id} matHang={matHang} khach={khach}
        tenMatHang={tenMatHang} tenKhach={tenKhach} />

      {/* Panel tính */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Kết quả cân đối</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <KV k="Tổng nguyên liệu vào" v={`${num(kq.tongNLVao)} kg`} />
          <KV k="Tổng thành phẩm" v={`${num(kq.tongTP)} kg`} />
          <KV k="Định mức chế biến" v={num(kq.dinhMuc)} strong />
          <KV k="Tỉ lệ thu hồi / tổng nhận" v={kq.tyLeThuHoi == null ? "—" : num(kq.tyLeThuHoi)} />
          <KV k="Giá trị nguyên liệu" v={num(kq.giaTriNL)} />
          <KV k="Giá thành" v={num(kq.giaThanh)} />
          <KV k="Giá trị xuất (VND)" v={num(kq.giaTriXuat)} />
          <KV k="Bình quân / kg NL" v={num(kq.binhQuanKgNL)} />
          <KV k="Giá trị phế liệu" v={num(kq.giaTriPheLieu)} />
          <div className="col-span-2 mt-1 sm:col-span-3">
            <div className={`rounded-lg px-4 py-3 text-base font-semibold ${kq.laiLo >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {kq.laiLo >= 0 ? "Lãi" : "Lỗ"}: <span className="tnum">{num(Math.abs(kq.laiLo))}</span> VND
            </div>
          </div>
        </div>
      </Card>

      {showBang && (
        <BangCanDoi
          ky={ky}
          nlVao={nlVao}
          pheLieu={pheLieu}
          tp={tp}
          matHang={matHang}
          khach={khach}
          kq={kq}
          onClose={() => setShowBang(false)}
        />
      )}
    </div>
  );
}

function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-slate-100 py-1">
      <span className="text-slate-500">{k}</span>
      <span className={`tnum text-right ${strong ? "font-semibold text-cyan-700" : "text-slate-800"}`}>{v}</span>
    </div>
  );
}

/* ---------- Khối nhập liệu ---------- */

function KhoiNLVao({ rows, onChange, kyId }: { rows: DongNLVao[]; onChange: (n: DongNLVao[]) => void; kyId: string }) {
  const [nhom, setNhom] = useState<NhomNL>("Thủy sản");
  const [ten, setTen] = useState("");
  const [sl, setSl] = useState("");
  const [gia, setGia] = useState("");
  const [tyLe, setTyLe] = useState("");
  const add = () => {
    if (!ten.trim() || !(Number(sl) > 0)) return;
    onChange([...rows, {
      id: uid(), kyId, nhom, ten: ten.trim(), soLuongKg: Number(sl),
      donGia: gia ? Number(gia) : null, tyLe: tyLe ? Number(tyLe) : null,
    }]);
    setTen(""); setSl(""); setGia(""); setTyLe("");
  };
  const tong = rows.reduce((s, r) => s + r.soLuongKg, 0);
  const tongTien = rows.reduce((s, r) => s + r.soLuongKg * (r.donGia ?? 0), 0);
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-medium text-slate-800">1. Nguyên liệu vào</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Select value={nhom} onChange={(e) => setNhom(e.target.value as NhomNL)}>
          {NHOM_NL.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <Input className="sm:col-span-2" value={ten} onChange={(e) => setTen(e.target.value)} placeholder="Tên (VD: 2 da nl lớn)" />
        <Input type="number" className="tnum" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="Số lượng kg" />
        <Input type="number" className="tnum" value={gia} onChange={(e) => setGia(e.target.value)} placeholder="Đơn giá" />
        <Input type="number" className="tnum" value={tyLe} onChange={(e) => setTyLe(e.target.value)} placeholder="Tỷ lệ % (bột)" />
      </div>
      <div className="mt-2 flex justify-end">
        <Button variant="outline" onClick={add}><Plus className="size-4" />Thêm dòng</Button>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr><th className="py-1.5">Nhóm</th><th>Tên</th><th className="text-right">SL (kg)</th><th className="text-right">Đơn giá</th><th className="text-right">Thành tiền</th><th className="text-right">Tỷ lệ</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5"><Badge>{r.nhom}</Badge></td>
                  <td className="text-slate-800">{r.ten}</td>
                  <td className="tnum text-right">{num(r.soLuongKg)}</td>
                  <td className="tnum text-right text-slate-500">{num(r.donGia)}</td>
                  <td className="tnum text-right text-slate-800">{num(r.soLuongKg * (r.donGia ?? 0))}</td>
                  <td className="tnum text-right text-slate-500">{r.tyLe != null ? `${num(r.tyLe)}%` : "—"}</td>
                  <td className="text-right"><button onClick={() => onChange(rows.filter((x) => x.id !== r.id))} className="text-slate-400 hover:text-red-600"><Trash2 className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-slate-200 font-medium"><td className="py-1.5" colSpan={2}>Tổng</td><td className="tnum text-right">{num(tong)}</td><td></td><td className="tnum text-right">{num(tongTien)}</td><td colSpan={2}></td></tr></tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

function KhoiPheLieu({ rows, onChange, kyId }: { rows: DongPheLieu[]; onChange: (n: DongPheLieu[]) => void; kyId: string }) {
  const [loai, setLoai] = useState("");
  const [sl, setSl] = useState("");
  const [gia, setGia] = useState("");
  const add = () => {
    if (!loai.trim() || !(Number(sl) > 0)) return;
    onChange([...rows, { id: uid(), kyId, loai: loai.trim(), soLuongKg: Number(sl), donGiaBan: gia ? Number(gia) : null }]);
    setLoai(""); setSl(""); setGia("");
  };
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-medium text-slate-800">2. Phế liệu (bán giá riêng)</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input className="sm:col-span-2" value={loai} onChange={(e) => setLoai(e.target.value)} placeholder="Loại (nội tạng, dạt…)" />
        <Input type="number" className="tnum" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="Số lượng kg" />
        <Input type="number" className="tnum" value={gia} onChange={(e) => setGia(e.target.value)} placeholder="Đơn giá bán" />
      </div>
      <div className="mt-2 flex justify-end">
        <Button variant="outline" onClick={add}><Plus className="size-4" />Thêm dòng</Button>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1.5">Loại</th><th className="text-right">SL (kg)</th><th className="text-right">Đơn giá bán</th><th className="text-right">Thành tiền</th><th></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 text-slate-800">{r.loai}</td>
                  <td className="tnum text-right">{num(r.soLuongKg)}</td>
                  <td className="tnum text-right text-slate-500">{num(r.donGiaBan)}</td>
                  <td className="tnum text-right text-slate-800">{num(r.soLuongKg * (r.donGiaBan ?? 0))}</td>
                  <td className="text-right"><button onClick={() => onChange(rows.filter((x) => x.id !== r.id))} className="text-slate-400 hover:text-red-600"><Trash2 className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function KhoiTP({ rows, onChange, kyId, matHang, khach, tenMatHang, tenKhach }: {
  rows: DongTP[]; onChange: (n: DongTP[]) => void; kyId: string;
  matHang: MatHang[]; khach: KhachHang[];
  tenMatHang: (id: string) => string; tenKhach: (id: string) => string;
}) {
  const [matHangId, setMatHangId] = useState("");
  const [khachId, setKhachId] = useState("");
  const [kenh, setKenh] = useState<Kenh>("Xuất khẩu");
  const [luong, setLuong] = useState("");
  const [gia, setGia] = useState("");
  const add = () => {
    if (!matHangId || !(Number(luong) > 0)) return;
    onChange([...rows, { id: uid(), kyId, matHangId, khachId, kenh, luongKg: Number(luong), donGia: gia ? Number(gia) : null }]);
    setLuong(""); setGia("");
  };
  const tong = rows.reduce((s, r) => s + r.luongKg, 0);
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-medium text-slate-800">3. Thành phẩm ra (xuất khẩu / nội địa)</h3>
      {matHang.length === 0 && (
        <p className="mb-2 text-sm text-amber-600">Chưa có mặt hàng — thêm ở màn "Mặt hàng cân đối" trước.</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Select className="sm:col-span-2" value={matHangId} onChange={(e) => setMatHangId(e.target.value)}>
          <option value="">— Mặt hàng —</option>
          {matHang.map((m) => <option key={m.id} value={m.id}>{m.ten}</option>)}
        </Select>
        <Select value={khachId} onChange={(e) => setKhachId(e.target.value)}>
          <option value="">— Khách —</option>
          {khach.map((k) => <option key={k.id} value={k.id}>{k.ten}</option>)}
        </Select>
        <Select value={kenh} onChange={(e) => setKenh(e.target.value as Kenh)}>
          {KENH.map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
        <Input type="number" className="tnum" value={luong} onChange={(e) => setLuong(e.target.value)} placeholder="Lượng kg" />
        <Input type="number" className="tnum" value={gia} onChange={(e) => setGia(e.target.value)} placeholder={kenh === "Xuất khẩu" ? "Đơn giá USD" : "Đơn giá VND"} />
      </div>
      <div className="mt-2 flex justify-end">
        <Button variant="outline" onClick={add} disabled={!matHangId}><Plus className="size-4" />Thêm dòng</Button>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1.5">Mặt hàng</th><th>Khách</th><th>Kênh</th><th className="text-right">Lượng (kg)</th><th className="text-right">Đơn giá</th><th></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 text-slate-800">{tenMatHang(r.matHangId)}</td>
                  <td className="text-slate-500">{tenKhach(r.khachId)}</td>
                  <td><Badge>{r.kenh === "Xuất khẩu" ? "XK" : "Nội địa"}</Badge></td>
                  <td className="tnum text-right">{num(r.luongKg)}</td>
                  <td className="tnum text-right text-slate-500">{num(r.donGia)}{r.kenh === "Xuất khẩu" ? " $" : ""}</td>
                  <td className="text-right"><button onClick={() => onChange(rows.filter((x) => x.id !== r.id))} className="text-slate-400 hover:text-red-600"><Trash2 className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-slate-200 font-medium"><td className="py-1.5" colSpan={3}>Tổng</td><td className="tnum text-right">{num(tong)}</td><td colSpan={2}></td></tr></tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}
