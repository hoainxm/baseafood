# Biên bản họp & quyết định — 2026-08-22

> **Chủ đề:** số hóa toàn bộ luồng từ nhập nguyên liệu → sản xuất thành phẩm; tách 2 giao diện bộ phận; chốt mốc chạy dữ liệu thật.
> **Trạng thái:** đã chốt định hướng, đang chuyển thành kế hoạch build. Các tài liệu chi tiết sinh ra từ buổi này liệt kê ở [§7](#7-tài-liệu-sinh-ra-từ-buổi-này).
> **Bối cảnh nền:** [`BAN-GIAO.md`](../BAN-GIAO.md) · vòng lặp gối đầu [`ke-hoach-tuan-1-thu-thap-du-lieu.md`](ke-hoach-tuan-1-thu-thap-du-lieu.md) · BTP/kho [`34-btp-san-xuat-kho.ba-spec.md`](../app-map/34-btp-san-xuat-kho.ba-spec.md).

File này là **nguồn canonical cho các quyết định của buổi họp**. Chi tiết thiết kế nằm ở các doc con — ở đây chỉ ghi *quyết định gì, vì sao, đụng vào đâu*.

---

## 1. Một câu tóm tắt

Hệ thống đã dựng được **từng mảnh** (nhập hàng, cân đối, danh mục, khung sản xuất/kho/đơn), nhưng **vòng chạy end-to-end chưa khép**: nhập → **sản xuất** → **lưu kho thành phẩm** → (bán / cân đối) còn đứt ở tầng kho. Buổi họp chốt: **tách 2 giao diện bộ phận vận hành theo bước**, mỗi bộ phận có **việc-hằng-ngày (daily task)** phải chốt, và **đưa dữ liệu thật vào chạy từ 01/09/2026** với mốc tồn gốc là **báo cáo tồn kho tổng 30/06/2026**.

---

## 2. Vấn đề nêu trong họp

1. **Vòng chạy chưa hoàn thiện triệt để.** Luồng *nhập hàng → sản xuất thành phẩm → lưu kho thành phẩm HOẶC đưa vào đơn bán → cân đối* mới nối được hai đầu (nhập ↔ cân đối, bán ↔ cân đối) mà **bỏ qua tầng kho thành phẩm/bán thành phẩm ở giữa**. Xem chỗ đứt gãy chi tiết ở [`flow-end-to-end-2-bo-phan.md` §3](flow-end-to-end-2-bo-phan.md).
2. **Chưa phân vai theo bộ phận.** Hiện mọi màn nằm chung một app; người nhập hàng và người sản xuất dùng lẫn. Cần **2 giao diện riêng, theo bước** cho 2 bộ phận đầu chuỗi.
3. **Chưa có nhịp vận hành hằng ngày rõ ràng.** Mỗi bộ phận cần biết "hôm nay phải làm gì và chốt gì".
4. **Chưa có đường đưa dữ liệu cũ vào hệ thống.** Tồn gốc + số liệu tháng 7–8 đang nằm ngoài hệ thống (Excel/giấy).

---

## 3. Các quyết định đã chốt

Mỗi quyết định ghi: **nội dung · loại (🟩 chốt / 🟨 định hướng) · đụng vào đâu**.

### QĐ-1 · Số hóa TRỌN chuỗi nhập → sản xuất 🟩
Mục tiêu tổng của giai đoạn này: **số hóa toàn bộ dữ liệu từ nhập hàng cho đến sản xuất thành phẩm**, theo **nhiều loại quy cách** và **kiểu chế biến** (luộc, chần, cắt, tẩm bột…) của **nhiều loại nguyên liệu** (bạch tuộc, mực, cá…). Không dừng ở việc ghi tổng — phải ghi được *cùng một mẻ nguyên liệu ra những quy cách/kiểu chế biến nào, mỗi thứ bao nhiêu*.
→ Cấu trúc dữ liệu quy cách × chế biến: [`bo-quy-cach-che-bien-thanh-pham.md`](../spec/bo-quy-cach-che-bien-thanh-pham.md).

### QĐ-2 · Tách 2 giao diện bộ phận, vận hành theo bước 🟩
Xây **2 giao diện riêng biệt** cho 2 bộ phận đầu chuỗi:
- **Bộ phận Nhập hàng** — nhập nguyên liệu theo chuyến, chốt ngày.
- **Bộ phận Sản xuất thành phẩm** — từ lượng nhập trong ngày, ghi nhận sản xuất ra được bao nhiêu thành phẩm, còn dở bao nhiêu đem lưu kho.

Hai giao diện đi **theo bước** (mỗi bộ phận chỉ thấy phần việc của mình), nhưng **cùng một cơ sở dữ liệu** và **nối liền nhau qua tầng kho**.
→ Thiết kế 2 giao diện + phân vai: [`flow-end-to-end-2-bo-phan.md` §4](flow-end-to-end-2-bo-phan.md).

### QĐ-3 · Mỗi bộ phận có việc-hằng-ngày phải chốt 🟩
- **Nhập hàng:** mỗi ngày phải **nhập hàng về + chốt ngày** (đã có cơ chế `daily_locks`).
- **Sản xuất:** mỗi ngày phải **ghi nhận: từ lượng nhập trong ngày sản xuất ra được bao nhiêu thành phẩm, phần chưa làm xong còn bao nhiêu → đem lưu kho** (bán thành phẩm còn trong khuôn đá), rồi **chốt ngày sản xuất** (`production_locks`).

Sửa sau khi chốt ⇒ **ghi bù bắt buộc lý do** (dùng lại pattern `laGhiBu` của màn Nhập hàng).
→ Định nghĩa daily-task từng bộ phận: [`flow-end-to-end-2-bo-phan.md` §5](flow-end-to-end-2-bo-phan.md).

### QĐ-4 · Mốc dữ liệu: baseline 30/06/2026 → realtime 01/09/2026 🟩
- **Báo cáo tồn kho tổng gần nhất = 30/06/2026** → lấy làm **tồn gốc (baseline)** của hệ thống.
- **Tháng 7 và tháng 8/2026**: nhập lại vào hệ thống **theo dạng báo cáo** (số tổng theo kỳ/tháng, không cần từng chứng từ).
- **Từ 01/09/2026**: bắt đầu **chạy dữ liệu realtime hằng ngày** (mỗi ngày nhập + chốt như vận hành thật).

⚠️ Đây là **quyết định MỚI** — trước buổi này tài liệu neo số liệu theo T7/2026 và **chưa** chốt ngày cutover.
→ Kế hoạch chuyển đổi: [`ke-hoach-cutover-1-9-2026.md`](ke-hoach-cutover-1-9-2026.md).

### QĐ-5 · Nhập liệu: tay trước, file/scan sau 🟩
Cần các chức năng **import bằng file (Excel)** và **scan chữ viết tay** của người dùng cho các vị trí nhập liệu. **Trước hết làm nhập tay thủ công**; import file và scan là giai đoạn sau.
→ Lộ trình import: [`ke-hoach-cutover-1-9-2026.md` §4](ke-hoach-cutover-1-9-2026.md).

### QĐ-6 · Làm rõ thao tác theo từng flow ("second step", phát hành, nhập liệu) 🟨
Cần phân tích và **đặt tên thống nhất** cho các thao tác lặp lại giữa các flow:
- **"Second step"** = bước thứ hai của chuỗi giá trị (**Sản xuất**, sau bước Nhập hàng), *đồng thời* là các thao tác **hai-bước / ghi-ngược** đã xuất hiện trong code (ghi chuyến 2 bước; cân đối hút sản lượng BTP theo ngày rồi **ghi ngược** khi sửa ô lưới).
- **Phát hành (publish)** vs **nhập liệu (entry)**: mỗi flow có giai đoạn *nhập nháp* (sửa được) và giai đoạn *chốt/phát hành* (khóa số, chỉ sửa qua ghi bù).

Đây là quyết định **định hướng** — bảng thuật ngữ chốt ở [`flow-end-to-end-2-bo-phan.md` §6](flow-end-to-end-2-bo-phan.md).

### QĐ-7 · Dùng nhiều bộ kỹ năng để soạn tài liệu + cấu trúc 🟨
Buổi họp thống nhất dùng **nhiều bộ kỹ năng (skills)** khác nhau để: phân tích nghiệp vụ → soạn tài liệu → dựng workflow → thiết kế cấu trúc dữ liệu + bộ quy cách thành phẩm. Nguyên tắc giữ nguyên theo [`docs/README.md`](../README.md): **mỗi chủ đề một file canonical, không copy — chỉ link**.

### QĐ-8 · Chuẩn "Project" làm nguồn tri thức 🟨
Bộ tài liệu re-draft từ buổi này được tổ chức để dùng làm **nguồn tri thức (Project)**: một cửa vào ([`README.md`](../README.md)), các doc con canonical, và các cross-reference thay cho sao chép nội dung.

---

## 4. Mục tiêu tổng (định khung mọi việc phía sau)

> **Số hóa toàn bộ dữ liệu từ NHẬP HÀNG đến SẢN XUẤT THÀNH PHẨM** của Xí nghiệp Baseafood BSF1, theo nhiều **quy cách** và **kiểu chế biến** (luộc/chần/cắt/tẩm bột…) của nhiều **loại nguyên liệu** (bạch tuộc/mực/cá…), sao cho:
> tồn kho cuối kỳ **suy ra từ sổ gốc, không ghi tay** → kế toán chốt số đúng.

---

## 5. Ranh giới buổi họp (không làm trong đợt này)

- **Không** làm phí xuất khẩu trong cân đối (phòng kế hoạch tính riêng, đã trừ trong giá báo — giữ nguyên nguyên tắc cũ).
- **Không** mở app ra ngoài mạng nội bộ trước khi siết RLS đầy đủ (🔴, xem [`05-bao-mat-phan-quyen.md`](../app-map/05-bao-mat-phan-quyen.md)).
- **Không** làm import file/scan ngay — tay trước (QĐ-5).

---

## 6. Điểm cần xác nhận thêm với xí nghiệp

Kế thừa các câu treo cũ ([`can-xac-nhan-dot-tiep.md`](can-xac-nhan-dot-tiep.md)) + phát sinh từ buổi này:

1. **Định dạng báo cáo tồn 30/06/2026** — file gì, cột nào là tồn đầu cho mỗi họ nguyên liệu / mỗi kho.
2. **Mẫu báo cáo tháng 7 & 8** — gộp theo tháng hay theo kỳ; đủ để dựng tồn đầu 01/09 chưa.
3. **Ai thao tác mỗi giao diện bộ phận** (Q28 cũ: Trúc nhập máy, Thủy ghi tay) — ánh xạ vào vai trò `user_profiles`.
4. **Quy tắc chia nguyên liệu cho từng bảng cân đối** + **định nghĩa chỉ số ≈ 0,45** (2 điểm treo cũ, chưa chốt).
5. **Đóng gói bán thành phẩm → thành phẩm**: ai ghi, khi nào, có phiếu không (treo từ doc `34`).

---

## 7. Tài liệu sinh ra từ buổi này

| Doc | Trả lời câu gì | Vị trí |
|---|---|---|
| **Biên bản này** | Họp chốt gì | `trien-khai/hop-2026-08-22-…` |
| [Flow end-to-end + 2 giao diện + daily-task](flow-end-to-end-2-bo-phan.md) | Chuỗi chạy thế nào, đứt ở đâu, 2 bộ phận làm gì mỗi ngày | `trien-khai/flow-end-to-end-2-bo-phan.md` |
| [Kế hoạch cutover 01/09](ke-hoach-cutover-1-9-2026.md) | Baseline 30/6, import T7–T8, realtime 1/9, import file/scan | `trien-khai/ke-hoach-cutover-1-9-2026.md` |
| [Bộ quy cách × chế biến thành phẩm](../spec/bo-quy-cach-che-bien-thanh-pham.md) | Cấu trúc dữ liệu quy cách/chế biến/nguyên liệu | `spec/bo-quy-cach-che-bien-thanh-pham.md` |

Cập nhật kèm theo: trạng thái/backlog trong [`CLAUDE.md`](../../CLAUDE.md), index [`app-map/README.md`](../app-map/README.md), ghi chú lệch của [`BAN-GIAO.md`](../BAN-GIAO.md).
