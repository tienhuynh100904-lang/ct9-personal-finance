# CT9 Finance — Quản lý tài chính cá nhân

Ứng dụng web thay cho file Excel "Bảng theo dõi thu chi": ghi chép thu chi, lập ngân sách, phân tích bằng biểu đồ. Next.js 16 + Supabase, deploy trên Vercel. Chỉ có **đăng nhập**, không có đăng ký.

| Trang | Tương ứng trong Excel |
|---|---|
| **Tổng quan** `/` | **Thẻ "Hôm nay"**: còn được chi bao nhiêu hôm nay, chuỗi ngày ghi chép, dải 7 ngày, ghi nhanh một chạm. **Khoản định kỳ** đến hạn chờ xác nhận. Bên dưới: **cảnh báo ngân sách** (nhóm chi đạt 80% hoặc vượt), số liệu tháng, thanh ngân sách từng nhóm, cơ cấu chi tiêu, top khoản chi, xu hướng 12 tháng |
| **Thu chi** `/transactions` | (Trên điện thoại vào từ Tổng quan → "Xem tất cả"; máy tính có mục ở thanh bên.) Sheet *Thu Chi*: thêm / sửa / xoá giao dịch, lọc theo tháng, loại, phân loại, tìm kiếm không dấu, xuất và **nhập CSV** (cùng 5 cột, xem trước, bỏ qua dòng trùng, hoàn tác được) mở được bằng Excel |
| **Phân tích** `/analytics` | Sheet *Phân loại thu chi*: tổng quan cả năm, 5 biểu đồ, bảng 12 tháng (số tiền / tỷ trọng), chi tiết từng khoản mục |
| **Ngân sách** `/budget` | Sheet *Lập ngân sách*: dự kiến, thực tế, chênh lệch cho thu nhập, chi tiêu, tiết kiệm/đầu tư |
| **Mục tiêu** `/goals` | File *Theo dõi mục tiêu tài chính*: Quỹ khẩn cấp có sẵn + quỹ mục tiêu tự tạo; chia tiền tiết kiệm vào quỹ, tính số cần gửi mỗi tháng, lãi theo ngày, cột mốc 25/50/75/100%, đánh giá kế hoạch có khả thi |
| **Cài đặt** `/settings` | **Giao diện Sáng / Tối / Theo thiết bị**, **nhắc ghi chép mỗi ngày**, **giao dịch định kỳ**, danh mục khoản mục (mỗi giao dịch thuộc một khoản mục), đổi mật khẩu, đăng xuất |

## Thiết kế để bạn quen ghi chép mỗi ngày

Ứng dụng chỉ có giá trị khi dữ liệu đầy đủ, nên giao diện xoay quanh việc ghi nhanh và đều:

- **Ghi trong vài giây:** nút "Ghi" nổi ở giữa thanh dưới (vùng ngón cái); chạm một khoản trong **Ghi nhanh** là form mở sẵn khoản mục, phân loại và số tiền lần trước; nút Lưu luôn nằm trên bàn phím; có "Hoàn tác" ngay sau khi lưu.
- **Một lý do để mở app mỗi ngày:** "Hôm nay còn được chi" = (ngân sách chi tiêu tháng − đã chi các ngày trước) ÷ số ngày còn lại. Ghi một khoản chi là con số giảm ngay.
- **Bớt nhập lặp lại:** tiền nhà, điện nước, wifi, lương… đặt một lần thành **khoản định kỳ** (trong Cài đặt, hoặc tick "Lặp lại hằng tháng" khi ghi). Đến ngày, trang Tổng quan gợi ý sẵn: bấm **Xác nhận** (sửa được số tiền, ví dụ tiền điện tháng này) hoặc **Bỏ qua**. App không tự ghi khi bạn chưa xác nhận.
- **Xây quỹ từ tiền đã tiết kiệm:** mọi khoản ghi vào nhóm *Tiết kiệm/Đầu tư* thành "tiền chưa phân bổ" ở trang **Mục tiêu**. Chia số đó vào một hoặc nhiều quỹ (Quỹ khẩn cấp có sẵn, các quỹ khác tự tạo); app tính mỗi tháng cần gửi bao nhiêu để kịp hạn và kế hoạch có khả thi so với ngân sách tiết kiệm. Lấy tiền ra có hai cách: **Rút về tiết kiệm** (đổi kế hoạch, tiền quay về phần chưa phân bổ) và **Chi từ quỹ** (ghi luôn khoản chi vào Thu chi, tiền rời hẳn tiết kiệm). Khoản chi từ quỹ mặc định không trừ vào thặng dư tháng; tick “Tính cả chi từ quỹ” để tính.
- **Cảnh báo ngân sách:** khi một nhóm chi (thiết yếu, không thiết yếu, phát sinh) đạt **80%** hoặc **vượt** kế hoạch tháng, trang Tổng quan và Ngân sách hiện cảnh báo, và ngay lúc bạn lưu khoản chi làm vượt ngưỡng sẽ có thông báo.
- **Chuỗi ngày không bắt lỗi:** hôm nay chưa ghi thì chưa tính là bỏ lỡ; ngày thật sự không chi thì bấm **"Không chi tiêu"** để giữ chuỗi; quên một ngày thì **ghi bù** là chuỗi nối lại. Thông báo luôn nhẹ nhàng.
- **Chạm giữ biểu tượng app** (Android) để vào thẳng "Ghi khoản chi" / "Ghi khoản thu".
- **Giao diện sáng là mặc định**; đổi sang tối hoặc theo điện thoại trong **Cài đặt → Giao diện** (lưu trên từng thiết bị, không nháy màu khi mở).
- Điện thoại là ưu tiên: mọi nút ≥ 44px, hỗ trợ tai thỏ/thanh cử chỉ, tablet dùng cùng thanh điều hướng, desktop có thanh bên.

Công thức được giữ đúng như Excel (đã đối chiếu 390 ô với file gốc): *Thặng dư = Thu nhập − Chi tiêu − Tiết kiệm/Đầu tư*; "Tổng chi tiêu" không gồm tiết kiệm; trung bình/tháng chia 12. Khác biệt duy nhất: "Top khoản chi" tự tính mọi khoản mục đã dùng (bảng Excel cố định nên bỏ sót "Đi nhậu", "Trà sữa"), và mỗi năm được tính riêng.

---

## 1. Tạo database trên Supabase

1. Tạo project tại [supabase.com](https://supabase.com) (chọn region Singapore cho nhanh).
2. **SQL Editor → New query** → dán toàn bộ file [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Users → Add user → Create new user**: nhập email + mật khẩu của bạn, tick **Auto Confirm User**.
4. **Quan trọng — tắt đăng ký:** **Authentication → Sign In / Providers** → tắt **Allow new users to sign up**. (Dữ liệu vẫn được bảo vệ bằng Row Level Security, mỗi tài khoản chỉ thấy dữ liệu của mình, nhưng tắt đăng ký để không ai tạo được tài khoản.)

### Nhập dữ liệu từ file Excel hiện có (tuỳ chọn)

File `supabase/seed.local.sql` đã được tạo sẵn từ `doc/T10-T12-2026 (1).xlsx` (36 giao dịch, ngân sách 2026, 20 khoản mục). Sau bước 3 ở trên, mở **SQL Editor**, dán nội dung file đó và **Run**. Chạy lại cũng không bị nhân đôi.

> **Nâng cấp từ bản cũ:** các bản mới thêm bảng `day_marks` (ngày "Không chi tiêu"), `recurring_transactions` + `recurring_runs` và hàm `confirm_recurring` (giao dịch định kỳ), `goals` + `goal_allocations`, view `savings_pool`, hàm `allocate_savings`, `spend_from_goal`, cột `transactions.from_savings` và `goal_allocations.transaction_id` (mục tiêu / quỹ, chi từ quỹ). Chạy lại toàn bộ `supabase/schema.sql` trong SQL Editor, không mất dữ liệu. Chưa chạy thì app vẫn dùng bình thường: phần định kỳ được ẩn và trang Mục tiêu báo cần chạy lại schema.

Nếu muốn tạo lại từ file Excel mới hơn:

```bash
pip install openpyxl
python scripts/excel-to-sql.py "doc/ten-file.xlsx"
```

> `doc/` và `supabase/*.local.sql` nằm trong `.gitignore` vì chứa dữ liệu tài chính thật — đừng đưa lên GitHub.

## 2. Chạy trên máy

```bash
cp .env.example .env.local   # rồi điền 2 giá trị bên dưới
npm install
npm run dev                  # http://localhost:3000
```

Hai biến môi trường lấy ở **Supabase → Project Settings → API Keys** (hoặc nút **Connect**):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

(Project cũ dùng "anon key" cũng được: đặt tên `NEXT_PUBLIC_SUPABASE_ANON_KEY`.) Key này công khai được vì mọi bảng đều có RLS — **không** dùng `service_role`/secret key cho 2 biến trên. Ngoại lệ duy nhất là tính năng nhắc ghi chép: route cron cần `SUPABASE_SERVICE_ROLE_KEY` (biến riêng, chỉ ở máy chủ, xem mục 5).

## 3. Deploy lên Vercel

1. Đẩy code lên GitHub (repo private càng tốt).
2. [vercel.com/new](https://vercel.com/new) → import repo → framework tự nhận Next.js.
3. **Environment Variables**: thêm `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → **Deploy**.
4. Trong Supabase: **Authentication → URL Configuration → Site URL** = địa chỉ Vercel của bạn.

Đổi biến môi trường sau này thì phải **Redeploy** (biến `NEXT_PUBLIC_` được đóng gói lúc build).

Trên điện thoại: mở trang web → *Thêm vào màn hình chính* để dùng như app.

> Supabase gói miễn phí sẽ **tạm dừng project sau 7 ngày không có truy cập**; khi đó app báo "Không tải được dữ liệu" — vào dashboard Supabase bấm *Restore*.

## 4. Quên mật khẩu (cần cấu hình Supabase một lần)

Trang đăng nhập có link **Quên mật khẩu?** → `/forgot-password` (nhập email) → email có liên kết → `/auth/confirm` kiểm tra liên kết → `/reset-password` (đặt mật khẩu mới, các thiết bị khác bị đăng xuất). Trang đặt mật khẩu chỉ mở được ngay sau khi bấm liên kết trong email (cookie 15 phút); người đã đăng nhập không vào thẳng được để bỏ qua bước "mật khẩu hiện tại". Đổi mật khẩu trong **Cài đặt** cũng đăng xuất các thiết bị khác.

Trong Supabase cần:

1. **Project Settings → Authentication → SMTP Settings**: bật SMTP riêng (Resend, Brevo, Gmail…). SMTP mặc định của Supabase chỉ gửi được vài email mỗi giờ.
2. **Authentication → URL Configuration**: *Site URL* = địa chỉ Vercel; *Redirect URLs* thêm `https://<tên-miền-của-bạn>/**` và `http://localhost:3000/**`.
3. **Authentication → Email Templates → Reset Password**: *Subject* = `Đặt lại mật khẩu CT9 Finance`; *Message body* = dán nội dung file [`supabase/email-templates/reset-password.html`](supabase/email-templates/reset-password.html) (email có logo, nút vàng, hỗ trợ chế độ tối; liên kết `{{ .SiteURL }}/auth/confirm?token_hash=…&type=recovery` mở được cả khi bấm trên máy khác với máy yêu cầu).

Nếu giữ mẫu mặc định (`{{ .ConfirmationURL }}`) thì liên kết chỉ mở được trên cùng trình duyệt đã bấm "Gửi liên kết". Lưu ý `{{ .SiteURL }}` là *Site URL* trong Supabase: muốn thử trên máy (localhost) thì tạm đặt Site URL = `http://localhost:3000`.

## 5. Nhắc ghi chép mỗi ngày (thông báo đẩy, tuỳ chọn)

**Cài đặt → Nhắc ghi chép**: bật/tắt, chọn giờ; mỗi ngày một thông báo (ngẫu nhiên trong 10 câu, không lặp lại câu hôm qua), tự bỏ qua nếu hôm nay bạn đã ghi chép. Cần thêm khoá VAPID, bật `pg_cron` + `pg_net` trong Supabase và đặt lịch. Hướng dẫn cài đặt, cách test và xử lý sự cố: **[docs/nhac-ghi-chep.md](docs/nhac-ghi-chep.md)**.

## Lệnh hữu ích

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy môi trường phát triển |
| `npm run build` | Build production (kiểm tra trước khi deploy) |
| `npm test` | Unit test phần tính toán (công thức Excel) |
| `npm run typecheck` / `npm run lint` | Kiểm tra TypeScript / ESLint |

## Cấu trúc

```
app/(app)/          các trang sau đăng nhập (layout có menu + form nhập giao dịch)
app/login/          trang đăng nhập
proxy.ts            làm mới phiên đăng nhập, chặn truy cập khi chưa đăng nhập
lib/finance.ts      toàn bộ công thức tính (thuần, có test)
lib/data.ts         đọc dữ liệu từ Supabase (luôn xác thực phiên trước)
lib/actions/        Server Actions: lưu giao dịch, ngân sách, danh mục, đăng nhập
components/         giao diện; components/charts/ là các biểu đồ (Recharts)
supabase/schema.sql bảng, RLS, view, hàm — chạy lại được nhiều lần
docs/database.md   tài liệu giải thích database (bảng, bảo mật RLS, câu SQL mẫu)
scripts/            chuyển Excel → SQL
```
