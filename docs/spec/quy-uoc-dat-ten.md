# Quy ước đặt tên + kế hoạch dọn tên tiếng Việt không dấu

- **Ngày lập:** 2026-10-12
- **Trạng thái:** CHỐT 2026-10-12 (chủ dự án duyệt 4 câu ở §6). §2 Luật áp dụng NGAY cho mọi thứ MỚI. §5 chạy theo đợt có lịch, **Đợt 0 xong 2026-10-13**; đợt kế tiếp: **Đợt 1**.
- **Thay cho:** Phần B của [`routing-va-naming.md`](routing-va-naming.md) (dự thảo 2026-08-07; nửa DB + route của nó đã làm xong ở `0016` và đợt react-router).
- **Liên quan:** [`CLAUDE.md`](../../CLAUDE.md) luật 8 · [`app-map/03-database.md`](../app-map/03-database.md) · [`app-map/04-tang-du-lieu.md`](../app-map/04-tang-du-lieu.md) · [`src/design-system/README.md`](../../src/design-system/README.md)

---

## 1. Vì sao có doc này

Repo không chốt quy ước từ đầu. Hệ quả:

- **DB và route đã đổi sang tiếng Anh** (`0016_rename_to_english.sql`, react-router v7), **nhưng doc DB canonical vẫn dạy "tiếng Việt không dấu, cấm tiếng Anh"** tới 2026-10-12 (`03-database.md`, `ops/supabase-setup.md`, `BAN-GIAO.md`). Agent và người mới đọc doc đó rồi tiếp tục đặt tên Việt. Ví dụ: policy `_nguoi_dung`, hàm `co_vai_tro` (0057), lib `dongChay.ts` (2026-10-12).
- **Lớp code trộn Anh–Việt** ngay trong một dòng: file `SummaryTable.tsx` export `BangTong`, file `CuonNgang.tsx` export `KhungCuonNgang`, type `MaterialImportItem` cạnh hàm `tinhTon`.
- Không có cổng máy nào chặn tên mới, nên nợ tăng mỗi ngày.

## 2. Luật (áp dụng ngay cho mọi thứ MỚI)

**Một câu:** mọi **định danh kỹ thuật** (máy đọc) viết **tiếng Anh**. Mọi **chữ người dùng đọc** viết **tiếng Việt có dấu**.

| Lớp | Kiểu chữ | Ví dụ đúng | Ví dụ cấm |
|---|---|---|---|
| Bảng, cột DB | `snake_case`, bảng số nhiều | `domestic_sales.quantity_kg` | `ban_noi_dia`, `so_luong_kg` |
| Hàm SQL, trigger, policy, index | `snake_case` | `has_role()`, policy `<table>_authenticated` | `co_vai_tro()`, `_nguoi_dung` |
| File migration MỚI | `NNNN_<english_snake>.sql` | `0058_rename_component_columns.sql` | `0051_bot_tam.sql` |
| Giá trị enum LƯU trong DB | `kebab-case` tiếng Anh | `"pending"`, `"in-stock"` | `"cho-nhap"`, `"dang-gom"` |
| Biến, hàm, hook, prop | `camelCase` | `computeStock`, `isLoading`, `label` | `tinhTon`, `dangTai`, `nhan` |
| Component, type, interface | `PascalCase` | `SummaryTable`, `StockLine` | `BangTong`, `DongBanNoiDia` |
| Hằng số module | `UPPER_SNAKE` | `RETAIL_WAREHOUSE` | `KHO_BAN_LE` |
| File component / file module | `PascalCase.tsx` / `camelCase.ts` | `LotPicker.tsx`, `einvoiceReconciliation.ts` | `GanLoDauVao.tsx`, `doiSoatHddt.ts` |
| Thư mục | `kebab-case` | `features/reconciliation/` | `features/doi-soat/` |
| Route, query param, giá trị tab | `kebab-case` | `/monthly-stock`, `?tab=storage-locations` | `/ton-kho-thang`, `?tab=kho-luu` |
| Khóa localStorage | `bsf.<kebab>.v<N>` | `bsf.row-marks.v1` | `bsf.coChu`, `bsf1:nav-nhom` |
| Khóa bảng tô màu (`toMau=`) | `kebab-case` | `sales-items` | `ban-hang` |
| CSS utility, variant, token, `data-*` | `kebab-case` | `enter-up`, `press-feedback`, `data-marked` | `hien-len`, `nhan-an`, `data-to-mau` |

**Giữ tiếng Việt có dấu (đúng luật, không phải nợ):** nhãn, tiêu đề trang, toast, `title`, thông báo lỗi, comment, mô tả test (`it("...")`), tên file **doc** (`docs/**`, kebab không dấu), tên sheet/cột của file Excel kế toán.

**Cầu nối cho người đọc Việt:** mỗi file nguồn giữ dòng đầu `// Tên tiếng Việt tương đương: …` như hiện nay. Định danh tiếng Anh, khối comment đầu file nói tiếng Việt.

**Từ viết tắt được phép** (thuật ngữ nghiệp vụ đã thành tên riêng): `nxt` (nhập-xuất-tồn), `wip` (BTP), `qc`, `qr`, `sscc`, `bsf1`. Ngoài danh sách này thì dịch ra (`hddt` → `einvoice`, `nl` → `material`, `tp` → `finishedGood`, `btp` → `wip`).

**Tên riêng trong dữ liệu đã lưu** (giữ, không dịch): mã xưởng trong slug vai trò (`manager-dong`), mã TK 1551, giá trị hiển thị có dấu đã lưu sẵn (`"Đông"`, `"Nhập hàng"`). Enum MỚI thì lưu mã tiếng Anh và tra nhãn qua bảng `…_LABELS`, giống `STORAGE_KIND_LABELS`.

### 2b. Từ điển thuật ngữ (một nguồn, cấm tự dịch khác đi)

| Tiếng Việt | Định danh | | Tiếng Việt | Định danh |
|---|---|---|---|---|
| nhập hàng / chuyến | `import` / `shipment` | | tồn đầu / tồn cuối | `opening` / `closing` |
| đại lý | `supplier` | | nhập · xuất · tồn | `in` · `out` · `stock` |
| loại nguyên liệu | `materialType` | | ghi bù | `backdate` |
| mặt hàng | `product` | | chốt (ngày/kỳ) | `lock` |
| thành phẩm | `finishedGood` | | kỳ cân đối | `balancingPeriod` |
| bán thành phẩm (BTP) | `wip` | | định mức | `yieldRatio` |
| phân xưởng | `workshop` | | hao hụt | `loss` |
| phiếu bán / dòng bán | `salesInvoice` / `salesItem` | | phế liệu | `scrap` |
| bán nội địa | `domesticSale` | | còn dở (chốt SX) | `leftover` |
| đơn đặt / lệnh xuất | `salesOrder` / `exportOrder` | | đông gửi / xả đông | `freezeDeposit` / `thaw` |
| đóng gói | `packaging` | | kho lưu (nội bộ/thuê) | `storageLocation` |
| bột tẩm | `batter` | | sổ kho tháng | `monthlyStockLedger` |
| lô / tem | `lot` / `label` | | đối soát (HĐĐT) | `reconciliation` (`einvoice`) |
| gắn lô / lý do chưa gắn | `lotInput` / `lotWaiver` | | truy xuất | `traceability` |
| danh mục | `catalog` | | tô màu dòng / đã dò | `rowMark` / `marked` |
| hàng chờ đồng bộ | `syncQueue` | | người thao tác | `operator` |

Thuật ngữ mới ⇒ thêm vào bảng này **trước** khi đặt tên.

## 3. Hiện trạng (kiểm kê máy 2026-10-12)

Đếm bằng script tách định danh theo camelCase/snake/kebab rồi so với từ điển âm tiết Việt. Âm tiết trùng tiếng Anh (`an`, `to`, `do`, `lot`…) chỉ tính khi đi cặp, nên số dưới đây là **cận dưới**.

| Lớp | Tổng | Tên Việt | Ghi chú |
|---|---|---|---|
| DB: bảng | 40 | **0** | 22 bảng đã đổi ở `0016` |
| DB: cột | ~156 | **2** | `component_rau_kg`, `component_bao_tu_kg` (0030) |
| DB: hàm / trigger | — | 3 hàm + 2 họ trigger | `co_vai_tro`, `la_admin`, `ghi_vet_sua_truc_tiep`; trigger `*_sua` (17), `*_tg` (7) |
| DB: policy RLS | — | ~25 | `*_toan_quyen`, `*_nguoi_dung`, `*_cua_toi`, `user_profiles_them/sua/xoa` |
| DB: giá trị enum lưu | 6 họ slug | **6** | `result` dat/tam/khong-dat · `status` cho-nhap/da-nhap · đơn dang-gom/du/dong · lệnh mo/dong · `kind` noi-bo/thue-ngoai · `method` quet/go/chon (enum chỉ sống trong code như `WarehouseType` xi-nghiep/phan-xuong thuộc Đợt 1–2) |
| File migration | 57 | 27 | lịch sử, **giữ nguyên** |
| Route | 27 | 6 | `/doi-soat` `/ton-kho-thang` `/nxt-nl` `/nxt-kho` `/bc-thanh-pham` `/bc-don-xuat` (`/nxt` hợp lệ — từ viết tắt được phép) |
| Khóa localStorage | ~70 | ~20 | khóa `.v1` cũ (đọc để chuyển dữ liệu) + `bsf.coChu/matDo/beRong` + `bsf1:nav-nhom` |
| Khóa bảng `toMau` (lưu `row_marks`) | 31 | **31** | `ban-hang`, `can-doi-ky`… đổi = mất dấu tô |
| Export TS (hàm + hằng + type) | 820 | **527** (64%) | `BangTong`, `tinhTon`, `DongBanNoiDia`… |
| Hàm / biến cục bộ | 5.045 | ~2.190 | không ra khỏi file |
| Tên trường / prop | 1.251 | 575 | `nhan`, `moTa`, `tieuDe`, `vaDongCu`… |
| File / thư mục `src` | — | 64 file + 1 thư mục | `doiSoat*.ts`, `GanLoDauVao.tsx`, `features/doi-soat/` |
| CSS utility / variant / `data-*` | 21 + 1 + ~12 | 11 + 1 + 9 | `hien-len`, `nhan-an`, `ngang-thap`, `data-to-mau` |

Phân bố khai báo tên Việt theo khu: `lib` 1.129 · `design-system` 301 · `balancing` 223 · `imports` 195 · `production` 160 · `monthly-stock` 115 · các feature còn lại < 100 mỗi khu.

**Kiểu dữ liệu nghiệp vụ lõi trong `types.ts` đã là tiếng Anh** (`MaterialImportItem.quantityKg`…). Nợ tập trung ở logic `lib/`, API design-system, và giá trị đã lưu.

## 4. Nguyên tắc dọn

1. **Chặn tái phát trước, dọn sau.** Không có cổng thì dọn xong lại bẩn.
2. **Đổi tên thuần, không kèm đổi logic.** Mỗi commit chỉ rename, nên diff đọc được và `build + lint + test` là đủ cổng.
3. **Dùng công cụ rename của TypeScript** (ts-morph / "Rename Symbol"), không sed tay. Tên Việt hay trùng chuỗi hiển thị, sed tay dễ đổi nhầm chữ trên màn.
4. **Một khu một commit, làm lúc không có phiên khác đang sửa khu đó.** Repo hay có nhiều phiên Claude chạy chung thư mục; rename lan rộng mà chạy song song là xung đột chắc chắn.
5. **Cái đã lưu (DB, localStorage, `row_marks`) theo luật "đọc cả cũ lẫn mới, ghi mới"**. Đã có tiền lệ: `VAI_TRO_CU_CHUAN` trong `types.ts` chuẩn hóa slug vai trò cũ lúc đọc. Không bao giờ đổi khóa mà không chuyển dữ liệu.
6. **Migration cũ `0001…0057` không sửa.** Chỉ thêm migration mới.

## 5. Kế hoạch theo đợt

| Đợt | Việc | Tier | Ước lượng | Cổng xong |
|---|---|---|---|---|
| **0 · Chặn tái phát** ✅ 2026-10-13 | (a) Chốt §2 vào CLAUDE.md luật 8 + sửa doc mâu thuẫn (✅ một phần 2026-10-12: `03-database`, `supabase-setup`, `BAN-GIAO`). (b) Viết lại bảng "15 bảng" ở `03-database` theo tên thật. (c) `scripts/check-naming.mjs`: đếm định danh tên Việt, ghi `naming-baseline.json`. (d) Pre-commit: chặn **khai báo MỚI** (dòng thêm) có tên Việt. CI: số đếm chỉ được giảm (ratchet). | 🟢 | 0,5–1 ngày | Thêm `const tinhTon2` ⇒ commit bị chặn |
| **1 · Cục bộ** | Biến/hàm không export, theo từng khu: `lib` → `design-system` → mỗi `features/*` | 🟢 | 3–5 ngày, chia nhiều phiên | ratchet giảm, 3 cổng xanh |
| **2 · API lib + file** | Export của `lib/*` + `types.ts` + test đi kèm; đổi tên file `lib` (`doiSoatHddt.ts` → `einvoiceReconciliation.ts`…) bằng `git mv`; sửa `covers:` app-map, bảng "Code đổi → doc" ở CLAUDE.md, đường dẫn trong hook | 🟡 | 2–3 ngày | 3 cổng + hook doc không cảnh báo sót |
| **3 · API design-system** | `BangTong` → `SummaryTable`, `LuoiNhap` → `GridInput`, `KhungCuonNgang` → `HorizontalScroll`, prop `nhan/moTa/tieuDe` → `label/description/title`; CSS utility + `data-*`. Giai đoạn chuyển: export cả hai tên, tên cũ gắn `@deprecated` (editor gạch ngang), codemod `features/*`, rồi gỡ alias | 🟡 lan rộng | 2–3 ngày | README design-system cập nhật, không còn import tên cũ |
| **4 · Route + thư mục feature** | 7 route Việt → tiếng Anh (`/doi-soat` → `/reconciliation`, `/ton-kho-thang` → `/monthly-stock`…), **giữ redirect route cũ vĩnh viễn** (bookmark, link đã gửi Zalo); `?tab=` dùng giá trị mới + đọc cả giá trị cũ; `features/doi-soat` → `features/reconciliation`. **Không đổi id dùng cho phân quyền** trong `nav-access.ts`; nếu đổi thì có bảng ánh xạ | 🟡→🔴 nếu đụng gate vai trò | 0,5–1 ngày | Link cũ mở đúng màn; gate 2 bộ phận không đổi |
| **5 · Dữ liệu đã lưu** | (a) 6 họ enum slug: đọc cả cũ + mới, ghi mới, rồi migration `UPDATE` idempotent. (b) 31 khóa `toMau`: migration đổi `row_marks.table_key` cùng lúc deploy code. (c) Khóa localStorage cũ: bộ chuyển một lần, giữ khóa cũ tới khi chắc. (d) 2 cột `component_*_kg`: thêm cột mới, ghi cả hai, rồi bỏ cột cũ. (e) Hàm SQL: tạo tên mới, tên cũ thành vỏ gọi sang. (f) Policy: `ALTER POLICY … RENAME TO` | 🔴 | 2–3 ngày + kiểm 2 chế độ (có / không `.env`, ngắt mạng rồi nối lại) | Backup trước; chạy migration 2 lần không lỗi; số liệu sổ không đổi một dòng |

**Thứ tự bắt buộc:** 0 trước mọi thứ. 1–3 làm xen kẽ được. 4 sau 2 (vì đổi thư mục kéo theo `covers:`). 5 làm cuối, chỉ 5a + 5f (§6 Q1), mỗi mục một câu xác nhận RED riêng.

**Không làm:** sửa migration cũ; đổi 141 mã TK 1551; đổi chữ hiển thị; đổi slug vai trò đang lưu (`manager-dong`…: tên riêng xưởng, đã có lớp chuẩn hóa).

## 6. Quyết định đã chốt (2026-10-12)

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Phạm vi dọn | **Đợt 0–4 + Đợt 5 chỉ mục 5a (enum slug) và 5f (tên policy).** KHÔNG làm 5b (khóa `toMau`/`row_marks`), 5c (khóa localStorage), 5d (2 cột `component_*_kg`), 5e (hàm SQL): rủi ro mất dấu/dữ liệu lớn hơn lợi ích, người dùng không thấy. Các tên đó ghi vào danh sách ngoại lệ của `check-naming` để ratchet không đếm. |
| Q2 | Nhịp làm | **Theo đợt có lịch.** Mỗi đợt một phiên riêng, báo trước, không chạy song song phiên khác sửa cùng khu. Không "dọn dần khi đụng file". |
| Q3 | Scope commit | **Tên khu tiếng Anh trùng thư mục** (`imports`, `balancing`, `design-system`, `docs`). Mô tả commit vẫn tiếng Việt có dấu. Áp từ 2026-10-12 (CLAUDE.md § Commit). |
| Q4 | Cổng chặn | **Chặn cứng ở pre-commit** (khai báo mới trên dòng thêm có âm tiết Việt ⇒ chặn) **+ ratchet ở CI** (tổng số tên Việt chỉ được giảm). |

## 7. Đo tiến độ + công cụ (Đợt 0)

| Lệnh | Làm gì |
|---|---|
| `npm run naming` | In nợ theo lớp (`declarations` · `fields` · `routes` · `css` · `files`) và theo khu |
| `npm run naming:check` | Ratchet (chạy trong CI): số nào **tăng** so với `scripts/naming-baseline.json` ⇒ đỏ; migration > `0057` có định danh tiếng Việt ⇒ đỏ |
| `npm run naming:update` | Ghi lại baseline — chạy ở cuối MỖI đợt dọn, commit cùng đợt đó |
| `node scripts/check-naming.mjs --staged` | Pre-commit (hook mục 6) gọi: chặn khai báo / route / CSS utility / file / thư mục **MỚI** mang tên Việt. Tên có sẵn ở `HEAD` không bị bắt; prop/khóa object không bị chặn (API design-system còn khóa Việt tới Đợt 3) |

- Ngoại lệ có chủ đích: comment `naming-ok: <lý do>` trên cùng dòng (VD tên phải khớp cột file Excel kế toán).
- Bộ nhận diện: `scripts/naming/lexicon.mjs` (+ test). Âm tiết Việt "mạnh" ⇒ bắt ngay; âm tiết trùng tiếng Anh chỉ bắt khi đi cặp; từ tiếng Anh rất hay gặp (`to`, `map`, `day`, `can`, `lot`…) không tính — **chặn nhầm tên tiếng Anh tệ hơn bỏ sót**, nên số đếm là cận dưới.
- Baseline 2026-10-13: `declarations` 2769 · `fields` 1105 · `routes` 6 · `css` 27 · `files` 66.


`node scripts/check-naming.mjs` (Đợt 0) in bảng §3 theo lớp và theo khu, ghi `naming-baseline.json`. CI so số mới với baseline: tăng thì đỏ, giảm thì cập nhật baseline. Bảng §3 cập nhật sau mỗi đợt.
