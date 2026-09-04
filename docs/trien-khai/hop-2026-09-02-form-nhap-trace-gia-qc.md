# Biên bản họp & quyết định — 2026-09-02

> **Chủ đề:** chốt số để **chạy realtime từ tháng 9**; chuẩn hóa **một form nhập duy nhất + chụp ảnh phiếu tay → OCR tự nhập**; định danh **lô + QR** cho truy xuất; nguyên tắc **giá & bình quân gia quyền theo ngày**; **QC chấm điểm + ảnh**; **khung nhân sự số hóa** theo khâu.
> **Trạng thái:** đã chốt định hướng vận hành; một số điểm còn treo chờ xác nhận với xí nghiệp ([§4](#4-điểm-cần-xác-nhận-thêm)).
> **Đã build đợt 1 (2026-09-05):** QĐ-4 mã số KH/đại lý · QĐ-6(lite)+QĐ-10 mã lô nội bộ + ô SSCC ở Nhập hàng (migration `0035`) · QĐ-8 màn QC checklist `/qc` chấm điểm + chốt ngày (migration `0036`, ảnh để sau). Chi tiết trạng thái: [`CLAUDE.md` Backlog](../../CLAUDE.md) · [`BAN-GIAO-tiep-theo.md`](../BAN-GIAO-tiep-theo.md). **Chưa build:** QĐ-7 giá bình quân gia quyền (chờ chốt PA), QR in/quét, OCR chụp phiếu. **Nối tiếp** buổi [`hop-2026-08-22`](hop-2026-08-22-so-hoa-flow-2-bo-phan.md) — kế thừa QĐ-1..8, buổi này **bổ sung/làm rõ** phần vận hành thực địa.
> **Bối cảnh nền:** [`BAN-GIAO.md`](../BAN-GIAO.md) · cutover [`ke-hoach-cutover-1-9-2026.md`](ke-hoach-cutover-1-9-2026.md) · lô/trace [`spec/import-xnt-kho-cutover.md`](../spec/import-xnt-kho-cutover.md) · quy cách [`spec/bo-quy-cach-che-bien-thanh-pham.md`](../spec/bo-quy-cach-che-bien-thanh-pham.md).
> **Nguồn:** bản speech-to-text (Whisper) của buổi họp — 2 file gốc `4.txt` + `5.txt`. STT nhiễu; nội dung dưới là **bản đã phiên giải**, các điểm nghe không chắc được đánh dấu *(cần xác nhận)*.
> **last_verified:** 2026-09-04

File này là **nguồn canonical cho các quyết định của buổi họp 2026-09-02**. Chi tiết thiết kế nằm ở các doc con — ở đây chỉ ghi *quyết định gì, vì sao, đụng vào đâu*.

> ⚠️ **Ngày họp cần xác nhận:** STT lẫn giữa "ngày 31 tháng 8" (`4.txt`) và "hôm nay là lễ" (`5.txt`, khớp lễ Quốc khánh 02/09). Tạm chốt **2026-09-02**; nếu sai, đổi tên file + tiêu đề.

---

## 1. Một câu tóm tắt

Buổi họp chốt: **hôm nay khóa số để bắt đầu chạy dữ liệu thật từ tháng 9**, và định hướng lớn cho vận hành thực địa là **dồn mọi cách ghi chép về MỘT form chuẩn**, cho phép **chụp ảnh phiếu viết tay để hệ thống tự bóc số (OCR)** nhằm giảm gõ tay ở xưởng; song song **định danh hàng theo lô + mã QR** để chuẩn bị truy xuất (nội bộ trước, SSCC nhà nước để sau — chừa sẵn ô trống), thống nhất **nguyên tắc giá theo ngày (bình quân gia quyền)**, và bổ sung **QC chấm điểm kèm ảnh** cùng **khung nhân sự số hóa gắn từng khâu**.

---

## 2. Vấn đề nêu trong họp

1. **Ghi chép tay ở xưởng còn nặng.** Người dưới xưởng viết giấy → chị Trúc gõ lại vào hệ thống (làm 2 lần). Chủ dự án muốn bỏ khâu gõ lại: **một form chuẩn**, chụp ảnh là hệ thống tự nhập.
2. **Chưa định danh được khối lượng hàng đi vào.** Hàng vào kho hiện **chưa gắn mã/QR**; không truy được *mẻ nào ăn nguyên liệu của lô nào*. Nhiều đại lý, nhiều xe, cùng loại cá nhưng **giá và chất lượng khác nhau** → tồn kho phải đi theo giá trị mà chưa có cách gán.
3. **Chưa thống nhất nguyên tắc giá.** Trong ngày nhập nhiều lô giá khác nhau, phần ra sản xuất và phần cất kho nên tính giá thế nào cho nhất quán, an toàn.
4. **Điều hướng khó dùng.** Người dùng phải hỏi "bấm nút nào"; cần tổ chức như **cây thư mục + đường link** để tự đi.
5. **QC/kỹ thuật cuối ngày chưa số hóa.** Kiểm vệ sinh, dụng cụ, thiết bị còn ghi văn xuôi; cần chấm điểm nhanh + ảnh.
6. **Chưa gắn người cho từng khâu số hóa.** Mỗi mắt xích cần một người chịu trách nhiệm nhập/chốt.
7. **Ràng buộc thực địa:** hàng đông lạnh khó dán tem; điện thoại bị hạn chế trong khu sản xuất (an toàn thực phẩm).

---

## 3. Các quyết định đã chốt

Mỗi quyết định ghi: **nội dung · loại (🟩 chốt / 🟨 định hướng / 🅿️ để sau) · đụng vào đâu**. Thứ tự theo mức ưu tiên chủ dự án nhấn.

### QĐ-1 · Một form nhập duy nhất + chụp ảnh phiếu tay → OCR tự nhập 🟩
Điểm chủ dự án **nhấn mạnh nhất**. Bỏ nhập tự do, mỗi loại nghiệp vụ về **một form chuẩn** (bố cục cố định, các ô định sẵn). Người dưới xưởng ghi trên **form giấy chuẩn** (hoặc nhập thẳng app) → **chụp một tấm hình** → hệ thống **tự bóc dữ liệu và điền vào ô** để chạy. Mục tiêu: người dưới xưởng **không phải gõ nhiều**, không phải chờ ai chỉ.
- **Mã hóa để máy đọc nhanh:** đặt **số cạnh tên** (mã số + tên) cho mặt hàng/khách/đại lý.
- **Chấp nhận sai lúc đầu:** cứ cho nhập để có số chạy trước, "đúng sai tính sau", rồi chỉnh dần — vì đã có phần mềm tổng hợp đối chiếu.
- **Chuyển đổi có chủ đích:** giai đoạn đầu **viết tay song song với app ~1 tháng** cho quen; ban đầu người ta thích viết tay, khi quen thì dồn hẳn về app (nhập máy nhanh hơn viết).
- Đây là **mở rộng của [QĐ-5 buổi 08-22](hop-2026-08-22-so-hoa-flow-2-bo-phan.md)** ("nhập liệu: tay trước, file/scan sau") — nay nâng thành **yêu cầu định hướng vận hành chính**.
→ Đụng: [`ke-hoach-cutover-1-9-2026.md §4`](ke-hoach-cutover-1-9-2026.md#4-chức-năng-import-tay-trước-filescan-sau-qđ-5) (lộ trình import tay → file → scan/OCR); nguyên tắc "import không tự chốt, luôn có ô sửa" giữ nguyên.

### QĐ-2 · Chốt tồn hôm nay → chạy realtime từ tháng 9; số phải "biến động như thực thể sống" 🟩
- **Hôm nay khóa số** để lấy mốc; **lấy tháng 9 làm chuẩn, tính từ tháng 9 đi**.
- Giữ mô hình 3 mốc của [QĐ-4 buổi 08-22](hop-2026-08-22-so-hoa-flow-2-bo-phan.md): **baseline 30/06 → nhập báo cáo T7–T8 → realtime từ tháng 9**. Buổi này **xác nhận đưa vào chạy thật**.
- **Không theo dõi tồn tĩnh:** số phải **biến động hằng ngày** (theo dõi "một thực thể sống"), **phân rõ loại tồn kho**; con số cuối cùng bản chất là **dòng tiền + tồn kho**.
→ Đụng: [`ke-hoach-cutover-1-9-2026.md §1–3`](ke-hoach-cutover-1-9-2026.md) (mốc + trình tự) · [`flow §5`](flow-end-to-end-2-bo-phan.md#5-việc-hằng-ngày-daily-task-từng-bộ-phận-qđ-3) (daily-task).

### QĐ-3 · Ranh giới nhập → sản xuất → kho (làm rõ) 🟩
- **Nhập hàng KHÔNG vào kho ngay.** Nguyên liệu về được lấy ra **sản xuất**; **khi ra thành phẩm / đóng block cấp đông mới ghi vào kho**.
- Nhận **kho nguyên liệu** chỉ sau khi qua **sơ chế + đông** rồi "cắt vào phong nguyên liệu" (không phải cả xe đổ thẳng vào kho).
- Trong ngày: nhập X → sản xuất Y → phần sản xuất ghi vào; phần đông chưa dùng ghi **theo block + quy cách** (2kg/5kg cấp đông).
→ Đụng: [`flow §3 (G1)`](flow-end-to-end-2-bo-phan.md#3-chỗ-đứt-gãy--vì-sao-chưa-hoàn-thiện-triệt-để) (nối SX↔NL, "còn dở" đem lưu kho) · [`30-nhap-hang.md`](../app-map/30-nhap-hang.md) · [`34-btp-san-xuat-kho.ba-spec.md`](../app-map/34-btp-san-xuat-kho.ba-spec.md).

### QĐ-4 · Mã hóa khách hàng / đại lý bằng số 🟩
Gán **mã số** cho khách hàng và đại lý (ví dụ Hanwha = 1, khách khác = 2, 3…). Người nhập chỉ gõ **số** → hệ thống **tự đổ tên**; hệ thống **cảnh báo** khi số khách không khớp việc đang làm (nhập số 1 mà đang làm cho số 2 → nhắc sửa). Số khách hàng ~10; ban đầu chưa quen, làm nhiều sẽ thuộc.
→ Đụng: [`32-danh-muc.md`](../app-map/32-danh-muc.md) (danh mục khách hàng/đại lý qua `Combobox`, thêm mã số).

### QĐ-5 · Khung nhân sự số hóa gắn từng khâu 🟩
Mỗi khâu số hóa phải **gắn một người chịu trách nhiệm**, đẩy luồng số hóa qua các "key" nhân sự. Chi tiết ở [§6](#6-phân-công-nhân-sự-qđ-5).
→ Đụng: [`flow §4`](flow-end-to-end-2-bo-phan.md#4-hai-giao-diện-bộ-phận-qđ-2) (2 giao diện bộ phận + vai trò) · [`ke-hoach-tuan-1-thu-thap-du-lieu.md`](ke-hoach-tuan-1-thu-thap-du-lieu.md).

### QĐ-6 · Định danh lô + mã QR/barcode cho truy xuất nội bộ 🟨
- **Sinh mã lô** khi hàng vào → dán lên → khi sản xuất **quét hoặc nhập số series** để biết mẻ này lấy từ lô nào (trace nội bộ).
- **Chọn QR** thay vì barcode 1 chiều: QR mã hóa được nhiều thông tin, đính kèm được (khách, ký, size, ngày, chế biến…).
- **Điểm mở (chưa chốt):** sinh mã ở **khúc nào** — ngay cổng/lúc nhập, hay **sau sơ chế + đông** lúc "cắt vào phong nguyên liệu"; và **ai** thao tác gieo mã.
- **Thực tế đông lạnh:** tem giấy dễ **bong / dính nhầm thùng khác** khi xả đông (một thùng dính 2–3 nhãn). Cân nhắc **mã nhựa tái sử dụng** (cấp ~1000 mã, gán ID hệ thống, quay vòng ra–vào) hoặc **in tem tại chỗ** bằng máy in nhỏ (kiểu siêu thị) để công nhân/QC tự in–dán rồi gửi QR lên hệ thống. Với BB (bao bì) thì dán **trước khi vào lạnh**, đúng thời điểm nhập.
- **Nguyên tắc chung:** trên sổ sách **phải định danh hết** — không định danh thì sau khó kiểm soát.
- Ăn khớp với hướng **cấp lô (Phương án A)** đã chốt 2026-08-26: [`spec/import-xnt-kho-cutover.md`](../spec/import-xnt-kho-cutover.md) (mã hàng `PX<phân xưởng>.<nhóm><nguồn>.<lô>`, realtime nhập/xuất theo lô).
→ Đụng: [`spec/import-xnt-kho-cutover.md`](../spec/import-xnt-kho-cutover.md) (sổ tồn cấp lô) · [`34-btp-san-xuat-kho.ba-spec.md`](../app-map/34-btp-san-xuat-kho.ba-spec.md) (trace mẻ↔lô) · [`30-nhap-hang.md`](../app-map/30-nhap-hang.md) (sinh mã lúc nhập).

### QĐ-7 · Nguyên tắc giá & bình quân gia quyền theo ngày 🟨 *(2 phương án — cần chốt, [§4](#4-điểm-cần-xác-nhận-thêm))*
Nhiều đại lý cùng loại cá, giá khác nhau → tồn kho phải đi theo giá trị. Bàn 2 phương án:
- **PA1 — phân lô theo giá:** lô **giá cao → đưa ra sản xuất trước**; lô **giá thấp → cất kho dự trữ** (giá trị kho giảm thì an toàn, tốt cho tương lai). Ví dụ nêu trong họp: ngày mua 12 tấn = 8 tấn giá 142k (ra sản xuất) + 4 tấn giá 141k (vào kho).
- **PA2 — bình quân gia quyền theo ngày *(nghiêng chọn)*:** trong ngày nhập, **xóa phân biệt người nhập**, lấy **giá bình quân gia quyền** của ngày. **Đơn giá gắn theo NGÀY nhập** nguyên liệu; **lượng hàng** thì theo mẻ **đã sơ chế/đông xong**. Nếu hàng đông để qua hôm sau mới nhập kho thì lượng tính sau nhưng **đơn giá vẫn truy theo ngày nhập gốc**.
- **Nguyên tắc Long (tách tiền khỏi đầu vào):** đầu vào **chỉ phân LƯỢNG theo đại lý (ký), KHÔNG phân giá** tại khâu nhập; giá dồn về **phòng kế toán / cuối luồng**. Bản chất chủ dự án chỉ cần **lô + lượng**; tiền để kế toán ráp.
→ Đụng: [`30-nhap-hang.md`](../app-map/30-nhap-hang.md) (đơn giá theo ngày) · [`31-can-doi-ky.md`](../app-map/31-can-doi-ky.md) + `lib/balancingCalc.ts` (giá thành). **CHỈ ghi doc — CHƯA sửa công thức** cho tới khi chốt PA.

### QĐ-8 · QC / kỹ thuật: checklist chấm điểm cuối ngày + ảnh 🟨
Báo cáo QC/kỹ thuật cuối ngày **không viết văn xuôi** — **mã hóa/chấm điểm cho nhanh**, kèm ảnh:
- Bộ **~10 chỉ tiêu** phải kiểm trong ngày (vệ sinh nhà xưởng, dụng cụ/thiết bị sản xuất có hư không…).
- Mỗi chỉ tiêu: chụp ảnh + đánh **OK/HOK**, hoặc **chấm điểm thang 10** (7–10 đạt · 5–7 tạm · <5 không đạt), hoặc **A/B/C** (A tốt · B tạm · **C = phải có người kiểm tra lại**, escalation).
- **Ảnh bắt buộc** kèm theo. On-site (kỹ thuật viên / CTV các tỉnh) **chụp theo form** rồi **admin duyệt**; ảnh phải có tàu / mã / đoạn quy chuẩn.
→ Đụng: chưa có doc — ghi định hướng ở đây; khi build tách `docs/spec/qc-checklist.md` *(để sau)*. Màn DEMO liên quan: `/quality`.

### QĐ-9 · Điều hướng dạng cây thư mục + đường link 🟨
Tổ chức hệ thống như **cây thư mục / đường dẫn link**: dựng **"khung" trước**, đặt mỗi chức năng **đúng vị trí trong cây**; người dùng **tự đi theo link** thay vì hỏi "bấm nút nào". Chủ dự án **giao cấu trúc cho dev tự quyết** ("con muốn đặt ở đâu thì đặt"), miễn là đặt tên rõ và người ta tự phục vụ được.
→ Đụng: [`02-pages-navigation.md`](../app-map/02-pages-navigation.md) (điều hướng, khung `AppShell.tsx`). Định hướng UX, chưa yêu cầu đổi cụ thể.

### QĐ-10 · SSCC / truy xuất nhà nước — chừa sẵn ô trống, làm sau 🅿️
Mã truy xuất nguồn gốc thủy sản (SSCC) của nhà nước **sẽ bắt buộc** (vài tháng tới); hiện nhà máy **khai giấy thủ công** lên sở, mã có thể về **sau 1–2 tuần**. Quyết: **thiết kế chừa sẵn ô trống** cho SSCC / định danh lô; khi hệ thống chuẩn thì **chỉ nhập thêm vào ô trống**. Sau này **lô nào cũng phải có SSCC mới cho nhập kho**. **Chưa làm ngay** — chỉ chừa trường, không chặn tiến độ.
→ Đụng: [`30-nhap-hang.md`](../app-map/30-nhap-hang.md) (chừa trường lúc nhập) · [`spec/import-xnt-kho-cutover.md`](../spec/import-xnt-kho-cutover.md) (gắn vào cấp lô).

### QĐ-11 · Lương / BHXH / xin nghỉ phép qua app 🅿️
Số hóa **báo cáo lương, BHXH**, và **xin nghỉ phép qua app** (tận dụng định danh điện thoại / dịch vụ công). Chủ dự án: **"báo cáo chạy trước"**, phần này **để sau** — ưu tiên số hóa sản xuất (khâu khó nhất) trước.
→ Đụng: chưa có doc — ghi để sau.

### QĐ-12 · Ràng buộc vận hành: điện thoại trong khu sản xuất 🅿️
An toàn thực phẩm: **không cho điện thoại tự do trong khu sản xuất**; chỉ **~4–5 người** tổng hợp số liệu / lãnh đạo được dùng khi báo cáo. Giải pháp cân nhắc: **túi bọc chống nước** (như khách nước ngoài đeo khi tham quan), hoặc **thiết bị/bảng riêng** link đồng hồ để nhập số. **Hệ quả thiết kế:** khâu ghi số ở xưởng có thể **vẫn viết giấy** rồi **chụp/nhập ở phòng** — càng củng cố QĐ-1 (form + chụp ảnh).
→ Đụng: liên quan QĐ-1; ghi ràng buộc, chưa cần build.

---

## 4. Điểm cần xác nhận thêm

Kế thừa các câu treo cũ ([`can-xac-nhan-dot-tiep.md`](can-xac-nhan-dot-tiep.md), [buổi 08-22 §6](hop-2026-08-22-so-hoa-flow-2-bo-phan.md#6-điểm-cần-xác-nhận-thêm-với-xí-nghiệp)) + phát sinh buổi này:

1. **Phương án giá (QĐ-7)** — chốt **PA1 (lô cao→SX / lô thấp→kho)** hay **PA2 (bình quân gia quyền theo ngày)**; và có áp nguyên tắc "đầu vào chỉ phân lượng, không phân giá" không. *Cần chủ dự án + phân xưởng trao đổi trên số thực tế.*
2. **Thời điểm sinh mã lô (QĐ-6)** — gieo mã ngay cổng/lúc nhập, hay sau sơ chế+đông; **loại tem** (mã nhựa tái dùng vs in giấy tại chỗ); **ai** gieo mã.
3. **Ngày họp** — STT lẫn "31/8" và "lễ 2/9"; xác nhận để đặt đúng tên file.
4. (Treo cũ) Định dạng báo cáo tồn 30/06 + báo cáo T7/T8; quy tắc chia nguyên liệu cho bảng cân đối; đóng gói BTP→TP ai ghi/khi nào (đã có [`/packaging`](../app-map/34-btp-san-xuat-kho.ba-spec.md), xác nhận vận hành thực tế).

---

## 5. Ưu tiên & thứ tự làm (theo chủ dự án)

- **Làm cái CHẮC trước, đừng tham** — "cái nào chắc cho đó".
- **Sản xuất là khâu khó nhất → làm trước**, xong khâu khó thì các khâu dễ (báo cáo, lương…) làm sau sẽ nhẹ.
- **Dựng đủ tiêu chí nhưng làm nhóm 1–2–3 trước**, phần còn lại để mở ô trống / làm dần.
- **Cứ cho chạy thử rồi chỉnh** — có số trước đã, đúng/sai tinh chỉnh sau (đối chiếu bằng phần mềm tổng hợp).

**Thứ tự đề xuất bám ưu tiên trên:** QĐ-2 (chốt số chạy T9) → QĐ-1 (form nhập + biểu mẫu chuẩn cho xưởng) → QĐ-5/§6 (gắn người từng khâu) → QĐ-3/QĐ-4 (ranh giới kho + mã KH) → QĐ-6/QĐ-7 (lô/QR + giá, sau khi chốt §4) → QĐ-8/QĐ-9 → QĐ-10/11/12 (để sau).

---

## 6. Phân công nhân sự (QĐ-5)

Mỗi khâu gắn một người; Nam soạn biểu mẫu/form trước, rồi cùng xuống xưởng ráp thực tế.

| Khâu / giao diện | Người phụ trách | Ghi chú |
|---|---|---|
| Kế toán / tồn kho tổng | **chị Dung** | Đầu mối số liệu tồn, đối chiếu |
| Nhập hàng hằng ngày (`/imports`) | **chị Trúc** | Nhập luồng hàng ngày; **form các tờ của chị Trúc** là mẫu để dựng app nhập cho xưởng |
| Ghi thành phẩm (`/wip`) | **chị Luyên** | Ghi sản lượng thành phẩm |
| Phân xưởng (nhập liệu dưới xưởng) | **1 người dưới xưởng** | Người trực tiếp nhập/chụp phiếu; cần xác định cụ thể |
| Tham gia dựng & tập huấn | **cô Hạnh, Lan, chị Trúc** (+ Nam) | Nam soạn hết biểu mẫu trước → **4 người xuống xưởng ngồi làm ~2 tiếng**, chủ dự án chỉ trực tiếp |
| Dev / setup số hóa | **Nam** (+ hỗ trợ) | Soạn form, dựng app nhập liệu dưới xưởng **trong cùng app, chia quyền** |

**Cách vận hành:** Nam **soạn biểu mẫu trước** → app nhập liệu cho xưởng bám **đúng form các tờ của chị Trúc** → 4 người xuống xưởng ráp ~2 tiếng → sau đó Nam ngồi tiếp với dưới xưởng để hoàn thiện. Đã link được danh mục → **mã thành phẩm**; lưu thông tin **chế biến + quy cách** theo [`spec/bo-quy-cach-che-bien-thanh-pham.md`](../spec/bo-quy-cach-che-bien-thanh-pham.md).

---

## 7. Tài liệu sinh ra / cập nhật từ buổi này

| Doc | Vai trò | Cập nhật |
|---|---|---|
| **Biên bản này** | Quyết định buổi 2026-09-02 (canonical) | 🆕 tạo mới |
| [`flow-end-to-end-2-bo-phan.md`](flow-end-to-end-2-bo-phan.md) | Chuỗi chạy, 2 giao diện, daily-task | thêm con trỏ QĐ-3/QĐ-5 buổi này |
| [`ke-hoach-cutover-1-9-2026.md`](ke-hoach-cutover-1-9-2026.md) | Mốc dữ liệu + import tay/file/scan | thêm QĐ-1 (form+OCR) + QĐ-2 (chạy T9) |
| [`spec/import-xnt-kho-cutover.md`](../spec/import-xnt-kho-cutover.md) | Sổ tồn cấp lô | ăn khớp QĐ-6 (lô/QR) — trỏ qua lại |
| [`30-nhap-hang.md`](../app-map/30-nhap-hang.md) · [`32-danh-muc.md`](../app-map/32-danh-muc.md) · [`34-btp-san-xuat-kho.ba-spec.md`](../app-map/34-btp-san-xuat-kho.ba-spec.md) | app-map nghiệp vụ | con trỏ 1 dòng tới QĐ liên quan |
| [`hop-2026-08-22-…`](hop-2026-08-22-so-hoa-flow-2-bo-phan.md) | Biên bản trước | thêm liên kết "buổi kế tiếp" |

Cập nhật kèm theo trạng thái sống: mục **Backlog/Trạng thái** trong [`CLAUDE.md`](../../CLAUDE.md) + [`BAN-GIAO-tiep-theo.md`](../BAN-GIAO-tiep-theo.md).

**Chưa có doc, sẽ tách khi build:** `docs/spec/qc-checklist.md` (QĐ-8) · phần lương/BHXH/nghỉ phép (QĐ-11).
