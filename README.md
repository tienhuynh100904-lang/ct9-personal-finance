# CT9 Finance — Quản lý tài chính cá nhân

Ứng dụng web thay cho file Excel "Bảng theo dõi thu chi": ghi chép thu chi, lập ngân sách, phân tích bằng biểu đồ. Next.js 16 + Supabase, deploy trên Vercel. Chỉ có **đăng nhập**, không có đăng ký.

| Trang | Tương ứng trong Excel |
|---|---|
| **Tổng quan** `/` | **Thẻ "Hôm nay"**: còn được chi bao nhiêu hôm nay, chuỗi ngày ghi chép, dải 7 ngày, ghi nhanh một chạm. Bên dưới: số liệu tháng, thanh ngân sách từng nhóm, cơ cấu chi tiêu, top khoản chi, xu hướng 12 tháng |
| **Thu chi** `/transactions` | Sheet *Thu Chi*: thêm / sửa / xoá giao dịch, lọc theo tháng, loại, phân loại, tìm kiếm không dấu, xuất CSV mở được bằng Excel |
| **Phân tích** `/analytics` | Sheet *Phân loại thu chi*: tổng quan cả năm, 5 biểu đồ, bảng 12 tháng (số tiền / tỷ trọng), chi tiết từng khoản mục |
| **Ngân sách** `/budget` | Sheet *Lập ngân sách*: dự kiến, thực tế, chênh lệch cho thu nhập, chi tiêu, tiết kiệm/đầu tư |
| **Cài đặt** `/settings` | **Giao diện Sáng / Tối / Theo thiết bị**, danh mục khoản mục (gợi ý khi nhập), đổi mật khẩu, đăng xuất |

## Thiết kế để bạn quen ghi chép mỗi ngày

Ứng dụng chỉ có giá trị khi dữ liệu đầy đủ, nên giao diện xoay quanh việc ghi nhanh và đều:

- **Ghi trong vài giây:** nút "Ghi" nổi ở giữa thanh dưới (vùng ngón cái); chạm một khoản trong **Ghi nhanh** là form mở sẵn khoản mục, phân loại và số tiền lần trước; nút Lưu luôn nằm trên bàn phím; có "Hoàn tác" ngay sau khi lưu.
- **Một lý do để mở app mỗi ngày:** "Hôm nay còn được chi" = (ngân sách chi tiêu tháng − đã chi các ngày trước) ÷ số ngày còn lại. Ghi một khoản chi là con số giảm ngay.
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

> **Nâng cấp từ bản cũ:** bản này thêm bảng `day_marks` (ngày "Không chi tiêu"). Chạy lại toàn bộ `supabase/schema.sql` trong SQL Editor, không mất dữ liệu.

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

(Project cũ dùng "anon key" cũng được: đặt tên `NEXT_PUBLIC_SUPABASE_ANON_KEY`.) Key này công khai được vì mọi bảng đều có RLS — **không** dùng `service_role`/secret key.

## 3. Deploy lên Vercel

1. Đẩy code lên GitHub (repo private càng tốt).
2. [vercel.com/new](https://vercel.com/new) → import repo → framework tự nhận Next.js.
3. **Environment Variables**: thêm `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → **Deploy**.
4. Trong Supabase: **Authentication → URL Configuration → Site URL** = địa chỉ Vercel của bạn.

Đổi biến môi trường sau này thì phải **Redeploy** (biến `NEXT_PUBLIC_` được đóng gói lúc build).

Trên điện thoại: mở trang web → *Thêm vào màn hình chính* để dùng như app.

> Supabase gói miễn phí sẽ **tạm dừng project sau 7 ngày không có truy cập**; khi đó app báo "Không tải được dữ liệu" — vào dashboard Supabase bấm *Restore*.

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
