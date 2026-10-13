# Nhắc ghi chép mỗi ngày (thông báo đẩy)

Mỗi ngày một thông báo trên điện thoại, đúng giờ bạn chọn, để bạn không quên ghi thu chi. Thông báo là **một trong 10 câu nhắc**, chọn ngẫu nhiên (không bao giờ lặp lại câu của hôm qua), và **tự bỏ qua nếu hôm nay bạn đã ghi chép rồi**. Bật/tắt và đổi giờ ngay trong **Cài đặt → Nhắc ghi chép**.

## 1. Tổng quan

| | |
|---|---|
| Tần suất | Tối đa **1 thông báo mỗi ngày** |
| Giờ nhắc | Bạn chọn, bội số của 15 phút (07:00, 21:15…), giờ Việt Nam. Có thể đến trễ tối đa khoảng 15 phút |
| Bật/tắt | Công tắc trong Cài đặt; tắt là không gửi gì nữa |
| Nội dung | 10 câu nhắc nhẹ nhàng, chọn ngẫu nhiên, không trùng câu hôm qua |
| Khi nào **không** nhắc | Hôm nay đã có giao dịch, hoặc đã bấm "Không chi tiêu"; đã tắt nhắc; chưa có thiết bị nào đăng ký |
| Bấm vào thông báo | Mở app và hiện sẵn form ghi khoản chi (`/?add=expense`) |
| Nền tảng | Android (Chrome) là chính. Máy tính (Chrome/Edge) dùng được. iPhone chỉ nhận khi đã **Thêm vào Màn hình chính** |

## 2. Cách hoạt động

```
Supabase pg_cron  ── mỗi 15 phút ──▶  POST /api/reminders/run   (Vercel, kèm CRON_SECRET)
                                            │
                     ┌──────────────────────┴──────────────────────────────────────┐
                     │ 1. Đọc reminder_settings: ai đang bật, đã đến giờ chưa       │
                     │ 2. "Giữ chỗ" ngày hôm nay (last_sent_on) để không gửi trùng  │
                     │ 3. Hôm nay đã ghi chép / đã đánh dấu "Không chi tiêu"? → bỏ qua│
                     │ 4. Chọn ngẫu nhiên 1 câu (khác câu hôm qua)                  │
                     │ 5. Gửi Web Push tới mọi thiết bị đã đăng ký                  │
                     │ 6. Thiết bị đã gỡ app (404/410) → tự xoá khỏi danh sách      │
                     └──────────────────────────────────────────────────────────────┘
                                            │
                  Dịch vụ push của Google/Mozilla ──▶ service worker (public/sw.js)
                                            │
                                  Điện thoại hiện thông báo → bấm → mở app
```

Vì sao cần Supabase **và** Vercel: Supabase giữ lịch hẹn giờ (pg_cron) và dữ liệu; còn việc ký và gửi Web Push (khoá VAPID) chạy bằng code của app trên Vercel. Mọi thứ nằm trong gói miễn phí, không cần cron của Vercel (gói Hobby chỉ cho chạy 1 lần/ngày).

Một thông báo được coi là "đến giờ" từ giờ bạn chọn cho tới **3 tiếng sau** (nhưng không qua nửa đêm). Nhờ vậy nếu cron lỡ một nhịp thì thông báo vẫn được gửi bù, mà không bao giờ nhắc vào lúc quá muộn.

## 3. Các thành phần trong mã nguồn

| File | Việc |
|---|---|
| [`lib/reminders.ts`](../lib/reminders.ts) | 10 câu nhắc, hàm chọn câu, hàm "đã đến giờ chưa", kiểm tra giờ hợp lệ (không phụ thuộc gì, có test) |
| [`lib/dates.ts`](../lib/dates.ts) | `appClockAt`: ngày + phút trong ngày theo giờ Việt Nam |
| [`app/api/reminders/run/route.ts`](../app/api/reminders/run/route.ts) | Route cron gọi mỗi 15 phút; kiểm tra `CRON_SECRET` |
| [`lib/push.ts`](../lib/push.ts) | Gửi Web Push (thư viện `web-push`), dọn thiết bị đã hết hạn |
| [`lib/actions/reminders.ts`](../lib/actions/reminders.ts) | Server action: lưu cài đặt, đăng ký/gỡ thiết bị, gửi thử |
| [`lib/supabase/admin.ts`](../lib/supabase/admin.ts) | Client dùng service key, **chỉ** cho route cron |
| [`public/sw.js`](../public/sw.js) | Service worker: hiện thông báo và mở app khi bấm |
| [`components/settings/reminder-settings.tsx`](../components/settings/reminder-settings.tsx) | Giao diện trong Cài đặt |
| [`components/ui/switch.tsx`](../components/ui/switch.tsx) | Công tắc bật/tắt |
| [`lib/push-client.ts`](../lib/push-client.ts) | Phần trình duyệt: kiểm tra hỗ trợ, đăng ký push |
| [`supabase/schema.sql`](../supabase/schema.sql) (mục 9) | Bảng `reminder_settings`, `push_subscriptions` (có RLS) |
| [`supabase/reminders-cron.sql`](../supabase/reminders-cron.sql) | Đặt lịch pg_cron + câu lệnh kiểm tra |
| [`tests/reminders.test.ts`](../tests/reminders.test.ts) | Test chọn câu, giờ nhắc, múi giờ |

### Dữ liệu

- **`reminder_settings`** (1 dòng/tài khoản): `enabled`, `remind_at` (giờ nhắc), `last_sent_on` (ngày đã nhắc gần nhất), `last_message` (số thứ tự câu đã gửi lần trước).
- **`push_subscriptions`** (1 dòng/thiết bị): địa chỉ nhận thông báo của trình duyệt (`endpoint`) và hai khoá mã hoá (`p256dh`, `auth`).

Cả hai bảng bật Row Level Security: bạn chỉ thấy dữ liệu của mình. Route cron dùng service key nên đọc được tất cả (xem mục 8).

## 4. Cài đặt lần đầu

Làm theo thứ tự.

### Bước 1. Tạo cặp khoá VAPID

```bash
npx web-push generate-vapid-keys
```

Lệnh in ra **Public Key** và **Private Key**. Giữ kín Private Key.

### Bước 2. Điền biến môi trường

Thêm vào `.env.local` (chạy trên máy) **và** Vercel → Settings → Environment Variables (chạy thật). Mẫu có trong [`.env.example`](../.env.example).

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public Key ở bước 1 |
| `VAPID_PRIVATE_KEY` | Private Key ở bước 1 |
| `VAPID_SUBJECT` | `mailto:email-của-bạn` |
| `CRON_SECRET` | Chuỗi ngẫu nhiên dài, ví dụ lấy bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **secret key** (service_role). **Chỉ** đặt ở máy chủ; tuyệt đối không thêm tiền tố `NEXT_PUBLIC_` |

Sau khi sửa biến trên Vercel phải **Redeploy** (biến `NEXT_PUBLIC_` được đóng gói lúc build).

### Bước 3. Tạo bảng

Supabase → **SQL Editor** → dán toàn bộ [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. Chạy lại nhiều lần không mất dữ liệu.

### Bước 4. Deploy lên Vercel

Đẩy code lên GitHub để Vercel tự deploy (xem README mục 3).

### Bước 5. Bật pg_cron và pg_net

Supabase → **Database → Extensions** → tìm và bật **`pg_cron`** và **`pg_net`**.

### Bước 6. Đặt lịch

Mở [`supabase/reminders-cron.sql`](../supabase/reminders-cron.sql), thay `<CRON_SECRET>` bằng đúng chuỗi đã dùng ở bước 2, rồi dán vào SQL Editor → **Run**. Từ giờ cứ 15 phút Supabase tự gọi app một lần. Khoá bí mật được cất trong Supabase Vault, không nằm trong câu lệnh cron.

### Bước 7. Bật trên điện thoại

1. Mở `https://ct9-personal-finance.vercel.app` bằng **Chrome trên Android** và đăng nhập.
2. (Khuyên dùng) Menu ⋮ → **Cài đặt ứng dụng** / **Thêm vào màn hình chính**, rồi mở app từ biểu tượng mới. Thông báo ổn định hơn khi app đã được cài.
3. **Cài đặt → Nhắc ghi chép** → gạt công tắc **Bật** → bấm **Cho phép** khi Chrome hỏi quyền thông báo.
4. Chọn giờ nhắc (Sáng / Trưa / Chiều / Tối hoặc "Giờ khác").
5. Bấm **Gửi thử thông báo**: vài giây sau điện thoại phải hiện thông báo.

Muốn nhận trên nhiều thiết bị (điện thoại và máy tính) thì làm bước 7 trên từng thiết bị; mỗi thiết bị tự đăng ký riêng.

## 5. Cách test

Test từ dễ đến khó. Bước nào lỗi thì dừng và xem mục 7.

### 5.1. Test logic (không cần mạng)

```bash
npm test
```

`tests/reminders.test.ts` kiểm tra: có đúng 10 câu khác nhau; câu được chọn **không bao giờ** trùng câu hôm qua và mọi câu đều có thể được chọn; giờ nhắc chỉ nhận bội số 15 phút; "đến giờ" đúng trong khoảng 3 tiếng, chỉ một lần mỗi ngày, không tràn qua nửa đêm; giờ Việt Nam đúng quanh nửa đêm.

### 5.2. Đăng ký và thông báo (trên máy hoặc điện thoại)

Chạy `npm run dev` rồi vào `http://localhost:3000/settings` bằng Chrome trên máy tính (localhost được trình duyệt coi là an toàn nên Web Push chạy được). Bật nhắc → **Gửi thử thông báo**. Thấy thông báo hiện lên là phần khoá VAPID, service worker và đăng ký thiết bị đã đúng.

Trên điện thoại thì test với bản đã deploy (điện thoại không vào được `localhost` của máy tính).

### 5.3. Route cron (kiểm tra luồng gửi hằng ngày)

Cần ba biến môi trường ở mục 4 trong `.env.local`. Chạy `npm run dev`, rồi:

1. Ép "đã đến giờ" bằng SQL Editor (đặt giờ nhắc về đầu giờ hiện tại và xoá dấu "đã nhắc hôm nay"):
   ```sql
   update public.reminder_settings
   set remind_at = date_trunc('hour', now() at time zone 'Asia/Ho_Chi_Minh')::time,
       last_sent_on = null
   where enabled;
   ```
2. Gọi route:
   ```bash
   curl.exe -X POST http://localhost:3000/api/reminders/run -H "Authorization: Bearer <CRON_SECRET>"
   ```
3. Đọc kết quả:

| Kết quả | Ý nghĩa |
|---|---|
| `{"checked":1,"sent":1,…}` + có thông báo | Hoạt động đúng |
| Gọi lần 2 ngay sau đó: `{"checked":0,…}` | Đúng: mỗi ngày chỉ gửi một lần |
| `"skippedLogged":1` | Hôm nay bạn đã có giao dịch hoặc đã đánh dấu "Không chi tiêu" nên bỏ qua. Muốn thử gửi thì xoá giao dịch hôm nay hoặc thử vào ngày khác |
| `"skippedNoDevice":1` | Chưa có thiết bị nào đăng ký (làm lại mục 5.2) |
| Mã `401` | Sai `CRON_SECRET` |
| Mã `500` `push not configured` | Thiếu một trong các biến VAPID / `SUPABASE_SERVICE_ROLE_KEY` |

Để thử lại sau khi đã gửi: chạy lại câu SQL ở bước 1.

### 5.4. Lịch pg_cron thật (chỉ làm được trên bản đã deploy)

Supabase không gọi được `localhost`, nên bước này dùng địa chỉ Vercel.

1. Gọi thử một lần ngay trong SQL Editor (câu lệnh có sẵn trong `reminders-cron.sql`, phần "Gọi thử ngay").
2. Xem phản hồi: `select id, status_code, content, created from net._http_response order by created desc limit 5;` → `status_code` phải là **200**.
3. Xem lịch sử: `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;` → `status` là `succeeded`.
4. Muốn xem thông báo đến đúng nhịp: tạm đổi lịch sang mỗi phút bằng câu `cron.alter_job` trong file, đặt giờ nhắc về đầu giờ (câu SQL ở mục 5.3), chờ 1–2 phút, **rồi nhớ đổi lại `*/15 * * * *`**.

### 5.5. Trên điện thoại thật

Đóng hẳn app (vuốt tắt khỏi danh sách ứng dụng gần đây) rồi chờ đến giờ nhắc. Thông báo vẫn phải hiện; bấm vào phải mở app với form ghi khoản chi.

### 5.6. Các tình huống cần thử

| Tình huống | Kết quả đúng |
|---|---|
| Tắt công tắc | Đến giờ không có thông báo |
| Hôm nay đã ghi 1 giao dịch | Không có thông báo |
| Hôm nay bấm "Không chi tiêu" | Không có thông báo |
| Từ chối quyền thông báo | Công tắc không bật được, hiện hướng dẫn mở lại quyền |
| Gỡ app / xoá dữ liệu trình duyệt rồi để cron chạy | Thiết bị tự bị xoá khỏi `push_subscriptions` |
| Đổi giờ nhắc | Lưu ngay, thông báo đến giờ mới |
| Nhiều ngày liên tiếp | Mỗi ngày một câu, không bao giờ giống hôm qua |

## 6. 10 câu nhắc và cách sửa

Danh sách nằm ở `REMINDER_MESSAGES` trong [`lib/reminders.ts`](../lib/reminders.ts):

1. Hôm nay bạn đã ghi chi tiêu chưa? Chỉ mất vài giây thôi.
2. Một khoản nhỏ cũng đáng ghi lại. Mở app ghi nhanh nhé!
3. Ly cà phê, bữa trưa, tiền xăng… hôm nay bạn đã ghi chưa?
4. Ghi ngay khi còn nhớ, cuối tháng bạn sẽ cảm ơn chính mình.
5. Chuỗi ngày ghi chép đang chờ bạn. Ghi một khoản để giữ lửa nhé!
6. Hôm nay không chi gì? Bấm "Không chi tiêu" để giữ chuỗi.
7. Hôm nay còn được chi bao nhiêu? Ghi lại để biết con số chính xác.
8. Mỗi ngày một phút, tiền bạc rõ ràng cả tháng.
9. Đừng để cuối tuần mới ngồi nhớ lại từng khoản. Ghi luôn bây giờ nhé!
10. Thói quen nhỏ, kết quả lớn. Ghi thu chi hôm nay nào!

Muốn sửa câu: chỉnh trực tiếp trong mảng đó (giữ nguyên **10 câu**, mỗi câu ngắn gọn, nên dưới 100 ký tự để không bị cắt trên màn hình khoá), chạy `npm test`, rồi deploy. Không cần đổi gì trong Supabase. Tiêu đề thông báo là `REMINDER_TITLE` ở cùng file.

## 7. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Thẻ báo "Chưa bật tính năng nhắc" | Chưa chạy schema mới | Chạy lại `supabase/schema.sql` |
| Báo "Chưa cấu hình khoá thông báo" | Thiếu `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ở bản build | Thêm biến rồi **Redeploy** |
| Công tắc xám, không bật được | Trình duyệt chặn thông báo, hoặc không hỗ trợ | Cho phép thông báo của trang trong cài đặt trình duyệt; iPhone cần Thêm vào Màn hình chính |
| "Gửi thử" báo chưa có thiết bị | Chưa đăng ký trên thiết bị này | Tắt rồi bật lại công tắc, hoặc bấm "Bật trên thiết bị này" |
| "Gửi thử" chạy nhưng không thấy thông báo | Chế độ không làm phiền, tiết kiệm pin, hoặc thông báo của Chrome bị tắt trong Cài đặt Android | Bật thông báo cho Chrome/app; tắt tối ưu pin cho Chrome |
| Gửi thử được nhưng đến giờ không có | Cron chưa chạy hoặc sai khoá | Xem `net._http_response` (mục 5.4): `401` = `CRON_SECRET` trên Vercel khác giá trị trong Vault; `500` = thiếu biến môi trường |
| Thông báo đến trễ | Cron chạy mỗi 15 phút; Android có thể hoãn khi tiết kiệm pin | Bình thường tới ~15 phút; tắt tối ưu pin cho Chrome |
| Cron báo `succeeded` nhưng `status_code` trống | pg_net chưa kịp gọi hoặc URL sai | Kiểm tra URL trong `reminders-cron.sql` |
| Mất nhắc sau thời gian dài không dùng | Gói Supabase miễn phí tạm dừng project sau 7 ngày không truy cập | Vào dashboard bấm Restore (xem README) |
| Đổi khoá VAPID | Thiết bị cũ không nhận được nữa | Trên từng thiết bị: "Gỡ thiết bị này" rồi bật lại |

## 8. Bảo mật và giới hạn

- **Route cron** chỉ nhận yêu cầu có đúng `Authorization: Bearer <CRON_SECRET>` (so sánh an toàn thời gian); không có hay sai khoá đều bị từ chối `401`. Đường dẫn này được mở khỏi cổng đăng nhập của proxy vì pg_cron không có phiên đăng nhập.
- **Service key** (`SUPABASE_SERVICE_ROLE_KEY`) bỏ qua mọi quy tắc RLS. Nó chỉ nằm trong biến môi trường của máy chủ, chỉ được dùng ở [`lib/supabase/admin.ts`](../lib/supabase/admin.ts) (có `server-only`) cho route cron. Lộ khoá này là lộ toàn bộ dữ liệu: đừng đưa vào Git, đừng thêm `NEXT_PUBLIC_`.
- **Nội dung thông báo** chung chung, không có số tiền hay tên khoản, vì nó hiện trên màn hình khoá.
- **Không bao giờ gửi nhiều hơn 1 lần/ngày**: ngày hôm nay được "giữ chỗ" trong `last_sent_on` trước khi gửi, nên hai lần gọi chồng nhau cũng không gửi trùng. Nếu gửi thất bại hoàn toàn, ngày đó được trả lại để lần cron sau (trong 3 tiếng) thử lại.
- **Giới hạn**: giờ nhắc tối thiểu 15 phút một nấc; thông báo là "nỗ lực tốt nhất" (Android có thể hoãn khi tiết kiệm pin); iPhone cần thêm app vào Màn hình chính và iOS 16.4 trở lên.
- **Ứng dụng một người dùng**: code vẫn xử lý đúng từng tài khoản riêng, nhưng chưa có giao diện quản trị nhiều người.
- **Gỡ bỏ hoàn toàn**: `select cron.unschedule('ct9-reminders');` để dừng lịch; tắt công tắc trong Cài đặt để dừng nhắc mà vẫn giữ dữ liệu.
