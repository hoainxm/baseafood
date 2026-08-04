import { useState } from "react";
import ThanhPhamScreen from "@/features/ThanhPham";
import NhapNguyenLieuScreen from "@/features/NhapNguyenLieu";
import CanDoiScreen from "@/features/CanDoi";
import MatHangScreen from "@/features/MatHang";
import KhachHangScreen from "@/features/KhachHang";
import { hasSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Boxes, ClipboardList, Fish, Scale, Package, Users } from "lucide-react";

type Screen = "nhap-nl" | "can-doi" | "mat-hang" | "khach-hang" | "thanh-pham";

const NAV: { id: Screen; label: string; icon: typeof Boxes }[] = [
  { id: "nhap-nl", label: "Nhập nguyên liệu hàng ngày", icon: ClipboardList },
  { id: "can-doi", label: "Cân đối 5 ngày", icon: Scale },
  { id: "mat-hang", label: "Mặt hàng cân đối", icon: Package },
  { id: "khach-hang", label: "Khách hàng", icon: Users },
  { id: "thanh-pham", label: "Danh mục thành phẩm", icon: Boxes },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("nhap-nl");

  return (
    <div className="flex min-h-full">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white sm:flex">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-700 text-white">
            <Fish className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Baseafood</div>
            <div className="text-xs text-slate-500">Quản lý nguyên liệu &amp; SX</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = screen === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setScreen(n.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-cyan-50 text-cyan-800"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <Icon className="size-4" />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          {hasSupabase ? "Đã kết nối Supabase" : "Dữ liệu lưu tạm trên máy"}
        </div>
      </aside>

      {/* Nội dung */}
      <div className="flex flex-1 flex-col">
        {/* Nav trên cùng cho mobile */}
        <div className="flex gap-2 border-b border-slate-200 bg-white p-2 sm:hidden">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setScreen(n.id)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-xs font-medium",
                screen === n.id
                  ? "bg-cyan-50 text-cyan-800"
                  : "text-slate-600",
              )}
            >
              {n.label}
            </button>
          ))}
        </div>

        <main className="mx-auto w-full max-w-5xl flex-1 p-5 sm:p-8">
          {screen === "nhap-nl" && <NhapNguyenLieuScreen />}
          {screen === "can-doi" && <CanDoiScreen />}
          {screen === "mat-hang" && <MatHangScreen />}
          {screen === "khach-hang" && <KhachHangScreen />}
          {screen === "thanh-pham" && <ThanhPhamScreen />}
        </main>
      </div>
    </div>
  );
}
