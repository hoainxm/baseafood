# Chuẩn nội dung & label — Baseafood MES

> Load khi: đặt/sửa BẤT KỲ chữ hiển thị nào — tên trang, mục sidebar, tiêu đề, mô tả, nhãn field, tên giá trị/tùy chọn, nút, empty state, toast, tooltip.
> Đây là canonical cho microcopy. Luật giao diện (size, màu, component) ở [`README.md`](README.md).

Người dùng: tổ trưởng/thủ kho **45–60 tuổi**, tablet ở xưởng lạnh, tay ướt, đeo kính lão. Ưu tiên tuyệt đối: **ít chữ · rõ nghĩa · nhất quán · không bắt người dùng dịch trong đầu.**

Nguồn (đã đối chiếu): GOV.UK / Home Office content style guide · Nielsen Norman Group · Material Design 3 · Apple HIG · Shopify Polaris. URL ở cuối file.

## Luật vàng (thuộc lòng)

1. **Sentence case mọi nơi** (nhãn, nút, menu, tiêu đề). Chỉ hoa chữ đầu + danh từ riêng / tên phân xưởng. KHÔNG Title Case, KHÔNG IN HOA.
2. **Nhãn field = DANH TỪ trần** gọi tên dữ liệu. Không câu, không động từ, không dấu hai chấm cuối.
3. **Nút = ĐỘNG TỪ đứng đầu**, dạng `{động từ} + {danh từ}` cho đủ ngữ cảnh. Ngoại lệ: nút phổ biến (Lưu, Hủy, Đóng, Xong).
4. **Ngữ cảnh đã có trong khung thì đừng lặp vào chữ.** Khối đã tên "Bộ lọc" ⇒ nhãn chỉ gọi tên chiều lọc; nghĩa "tất cả/chỉ" nằm ở **giá trị mặc định**, không ở nhãn. Cấm tiền tố `Chỉ xem…`, `Chỉ dòng…`, hậu tố `… dòng`.
5. **Một khái niệm = một từ** xuyên suốt hệ (đừng lúc "loại NL" lúc "mặt hàng"). Ưu tiên "chọn" hơn "nhấn/click".
6. Nhãn & nút **không dấu chấm cuối**. Câu mô tả/hint/empty state đủ ý thì có dấu chấm.

## Bảng quy tắc theo loại label

| Loại | Quy tắc | ✅ Tốt | ❌ Xấu |
|---|---|---|---|
| **Tiêu đề trang** | Sentence case, danh từ mô tả, ≤ ~65 ký tự, không chấm cuối | Sổ nhập nguyên liệu | SỔ Nhập Nguyên Liệu. |
| **Mô tả trang** | 1 câu, giọng chủ động, nói *cái gì ở đây + làm được gì* | Ghi từng chuyến hàng về xưởng trong ngày. | Chức năng quản lý nhập liệu |
| **Mục sidebar / nav** | Từ quen thuộc, mô tả đích đến, danh từ ngắn; cấm jargon "sáng tạo" | Nhập hàng · Cân đối kỳ | Cổng dữ liệu · Trung tâm vận hành |
| **Nhãn field (nhập)** | Danh từ, luôn hiện, đặt TRÊN ô, không placeholder-thay-nhãn, không `:` | Đại lý · Đơn giá | Nhập tên đại lý: · Bạn hãy chọn đại lý |
| **Nhãn field (lọc)** | CHỈ gọi tên chiều lọc. "tất cả/chỉ" → ở giá trị mặc định | Đại lý (mặc định "Tất cả đại lý") | Chỉ xem đại lý |
| **Tên giá trị / option** | Tự đứng vững, KHÔNG lặp từ ở nhãn nhóm hay bối cảnh, ngắn nhất | Tất cả · Chưa có giá | Tất cả dòng · Chỉ dòng chưa có giá |
| **Nút hành động** | Verb-first `{verb}+{noun}`, cụ thể | Lưu chuyến · Chốt ngày · Xóa dòng | OK · Gửi · Thực hiện |
| **Hint field** | ≤1 câu, bổ sung (không lặp nhãn) | Để trống nếu chưa có hóa đơn | Nhập đơn giá vào ô đơn giá. |
| **Empty state** | (1) đang trống, (2) chỗ này chứa gì, (3) đường tới hành động đầu tiên | Chưa có chuyến nào trong ngày. Nhấn "Ghi chuyến hàng" để bắt đầu. | (bảng rỗng không chữ) |
| **Toast / lỗi** | Cụ thể cái gì sai + cách sửa, không đổ lỗi người dùng, giữ input | Thiếu đơn giá ở dòng 2. Nhập giá hoặc để "Chưa có giá". | Dữ liệu không hợp lệ |
| **Tooltip / ⓘ** | Ngắn; KHÔNG chứa thông tin sống còn (tay ướt khó chạm) | Ghi bù = ghi sau ngày hàng về | (đặt bước bắt buộc chỉ trong tooltip) |

## Đặc thù tiếng Việt

- **Không viết hoa kiểu tiếng Anh** ("Nhập Nguyên Liệu"). Tiếng Việt dùng sentence case: "Nhập nguyên liệu".
- Nhãn field là **danh từ/cụm danh từ** ("Ngày hàng về xưởng"), không phải mệnh lệnh ("Hãy chọn ngày").
- Nút là **động từ/cụm động từ** ("Ghi chuyến hàng", "Chốt ngày").
- Tránh giới từ treo lửng: "Xem theo" ❌ → gọi thẳng chiều: "Kỳ xem sổ" ✅.
- Nhất quán số & đơn vị: khối lượng luôn **kg**, tiền **đ**, locale vi-VN (xem `lib/format.ts`).

## Checklist khi thêm/sửa 1 label

- [ ] Sentence case? (không Title Case, không IN HOA)
- [ ] Nhãn field là danh từ trần, không `:` cuối?
- [ ] Nút bắt đầu bằng động từ?
- [ ] Đã bỏ mọi từ ngữ cảnh đã có trong khung ("Chỉ xem…", "… dòng", "Tất cả dòng")?
- [ ] Option ngắn nhất mà vẫn tự đứng vững?
- [ ] Cùng khái niệm dùng cùng từ với chỗ khác trong hệ?
- [ ] Empty state / lỗi có chỉ đường hành động, không đổ lỗi?

## Before → After đã áp (mẫu tham chiếu)

Toolbar bộ lọc `features/NhapNguyenLieu.tsx`:

| Trước | Sau | Luật |
|---|---|---|
| Nhãn lọc "Chỉ xem đại lý" | **Đại lý** (mặc định "Tất cả đại lý") | #4 nhãn lọc = danh từ trần |
| Nhãn lọc "Chỉ xem loại nguyên liệu" | **Loại nguyên liệu** (mặc định "Tất cả loại") | #4, #5 |
| Nhãn nhóm lọc "Đơn giá" | **Trạng thái giá** | #5 tránh trùng tên cột "Đơn giá (đ)" gây mơ hồ nhập-hay-lọc |
| Option "Tất cả dòng" | **Tất cả** | option không lặp bối cảnh "dòng" |
| Option "Chỉ dòng chưa có giá" | **Chưa có giá** | nhất quán với nhãn "Chưa có giá" dùng chỗ khác |
| "Xem theo" (cũ) | **Kỳ xem sổ** | nhãn = danh từ chiều được chọn |

**Mẫu chuẩn để noi theo:** "Kỳ xem sổ", "Phân xưởng", "Ngày hàng về xưởng" — danh từ, sentence case, gọi đúng chiều.

## Nguồn

- GOV.UK style A–Z (sentence case, buttons, active voice): https://www.gov.uk/guidance/style-guide/a-to-z-of-gov-uk-style
- Home Office content style guide (nhãn plain-language, hint ≤1 câu, "select" > "click"): https://design.homeoffice.gov.uk/design-and-content/content/content-style-guide
- NN/g — Placeholders in Form Fields Are Harmful: https://www.nngroup.com/articles/form-design-placeholders/
- NN/g — Navigation & cognitive strain: https://www.nngroup.com/articles/navigation-cognitive-strain/
- NN/g — Designing Empty States: https://www.nngroup.com/articles/empty-state-interface-design/
- NN/g — Error Message Guidelines: https://www.nngroup.com/articles/error-message-guidelines/
- Material Design 3 — Content design style guide: https://m3.material.io/foundations/content-design/style-guide
- Apple HIG — Writing: https://developer.apple.com/design/human-interface-guidelines/writing
- Shopify Polaris — Actionable language: https://polaris.shopify.com/content/actionable-language
