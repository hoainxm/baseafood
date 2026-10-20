# Quy ước đặt tên + kế hoạch dọn tên tiếng Việt không dấu

- **Ngày lập:** 2026-10-12
- **Trạng thái:** CHỐT 2026-10-12 (chủ dự án duyệt 4 câu ở §6). §2 Luật áp dụng NGAY cho mọi thứ MỚI. §5 chạy theo đợt có lịch, **Đợt 0 → 4 xong 2026-10-13**; **Đợt 5 (5a + 5f) xong 2026-10-13** (`0059` + `0060` đã chạy trên DB thật, code đã deploy); **nhóm A dọn trọn 2026-10-14** (xem Kết quả nhóm A) (xem Kết quả Đợt 5); còn lại: tên TRƯỜNG dữ liệu trong `lib` + literal loại danh mục (xem Kết quả Đợt 4).
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
| tài liệu công ty | `companyDocument` | | lần ban hành | `documentVersion` (số lần = `revisionNo`) |
| phòng ban | `department` | | xem xét / phê duyệt | `review` / `approve` |
| biểu mẫu · quy trình · hướng dẫn | `form` · `procedure` · `instruction` | | chứng nhận · hồ sơ năng lực | `certificate` · `capabilityProfile` |
| thu hồi (tài liệu) | `withdraw` | | hết hiệu lực (lần ban hành) | `obsolete` |
| hợp đồng (xuất khẩu) | `exportContract` | | bản hợp đồng (rvs / phụ kiện) | `revision` (số bản = `revisionNo`) |
| kết quả duyệt (BGĐ ký giấy) | `approval` (`decision`) | | gia hạn giao hàng | `deadlineExtension` |
| chuyến (1 container) | `shipment` | | mã lô xuất khẩu (MSL) | `lotCode` |
| bước / mục của chuyến | `step` / `stepItem` | | chứng từ (bộ chứng từ) | `document` (`docKind`) |
| thực xuất | `actuals` | | tiền về / gửi bộ chứng từ | `payment` / `documents-sent` |
| dung sai | `tolerance` | | khép kín | `closure` (`closed`) |
| Phòng Kế hoạch · nhân viên kế hoạch | `planning` · `planner` | | người đóng hàng (ảnh đóng cont) | `loading` |
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
5. **Cái đã lưu (DB, localStorage, `row_marks`) theo luật "đọc cả cũ lẫn mới, ghi mới"**. Đã có tiền lệ: `LEGACY_ROLE_MAP` trong `types.ts` chuẩn hóa slug vai trò cũ lúc đọc. Không bao giờ đổi khóa mà không chuyển dữ liệu.
6. **Migration cũ `0001…0057` không sửa.** Chỉ thêm migration mới.

## 5. Kế hoạch theo đợt

| Đợt | Việc | Tier | Ước lượng | Cổng xong |
|---|---|---|---|---|
| **0 · Chặn tái phát** ✅ 2026-10-13 | (a) Chốt §2 vào CLAUDE.md luật 8 + sửa doc mâu thuẫn (✅ một phần 2026-10-12: `03-database`, `supabase-setup`, `BAN-GIAO`). (b) Viết lại bảng "15 bảng" ở `03-database` theo tên thật. (c) `scripts/check-naming.mjs`: đếm định danh tên Việt, ghi `naming-baseline.json`. (d) Pre-commit: chặn **khai báo MỚI** (dòng thêm) có tên Việt. CI: số đếm chỉ được giảm (ratchet). | 🟢 | 0,5–1 ngày | Thêm `const tinhTon2` ⇒ commit bị chặn |
| **1 · Cục bộ** ✅ 2026-10-13 | Biến/hàm không export, theo từng khu: `lib` → `design-system` → mỗi `features/*` | 🟢 | 3–5 ngày, chia nhiều phiên | ratchet giảm, 3 cổng xanh |
| **2 · API lib + file** ✅ 2026-10-13 | Export của `lib/*` + `types.ts` + test đi kèm; đổi tên file `lib` (`doiSoatHddt.ts` → `einvoiceReconciliation.ts`…) bằng `git mv`; sửa `covers:` app-map, bảng "Code đổi → doc" ở CLAUDE.md, đường dẫn trong hook | 🟡 | 2–3 ngày | 3 cổng + hook doc không cảnh báo sót |
| **3 · API design-system** ✅ 2026-10-13 | `BangTong` → `SummaryTable`, `LuoiNhap` → `GridInput`, `KhungCuonNgang` → `HorizontalScroll`, prop `nhan/moTa/tieuDe` → `label/description/title`; CSS utility + `data-*`. Giai đoạn chuyển: export cả hai tên, tên cũ gắn `@deprecated` (editor gạch ngang), codemod `features/*`, rồi gỡ alias | 🟡 lan rộng | 2–3 ngày | README design-system cập nhật, không còn import tên cũ |
| **4 · Route + thư mục feature** ✅ 2026-10-13 | 7 route Việt → tiếng Anh (`/doi-soat` → `/reconciliation`, `/ton-kho-thang` → `/monthly-stock`…), **giữ redirect route cũ vĩnh viễn** (bookmark, link đã gửi Zalo); `?tab=` dùng giá trị mới + đọc cả giá trị cũ; `features/doi-soat` → `features/reconciliation`. **Không đổi id dùng cho phân quyền** trong `nav-access.ts`; nếu đổi thì có bảng ánh xạ | 🟡→🔴 nếu đụng gate vai trò | 0,5–1 ngày | Link cũ mở đúng màn; gate 2 bộ phận không đổi |
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
- Sau Đợt 1 (2026-10-13): `declarations` **747** · `fields` 1050 · `routes` 6 · `css` 27 · `files` 66.

### Kết quả Đợt 1 (2026-10-13)

- Đổi **3.229 khai báo cục bộ** (1.878 tên khác nhau: biến, cặp `useState`, tham số, hàm, kiểu không export) bằng `scripts/naming/rename.mjs` — TypeScript language service, kiểm va chạm trong phạm vi, giữ kiểu chữ, khóa object viết tắt giữ nguyên (`{ x }` → `{ x: y }`) nên dữ liệu đã lưu không đổi khóa. 19 tên va chạm được đặt tay. Một commit mỗi khu (`lib`, `design-system`, từng `features/*`, `app`).
- Tên tiếng Anh do agent đề xuất theo ngữ cảnh + từ điển §2b, rà lại bằng mắt; cổng: build + lint + 366 test + mở 20 route trên preview demo không lỗi console.
- Kèm theo: `lib/devicePrefs.ts` (cài đặt theo máy) thay `localStorage` trực tiếp ở màn sản xuất; hook pre-commit miễn đúng `DailyImportInvoice.tsx` như README.
- **Còn sót (bộ nhận diện chưa có âm tiết):** tên như `thuGon`, `moNav`, `thamSo`, `nhom` không bị đếm vì `thu`, `gon`, `tham`… chưa có trong `lexicon.mjs` hoặc là âm tiết mơ hồ đứng một mình. Bổ sung âm tiết ⇒ baseline TĂNG ⇒ chạy `naming:update` cùng commit bổ sung, rồi dọn bằng `rename.mjs collect/apply` như Đợt 1.

### Kết quả Đợt 2 (2026-10-13)

- **Lexicon bổ sung trước** (commit riêng): thêm `khoa`, `thue`, `chuan`, `nghi`, `thu`, `gon`, `xep`, `gui`… ⇒ số đo TĂNG (1195 khai báo · 1229 trường · 75 file) vì giờ thấy những tên Đợt 1 để lọt.
- **369 tên export** của `lib/*` + `types.ts` đổi sang tiếng Anh ở MỌI file dùng (111 file), qua `rename.mjs apply --exported` — kiểm va chạm trên từng file import. Ví dụ: `tinhTon` → `computeWipStock`, `locBanLe` → `filterRetailSales`, `khaDung` → `getAvailableKg`, `AnhXaBang` → `TableMapping`, `KHO_BAN_LE` → `RETAIL_WAREHOUSE`, `doiSoat` → `reconcile`. **Chỉ đổi tên định danh, KHÔNG đổi tên thuộc tính** (kiểu đang lưu DB / hàng chờ offline giữ nguyên hình dạng); giá trị chuỗi (khóa lưu trữ `bsf1:che-do`, marker kho) giữ nguyên.
- **30 file `lib` đổi tên** bằng `rename.mjs move` (getEditsForFileRename + `git mv`, sửa cả `import()` động): `truyXuatLo` → `lotTraceability`, `doiSoatHddt` → `einvoiceReconciliation`, `doiSoatHaiBan` → `twoVersionReconciliation`, `doiSoat{Chung,Xuat,XuatShift,XuatTongHop}` → `reconciliation{Common,Export,ExportShift,ExportSummary}`, `toMau` → `rowMarks`, `botTam` → `batter`, `banNoiDia` → `domesticSales`, `khoCanDoi` → `balancingStockLines`, `chuyenTrongNgay` → `dailyShipments`, `dongChay` → `dataFlow`, `cheDo` → `demoMode`, `sinhDemo` → `demoGenerator` (+ test đi kèm).
- Doc / `covers:` / bảng cổng kiểm của CLAUDE.md / comment + tiêu đề test đổi theo (chỉ khi tên cũ đã biến khỏi `src`; tên trùng symbol khác còn sống — `tongDong`, `NutDong`, `DauDong`… — giữ cho Đợt 3/4).
- Sau Đợt 2: `declarations` **731** · `fields` 1229 · `routes` 6 · `css` 27 · `files` **45**. Còn lại chủ yếu: API design-system (Đợt 3), file/thư mục features + route (Đợt 4), tên trường (`fields` — props design-system ở Đợt 3; thuộc tính kiểu lưu DB thì KHÔNG đổi).

### Kết quả Đợt 3 (2026-10-13)

- **API design-system sang tiếng Anh:** 102 export (`BangTong` → `SummaryTable`, `LuoiNhap` → `EditableGrid`, `KhungCuonNgang` → `HorizontalScroll`, `Nhan` → `Tag`, `NutToMauChon` → `RowMarkActions`, `useToMau` → `useRowMarkTools`…), ~260 prop (`nhan` → `label`, `moTa` → `description`, `tieuDe` → `title`, `toMau` → `rowMarkKey`, `xoRa` → `fullHeight`, `dinhDau` → `stickyHeader`, `onSuaMuc`/`nhanSua`/`suaDuoc` → `onEditItem`/`editLabel`/`canEdit`, `chinh` → `primary`, `anTrenDienThoai` → `hideOnMobile`…), `notify.daLuu/daXoa/loi/canhBao` → `notify.saved/deleted/error/warning`, 16 file pattern (`ThongKe.tsx` → `StatCardGrid.tsx`, `toMauNguon.ts` → `rowMarkSource.ts`…).
- **CSS:** utility `hien-*` → `enter-*`, `nhan-an` → `press-feedback`, `*-an-toan` → `*-safe`, `bang-*` → `table-*`, `cot-dau-dinh` → `sticky-first-col`; variant `ngang-thap:` → `short-landscape:`; `data-to-mau` → `data-marked` (+ 9 `data-*` khác); biến `--pad-o` → `--cell-pad`, `--to-nen` → `--mark-bg`. **Giữ nguyên** bảng màu `--to-<sắc>-<mức>` + `--tone-*` vì mã sắc (`vang-3`…) là GIÁ TRỊ đã lưu trong `row_marks`; giữ giá trị mật độ `thoang/vua/gon` (khóa cài đặt đã lưu).
- **Kèm (sót từ Đợt 2):** `TableMapping` (`layKhoa` → `getKey`, `vaDongCu` → `patchLegacy`, `truongKhongCache` → `uncachedFields`, `cotThamChieu` → `refColumns`, `khoaChinh` → `primaryKey`), `BANG_X` → `X_TABLE`, `connectivity.baoLoi/baoOK/laySnapshot` → `reportError/reportOk/getSnapshot`.
- **Bài học 1 — đổi tên prop có lỗi ÂM THẦM mà `tsc` không bắt:** object có spread (`{ ...c, oRieng: undefined, khoa: () => true }`) hoặc dựng trong callback `.map` của hàm generic KHÔNG bị kiểm thuộc tính thừa ⇒ khóa cũ bị bỏ qua lặng lẽ. Đã dính: **khóa ô kỳ cân đối đã chốt** (MaterialGrid/WipGrid) và dòng phụ của lựa chọn Combobox ở 15 chỗ. Bắt bằng script dò "khóa object còn tên cũ trong khi kiểu đích (spread / kiểu khai báo / kiểu ngữ cảnh) không có khóa đó" — PHẢI chạy sau mọi đợt đổi tên prop.
- **Bài học 2 — file test KHÔNG được kiểm kiểu** (`tsconfig.app.json` loại `*.test.ts`): test dựng object bằng khóa cũ chỉ lộ khi chạy (`rowMarks.test`, `repo.test` — hàng chờ đồng bộ). Cần cổng `tsc` riêng cho test.
- **Bài học 3 — re-export qua barrel:** language service giữ tên công khai bằng bí danh (`SummaryTable as BangTong` ở `design-system/index.ts`) ⇒ phải đổi tiếp chính bí danh rồi gộp `X as X`.
- Sau Đợt 3: `declarations` **484** · `fields` **934** · `routes` 6 · `css` **0** · `files` **29**.

### Kết quả Đợt 4 (2026-10-13)

- **Route:** `/doi-soat` → `/reconciliation`, `/ton-kho-thang` → `/monthly-stock`, `/nxt-nl` → `/nxt-material`, `/nxt-kho` → `/nxt-warehouse`, `/bc-thanh-pham` → `/production-report`, `/bc-don-xuat` → `/export-report`. Route cũ redirect VĨNH VIỄN, giữ `?query` (`LegacyPathRedirect`).
- **`?tab=` + tham số:** Danh mục `dai-ly`… → `suppliers`…, QR `in`/`giai-doan` → `print`/`stages`; `?lo=` → `?lot=` (tem QR ĐÃ IN vẫn tra được — regex `(?:lot|lo)=` + test), `?duyet=` → `?approve=`, `?don=&kiem=` → `?order=&check=`. Một nguồn: `lib/legacyUrls.ts` (+ test).
- **Phân quyền:** id nav = path ⇒ đổi đồng bộ ở `KIT_NAV`/`NAV_TREE`/guideContent/`nav-access.ts`; `nav-access.test.ts` chốt tập màn từng vai trò (chạy trên code cũ chỉ lệch đúng 2 id đổi tên ⇒ quyền không đổi).
- **Feature:** 118 export, 382 prop, 957 tên cục bộ (gồm phần lexicon mới bắt thêm ở `lib`), 27 file + thư mục `features/doi-soat` → `features/reconciliation`, `data/thanh-pham.json` → `data/finished-goods.json`. Hook danh mục: `useSuaDanhMuc` → `useQuickCatalogEdit` trả `{ openEdit, canEdit, editLabel, dialog }`.
- **Lỗi âm thầm bắt được (tsc không báo):** khóa ngày giá không xóa khi bỏ dòng gợi ý (`giaNgay` trong `.map` spread, importHelpers), mô tả rê chuột nhóm nav "Khác" mất (`moTa` trong `.map`). Test không kiểm kiểu: `getSupplierVehicles` trả `{ plates, drivers }` (test cũ còn `{ bienSo, taiXe }`).
- **CỐ Ý giữ (giá trị `null` trong bảng ánh xạ = không đổi):** khóa loại danh mục (`matHang`, `khachHang`, `daiLy`, `loaiNL`, `botTam`, `khoLuu`) vì đi cùng chuỗi literal `"daiLy"` trong so sánh — language service không đổi chuỗi ⇒ phải làm riêng cùng literal; prop mô phỏng dữ liệu `lib` (`{ nut, cach }`, `{ viTri, cu, moi }`, `dichGoiY`, `veKhong`); `trangThai` trong ép kiểu `as {…}` của CheDoDemo. Khóa bảng tô màu (`"ton-kho-thang"`, `"danh-muc-…"`) — giá trị đã lưu.
- Sau Đợt 4: `declarations` **0** · `routes` **0** · `css` **0** · `files` **0** · `fields` **603** (tên TRƯỜNG kiểu dữ liệu `lib` + nhóm cố ý giữ ở trên). Cổng đếm file bỏ qua `.md` (tên doc tiếng Việt không dấu là hợp lệ).

### Còn lại sau Đợt 4

| Việc | Tier | Ghi chú |
|---|---|---|
| Tên trường kiểu dữ liệu `lib` (`LotNode.nhan`, `FlowStage.ten/kgCho`…) — KHÔNG lưu DB | 🟡 | ✅ xong 2026-10-14 — xem Kết quả tên trường `lib` |
| Literal loại danh mục (`"daiLy"`…) + `theo: "ten"` + khóa cùng tên | 🟡 | đổi cùng lúc literal + khóa (grep `"daiLy"`), có test |
| Đợt 5a/5f | 🔴 | ✅ code xong — xem Kết quả Đợt 5 |

### Kết quả Đợt 5 (2026-10-13)

Chủ dự án duyệt cả 5a + 5f, **tự chạy migration ở SQL Editor** (✅ 0059 rồi 0060, 2026-10-13), code chỉ push sau khi migration đã chạy.

- **5a — giá trị enum lưu DB** (7 họ): `production_wips.status` `cho-nhap/da-nhap` → `pending/stocked` · `sales_orders.status` `dang-gom/du/dong` → `collecting/complete/closed` · `export_orders.status` `mo/dong` → `open/closed` · `storage_locations.kind` `noi-bo/thue-ngoai` → `internal/external` · `qc_checklists.result` `dat/tam/khong-dat` → `pass/conditional/fail` · `lot_inputs.method` + `lot_dispatches.method` `quet/go/chon` → `scan/typed/picked` (`fifo` giữ) · `audit_log.action` `them/sua/xoa/dang-nhap/dang-xuat/gui` → `create/update/delete/login/logout/submit`.
- **Một nguồn cũ → mới:** `src/lib/legacyValues.ts` (`LEGACY_VALUES` + `normalize*`, có test). Code **ghi giá trị mới, đọc cả hai**: `fromRow` (dòng máy chủ chưa đổi) + `patchLegacy` (bộ đệm máy, hàng chờ offline) đi qua `normalize*`. Mặc định khi rỗng giữ như cũ.
- **`audit_log` KHÔNG sửa lịch sử** (append-only): đọc qua `normalizeAuditAction`, lọc theo thao tác dùng `auditActionAliases` (`in (mới, cũ…)`). Trigger ghi vết SQL `0048` vẫn ghi `them/sua/xoa` — app đọc ra đúng nhãn, để nguyên (5e không làm).
- **`0059_english_enum_values.sql`:** nới CHECK 3 cột (0036/0046/0056) nhận CẢ cũ LẪN mới (máy chưa tải lại bản mới vẫn ghi được), UPDATE cũ → mới, đổi DEFAULT. Mỗi dòng đổi để lại một dòng `audit_log` "[SQL trực tiếp]" qua trigger 0048. Có ROLLBACK.
- **`0060_english_policy_names.sql`:** chỉ `alter policy … rename` — policy public có hậu tố `_nguoi_dung/_toan_quyen/_cua_toi/_them/_sua/_xoa/_xem/_doc` thành `<bảng>_authenticated/_full_access/_own_rows/_insert/_update/_delete/_select/_read`; điều kiện quyền không đổi. Tên cũ lưu trong COMMENT để ROLLBACK đổi ngược chính xác. ⚠ Sau 0060 đừng chạy lại 0021/0047/0057 (tạo lại tên cũ song song) — cần thì chạy 0060 ngay sau.
- **Kiểm:** hai migration chạy 2 lần trên Postgres nhúng (PGlite, lược đồ tối thiểu có CHECK nội tuyến + policy tên cũ + ca trùng tên) — lần 2 không đổi gì; CHECK vẫn chặn giá trị lạ; ROLLBACK trả đúng giá trị, default, tên policy. Preview demo: bộ đệm `cho-nhap` hiện "Chờ nhập", duyệt ghi `stocked`, nhật ký ghi `update`; kho lưu `noi-bo` hiện "Kho nhà".
- Sau Đợt 5: `fields` **600**.

### Kết quả tên trường `lib` (2026-10-14)

- **Phạm vi:** mọi trường của kiểu khai trong `src/lib` (trừ `types.ts`), gồm cả trường "anh em" bị lexicon bỏ sót vì âm tiết ngắn (`ten`, `nhom`, `tu/den`, `loi`, `dong`…), cùng kiểu nhân bản ở màn hình (`NxtReportScreen`/`WarehouseNxtScreen` theo `nxtExcel`, `SessionLot`, tham số `MonthlyStockScreen`). Thêm các khóa object có kiểu SUY RA mà `--props` không với tới: giá trị trả về của `useAuth()` (`profile · isLoading · requiresLogin · isAdmin · signIn · createAccount · signOut`), `FILL_COLORS.header/edited`, bộ sinh ngẫu nhiên demo (`int`/`pick`).
- **Thuật ngữ:** theo §2b (`opening/closing`, `inKg/outKg`, `freezeDeposit/thaw`, `yieldRatio`, `materialFamily`, `operator`…). Đối soát HĐĐT: sổ phần mềm = `ledger`, bản thuế gửi / bản tự tải = `sent` / `downloaded`, số hóa đơn = `invoiceNumber` (đếm = `invoiceCount`), ký hiệu = `series`, MST người bán = `sellerTaxCode`, dòng Excel = `fileRow`, chỉ số dòng AOA = `rowIndex`. Cặp lọc ngày `tu/den` → `fromDate/toDate` (`from` là từ khóa nên codemod từ chối); cạnh sơ đồ → `source/target`.
- **CỐ Ý giữ (dữ liệu đã LƯU):** `SyncQueue.them/xoa` (hàng chờ dưới máy, khóa `.cho`, đánh dấu `naming-ok`); `ReconciliationSummary` + `ReconciliationRun.options` (`soChuanTen/benThue/cheDo`, jsonb `reconciliation_runs`) — màn đối soát ghi/đọc đúng khóa cũ, chỉ phía engine đổi tên; giá trị chế độ `haiBan/cungNgay`; khóa `Record` theo giá trị enum (`TraceStageKey` `nhap/kho`, `SumMismatchKind` `phi/chietKhau/lamTron`); mã cột / mã nút sơ đồ (`key: "tonDau"`, nút `tonBtp`).
- **Bài học — lỗi `tsc` KHÔNG bắt:** (1) object dựng trong `.map`/biến tạm không có kiểu ngữ cảnh ⇒ rename không đổi khóa theo; sửa theo chẩn đoán `tsc` (chỉ đổi khi tên mới có thật trong kiểu đích). (2) Khóa của `Record<Union, …>` có khai báo rỗng ⇒ bộ sửa tự động suýt đổi `nhap` (giá trị enum) thành `importedKg` — luật: kiểu ánh xạ/chỉ mục chuỗi KHÔNG đụng. (3) Test truyền đầu vào qua `Partial` + spread (`{ sanXuat: [...] }`) ⇒ khóa cũ bị bỏ qua lặng lẽ, test vẫn xanh sai — chỉ lộ khi kiểm kiểu file test. (4) `toEqual({...})` trong test không có kiểu. ⇒ Kiểm kiểu CẢ file test bằng tsconfig tạm (`include: src`, bỏ `exclude`) trong lúc đổi tên.
- **Kiểm:** `tsc` app + test 0 lỗi, 401 test, lint không thêm cảnh báo. Bộ máy đối soát (gần như không có test) chạy trên **4 file thật** của kế toán ở bản cũ (HEAD) và bản mới: kết quả engine, so hai bản, cùng MST cùng ngày và **mọi ô của file Excel xuất** giống hệt từng byte. Preview demo: 19 màn hiển thị, không lỗi console.
- Sau đợt: `fields` **600 → 100**. Còn: `types.ts` (trường đã lưu — cần `fromRow`/`patchLegacy` đọc cả tên cũ, 🟡), kiểu khai riêng ở màn hình, khóa literal-union của design-system (`tim`, `vua/rong`, `tinh`, `nguon`) và literal loại danh mục.

### Kết quả trường `types.ts` (2026-10-14)

- **Đã LƯU nên đổi kèm đọc tên cũ** (🟡): `WipProductionItem.componentRauKg/componentBaoTuKg` → `tentacleKg/stomachKg` (cột DB `component_*_kg` giữ — 5d không làm); `ReconciliationSummary` → `invoiceCount · matched · mismatched · missing · nearMatched · ledgerRowCount · ledgerMatched · ledgerMissing · totalDifference · threshold`; `ReconciliationRun.options` → `ledgerSheetName · taxSideSheets · mode`; giá trị chế độ đối soát `so/haiBan/kiemCong/cungNgay` → `ledger/twoVersion/columnSum/sameDay`. `NxtReportItem` (không còn ai dùng) → `openingKg · inPeriodKg · outPeriodKg · closingKg`.
- **Khuôn đọc-cả-hai cho trường đã lưu:** `LEGACY_FIELDS` + `renameLegacyFields` trong `lib/legacyValues.ts`, gọi ở `fromRow` (jsonb / dòng máy chủ — KHÔNG viết lại dữ liệu cũ, không migration) và `patchLegacy` (bộ đệm máy, hàng chờ). Ghi luôn tên mới. Có test ở `legacyValues.test.ts` + `repo.test.ts` (dòng máy chủ và bộ đệm mang tên cũ).
- **Kiểm:** 406 test; preview chế độ máy: cài vào bộ đệm một bản đối soát + một dòng SX mang tên trường cũ ⇒ danh sách bản lưu hiện đúng "7 khớp · 1 lệch · 2 chưa", sổ ngày `/wip` hiện "râu 3 · bao tử 2". Chế độ máy chủ chỉ kiểm qua test `fromRow` (không mở dữ liệu thật).
- ⚠ Máy còn mở bản app CŨ (chưa tải lại) đọc bản đối soát lưu bằng bản mới sẽ thấy tổng kết trống và tự chọn chế độ mặc định — chỉ hiển thị, không mất số; hết khi tải lại.
- Sau đợt: `fields` **100 → 83** (`types.ts` sạch). Còn: kiểu khai riêng ở màn hình, khóa literal-union design-system, literal loại danh mục.

### Kết quả kiểu khai riêng ở màn hình (2026-10-14)

- **Prop + trường kiểu khai trong `src/features`** (76 khai báo): `matHang/botTam/loaiNL` (prop danh sách) → `products/batterTypes/materialTypeCell`; `dong` → `lines/rows/items/imports` theo nghĩa; `onBo/onDoi/onMo` → `onRemove/onChange/onOpen`; `dl` → `traceData`; `ky/onChangeKy` → `period/onChangePeriod`; `choHutBan/onHutBan` → `pendingSales/onPullSales`; `ProductionLine.botKg` → `batterKg`; nav `ten/con/nhom/ca` → `name/children/groups/shift`…
- **Khóa object có kiểu suy ra** (đổi theo vị trí bằng language service): `useSettings()` của Cài đặt hiển thị (`fontSize · density · width · changeFontSize · changeDensity · changeWidth · reset`), bảng sắc `KIND_TONES` của Tổng quan, object tổng của 3 báo cáo, `diff` của nhật ký "gửi báo cáo SX" (`sender · total · byOperator · batterByType · domesticSale` — chỉ dòng ghi MỚI, lịch sử giữ nguyên).
- **Biến cục bộ** nhận từ destructuring (`sheetNames: tenSheets`) đổi theo tên prop rồi gộp `x: x` (kiểm trùng tên trong đúng hàm bao quanh).
- **Bài học — lỗi thật đã lên production rồi vá trong 4 phút:** đợt `types.ts` đổi `componentRauKg` → `tentacleKg` nhưng object dòng SX dựng trong `.map` vẫn dùng khóa cũ (kiểu đích không bắt). Mẻ có tách râu/bao tử sẽ gửi `null` lên máy chủ. Vá ở `9f4858b`; kiểm DB (chỉ đọc) không có mẻ nào ghi trong khung lỗi. ⇒ Sau MỌI lần đổi tên trường: **grep thẳng tên cũ** trên toàn `src` (không chỉ tin `tsc` + bộ dò khóa), nhất là object dựng trong `.map`.
- **Phát hiện kèm (lỗi có sẵn, đã sửa):** nút **Hủy** của "Tùy chỉnh giao diện" không trả cỡ chữ/mật độ về như lúc mở (gọi `setMo(false)` bỏ qua bước khôi phục) — nay gọi `handleOpenChange(false)`.
- **CỐ Ý giữ / để sau:** `features/imports` (phiên OCR đang làm), `useBang()` trả `{ trangThai, loi }` (đụng `MaterialImportScreen`), khóa loại danh mục (`matHang`…), khóa màu/cỡ design-system (`tim`, `vua/rong`, `tinh`, `nguon`), giá trị enum làm khóa `Record` (`TraceStageKey` `nhap/kho`, id nút sơ đồ `tonBtp`, `SumMismatchKind`), khóa localStorage Cài đặt hiển thị (`coChu/matDo/beRong` — 5c). Tên cũ CỐ Ý trong `LEGACY_FIELDS` và hàng chờ `them/xoa` đánh dấu `naming-ok`.
- Sau đợt: `fields` **83 → 38**.

### Kết quả nhóm A — dọn trọn (2026-10-14)

Chủ dự án duyệt làm trọn nhóm A trong MỘT lần, giữ nguyên nhóm B (dữ liệu đã lưu).

- **Cổng đo đúng hơn (A9):** lexicon thêm ~50 âm tiết lâu nay lọt (`ky nhom loi moc dau doi chu goi cuu tho nap lich ket ghep suy xong phong…`; `ky/nhom/loi/moc/dau/doi/chu/goi` chuyển từ "mơ hồ" sang "chắc chắn"). Đo bằng lexicon mới trước khi dọn: **201 khai báo · 76 trường · 1 file** (lexicon cũ báo 0/38/0). Sau đợt: **0 · 0 · 0** ở mọi lớp.
- **Khai báo + biến cục bộ (A1, A2):** ~1.050 khai báo — component (`CanDoiScreen` → `BalancingScreen`, `KyDetail` → `PeriodDetail`), kiểu (`GoiDemo` → `DemoBundle`, `KetQuaOcr` → `OcrResult`, `CanBang` → `MassBalance`, `BenCo` → `VersionPresence`), hàm (`sheetsTuBase64` → `sheetsFromBase64`, `ghepNapLai` → `mergeReload`, `useBang` → `useTable`), hằng (`LA_DEMO` → `IS_DEMO`), tên cục bộ mơ hồ (`ten/tu/den/ra/co/dl/so/ma/mo…` theo nghĩa từng chỗ), 1 file (`QrTraCuuScreen.tsx` → `QrLookupScreen.tsx`).
- **Trường + khóa (A3, A6, A7):** loại danh mục `matHang/khachHang/daiLy/loaiNL/khoLuu/botTam` → `product/customer/supplier/materialType/storageLocation/batter` (+ `theo: "ten"` → `matchBy: "name"`); `useTable()` trả `{ status, error }`; khóa trả về của các hook design-system (`SummaryTable`, chọn dòng, ô số…), tổng báo cáo, `useTraceData`.
- **Giá trị enum chỉ sống trong bộ nhớ (A4, A5) — 40 union:** khâu truy xuất `imports/production/warehouse/packaging/outbound`, việc thiếu `label/lot/approve/scan`, cảnh báo dòng chảy (`imports-unlocked`…, mức `error/reminder/info`), kỳ xem `day/week/month/year/custom`, trạng thái nạp `loading/ready/error`, kết nối `unknown/connected/error`, khớp đối soát `MATCHED/MISMATCHED/MISSING` · `FOUND/MISSING`, so hai bản `BOTH/SENT_ONLY/DOWNLOADED_ONLY`, phần lệch `fee/discount/rounding/real`, `Tag` `done/pending/warning/error/source/location/category/muted`, sắc `purple/teal/blue/cyan/sand/pink/green/orange/gray` (kèm token CSS `--…tone-*`), cỡ hộp thoại `md/lg`, ô lưới `input/computed/text`, id nút sơ đồ dòng chảy (`wip`, `warehouse`, `packaging`, `workshop:<xưởng>`…).
- **CỐ Ý giữ (nhóm B + dữ liệu):** khóa localStorage (`bsf.coChu`, `bsf.wip-xuong.v1`…), khóa tô màu + mã màu `row_marks` (`vang-2`…), tiền tố id cảnh báo (`ccn|`, `cd|`… — nằm trong khóa tô màu), giá trị `"tat-ca"` trong khóa tô màu Tổng quan, mật độ/bề rộng hiển thị (`gon`, `toi-da`), cột DB `component_*_kg`, hàm/trigger SQL, giá trị có dấu (`Đông/Cá/Khô`…), vai trò `manager-dong…`, metadata đăng nhập `ho_ten`, hàng chờ `them/xoa`, khóa đọc dữ liệu cũ trong `LEGACY_*`, khóa JSON seed + dạng localStorage đời rất cũ trong `db.ts`, tiêu đề cột file Excel kế toán, mã cột bảng (`key: "tonDau"`).
- **Cách làm enum an toàn:** đổi union rồi để `tsc` chỉ chỗ dùng; mỗi literal cũ trong vùng lỗi chọn tên mới theo **kiểu đích thật tại chỗ** (kiểu ngữ cảnh / vế bên kia phép so sánh / biểu thức `switch` / khóa `Record`). Lượt đầu (thay theo vùng lỗi KHÔNG xét kiểu) đã lẫn chéo một chỗ (`STAGE_TONES` nhận `entry` của chế độ màn Nhập) — bắt được nhờ rà mọi giá trị cũ có NHIỀU đích.
- **Lỗi âm thầm bắt được (tsc không báo):** `DemoMode` so `status !== "dang-tai"`; ô lọc giá Nhập hàng còn `"tat-ca"/"thieu-gia"`; Tổng quan `stageKg("nhap")` (tham số `string` ⇒ số khâu về 0 — nay khai `TraceStageKey`); sắc dự phòng `"xam"`; phần lệch đối soát qua `as DiffPart[]` (nay `satisfies`); bảng nhãn SO HAI BẢN `Record<string,…>` khóa `CHI_THUE` ⇒ cột KẾT QUẢ ra TRỐNG (oracle bắt — nay `Record<VersionPresence,…>`); `STAGE_TONES`, `FormDialog.WIDTHS` khai lỏng (nay siết kiểu). Dịch sai nghĩa sửa luôn: `CanBang.children` ("còn lại", không phải "con") → `remainingKg`.
- **Kiểm:** `tsc` app + test 0 lỗi · 426 test · lint không thêm cảnh báo · oracle đối soát 4 file thật: **file Excel xuất giống hệt từng ô** · preview 21 màn không lỗi, độ dài nội dung từng màn khớp trước khi đổi, màu `tone-*` ra đúng, lọc giá / chế độ sổ chạy với giá trị mới.

### Cách chạy lại codemod

```bash
node scripts/naming/rename.mjs collect <out.json> src/lib/   # liệt kê ứng viên (khai báo không export)
node scripts/naming/rename.mjs apply <mapping.json> src/lib/ # mapping {"cu":"new","file::cu":"override","file::Chu.cu":"theo chủ"}
node scripts/naming/rename.mjs collect --props <out.json> src/design-system/  # tên thuộc tính trong interface / type literal
node scripts/naming/rename.mjs apply --props <mapping.json> src/design-system/
```
Đợt 2 (export) cần mở rộng `collect` sang khai báo CÓ export — rename của language service tự sửa mọi nơi import.


`node scripts/check-naming.mjs` (Đợt 0) in bảng §3 theo lớp và theo khu, ghi `naming-baseline.json`. CI so số mới với baseline: tăng thì đỏ, giảm thì cập nhật baseline. Bảng §3 cập nhật sau mỗi đợt.
