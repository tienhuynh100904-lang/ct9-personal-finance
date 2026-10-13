-- =====================================================================
-- Lịch gọi hệ thống nhắc ghi chép: mỗi 15 phút, Supabase (pg_cron) gửi một
-- yêu cầu POST tới /api/reminders/run của app trên Vercel.
-- Chạy file này trong Supabase → SQL Editor SAU KHI:
--   1. đã chạy supabase/schema.sql (có bảng reminder_settings, push_subscriptions),
--   2. đã deploy app lên Vercel với đủ biến môi trường (xem docs/nhac-ghi-chep.md),
--   3. đã bật 2 extension: Database → Extensions → pg_cron và pg_net.
-- Thay <CRON_SECRET> bằng chuỗi bí mật của bạn trước khi chạy. Chạy lại an toàn.
-- =====================================================================

-- 1) Lưu khoá bí mật trong Vault (không để lộ trong câu lệnh cron).
--    Giá trị PHẢI giống biến CRON_SECRET trên Vercel.
do $$
begin
  if exists (select 1 from vault.secrets where name = 'ct9_cron_secret') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'ct9_cron_secret'),
      '9b8cc186294ce84d207b39c1506373abaec25406400d993a2438bf600a1f0529'
    );
  else
    perform vault.create_secret('9b8cc186294ce84d207b39c1506373abaec25406400d993a2438bf600a1f0529', 'ct9_cron_secret');
  end if;
end
$$;

-- 2) Đặt lịch: phút 0, 15, 30, 45 của mỗi giờ (UTC; app tự đổi sang giờ Việt Nam).
select cron.schedule(
  'ct9-reminders',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://ct9-personal-finance.vercel.app/api/reminders/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ct9_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $job$
);

-- ---------------------------------------------------------------------
-- Kiểm tra và quản lý (chạy riêng từng câu khi cần)
-- ---------------------------------------------------------------------
-- Gọi thử ngay một lần, không chờ lịch:
--   select net.http_post(
--     url := 'https://ct9-personal-finance.vercel.app/api/reminders/run',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ct9_cron_secret'))
--   );
-- Xem phản hồi (status_code 200 = chạy tốt, 401 = sai khoá, 500 = thiếu cấu hình):
--   select id, status_code, content, created from net._http_response order by created desc limit 5;
-- Xem lịch sử các lần cron chạy:
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- Tạm đặt chạy mỗi phút để thử (nhớ đổi lại '*/15 * * * *' sau đó):
--   select cron.alter_job((select jobid from cron.job where jobname = 'ct9-reminders'), schedule := '* * * * *');
-- Xoá lịch:
--   select cron.unschedule('ct9-reminders');
