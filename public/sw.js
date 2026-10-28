// Service worker แบบเรียบง่าย: ไม่แคชข้อมูล (ข้อมูลต้องสดจาก Google Sheets เสมอ)
// แค่แสดงหน้า "ออฟไลน์" เมื่อเปิดแอปตอนไม่มีอินเทอร์เน็ต
const CACHE = "paradise-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
