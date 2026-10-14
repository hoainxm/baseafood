// ============================================================
// Tên file: supabase/functions/ocr-import-slip/index.ts
// Tên tiếng Việt: Đọc ảnh phiếu nhập bằng OpenAI (phía máy chủ)
// Description: Edge Function — nhận ảnh phiếu + danh mục, gọi OpenAI vision, trả bản nháp
// ============================================================
//
// Vì sao chạy ở máy chủ: key OpenAI KHÔNG được nằm trong bundle trình duyệt (biến
// VITE_* bị nhúng thẳng vào JS). Key đặt ở Supabase → Edge Functions → Secrets:
//   OPENAI_API_KEY   (bắt buộc)
//   OPENAI_MODEL     (tuỳ chọn, mặc định gpt-4.1-mini — cần model đọc được ảnh)
// Chỉ người đã đăng nhập VÀ có vai trò (`co_vai_tro()`, mig 0057) mới gọi được —
// người tự đăng ký không đốt tiền key. Hàm KHÔNG ghi bảng nào, không lưu ảnh, không log
// ảnh: ảnh phiếu đã lưu riêng ở Storage bucket `qc` (lib/storage.ts).
// Kết quả là NHÁP: app vẫn bắt người soát lại từng ô (docs/app-map/30-nhap-hang.md).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Ảnh base64 tối đa ~8 MB (app đã nén về ≤1600px JPEG, thường < 500 KB). */
const MAX_IMAGE_CHARS = 8_000_000;
const MAX_CATALOG_ITEMS = 2000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Khuôn JSON bắt OpenAI trả đúng hình (structured outputs, strict). */
const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text", "raw", "date", "supplier", "licensePlate", "driverName", "workshop", "lines", "scraps", "totalKg", "warnings"],
  properties: {
    text: { type: "string", description: "Toàn văn chữ trên phiếu, giữ xuống dòng theo hàng." },
    raw: {
      type: "object",
      additionalProperties: false,
      description: "Chữ CHÉP Y như trên phiếu của từng ô (trước khi khớp danh mục), null nếu phiếu không ghi.",
      required: ["date", "supplier", "workshop", "licensePlate", "driverName"],
      properties: {
        date: { type: ["string", "null"] },
        supplier: { type: ["string", "null"] },
        workshop: { type: ["string", "null"] },
        licensePlate: { type: ["string", "null"] },
        driverName: { type: ["string", "null"] },
      },
    },
    date: { type: ["string", "null"], description: "Ngày hàng về dạng yyyy-mm-dd, null nếu không thấy." },
    supplier: { type: ["string", "null"], description: "Nhãn đại lý ĐÚNG Y một mục trong danh mục, null nếu không chắc." },
    licensePlate: { type: ["string", "null"], description: "Biển số xe chở hàng, null nếu phiếu không ghi." },
    driverName: { type: ["string", "null"], description: "Tên tài xế, null nếu phiếu không ghi." },
    workshop: { type: ["string", "null"], description: "Xưởng nhận hàng: ĐÚNG Y một mục trong danh sách xưởng, null nếu không ghi." },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["raw", "materialType", "kg", "unitPrice"],
        properties: {
          raw: { type: "string", description: "Chữ CHÉP Y cả dòng trên phiếu: loại · số lượng · đơn giá (vd \"2Da NL 80↑ · 11,017 · 142\")." },
          materialType: { type: "string", description: "Tên loại NL ĐÚNG Y một mục trong danh mục." },
          kg: { type: "number", description: "Khối lượng kg của dòng đó." },
          unitPrice: { type: ["number", "null"], description: "Đơn giá đồng/kg của dòng đó, null nếu phiếu không ghi." },
        },
      },
    },
    scraps: {
      type: "array",
      description: "Phế liệu cân gộp (nội tạng, dạt…) — KHÔNG đưa vào lines.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "kg"],
        properties: {
          name: { type: "string", description: "Loại phế liệu ĐÚNG Y một mục trong danh sách PHẾ LIỆU." },
          kg: { type: "number" },
        },
      },
    },
    totalKg: { type: ["number", "null"], description: "Số tổng ghi ở chân cột số lượng (nếu có), null nếu không ghi." },
    warnings: { type: "array", items: { type: "string" }, description: "Điều người nhập cần soát lại, câu ngắn tiếng Việt." },
  },
} as const;

// QUY ƯỚC PHIẾU rút từ phiếu thật — mỗi điều ghi nguồn đối chiếu. Thêm điều mới khi soát
// một phiếu đọc sai (docs/ops/openai-ocr.md § Quy ước phiếu của xưởng).
const SYSTEM_PROMPT = `Bạn đọc ảnh phiếu nhập nguyên liệu thủy sản viết tay của xí nghiệp Baseafood (Việt Nam), mẫu in "BÁO CÁO TỔNG HỢP NGUYÊN LIỆU HẰNG NGÀY" (cột STT · TÊN ĐẠI LÝ · LOẠI NGUYÊN LIỆU · SỐ LƯỢNG · ĐƠN GIÁ · GHI CHÚ).
Nhiệm vụ: chép lại chữ trên phiếu và bóc các ô để điền form nhập hàng.

QUY ƯỚC PHIẾU CỦA XƯỞNG (đã đối chiếu với sổ thật):
1. Xưởng ghi ở góc trên dưới tên công ty: "PXĐ" = phân xưởng Đông, "PXC" = Cá, "PXK" = Khô. Không ghi ⇒ null, đừng đoán theo loại hàng.
2. Ngày ghi "NGÀY dd THÁNG mm NĂM yy": năm 2 chữ số là 20yy ("26" ⇒ 2026).
3. Tên đại lý hay viết tắt chữ đầu: "H Phú" = "Hồng Phú". Chọn nhãn trong DANH MỤC ĐẠI LÝ khớp chữ đầu + phần tên còn lại; nhiều nhãn cùng khớp mà không phân biệt được ⇒ null.
4. Tài xế và biển số thường ghi ở cột GHI CHÚ, không có nhãn: dòng có dạng "51M 05772" là biển số; dòng là tên người ("Phạm H Khánh") là tài xế. Tên đệm hay viết tắt một chữ ("H" = "Hoàng"): nếu khớp một tên trong TÀI XẾ ĐÃ GHI (cùng họ, cùng tên, chữ đầu tên đệm trùng) thì chép y tên đó.
5. Loại nguyên liệu viết tắt: "1Da" / "1 da" = "1 da"; "2Da" = "2 da"; "NL" = nguyên liệu (bỏ qua). "80↑" / "80 lên" = cỡ lớn (80↑); "80↓" / "80 xuống" = cỡ nhỏ (80↓). Loài (bạch tuộc, mực…) thường không ghi: lấy theo LỊCH SỬ GIAO của đại lý đó, rồi chọn tên trong DANH MỤC LOẠI NL khớp đúng số da + cỡ (vd "2Da NL 80↑" của Hồng Phú = "Bạch tuộc 2 da lớn (80↑)").
6. Số lượng là KG. Dấu "." HOẶC "," đứng trước đúng 3 chữ số là dấu NGHÌN: "2.014" = 2014, "11,017" = 11017, "1.379" = 1379. Chỉ coi là thập phân khi sau dấu có 1–2 chữ số ("12,5").
7. Đơn giá ghi tắt theo NGHÌN đồng/kg: "158" = 158000. Cột thành tiền (nếu có) không phải đơn giá; chỉ có thành tiền thì đơn giá = thành tiền ÷ kg. Không ghi giá ⇒ null.
8. Số ở chân cột SỐ LƯỢNG (vd "14,410") là TỔNG — trả ở "totalKg", không phải một dòng hàng. Tổng các dòng phải bằng tổng này; lệch thì đọc lại từng số, vẫn lệch thì ghi vào "warnings".
9. Ghi chú kiểu "Nội tạng 1.000 kg", "Dạt 200 kg" là PHẾ LIỆU cân gộp: trả ở "scraps" (tên chọn trong danh sách PHẾ LIỆU), KHÔNG đưa vào "lines".
10. Phiếu có NHIỀU đại lý (nhiều nhóm STT): chỉ lấy đại lý ĐẦU TIÊN cùng các dòng của nó, và ghi vào "warnings" tên các đại lý còn lại để người nhập ghi chuyến riêng.

Quy tắc trả kết quả:
- "text": chép nguyên văn mọi hàng chữ đọc được, mỗi hàng một dòng.
- "raw" và "lines[].raw": chép Y NGUYÊN chữ trên phiếu của ô đó (giữ viết tắt, dấu chấm/phẩy, mũi tên) — người nhập đặt cạnh ảnh để đối chiếu, KHÔNG sửa hay khớp danh mục ở đây.
- "supplier", "materialType", "workshop", "scraps[].name": CHỈ chép y một mục có trong danh sách được cho; "licensePlate", "driverName": chép y mục trong XE ĐÃ GHI / TÀI XẾ ĐÃ GHI nếu khớp, không thì chép như trên phiếu (biển dạng "51M-05772").
- Không đoán bừa: thà để null / bỏ dòng còn hơn sai — người nhập soát lại từng ô.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Chặn người không có vai trò (cổng JWT của Supabase đã chặn người chưa đăng nhập).
  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: hasRole, error: roleError } = await sb.rpc("co_vai_tro");
  if (roleError || hasRole !== true) return json(403, { error: "forbidden" });

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json(503, { error: "missing_key", message: "Chưa đặt OPENAI_API_KEY ở Supabase secrets." });

  let body: {
    image?: unknown;
    suppliers?: unknown;
    materialTypes?: unknown;
    knownPlates?: unknown;
    knownDrivers?: unknown;
    workshops?: unknown;
    supplierHistory?: unknown;
    scrapTypes?: unknown;
    year?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }
  const image = typeof body.image === "string" ? body.image : "";
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(image) || image.length > MAX_IMAGE_CHARS)
    return json(400, { error: "bad_image" });
  const asList = (v: unknown) =>
    (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string").slice(0, MAX_CATALOG_ITEMS);
  const suppliers = asList(body.suppliers);
  const materialTypes = asList(body.materialTypes);
  const knownPlates = asList(body.knownPlates);
  const knownDrivers = asList(body.knownDrivers);
  const workshops = asList(body.workshops);
  const supplierHistory = asList(body.supplierHistory);
  const scrapTypes = asList(body.scrapTypes);
  const year = typeof body.year === "number" && body.year > 2000 && body.year < 2100 ? body.year : new Date().getFullYear();

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
  const userText =
    `Năm hiện tại: ${year}.\n\nDANH MỤC ĐẠI LÝ (mã · tên):\n${suppliers.join("\n") || "(trống)"}\n\n` +
    `DANH MỤC LOẠI NL:\n${materialTypes.join("\n") || "(trống)"}\n\n` +
    `XƯỞNG: ${workshops.join(", ") || "(không có)"}\n\n` +
    `PHẾ LIỆU: ${scrapTypes.join(", ") || "(không có)"}\n\n` +
    `LỊCH SỬ GIAO (đại lý: loại hay giao (giá gần nhất)):\n${supplierHistory.join("\n") || "(trống)"}\n\n` +
    `XE ĐÃ GHI:\n${knownPlates.join("\n") || "(trống)"}\n\n` +
    `TÀI XẾ ĐÃ GHI:\n${knownDrivers.join("\n") || "(trống)"}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: image, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "import_slip", strict: true, schema: RESULT_SCHEMA } },
    }),
  });
  if (!res.ok) {
    // Không trả nguyên văn lỗi OpenAI (có thể lộ thông tin tài khoản) — chỉ mã.
    console.error("openai_error", res.status);
    return json(502, { error: "openai_error", status: res.status });
  }
  const completion = await res.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return json(502, { error: "empty_result" });
  try {
    return json(200, { ...JSON.parse(content), model });
  } catch {
    return json(502, { error: "bad_result" });
  }
});
