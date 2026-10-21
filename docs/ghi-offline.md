# Ghi thu chi khi mất mạng

Không có sóng (thang máy, hầm xe, vùng sâu) vẫn ghi được khoản thu chi. Khoản ghi được **lưu trên điện thoại** và **tự gửi lên máy chủ khi có mạng**, kể cả khi app đã đóng (Android Chrome). Không cần cài đặt hay cấu hình gì thêm.

## 1. Tổng quan

| | |
|---|---|
| Khi nào dùng | Mở app (biểu tượng, lối tắt "Ghi chi"/"Ghi thu", thông báo nhắc) mà điện thoại không có mạng |
| Màn hình | Trang **Ghi nhanh khi mất mạng**: số tiền, khoản mục, phân loại, ngày, ghi chú, danh sách **Chờ gửi** |
| Lưu ở đâu | IndexedDB trên chính điện thoại đó, đến khi gửi xong |
| Khi nào gửi | Có mạng lại: Android Chrome tự gửi nền (Background Sync), kể cả khi app đã đóng. Mọi trình duyệt: gửi khi mở app, khi có sự kiện "online", hoặc bấm **Gửi ngay** |
| Gửi trùng | Không thể: mỗi khoản có mã riêng tạo trên máy, gửi lại lần hai máy chủ coi như đã có |
| Điều kiện | Đã mở app **ít nhất một lần khi có mạng và đã đăng nhập** trên máy đó (để có danh sách khoản mục) |
| Nền tảng | Android Chrome đầy đủ. iPhone/Safari: ghi được, nhưng chỉ gửi khi mở lại app (Safari không có gửi nền) |

## 2. Hai lớp xử lý mất mạng

| Tình huống | Lớp xử lý | Kết quả |
|---|---|---|
| App **đang mở**, mạng rớt lúc bấm Lưu | `experimental.useOffline` của Next.js ([`next.config.ts`](../next.config.ts)) + dải báo [`components/app/offline-banner.tsx`](../components/app/offline-banner.tsx) | Yêu cầu Lưu được giữ lại và tự chạy một lần khi có mạng. Tắt app lúc đang chờ thì mất |
| **Mở app khi không có mạng** (trang không tải được) | Service worker trả về [`public/offline.html`](../public/offline.html), lưu vào hàng đợi trên máy | Khoản ghi nằm trên máy, tắt app vẫn còn, tự gửi khi có mạng |

Tài liệu này nói về lớp thứ hai.

## 3. Cách hoạt động

```
  Có mạng, đã đăng nhập                         Không có mạng
  ─────────────────────                         ─────────────
  App mở ─▶ OfflineSupport                       Mở app / lối tắt
     │  1. đăng ký /sw.js                            │
     │  2. gửi "snapshot" (danh sách khoản mục)      ▼
     ▼                                           sw.js: tải trang lỗi mạng
  sw.js ─▶ IndexedDB  meta.snapshot              ─▶ trả offline.html (từ cache)
     │     cache: offline.html, offline-db.js        │
     │                                               ▼
     │                                           Người dùng nhập, bấm "Lưu trên máy"
     │                                           ─▶ IndexedDB  queue (status: pending)
     │                                           ─▶ đăng ký Background Sync "ct9-flush"
     │
     └──────────── Có mạng lại ◀──────────────────────┘
                        │  (sync nền / mở app / "online" / bấm Gửi ngay)
                        ▼
        sw.js: gửi lần lượt từng khoản  POST /api/offline/transactions
                        │
        200 ─▶ xoá khỏi hàng đợi           401 / chuyển hướng /login ─▶ giữ lại, chờ đăng nhập
        409 ─▶ đánh dấu "tài khoản khác"    422 ─▶ đánh dấu lỗi kèm lý do (người dùng xoá được)
        5xx / lỗi mạng ─▶ dừng, thử lại sau
                        │
                        ▼
        Báo cho app đang mở (toast + tải lại số liệu); app đóng thì hiện thông báo (nếu đã cho phép)
```

## 4. Các thành phần trong mã nguồn

| File | Việc |
|---|---|
| [`public/offline.html`](../public/offline.html) | Trang ghi nhanh offline. HTML + JS thuần (không React, không cần máy chủ), giao diện sáng/tối theo cài đặt của app |
| [`public/offline-db.js`](../public/offline-db.js) | Kho IndexedDB `ct9-offline` dùng chung cho trang offline và service worker (`self.CT9Offline`) |
| [`public/sw.js`](../public/sw.js) | Service worker: lưu sẵn trang offline, trả trang đó khi không tải được trang, gửi hàng đợi (sự kiện `sync`, tin nhắn `ct9-flush`), cùng phần thông báo nhắc có từ trước |
| [`components/app/offline-support.tsx`](../components/app/offline-support.tsx) | Phần trong app: đăng ký service worker mỗi lần mở app, gửi snapshot khoản mục, báo khi đồng bộ xong |
| [`app/(app)/layout.tsx`](../app/(app)/layout.tsx) | `ComposerLoader` dựng snapshot từ danh mục khoản mục và gắn `OfflineSupport` (chỉ khi danh mục tải thành công) |
| [`lib/offline-sync.ts`](../lib/offline-sync.ts) | Phần thuần, có test: dựng snapshot, đọc gói dữ liệu gửi lên, kiểm tra yêu cầu cùng nguồn |
| [`app/api/offline/transactions/route.ts`](../app/api/offline/transactions/route.ts) | API nhận một khoản ghi offline |
| [`app/login/login-form.tsx`](../app/login/login-form.tsx) | Ở trang đăng nhập (đã đăng xuất): báo service worker xoá snapshot khoản mục (`ct9-forget`) |
| [`proxy.ts`](../proxy.ts) | Cho `offline.html` và `offline-db.js` đi qua khi chưa đăng nhập (không chứa dữ liệu) |
| [`tests/offline-sync.test.ts`](../tests/offline-sync.test.ts) | Test snapshot, gói dữ liệu, kiểm tra nguồn, và trang offline có đủ phân loại giống app |

## 5. Dữ liệu trên máy

IndexedDB tên **`ct9-offline`** (xem trong Chrome DevTools → Application → IndexedDB):

| Kho | Khoá | Nội dung |
|---|---|---|
| `queue` | `id` | Khoản chờ gửi: `id` (UUID tạo trên máy, cũng là id giao dịch khi lưu), `user_id`, `kind`, `item_id`, `item_name`, `category`, `amount`, `occurred_on`, `note`, `created_at`, `status` (`pending` / `failed` / `other_account`), `error` |
| `meta` | `snapshot` | `{ userId, items: [{ id, kind, name, category }], savedAt }`: khoản mục đang dùng (bỏ khoản đã ẩn), dùng nhiều nhất trước; `category` là phân loại lần ghi gần nhất, không có thì lấy mặc định |
| `meta` | `sync` | `{ needsLogin, lastTriedAt }`: lần gửi gần nhất có bị yêu cầu đăng nhập không |

Cache của service worker: **`ct9-offline-v2`** chứa `/offline.html`, `/offline-db.js`, `/icon.svg`. Mỗi lần mở app khi có mạng, các file này được tải lại để luôn mới. Service worker **không bao giờ** lưu trang hay dữ liệu của app.

Snapshot được làm mới mỗi lần mở app khi có mạng, và bị xoá khi về trang đăng nhập (đăng xuất). Khoản đang chờ gửi thì **không** bị xoá khi đăng xuất.

## 6. API `POST /api/offline/transactions`

Gọi bởi service worker, một khoản mỗi lần, kèm cookie đăng nhập.

```json
{
  "id": "0b7e3c1e-5d2a-4f6b-9c8d-1a2b3c4d5e6f",
  "user_id": "9f8e7d6c-5b4a-4321-8fed-cba987654321",
  "kind": "expense",
  "item_id": "11111111-2222-4333-8444-555555555555",
  "category": "essential",
  "amount": 45000,
  "occurred_on": "2026-10-21",
  "note": null
}
```

| Trả về | Nghĩa | Service worker làm gì |
|---|---|---|
| `200 { ok: true }` | Đã lưu | Xoá khỏi hàng đợi |
| `200 { ok: true, duplicate: true }` | Đã có từ lần gửi trước (trùng khoá chính) | Xoá khỏi hàng đợi |
| `307` về `/login` (từ proxy) hoặc `401` | Chưa đăng nhập / phiên hết hạn | Giữ lại, trang offline nhắc đăng nhập |
| `403` | Yêu cầu không đến từ chính trang này | Đánh dấu lỗi |
| `409` | Khoản được ghi bằng tài khoản khác với tài khoản đang đăng nhập | Đánh dấu `other_account` |
| `422` | Dữ liệu sai, hoặc khoản mục đã bị xoá | Đánh dấu lỗi kèm lý do |
| `5xx` | Máy chủ hoặc Supabase lỗi tạm thời | Dừng, thử lại sau |

Dữ liệu được kiểm tra bằng đúng `validateTransaction` như khi ghi trong app. Lưu thành công cũng bỏ đánh dấu "Không chi tiêu" của ngày đó (với khoản chi), giống trong app. **Không** có cảnh báo vượt ngân sách cho khoản gửi từ hàng đợi.

## 7. Bảo mật

- API chỉ chèn giao dịch cho **tài khoản đang đăng nhập** (`getUser()`, như `getSession()`), và RLS của Supabase vẫn áp dụng.
- Khoản có `user_id` khác tài khoản đang đăng nhập bị từ chối (`409`), nên đổi tài khoản trên cùng máy không đẩy nhầm dữ liệu.
- Kiểm tra cùng nguồn (`Sec-Fetch-Site` / `Origin`) chống giả mạo yêu cầu từ trang khác. Server Action có sẵn kiểm tra này, route handler thì phải tự làm.
- `offline.html` công khai nhưng không chứa dữ liệu. Tên khoản mục và các khoản chờ gửi chỉ nằm trong IndexedDB của máy đó. Tên khoản mục bị xoá khi đăng xuất.

## 8. Cách test

**Tự động:** `npm test` (gồm `tests/offline-sync.test.ts`).

**Trên máy tính (Chrome):**

1. `npm run build && npm run start`, mở `http://localhost:3000`, đăng nhập, mở Tổng quan một lần.
2. DevTools → **Application → Service workers**: thấy `/sw.js` đang chạy. **Application → IndexedDB → ct9-offline → meta**: có `snapshot`.
3. Tick **Offline** (trong Application → Service workers, để áp dụng cho cả service worker), rồi mở `http://localhost:3000/?add=expense`: hiện trang **Ghi nhanh khi mất mạng**.
4. Ghi một khoản → danh sách **Chờ gửi (1)**, trong IndexedDB `queue` có một dòng `pending`.
5. Bỏ tick Offline, bấm **Gửi ngay** (hoặc mở lại app): khoản biến khỏi danh sách, app hiện "Đã gửi 1 khoản ghi lúc mất mạng", khoản có trong Thu chi.

**Trên Android (bản đã deploy):** mở app một lần khi có mạng → bật chế độ máy bay → mở app từ biểu tượng → ghi một khoản → **đóng hẳn app** → tắt chế độ máy bay → chờ một lát: khoản tự lên (và có thông báo "Đã gửi … khoản" nếu đã bật thông báo).

## 9. Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Mất mạng mở app vẫn ra trang lỗi của Chrome | Service worker chưa cài (chưa từng mở app khi có mạng sau bản cập nhật này) | Mở app một lần khi có mạng |
| Trang offline báo "chưa có danh sách khoản mục" | Chưa có snapshot (chưa mở app khi đã đăng nhập, hoặc vừa đăng xuất) | Mở app khi có mạng và đăng nhập |
| "Cần đăng nhập để gửi" | Phiên đăng nhập hết hạn | Mở app, đăng nhập: khoản tự gửi |
| Khoản báo "Khoản mục không còn trong danh mục" | Khoản mục bị xoá sau khi ghi offline | Xoá khỏi danh sách chờ, ghi lại trong app |
| Khoản báo "tài khoản khác" | Ghi khi đang dùng tài khoản A, gửi khi đăng nhập tài khoản B | Đăng nhập lại tài khoản A, hoặc xoá khoản đó |
| Không tự gửi khi app đóng | iPhone/Safari không có gửi nền; hoặc Android tiết kiệm pin | Mở app khi có mạng là gửi |

## 10. Giới hạn

- Chỉ chọn được **khoản mục đã có** (từ lần mở app gần nhất khi có mạng). Tạo khoản mục mới cần có mạng.
- Ngày mặc định là hôm nay theo giờ Việt Nam, tính bằng đồng hồ của máy.
- Không có cảnh báo ngân sách và nút Hoàn tác cho khoản gửi từ hàng đợi. Muốn sửa thì sửa trong Thu chi sau khi đã gửi.
- Mở app khi không có mạng thì chỉ có trang ghi nhanh, chưa xem được số liệu.

## 11. Khi sửa code

- **Đổi phân loại** trong [`lib/categories.ts`](../lib/categories.ts): sửa cả mảng `CATEGORIES` trong `offline.html`. `npm test` báo lỗi nếu hai nơi lệch nhau.
- **Đổi giới hạn dữ liệu** (số tiền tối đa, độ dài ghi chú, khoảng ngày) trong [`lib/validation.ts`](../lib/validation.ts): sửa phần kiểm tra trong `offline.html` cho khớp. Máy chủ vẫn kiểm tra lại nên lệch cũng không ghi sai, chỉ báo lỗi muộn hơn.
- **Đổi danh sách file của trang offline** (thêm ảnh, file JS): thêm vào `OFFLINE_FILES` trong `sw.js`, loại khỏi `proxy.ts` nếu cần, và tăng `OFFLINE_CACHE` (`ct9-offline-v3`…).
- **Đổi cấu trúc IndexedDB**: tăng `DB_VERSION` trong `offline-db.js` và xử lý nâng cấp trong `onupgradeneeded`.
- `sw.js` được phục vụ với `Cache-Control: no-cache` ([`next.config.ts`](../next.config.ts)) nên bản mới tới điện thoại ở lần mở app kế tiếp.
