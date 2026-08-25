// Service Worker لمنصة الإنتاجية المتقدمة
// مسؤول فقط عن تخزين "هيكل" التطبيق (الصفحة + الأيقونات) عشان يفتح حتى من غير نت.
// ملاحظة: تخزين الصوتيات (القرآن) بيتم بشكل منفصل جوه التطبيق نفسه (quran-audio-v1)
// وده مش بيتأثر بالكاش هنا.

const APP_SHELL_CACHE = 'app-shell-v1';

// عدّل الاسم ده لو هتغيّر اسم ملف الـ HTML الرئيسي بعد الرفع
const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      return Promise.all(
        APP_SHELL_FILES.map((url) =>
          cache.add(url).catch(() => {
            // لو ملف مش موجود بنفس الاسم، نتجاهله بدل ما نفشل التثبيت كله
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('app-shell-') && key !== APP_SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // نسيب طلبات غير GET وطلبات من نطاقات تانية (زي API القرآن) تعدي عادي من غير تدخل
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first للصفحة الرئيسية عشان أي تحديث ينزل فورًا، مع fallback للكاش لو مفيش نت
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first لباقي ملفات الهيكل (أيقونات، مانيفست)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, resClone));
        return res;
      }).catch(() => cached);
    })
  );
});
