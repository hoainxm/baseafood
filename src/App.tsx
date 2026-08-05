import { useState } from "react";
import NhapNguyenLieuScreen from "@/features/NhapNguyenLieu";
import CanDoiScreen from "@/features/CanDoi";
import DanhMucScreen from "@/features/DanhMuc";
import KitPage from "@/design-system/kit/KitPage";
import { CoChuNhanh, Logo, Toaster, TrangThaiDuLieu } from "@/design-system";
import { cn } from "@/lib/utils";
import { Truck, Scale, Library, Palette } from "lucide-react";

type Screen = "nhap-hang" | "can-doi" | "danh-muc" | "kit";

/**
 * Điều hướng: 3 việc, mỗi việc một động từ, mỗi việc một icon riêng.
 * 3 danh mục cũ (Mặt hàng / Khách hàng / Thành phẩm) tên gần giống nhau nên
 * gộp thành một mục "Danh mục" có tab bên trong.
 */
const NAV: {
  id: Screen;
  label: string;
  moTa: string;
  icon: typeof Truck;
}[] = [
  {
    id: "nhap-hang",
    label: "Nhập hàng",
    moTa: "Ghi chuyến nguyên liệu về xưởng",
    icon: Truck,
  },
  {
    id: "can-doi",
    label: "Cân đối",
    moTa: "Nguyên liệu vào ↔ thành phẩm ra",
    icon: Scale,
  },
  {
    id: "danh-muc",
    label: "Danh mục",
    moTa: "Mặt hàng, khách, đại lý, loại NL",
    icon: Library,
  },
];

/* Hai thanh header (thanh bên và thanh nội dung) PHẢI cùng chiều cao,
   nếu không đường kẻ dưới chúng lệch nhau và cả trang trông vênh. */
const CAO_HEADER = "h-20";

export default function App() {
  const [screen, setScreen] = useState<Screen>("nhap-hang");

  const hienTai = NAV.find((n) => n.id === screen);
  const tieuDeMan = screen === "kit" ? "Bộ giao diện" : (hienTai?.label ?? "");

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Thanh bên (desktop / tablet ngang) */}
      <aside className="hidden w-72 shrink-0 flex-col border-r-2 border-border bg-card md:flex">
        <div
          className={cn(
            "flex shrink-0 items-center border-b-2 border-border px-5",
            CAO_HEADER,
          )}
        >
          <Logo cao="h-11" phuDe="Xí nghiệp BSF1" />
        </div>

        <nav className="flex-1 space-y-2 p-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = screen === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setScreen(n.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                  active
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-transparent text-foreground hover:bg-muted",
                )}
              >
                <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-base font-semibold">
                    {n.label}
                  </span>
                  <span
                    className={cn(
                      "block text-sm",
                      active
                        ? "text-accent-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {n.moTa}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-border px-5 py-4">
          <button
            onClick={() => setScreen("kit")}
            className={cn(
              "flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-base font-medium transition-colors",
              screen === "kit"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Palette className="size-5" aria-hidden />
            Bộ giao diện
          </button>
          <TrangThaiDuLieu />
        </div>
      </aside>

      {/* Nội dung */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "flex shrink-0 items-center justify-between gap-4 border-b-2 border-border bg-card px-5 sm:px-8",
            CAO_HEADER,
          )}
        >
          <Logo cao="h-10" phuDe="Xí nghiệp BSF1" className="md:hidden" />
          <h1 className="hidden truncate text-xl font-semibold text-foreground md:block">
            {tieuDeMan}
          </h1>
          <CoChuNhanh className="shrink-0" />
        </header>

        <main className="w-full flex-1 p-5 pb-28 sm:p-8 md:pb-8">
          <div className="mx-auto w-full max-w-(--app-content-width)">
            {screen === "nhap-hang" && <NhapNguyenLieuScreen />}
            {screen === "can-doi" && <CanDoiScreen />}
            {screen === "danh-muc" && <DanhMucScreen />}
            {screen === "kit" && <KitPage />}
          </div>
        </main>
      </div>

      {/* Tab dưới cho điện thoại — cao 64px, icon + chữ, ngón cái với tới */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t-2 border-border bg-card md:hidden">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = screen === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setScreen(n.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-sm font-semibold transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-6" aria-hidden />
              <span className="leading-tight">{n.label}</span>
            </button>
          );
        })}
      </nav>

      <Toaster position="bottom-center" richColors closeButton />
    </div>
  );
}
