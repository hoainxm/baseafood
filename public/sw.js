// ============================================================
// Baseafood MES — Service Worker (PWA)
// Chiến lược: NETWORK-FIRST, dự phòng cache khi mất mạng.
//  - Chỉ đụng request GET cùng origin (bỏ qua Google Fonts, Supabase…).
//  - version.json luôn lấy mạng, KHÔNG cache — để cơ chế nhắc bản mới
//    (version.json + UpdateBanner) không bị kẹt số cũ.
//  - Điều hướng (navigate) mất mạng → trả trang gốc "/" đã cache (offline shell).
// SW này chỉ đăng ký ở bản PRODUCTION (xem src/main.tsx) — dev không đăng ký.
// ============================================================
const CACHE = "baseafood-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fonts / Supabase / CDN: để mạng lo
  if (url.pathname.endsWith("/version.json")) return; // luôn lấy mạng, giữ cơ chế nhắc bản mới

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Chỉ cache phản hồi hợp lệ, cùng origin.
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode === "navigate") return caches.match("/");
          return Response.error();
        })
      )
  );
});
