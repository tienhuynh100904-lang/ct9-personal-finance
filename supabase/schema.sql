-- =====================================================================
--  CT9 Finance — cấu trúc database trên Supabase
--
--  Cách dùng: Supabase Dashboard → SQL Editor → New query → dán toàn bộ
--  file này → Run. Có thể chạy lại nhiều lần mà không mất dữ liệu.
--
--  Mã phân loại (category) dùng trong database:
--    Thu nhập : main = Thu nhập chính, side = Thu nhập phụ,
--               irregular = Thu nhập bất thường
--    Chi tiêu : essential = Thiết yếu, non_essential = Không thiết yếu,
--               incidental = Phát sinh, saving = Tiết kiệm/Đầu tư
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Giao dịch thu / chi (tương ứng sheet "Thu Chi")
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('income', 'expense')),
  item        text not null check (char_length(btrim(item)) between 1 and 100),
  category    text not null,
  amount      bigint not null check (amount > 0 and amount < 1000000000000),
  occurred_on date not null,
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint transactions_category_matches_kind check (
    (kind = 'income'  and category in ('main', 'side', 'irregular')) or
    (kind = 'expense' and category in ('essential', 'non_essential', 'incidental', 'saving'))
  )
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);

-- ---------------------------------------------------------------------
-- 2) Ngân sách dự kiến theo tháng (tương ứng sheet "Lập ngân sách")
-- ---------------------------------------------------------------------
create table if not exists public.budgets (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year       smallint not null check (year between 2000 and 2100),
  month      smallint not null check (month between 1 and 12),
  category   text not null check (category in (
               'main', 'side', 'irregular',
               'essential', 'non_essential', 'incidental', 'saving')),
  amount     bigint not null default 0 check (amount >= 0 and amount < 1000000000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, year, month, category)
);

-- ---------------------------------------------------------------------
-- 3) Danh mục khoản mục (gợi ý khi nhập — như cột "Khoản mục" trong Excel)
-- ---------------------------------------------------------------------
create table if not exists public.items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('income', 'expense')),
  name             text not null check (char_length(btrim(name)) between 1 and 100),
  default_category text,
  created_at       timestamptz not null default now(),
  constraint items_default_category_matches_kind check (
    default_category is null or
    (kind = 'income'  and default_category in ('main', 'side', 'irregular')) or
    (kind = 'expense' and default_category in ('essential', 'non_essential', 'incidental', 'saving'))
  ),
  constraint items_user_kind_name_key unique (user_id, kind, name)
);

-- ---------------------------------------------------------------------
-- 4) Thống kê khoản mục đã dùng — để gợi ý nhanh khi nhập giao dịch.
--    security_invoker: view chạy với quyền người gọi nên RLS vẫn áp dụng.
-- ---------------------------------------------------------------------
create or replace view public.item_usage with (security_invoker = true) as
select
  t.user_id,
  t.kind,
  t.item,
  count(*)::integer as uses,
  max(t.occurred_on) as last_used_on,
  (array_agg(t.category order by t.occurred_on desc, t.created_at desc))[1] as last_category
from public.transactions t
group by t.user_id, t.kind, t.item;

-- ---------------------------------------------------------------------
-- 5) Tự cập nhật cột updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6) Đổi tên khoản mục (và cập nhật các giao dịch đã ghi) trong 1 lần.
--    Nếu tên mới đã tồn tại thì gộp 2 khoản mục làm một.
-- ---------------------------------------------------------------------
create or replace function public.rename_item(
  p_kind text,
  p_old_name text,
  p_new_name text,
  p_update_transactions boolean default true
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_new  text := btrim(p_new_name);
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if v_new = '' then
    raise exception 'empty name';
  end if;

  if exists (
    select 1 from public.items
    where user_id = v_user and kind = p_kind and name = v_new and name <> p_old_name
  ) then
    delete from public.items
    where user_id = v_user and kind = p_kind and name = p_old_name;
  else
    update public.items set name = v_new
    where user_id = v_user and kind = p_kind and name = p_old_name;
  end if;

  if p_update_transactions then
    update public.transactions set item = v_new
    where user_id = v_user and kind = p_kind and item = p_old_name;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) Bảo mật: Row Level Security — mỗi tài khoản chỉ thấy dữ liệu của mình
-- ---------------------------------------------------------------------
alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;
alter table public.items        enable row level security;

drop policy if exists "Owner full access" on public.transactions;
create policy "Owner full access" on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner full access" on public.budgets;
create policy "Owner full access" on public.budgets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner full access" on public.items;
create policy "Owner full access" on public.items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Chỉ người đã đăng nhập mới được truy cập; khách (anon) không có quyền gì.
revoke all on public.transactions, public.budgets, public.items, public.item_usage from anon;
revoke execute on function public.rename_item(text, text, text, boolean) from public, anon;

grant select, insert, update, delete on public.transactions, public.budgets, public.items to authenticated;
grant select on public.item_usage to authenticated;
grant execute on function public.rename_item(text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 8) Ngày đánh dấu "Không chi tiêu": giữ chuỗi ngày ghi chép không bị
--    ngắt vào những ngày bạn thật sự không chi gì. Mỗi ngày tối đa 1 dòng.
-- ---------------------------------------------------------------------
create table if not exists public.day_marks (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  kind       text not null default 'no_spend' check (kind in ('no_spend')),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.day_marks enable row level security;

drop policy if exists "Owner full access" on public.day_marks;
create policy "Owner full access" on public.day_marks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.day_marks from anon;
grant select, insert, update, delete on public.day_marks to authenticated;

-- ---------------------------------------------------------------------
-- 9) Nhắc ghi chép mỗi ngày (thông báo đẩy): cài đặt của người dùng và
--    các thiết bị đã đăng ký nhận. Xem docs/nhac-ghi-chep.md.
--    `last_sent_on` / `last_message` do hệ thống nhắc cập nhật để mỗi ngày
--    chỉ gửi một lần và không lặp lại câu của hôm qua.
-- ---------------------------------------------------------------------
create table if not exists public.reminder_settings (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled      boolean not null default false,
  remind_at    time not null default '21:00'
               check (extract(second from remind_at) = 0 and extract(minute from remind_at)::int % 15 = 0),
  last_sent_on date,
  last_message smallint,
  updated_at   timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

drop trigger if exists reminder_settings_set_updated_at on public.reminder_settings;
create trigger reminder_settings_set_updated_at
  before update on public.reminder_settings
  for each row execute function public.set_updated_at();

alter table public.reminder_settings enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "Owner full access" on public.reminder_settings;
create policy "Owner full access" on public.reminder_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner full access" on public.push_subscriptions;
create policy "Owner full access" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.reminder_settings, public.push_subscriptions from anon;
grant select, insert, update, delete on public.reminder_settings, public.push_subscriptions to authenticated;

-- ---------------------------------------------------------------------
-- 10) Giao dịch định kỳ (tiền nhà, điện nước, wifi, lương…).
--     `recurring_transactions`: mẫu "mỗi tháng vào ngày N" (ngày 29–31 rơi
--     vào ngày cuối của tháng ngắn hơn).
--     `recurring_runs`: mỗi mẫu mỗi tháng tối đa 1 dòng — đã xác nhận (kèm
--     giao dịch đã tạo) hoặc đã bỏ qua. Xoá giao dịch đó thì dòng này tự xoá
--     theo, nên khoản định kỳ lại hiện ra để xác nhận.
-- ---------------------------------------------------------------------
create table if not exists public.recurring_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('income', 'expense')),
  item         text not null check (char_length(btrim(item)) between 1 and 100),
  category     text not null,
  amount       bigint not null check (amount > 0 and amount < 1000000000000),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  note         text check (note is null or char_length(note) <= 500),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint recurring_category_matches_kind check (
    (kind = 'income'  and category in ('main', 'side', 'irregular')) or
    (kind = 'expense' and category in ('essential', 'non_essential', 'incidental', 'saving'))
  )
);

create index if not exists recurring_transactions_user_idx on public.recurring_transactions (user_id);

create table if not exists public.recurring_runs (
  recurring_id   uuid not null references public.recurring_transactions (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year           smallint not null check (year between 2000 and 2100),
  month          smallint not null check (month between 1 and 12),
  status         text not null check (status in ('done', 'skipped')),
  transaction_id uuid references public.transactions (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (recurring_id, year, month),
  constraint recurring_runs_done_has_transaction check ((status = 'done') = (transaction_id is not null))
);

create index if not exists recurring_runs_user_month_idx on public.recurring_runs (user_id, year, month);

drop trigger if exists recurring_transactions_set_updated_at on public.recurring_transactions;
create trigger recurring_transactions_set_updated_at
  before update on public.recurring_transactions
  for each row execute function public.set_updated_at();

alter table public.recurring_transactions enable row level security;
alter table public.recurring_runs         enable row level security;

drop policy if exists "Owner full access" on public.recurring_transactions;
create policy "Owner full access" on public.recurring_transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Ghi được chỉ khi mẫu định kỳ cũng là của chính mình.
drop policy if exists "Owner full access" on public.recurring_runs;
create policy "Owner full access" on public.recurring_runs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.recurring_transactions r
      where r.id = recurring_id and r.user_id = (select auth.uid())
    )
  );

-- Xác nhận khoản định kỳ của 1 tháng: tạo giao dịch và ghi nhận "đã xác nhận"
-- trong cùng 1 lần. Bấm 2 lần (hoặc từ 2 thiết bị) thì lần sau bị từ chối và
-- không tạo giao dịch trùng. Tháng đã "bỏ qua" vẫn xác nhận lại được.
create or replace function public.confirm_recurring(
  p_recurring_id uuid,
  p_year integer,
  p_month integer,
  p_amount bigint,
  p_occurred_on date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rule public.recurring_transactions;
  v_tx   uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_rule from public.recurring_transactions
  where id = p_recurring_id and user_id = v_user;
  if not found then
    raise exception 'recurring transaction not found' using errcode = 'P0002';
  end if;

  insert into public.transactions (user_id, kind, item, category, amount, occurred_on, note)
  values (v_user, v_rule.kind, v_rule.item, v_rule.category, coalesce(p_amount, v_rule.amount), p_occurred_on, v_rule.note)
  returning id into v_tx;

  insert into public.recurring_runs as run (recurring_id, user_id, year, month, status, transaction_id)
  values (v_rule.id, v_user, p_year, p_month, 'done', v_tx)
  on conflict (recurring_id, year, month) do update
    set status = 'done', transaction_id = excluded.transaction_id
    where run.status = 'skipped';
  if not found then
    raise exception 'already confirmed' using errcode = '23505';
  end if;

  return v_tx;
end;
$$;

revoke all on public.recurring_transactions, public.recurring_runs from anon;
revoke execute on function public.confirm_recurring(uuid, integer, integer, bigint, date) from public, anon;

grant select, insert, update, delete on public.recurring_transactions, public.recurring_runs to authenticated;
grant execute on function public.confirm_recurring(uuid, integer, integer, bigint, date) to authenticated;
