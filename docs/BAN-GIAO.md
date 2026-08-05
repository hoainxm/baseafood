# Bàn giao dự án — Baseafood MES (BSF1 Bà Rịa)

> **Mục đích file này:** tổng hợp toàn bộ ngữ cảnh dự án để bàn giao cho người/tài khoản tiếp nhận. Đọc file này trước, sau đó đi vào chi tiết theo các liên kết ở cuối.
>
> **Cập nhật:** 2026-08-05 · **Người bàn giao:** tài khoản Claude hiện tại.

---

## 1. Dự án là gì

Hệ thống **MES** (quản lý sản xuất) cho **Xí nghiệp Baseafood BSF1** — TP Bà Rịa, thuộc CTCP Chế biến XNK Thủy sản Bà Rịa - Vũng Tàu (thành lập 1976, ~650–1.000 lao động, 3 nhà máy, ~9.000 tấn/năm, 90% xuất khẩu, chuẩn EU/HACCP/HALAL/ISO).

**Repo mới, độc lập với SDFactory.** SDFactory chỉ là demo bán hàng — KHÔNG kế thừa cấu trúc dữ liệu / phân quyền. Tài liệu nghiệp vụ đã được chuyển từ SDFactory sang repo này để tự chứa ngữ cảnh.

### Vấn đề cốt lõi cần giải (từ buổi làm việc với chị Dung — phó GĐ phụ trách xưởng)

Baseafood là **doanh nghiệp sản xuất**, không phải thương mại. Nguyên liệu (cá, tôm, bạch tuộc — đổ xá, số lượng lớn) **không cất thẳng vào kho** mà phải qua sơ chế → rửa → **cấp đông thành lốc/khối** (khối lượng KHÔNG cố định) mới đủ chuẩn cất, để làm nguyên liệu cho kỳ sau.

Sinh ra **vòng lặp gối đầu**: mỗi kỳ dùng cả hàng mới mua lẫn lốc đông kỳ trước; phần dư lại đông gửi cho kỳ sau — các vòng đè lên nhau qua nhiều kỳ. Ghi chép phần gối đầu này bằng tay → **tồn nguyên liệu cuối tháng lệch** → **kế toán chốt số sai**. Đây là đau nhất, ưu tiên số 1.

- **Vòng lặp gối đầu = khối "đông gửi" ↔ khối "xả đông"** trong báo cáo tháng.
- Hiện làm hoàn toàn thủ công: cộng tay, gửi nhóm Zalo mỗi sáng 8–9h.

### Người dùng (quyết định mọi thứ về UI)

Phần lớn là **tổ trưởng / thủ kho 45–60 tuổi**, dùng **tablet ở xưởng lạnh, tay ướt, đeo kính lão**. Giao diện tối ưu cho nhóm này: chữ to, vùng chạm ≥ 44px, nhãn luôn hiện, nút Lưu không bao giờ disabled. Luật bắt buộc ở [`src/design-system/README.md`](../src/design-system/README.md).

### Ba phân xưởng
**Đông · Cá · Khô.** Xưởng Đông làm **cân đối 5 ngày**; xưởng Cá + Khô làm **theo tháng**. Xưởng Khô báo cáo riêng (chưa thu được file).

---

## 2. Đã build được gì (trạng thái code)

| Màn hình | File | Trạng thái |
|---|---|---|
| Nhập nguyên liệu hàng ngày | [`src/features/NhapNguyenLieu.tsx`](../src/features/NhapNguyenLieu.tsx) | 🟡 **một phần** — nhập theo chuyến (1 đại lý nhiều dòng loại hàng) + lọc ngày/khoảng/xưởng/đại lý/loại chạy được; **thiếu chốt ngày, không có chuyến thật (chuyen_id), chưa nhập phế liệu** — xem §5 + §7 |
| Cân đối 5 ngày + xuất bảng in | [`CanDoi.tsx`](../src/features/CanDoi.tsx) · [`BangCanDoi.tsx`](../src/features/BangCanDoi.tsx) | ✅ gồm khối phế liệu (nội tạng/dạt), tính định mức + lãi/lỗ |
| Danh mục (5 tab) | [`DanhMuc.tsx`](../src/features/DanhMuc.tsx) | ✅ đại lý · loại NL · mặt hàng · khách hàng |
| Thành phẩm (141 mã, chỉ đọc) | [`ThanhPham.tsx`](../src/features/ThanhPham.tsx) | ✅ seed từ danh mục kế toán TK 1551 |
| Bộ giao diện người lớn tuổi + cài đặt hiển thị | `src/design-system/` | ✅ |
| Tầng dữ liệu Supabase ↔ localStorage | [`src/lib/repo.ts`](../src/lib/repo.ts) | ✅ env-gated |

**Đường điều hướng** (`App.tsx`): 3 mục — Nhập hàng · Cân đối · Danh mục.

> ⚠️ **Đính chính bản handoff trước:** màn Nhập hàng **chưa "xong"** (thiếu chốt ngày + chuyến thật); phế liệu **đã build** ở màn Cân đối chứ không phải backlog. Chi tiết §7.

### Backlog (chưa làm — cần khảo sát thực địa tiếp)
- Điền anon key + chạy migration lên Supabase (đang chạy localStorage).
- Siết RLS theo người dùng (thêm đăng nhập trước).
- Nhập khẩu số liệu cũ lên máy chủ (hiện phải sửa/lưu tay từng màn để đẩy).
- **Định mức NL → TP** (tỷ lệ thu hồi) — mắt xích tính tồn cuối kỳ.
- Báo cáo tháng 6 khối.
- **Vòng lặp đông gửi ↔ xả đông + tồn cuối kỳ** (vấn đề cốt lõi §1 — CHƯA số hóa).
- Phế liệu (nội tạng, dạt — bán giá riêng) đưa vào cân đối.
- Test thực địa với 5 người dùng ≥45 tuổi.

---

## 3. Kiến trúc & quy tắc code (bắt buộc tuân thủ)

**Stack:** React + Vite + TypeScript strict + Tailwind v4 + primitive kiểu shadcn (radix-nova). Alias `@/*` → `src/*`.

**Cấu trúc:**
```
src/
├── data/thanh-pham.json     141 mã thành phẩm (TK 1551) — chỉ là SEED cho bảng thanh_pham
├── types.ts                 ThanhPham, DongNhapNL, MatHang, KhachHang, DaiLy, LoaiNguyenLieu, KyCanDoi…
├── lib/                     repo (Supabase↔localStorage) · danhMuc · format (vi-VN) · db · canDoi · supabase · store
├── components/ui/           primitive shadcn — ĐÃ đè size cho người lớn tuổi
├── design-system/
│   ├── tokens.css           NƠI DUY NHẤT định cỡ chữ / màu / chiều cao ô
│   ├── patterns/            Field, NumberField, Combobox, DateField, RecordTable, DanhMucCrud, ConfirmDelete…
│   └── index.ts             cửa import DUY NHẤT cho features
├── features/                5 màn nghiệp vụ
└── App.tsx
```

**Quy tắc quan trọng nhất:**
1. `src/features/**` **chỉ import từ `@/design-system`.** Cấm import thẳng `@/components/ui/*`; cấm viết class cỡ chữ / mã màu tay — sửa `tokens.css` thay vì đè cục bộ.
2. Mọi khối lượng là **kg**; số hiển thị locale **vi-VN**, class `tnum` (tabular-nums).
3. Nhãn luôn hiện (không dùng placeholder thay nhãn); vùng chạm ≥ 44px; nút Lưu **không bao giờ disabled** (thiếu thì bắn `ErrorSummary`).
4. Không xóa bản ghi nghiệp vụ — dùng trạng thái; mọi xóa hiện tại qua `ConfirmDelete` + toast Hoàn tác.
5. Danh mục thay nhập tự do: đại lý / loại NL / mặt hàng / khách hàng chọn qua `Combobox` (tạo mới tại chỗ).
6. Brand `#17529c` (từ `public/baseafood-logo.png`).
7. ⚠️ `npx shadcn add` **không chạy được trên Windows** (CLI quét ngược thư mục cha, đụng junction bị khóa quyền) — lấy component thủ công theo `src/design-system/README.md`.

---

## 4. Dữ liệu & Supabase

**Mọi màn đọc/ghi qua [`src/lib/repo.ts`](../src/lib/repo.ts)** — KHÔNG gọi localStorage trực tiếp.
- Chưa điền `.env` → chạy **localStorage** (số liệu nằm trên đúng 1 máy/trình duyệt, xóa lịch sử = mất sạch, không backup).
- Điền `.env` → chạy **Supabase**, đồng thời ghi bản sao xuống localStorage (mất mạng giữa ca vẫn đối chiếu được).

**Quy ước đặt tên DB: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố** (`nhap_nguyen_lieu`, `so_luong_kg`). Cấm tên có dấu — Postgres bắt bọc nháy kép + dấu tiếng Việt có 2 dạng Unicode NFC/NFD trông giống hệt nhưng là 2 định danh khác nhau.

**11 bảng:** `xi_nghiep` · `dai_ly` · `loai_nguyen_lieu` · `thanh_pham` (khóa chính = `ma`) · `mat_hang` · `khach_hang` · `nhap_nguyen_lieu` · `ky_can_doi` · `nguyen_lieu_vao` · `phe_lieu` · `thanh_pham_ra`.

**Migration** (`supabase/migrations/`):
- `0001_baseafood_mes.sql` — tạo 11 bảng MES.
- `0002_go_bo_sdfactory.sql` — gỡ 3 bảng cũ SDFactory (**PHÁ HỦY, chạy thủ công, không hoàn tác**; không chạy cũng không ảnh hưởng MES).
- `0003_siet_rls.sql` — siết RLS về `authenticated` (chạy SAU khi có đăng nhập, nếu không app ngừng đọc/ghi).

**Hướng dẫn cutover chi tiết:** [`docs/supabase-setup.md`](supabase-setup.md).

### 🔒 Bảo mật — đọc kỹ trước khi bàn giao
- ⚠️ RLS hiện **mở cho `anon`** (chưa có đăng nhập) → **ai có anon key là sửa được số liệu**. Chỉ chạy trong **mạng nội bộ xí nghiệp**. Trước khi mở ra ngoài: thêm đăng nhập → chạy `0003`.
- **KHÔNG ghi project ref / URL / key** vào bất kỳ file nào trong repo. `.env.example` để trống; `.env` đã gitignore.
- Nếu anon key từng bị commit ở repo bất kỳ: **rotate** ở Dashboard → Project Settings → API → Rotate.
- URL + anon key lấy ở Dashboard → Project Settings → API. **Người bàn giao KHÔNG để lại key trong file này** — người tiếp nhận tự lấy từ Dashboard sau khi được cấp quyền project.

---

## 5. Việc đang làm dở (uncommitted — chú ý khi tiếp nhận)

`git status` có 2 file sửa **chưa commit**:

| File | Nội dung sửa dở |
|---|---|
| `src/features/NhapNguyenLieu.tsx` | Refactor màn nhập sang mô hình **"chuyến"**: 1 đại lý đổ NHIỀU loại hàng trong 1 lượt giao (1 xe), mỗi loại một dòng, thêm loại nào **lưu luôn** loại đó. Khớp **Q21 đã chốt** (gộp lượt giao) + đúng sổ giấy "Báo cáo tổng hợp NL hàng ngày" (STT theo đại lý). +341 dòng. |
| `CLAUDE.md` | sửa nhỏ 1 dòng. |

**Mô hình dữ liệu hiện tại của "chuyến" — đọc kỹ để không hiểu nhầm:**
- Đại lý giao 3 mặt hàng ⇒ **3 dòng** `nhap_nguyen_lieu`, KHÔNG phải 3 phiếu riêng (đúng Q21). Ba dòng chung đầu chuyến (ngày · đại lý · tài xế · biển số).
- ⚠️ Nhưng **không có thực thể "phiếu/chuyến" thật**: 3 dòng chỉ **gom ngầm** theo (ngày + đại lý + xe), KHÔNG có `chuyen_id` liên kết. Hệ quả: ContextBar đếm "Số chuyến" = số đại lý phân biệt ([NhapNguyenLieu.tsx:369](../src/features/NhapNguyenLieu.tsx#L369)) → **cùng 1 đại lý giao 2 chuyến trong ngày bị gộp thành 1**.
- `DongNhapNL` ([types.ts](../src/types.ts)) chưa có `chuyenId`, chưa có trường trạng thái **chốt/khóa**.

→ Người tiếp nhận **quyết định commit hay tiếp tục** phần refactor "chuyến" này. Ba điểm sổ nhập cần bổ sung (từ xác nhận đợt 2, **đã làm** trong bản refactor): thêm thành tiền = SL × đơn giá · tách cột tài xế/biển số khỏi ghi chú · thêm trường loài NL rõ ràng (không mặc định ngầm "bạch tuộc").

---

## 6. Nghiệp vụ đã chốt với người dùng (nền tảng thiết kế)

Từ **28 câu hỏi xác nhận** — xem đầy đủ [`docs/trien-khai/bang-cau-hoi-xac-nhan-truoc-plan.md`](trien-khai/bang-cau-hoi-xac-nhan-truoc-plan.md). Điểm cốt lõi:

- **Kỳ cân đối** = tập ngày **tiếp nhận NL** của một lô (ngày rời rạc, không liên tục). Mỗi **loại NL một bảng**.
- **TP làm ra có thể trễ hơn kỳ** → nhập TP gắn theo **lô**; hệ thống cho nhập cả khi kỳ nhận NL đã đóng.
- **Định mức chế biến = Tổng NL (kg) ÷ Tổng TP (kg)**. Đã kiểm chứng mẫu "Mực ống khay": 3.106 ÷ 2.856 ≈ **1,09** (khớp).
- **Công thức:** Giá thành = (Tổng TP × chi phí CB/kg) + giá trị NL; Lãi/Lỗ = giá trị xuất − giá thành. Chi phí CB, tỉ giá (26.000 VND/USD), đơn giá NL/USD: **nhập tay mỗi kỳ**.
- Gộp nội địa (VND) + xuất khẩu (USD) trong 1 bảng, quy tỉ giá.
- **Đại lý (đầu vào) ≠ khách hàng (đầu ra)** — 2 danh mục tách riêng.
- Tài xế/biển số theo **từng lượt giao** (không cố định theo đại lý); biển số **không bắt buộc**.
- "Bột" = **phụ gia tẩm** (có cột tỷ lệ % trong TP), không phải phụ phẩm.
- Mặt hàng **chưa khớp hẳn 141 mã** → cần ánh xạ + bổ sung danh mục; danh mục mặt hàng **mở** (thêm inline).
- **Mindset quy ước:** NL không ghi loài ⇒ mặc định **bạch tuộc**. "80 trên = lớn / 80 dưới = nhỏ" (mốc ~80 g/con) để định giá khác nhau.
- **Bỏ** khối "tồn NL phân xưởng" + "xả đông" khỏi báo cáo tháng (không theo dõi được).

### Còn treo (chưa chốt, không chặn code hiện tại)
1. **Quy tắc chia NL cho từng bảng cân đối** — bảng phụ theo ngày là tổng NL nhận (VD mực 6.291 kg), mỗi bảng chỉ lấy phần đưa vào mặt hàng đó (VD 3.106) — cân riêng hay ước tính? Máy gợi ý hay nhập tay?
2. **Chỉ số ≈ 0,45** = Tổng TP ÷ Tổng NL nhận — cần tên gọi + định nghĩa chính xác ô.

---

## 7. Việc cần làm tiếp — hướng đi cụ thể cho từng gap

Ba gap dưới đây là **ưu tiên làm tiếp ngay** trên màn Nhập hàng, đã thống nhất hướng đi (chưa code):

### 7.1 · Chốt nhập hàng của 1 ngày (khóa số liệu) — CHƯA có
- **Vì sao:** docs §2 điểm 4 (`ke-hoach-tuan-1`) yêu cầu *"tự cộng và **khóa kỳ** — thay việc cộng tay"*; tổng ngày (VD 31/7 = 9.210 kg) chốt xong mới chuyển sang biểu mẫu tháng. Hiện mọi dòng sửa/xóa bất kỳ lúc nào → không có mốc "số liệu ngày này đã đúng, khóa lại".
- **Hướng đi:** thêm bản ghi **trạng thái chốt theo (ngày + phân xưởng)** — nút **"Chốt ngày"** ⇒ khóa toàn bộ chuyến của ngày đó (không cho sửa/xóa/thêm), hiển thị tổng ngày đã chốt, chừa nút **"Mở lại"** cho người có quyền. Đây là **điểm đau nhất** — nên làm trước.

### 7.2 · Chuyến thật (`chuyen_id`) — hiện gom ngầm
- **Vì sao:** 3 dòng cùng chuyến chỉ gom theo (ngày+đại lý+xe); 1 đại lý giao 2 lần/ngày bị đếm thành 1 chuyến (§5).
- **Hướng đi:** thêm bảng `chuyen_nhap` (id · ngày · phân xưởng · đại lý · tài xế · biển số · ghi chú · trạng thái chốt) + cột `chuyen_id` trên `nhap_nguyen_lieu`. Mỗi lần "Ghi chuyến hàng" tạo 1 chuyến; các dòng loại hàng gắn `chuyen_id`. "Số chuyến" đếm theo chuyến thật. *(Trạng thái chốt ở §7.1 nên gắn vào chuyến hoặc vào ngày — chốt sớm 2 cái này cùng nhau.)*

### 7.3 · Nhập phế liệu (nội tạng / dạt) ngay tại màn Nhập hàng — QUYẾT ĐỊNH MỚI
- **Hiện trạng:** phế liệu **đã build** nhưng ở màn **Cân đối** (`KhoiPheLieu`, [CanDoi.tsx:712](../src/features/CanDoi.tsx#L712), bảng `phe_lieu`) — theo docs cũ (*"phế liệu từ NL **ra** → đưa vào cân đối"*).
- **Quyết định mới (chủ dự án chốt 05/08):** nghiệp vụ thực tế **cân nội tạng/dạt ngay lúc nhận hàng** → **thêm ô nhập phế liệu vào màn Nhập hàng**. Đây là **thay đổi lệch docs cũ** — khi làm phải:
  1. Cập nhật docs nghiệp vụ (`bang-cau-hoi` đợt 2 + `plan-flow` §4) cho khớp.
  2. Quyết chỗ lưu: dùng lại bảng `phe_lieu` (gắn theo chuyến/ngày nhập thay vì theo kỳ cân đối) hay bảng riêng — **tránh nhập 2 nơi cho cùng 1 số liệu** (nguyên tắc "một số liệu một nguồn chuẩn").
  3. Cân đối vẫn phải đọc được phế liệu (đang tính `giaTriPheLieu` trong [canDoi.ts](../src/lib/canDoi.ts)) — đừng làm gãy phần này.

### Câu chốt còn treo với xí nghiệp (xem [`can-xac-nhan-dot-tiep.md`](trien-khai/can-xac-nhan-dot-tiep.md))
- Q23: giải nghĩa mã NL viết tắt còn lại ("80j", "100 NL", "R2C") — hỏi thủ kho.
- Q27: xưởng Khô báo cáo ở đâu, ai giữ.
- Q28: ai nhập số liệu mỗi phân xưởng (hiện: **Trúc** nhập máy, **Thủy** ghi tay).
- 2 điểm còn treo ở §6 (quy tắc chia NL cho từng bảng; định nghĩa chỉ số ≈ 0,45).

**File cần xin thêm:** báo cáo BTP hàng ngày (mẫu) · bảng cân đối 5 ngày các loại NL khác · bảng giá khách hàng (USD theo khách + mặt hàng) · file số liệu xưởng Khô.

**Đầu mối liên hệ:** chị **Dung** (phó GĐ, phụ trách xưởng) · **Trúc** (nhập Excel) · **Thủy** (ghi tay) · thủ kho từng kho (3 tầng: 2 kho lớn XN · kho nhỏ xưởng · kho thuê ngoài).

---

## 8. Chạy dự án

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

Cutover Supabase: `cp .env.example .env` → điền `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_ID=bsf1` → chạy `0001` ở SQL Editor → góc thanh bên hiện **"Đã nối máy chủ"** màu xanh.

---

## 9. Bản đồ tài liệu (đọc theo thứ tự)

| # | File | Nội dung |
|---|---|---|
| 0 | [`CLAUDE.md`](../CLAUDE.md) | Chỉ dẫn cho AI agent — tóm tắt quy tắc + cấu trúc (đọc đầu tiên khi mở repo) |
| 1 | [`docs/trien-khai/README.md`](trien-khai/README.md) | Mục lục tài liệu nghiệp vụ |
| 2 | [`docs/trien-khai/ke-hoach-tuan-1-thu-thap-du-lieu.md`](trien-khai/ke-hoach-tuan-1-thu-thap-du-lieu.md) | **Phân tích hiện trạng đầy đủ**: tổ chức, dữ liệu, 6 khối báo cáo tháng, vòng lặp gối đầu |
| 3 | [`docs/trien-khai/bang-cau-hoi-xac-nhan-truoc-plan.md`](trien-khai/bang-cau-hoi-xac-nhan-truoc-plan.md) | 28 câu hỏi + **kết quả xác nhận** với người dùng |
| 4 | [`docs/trien-khai/plan-flow-can-doi-5-ngay.md`](trien-khai/plan-flow-can-doi-5-ngay.md) | Thiết kế flow cân đối 5 ngày (đã code) |
| 5 | [`docs/trien-khai/diem-can-xac-nhan-theo-buoi.md`](trien-khai/diem-can-xac-nhan-theo-buoi.md) · [`can-xac-nhan-dot-tiep.md`](trien-khai/can-xac-nhan-dot-tiep.md) | Sổ điểm cần xác nhận theo buổi/đợt |
| 6 | [`docs/supabase-setup.md`](supabase-setup.md) | Cutover Supabase + bảo mật + tầng repo |
| 7 | [`src/design-system/README.md`](../src/design-system/README.md) | Luật UI cho người lớn tuổi + bảng chọn component |

---

**Tóm một câu:** master data + cân đối 5 ngày (kèm phế liệu) đã xong và chạy được (localStorage); màn Nhập hàng nhập được theo chuyến nhưng **còn thiếu chốt ngày + chuyến thật + nhập phế liệu tại chỗ (§7)**; phần khó nhất — **số hóa vòng lặp gối đầu để chốt tồn cuối kỳ đúng** — vẫn còn nguyên phía trước, chờ khảo sát thực địa tiếp và chốt 2 điểm treo ở §6.
