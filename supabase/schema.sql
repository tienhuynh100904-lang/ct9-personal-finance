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
