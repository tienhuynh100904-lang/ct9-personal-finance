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
-- 1) Danh mục khoản mục (cột "Khoản mục" trong Excel). Do người dùng tự
--    tạo và đặt tên; mỗi giao dịch thuộc đúng 1 khoản mục. Khác với
--    "phân loại" (category): phân loại là nhóm cố định của giao dịch
--    (thu 3 nhóm, chi 4 nhóm), còn `default_category` ở đây chỉ là gợi ý
--    phân loại khi chọn khoản mục. `archived_at`: khoản mục đã ẩn (đã có
--    giao dịch nên không xoá được) không hiện khi nhập mới.
-- ---------------------------------------------------------------------
create table if not exists public.items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('income', 'expense')),
  name             text not null check (char_length(btrim(name)) between 1 and 100),
  default_category text,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  constraint items_default_category_matches_kind check (
    default_category is null or
    (kind = 'income'  and default_category in ('main', 'side', 'irregular')) or
    (kind = 'expense' and default_category in ('essential', 'non_essential', 'incidental', 'saving'))
  ),
  constraint items_user_kind_name_key unique (user_id, kind, name),
  -- Để giao dịch tham chiếu (user_id, id, kind): khoản mục phải cùng chủ và cùng thu/chi.
  constraint items_identity_key unique (user_id, id, kind)
);

-- Nâng cấp từ bản cũ (bảng items đã có từ trước):
alter table public.items add column if not exists archived_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_identity_key' and conrelid = 'public.items'::regclass) then
    alter table public.items add constraint items_identity_key unique (user_id, id, kind);
  end if;
end $$;

-- Khoá so khớp tên khoản mục: không phân biệt hoa/thường và khoảng trắng thừa
-- ("Cà  phê" và "cà phê" là một). Giữ khớp với itemKey() trong lib/items.ts.
create or replace function public.item_key(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(normalize(btrim(regexp_replace(p_name, '\s+', ' ', 'g')), NFC))
$$;

-- ---------------------------------------------------------------------
-- 2) Giao dịch thu / chi (tương ứng sheet "Thu Chi"). Mỗi giao dịch thuộc
--    1 khoản mục (item_id) và có 1 phân loại (category).
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('income', 'expense')),
  item_id     uuid not null,
  category    text not null,
  amount      bigint not null check (amount > 0 and amount < 1000000000000),
  occurred_on date not null,
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint transactions_category_matches_kind check (
    (kind = 'income'  and category in ('main', 'side', 'irregular')) or
    (kind = 'expense' and category in ('essential', 'non_essential', 'incidental', 'saving'))
  ),
  constraint transactions_item_fk foreign key (user_id, item_id, kind)
    references public.items (user_id, id, kind)
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);

-- ---------------------------------------------------------------------
-- 3) Ngân sách dự kiến theo tháng (tương ứng sheet "Lập ngân sách")
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
-- 4) View `item_usage` (thống kê khoản mục đã dùng), khoản mục mẫu cho tài
--    khoản mới và bước chuyển dữ liệu cũ nằm ở phần 12 cuối file.
-- ---------------------------------------------------------------------

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
-- 6) Đổi tên khoản mục. Giao dịch gắn theo item_id nên tự đi theo tên mới.
--    Nếu tên mới trùng một khoản mục khác (cùng loại thu/chi) thì gộp: các
--    giao dịch và khoản định kỳ chuyển sang khoản mục kia. Trả về id khoản
--    mục còn lại.
-- ---------------------------------------------------------------------
drop function if exists public.rename_item(text, text, text, boolean);

create or replace function public.rename_item(p_item_id uuid, p_new_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_new   text := btrim(regexp_replace(coalesce(p_new_name, ''), '\s+', ' ', 'g'));
  v_kind  text;
  v_other uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if v_new = '' or char_length(v_new) > 100 then
    raise exception 'invalid_name';
  end if;

  select kind into v_kind from public.items where id = p_item_id and user_id = v_user;
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;

  select id into v_other from public.items
  where user_id = v_user and kind = v_kind and id <> p_item_id and public.item_key(name) = public.item_key(v_new);

  if v_other is not null then
    update public.transactions           set item_id = v_other where item_id = p_item_id and user_id = v_user;
    update public.recurring_transactions set item_id = v_other where item_id = p_item_id and user_id = v_user;
    delete from public.items where id = p_item_id and user_id = v_user;
    return v_other;
  end if;

  update public.items set name = v_new where id = p_item_id and user_id = v_user;
  return p_item_id;
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
revoke all on public.transactions, public.budgets, public.items from anon;
revoke execute on function public.rename_item(uuid, text) from public, anon;

grant select, insert, update, delete on public.transactions, public.budgets, public.items to authenticated;
grant execute on function public.rename_item(uuid, text) to authenticated;

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
  item_id      uuid not null,
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
  ),
  constraint recurring_item_fk foreign key (user_id, item_id, kind)
    references public.items (user_id, id, kind)
);

create index if not exists recurring_transactions_user_idx on public.recurring_transactions (user_id);

-- Số ngày hiện nhắc trước và sau ngày đến hạn (0 = chỉ đúng ngày đó).
alter table public.recurring_transactions
  add column if not exists remind_days smallint not null default 1 check (remind_days between 0 and 7);

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

  insert into public.transactions (user_id, kind, item_id, category, amount, occurred_on, note)
  values (v_user, v_rule.kind, v_rule.item_id, v_rule.category, coalesce(p_amount, v_rule.amount), p_occurred_on, v_rule.note)
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

-- ---------------------------------------------------------------------
-- 11) Mục tiêu tài chính / quỹ (tương ứng file "Theo dõi mục tiêu tài
--     chính"). `goals`: mỗi quỹ một dòng. Quỹ khẩn cấp (kind = 'emergency')
--     mỗi tài khoản tối đa 1, mục tiêu = chi phí cố định 1 tháng × số tháng.
--     `goal_allocations`: tiền tiết kiệm chia vào quỹ (số dương) hoặc rút
--     ra (số âm). Tiền tiết kiệm = tổng giao dịch "Tiết kiệm/Đầu tư".
-- ---------------------------------------------------------------------
create table if not exists public.goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind            text not null default 'custom' check (kind in ('emergency', 'custom')),
  name            text not null check (char_length(btrim(name)) between 1 and 60),
  target_amount   bigint not null check (target_amount > 0 and target_amount < 1000000000000),
  monthly_expense bigint check (monthly_expense is null or (monthly_expense > 0 and monthly_expense < 1000000000000)),
  reserve_months  smallint check (reserve_months is null or reserve_months between 1 and 24),
  start_date      date not null,
  months          smallint not null check (months between 1 and 600),
  rate_bp         smallint not null default 0 check (rate_bp between 0 and 1200),
  place           text not null default 'bank' check (place in ('bank', 'app', 'mmf')),
  initial_amount  bigint not null default 0 check (initial_amount >= 0 and initial_amount < 1000000000000),
  note            text check (note is null or char_length(note) <= 1000),
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint goals_emergency_target check (
    kind <> 'emergency' or (
      monthly_expense is not null and reserve_months is not null
      and target_amount = monthly_expense * reserve_months
    )
  )
);

create unique index if not exists goals_one_emergency_per_user on public.goals (user_id) where kind = 'emergency';

create table if not exists public.goal_allocations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id      uuid not null references public.goals (id) on delete cascade,
  amount       bigint not null check (amount <> 0 and abs(amount) < 1000000000000),
  allocated_on date not null,
  note         text check (note is null or char_length(note) <= 200),
  created_at   timestamptz not null default now()
);

create index if not exists goal_allocations_user_goal_idx on public.goal_allocations (user_id, goal_id, allocated_on);

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals            enable row level security;
alter table public.goal_allocations enable row level security;

drop policy if exists "Owner full access" on public.goals;
create policy "Owner full access" on public.goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Ghi được chỉ vào quỹ của chính mình.
drop policy if exists "Owner full access" on public.goal_allocations;
create policy "Owner full access" on public.goal_allocations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid()))
  );

-- Tổng tiền đã tiết kiệm và tổng đã chia vào quỹ của người đang đăng nhập.
-- security_invoker: RLS của 2 bảng vẫn áp dụng, nên mỗi người chỉ thấy số của mình.
-- "Chi từ quỹ": a transaction paid with money taken from a goal. It stays an ordinary expense
-- (it shows in Thu chi and in the budgets), but the app leaves it out of the month's surplus by
-- default, and its goal_allocations row (transaction_id) takes the money out of the goal.
alter table public.transactions add column if not exists from_savings boolean not null default false;
alter table public.goal_allocations
  add column if not exists transaction_id uuid references public.transactions (id) on delete cascade;
create unique index if not exists goal_allocations_transaction_key
  on public.goal_allocations (transaction_id) where transaction_id is not null;

create or replace view public.savings_pool with (security_invoker = true) as
select
  (select coalesce(sum(t.amount), 0) from public.transactions t
     where t.kind = 'expense' and t.category = 'saving')::bigint as saved,
  (select coalesce(sum(a.amount), 0) from public.goal_allocations a)::bigint as allocated,
  (select coalesce(sum(t.amount), 0) from public.transactions t
     where t.kind = 'expense' and t.from_savings)::bigint as spent;

-- Chia tiền tiết kiệm vào một hoặc nhiều quỹ (số dương) hoặc rút ra (số âm)
-- trong 1 lần. Từ chối nếu tổng chia vượt số tiền chưa phân bổ, nếu rút quá số
-- đã chia vào quỹ, hoặc nếu quỹ đã lưu trữ. Khoá theo tài khoản để 2 lần bấm
-- cùng lúc không vượt quá số tiền có.
create or replace function public.allocate_savings(p_items jsonb, p_on date, p_note text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_available bigint;
  v_total     bigint := 0;
  v_item      record;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no_items';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  for v_item in
    select (e->>'goal_id')::uuid as goal_id, sum((e->>'amount')::bigint) as amount
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    if v_item.amount = 0 then
      continue;
    end if;
    if not exists (
      select 1 from public.goals g
      where g.id = v_item.goal_id and g.user_id = v_user and (g.archived_at is null or v_item.amount < 0)
    ) then
      raise exception 'goal_not_found';
    end if;
    if v_item.amount < 0 and (
      select coalesce(sum(a.amount), 0) from public.goal_allocations a where a.goal_id = v_item.goal_id
    ) + v_item.amount < 0 then
      raise exception 'goal_balance';
    end if;
    v_total := v_total + v_item.amount;
    insert into public.goal_allocations (user_id, goal_id, amount, allocated_on, note)
    values (v_user, v_item.goal_id, v_item.amount, p_on, nullif(btrim(coalesce(p_note, '')), ''));
  end loop;

  select p.saved - p.spent - p.allocated into v_available from public.savings_pool p;
  if v_total > 0 and v_available < 0 then
    raise exception 'insufficient_pool';
  end if;
end;
$$;

-- Chi tiêu thẳng từ quỹ: tạo giao dịch chi (đánh dấu from_savings) và trừ tiền
-- khỏi quỹ trong 1 lần. Xoá giao dịch đó (kể cả "Hoàn tác") thì tiền về lại quỹ.
drop function if exists public.spend_from_goal(uuid, bigint, text, text, date, text);

create or replace function public.spend_from_goal(
  p_goal_id uuid,
  p_amount bigint,
  p_item_id uuid,
  p_category text,
  p_occurred_on date,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_tx        uuid;
  v_item_name text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_category not in ('essential', 'non_essential', 'incidental') then
    raise exception 'invalid_category';
  end if;
  if not exists (select 1 from public.goals g where g.id = p_goal_id and g.user_id = v_user) then
    raise exception 'goal_not_found';
  end if;

  select i.name into v_item_name from public.items i
  where i.id = p_item_id and i.user_id = v_user and i.kind = 'expense';
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;

  insert into public.transactions (user_id, kind, item_id, category, amount, occurred_on, note, from_savings)
  values (v_user, 'expense', p_item_id, p_category, p_amount, p_occurred_on, nullif(btrim(coalesce(p_note, '')), ''), true)
  returning id into v_tx;

  insert into public.goal_allocations (user_id, goal_id, amount, allocated_on, note, transaction_id)
  values (v_user, p_goal_id, -p_amount, p_occurred_on, v_item_name, v_tx);

  return v_tx;
end;
$$;

-- Sửa một khoản "chi từ quỹ" ở trang Thu chi: số tiền và ngày được cập nhật theo vào
-- quỹ. Đổi thành khoản thu hoặc nhóm Tiết kiệm thì nó không còn là chi từ quỹ nữa.
create or replace function public.sync_goal_spend()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'expense' and new.category <> 'saving' then
    update public.goal_allocations
      set amount = -new.amount, allocated_on = new.occurred_on,
          note = (select i.name from public.items i where i.id = new.item_id)
      where transaction_id = new.id;
  else
    delete from public.goal_allocations where transaction_id = new.id;
    new.from_savings := false;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_sync_goal_spend on public.transactions;
create trigger transactions_sync_goal_spend
  before update on public.transactions
  for each row when (old.from_savings) execute function public.sync_goal_spend();

revoke all on public.goals, public.goal_allocations, public.savings_pool from anon;
revoke execute on function public.allocate_savings(jsonb, date, text) from public, anon;
revoke execute on function public.spend_from_goal(uuid, bigint, uuid, text, date, text) from public, anon;

grant select, insert, update, delete on public.goals, public.goal_allocations to authenticated;
grant select on public.savings_pool to authenticated;
grant execute on function public.allocate_savings(jsonb, date, text) to authenticated;
grant execute on function public.spend_from_goal(uuid, bigint, uuid, text, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 12) Khoản mục bắt buộc: khoản mục mẫu, chuyển dữ liệu cũ và thống kê.
--
--     a) `seed_default_items`: khoản mục mẫu cho tài khoản mới (chạy tự
--        động khi đăng ký) — người dùng sửa, xoá hoặc thêm tuỳ ý.
--     b) Nâng cấp từ bản cũ, khi giao dịch còn lưu tên khoản mục dạng chữ
--        (cột `item`): tạo khoản mục cho mọi tên đã dùng (gộp tên chỉ khác
--        hoa/thường hay khoảng trắng), gắn `item_id` cho từng giao dịch và
--        khoản định kỳ, rồi bỏ cột `item`. Không mất giao dịch nào. Chỉ chạy
--        một lần; chạy lại file thì bước này tự bỏ qua.
--     c) View `item_usage`: số lần dùng của từng khoản mục.
-- ---------------------------------------------------------------------
create or replace function public.seed_default_items(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.items (user_id, kind, name, default_category)
  select p_user, v.kind, v.name, v.category
  from (values
    ('expense', 'Ăn uống',            'essential'),
    ('expense', 'Đi chợ',             'essential'),
    ('expense', 'Xăng xe',            'essential'),
    ('expense', 'Tiền nhà',           'essential'),
    ('expense', 'Điện nước',          'essential'),
    ('expense', 'Internet/Điện thoại', 'essential'),
    ('expense', 'Cà phê',             'non_essential'),
    ('expense', 'Mua sắm',            'non_essential'),
    ('expense', 'Giải trí',           'non_essential'),
    ('expense', 'Sức khoẻ',           'incidental'),
    ('expense', 'Sửa chữa',           'incidental'),
    ('expense', 'Tiết kiệm',          'saving'),
    ('expense', 'Đầu tư',             'saving'),
    ('income',  'Lương',              'main'),
    ('income',  'Làm thêm',           'side'),
    ('income',  'Thưởng',             'irregular')
  ) as v(kind, name, category)
  on conflict do nothing
$$;

do $$
declare
  v_legacy_tx  boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'item');
  v_legacy_rec boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recurring_transactions' and column_name = 'item');
  v_sources text;
begin
  if not (v_legacy_tx or v_legacy_rec) then
    return;
  end if;

  -- View cũ đọc cột `item` nên phải bỏ trước khi bỏ cột; ngay bên dưới view mới được tạo lại.
  drop view if exists public.item_usage;

  -- Khoản mục đã có trong danh mục mà chỉ khác hoa/thường hay khoảng trắng: giữ cái tạo sớm nhất.
  delete from public.items i
  using (
    select id, row_number() over (partition by user_id, kind, public.item_key(name) order by created_at, id) as rn
    from public.items
  ) d
  where d.id = i.id and d.rn > 1;

  update public.items
  set name = btrim(regexp_replace(name, '\s+', ' ', 'g'))
  where name <> btrim(regexp_replace(name, '\s+', ' ', 'g'));

  -- Tên đã dùng trong giao dịch / khoản định kỳ mà chưa có trong danh mục: tạo mới
  -- (viết hoa theo cách được dùng nhiều nhất). Phân loại mặc định để trống = "như lần trước".
  select string_agg(s, ' union all ') into v_sources from (
    select 'select user_id, kind, item from public.transactions' as s where v_legacy_tx
    union all
    select 'select user_id, kind, item from public.recurring_transactions' where v_legacy_rec
  ) q;

  execute format($f$
    insert into public.items (user_id, kind, name)
    select user_id, kind, name from (
      select s.user_id, s.kind, s.name,
             row_number() over (partition by s.user_id, s.kind, public.item_key(s.name) order by s.n desc, s.name) as rn
      from (
        select user_id, kind, btrim(regexp_replace(item, '\s+', ' ', 'g')) as name, count(*) as n
        from (%s) u
        group by 1, 2, 3
      ) s
      where not exists (
        select 1 from public.items i
        where i.user_id = s.user_id and i.kind = s.kind and public.item_key(i.name) = public.item_key(s.name)
      )
    ) x
    where rn = 1
  $f$, v_sources);

  if v_legacy_tx then
    alter table public.transactions add column if not exists item_id uuid;

    update public.transactions t
    set item_id = i.id
    from public.items i
    where t.item_id is null
      and i.user_id = t.user_id and i.kind = t.kind
      and public.item_key(i.name) = public.item_key(t.item);

    alter table public.transactions alter column item_id set not null;
    if not exists (select 1 from pg_constraint where conname = 'transactions_item_fk' and conrelid = 'public.transactions'::regclass) then
      alter table public.transactions
        add constraint transactions_item_fk foreign key (user_id, item_id, kind)
        references public.items (user_id, id, kind);
    end if;
    alter table public.transactions drop column item;
  end if;

  if v_legacy_rec then
    alter table public.recurring_transactions add column if not exists item_id uuid;

    update public.recurring_transactions t
    set item_id = i.id
    from public.items i
    where t.item_id is null
      and i.user_id = t.user_id and i.kind = t.kind
      and public.item_key(i.name) = public.item_key(t.item);

    alter table public.recurring_transactions alter column item_id set not null;
    if not exists (select 1 from pg_constraint where conname = 'recurring_item_fk' and conrelid = 'public.recurring_transactions'::regclass) then
      alter table public.recurring_transactions
        add constraint recurring_item_fk foreign key (user_id, item_id, kind)
        references public.items (user_id, id, kind);
    end if;
    alter table public.recurring_transactions drop column item;
  end if;

  -- Tài khoản chưa có khoản mục nào (chưa ghi gì) cũng được khoản mục mẫu.
  perform public.seed_default_items(u.id)
  from auth.users u
  where not exists (select 1 from public.items i where i.user_id = u.id);
end $$;

-- Hai khoản mục cùng loại không được trùng tên (không phân biệt hoa/thường, khoảng trắng).
create unique index if not exists items_user_kind_key_idx on public.items (user_id, kind, public.item_key(name));
create index if not exists transactions_item_idx on public.transactions (item_id);
create index if not exists recurring_transactions_item_idx on public.recurring_transactions (item_id);

-- Mọi khoản mục (kể cả chưa dùng) kèm số lần dùng và phân loại gần nhất.
-- security_invoker: view chạy với quyền người gọi nên RLS vẫn áp dụng.
drop view if exists public.item_usage;
create view public.item_usage with (security_invoker = true) as
select
  i.user_id,
  i.id as item_id,
  i.kind,
  i.name as item,
  count(t.id)::integer as uses,
  max(t.occurred_on) as last_used_on,
  (array_agg(t.category order by t.occurred_on desc, t.created_at desc) filter (where t.id is not null))[1] as last_category
from public.items i
left join public.transactions t on t.item_id = i.id
group by i.user_id, i.id, i.kind, i.name;

revoke all on public.item_usage from anon;
grant select on public.item_usage to authenticated;

-- Khoản mục mẫu cho tài khoản mới, ngay khi đăng ký. Lỗi ở đây không được chặn việc đăng ký.
create or replace function public.handle_new_user_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.seed_default_items(new.id);
  exception when others then
    raise warning 'seed_default_items failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.seed_default_items(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user_items() from public, anon, authenticated;

drop trigger if exists seed_items_on_signup on auth.users;
create trigger seed_items_on_signup
  after insert on auth.users
  for each row execute function public.handle_new_user_items();

-- ---------------------------------------------------------------------
-- 13) Khoản tiết kiệm có kỳ hạn (gửi ngân hàng, tái tục…). Chỉ để theo dõi ngày
--     đáo hạn và tiền lãi: không tạo giao dịch và không trừ vào tiền chưa
--     phân bổ của các quỹ, nên một khoản tiền vừa nằm trong quỹ vừa nằm trong
--     khoản tiết kiệm. `closed_on` có giá trị = đã tất toán (hoặc đã tái tục
--     sang khoản mới).
--     Ngày đáo hạn = start_date + term_months; lãi đơn = gốc × lãi suất ×
--     số ngày / 365.
-- ---------------------------------------------------------------------
create table if not exists public.savings_deposits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  principal   bigint not null check (principal > 0 and principal < 1000000000000),
  rate_bp     smallint not null default 0 check (rate_bp between 0 and 2000),
  start_date  date not null,
  term_months smallint not null check (term_months between 1 and 120),
  note        text check (note is null or char_length(note) <= 500),
  closed_on   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists savings_deposits_user_idx on public.savings_deposits (user_id, closed_on);

drop trigger if exists savings_deposits_set_updated_at on public.savings_deposits;
create trigger savings_deposits_set_updated_at
  before update on public.savings_deposits
  for each row execute function public.set_updated_at();

alter table public.savings_deposits enable row level security;

drop policy if exists "Owner full access" on public.savings_deposits;
create policy "Owner full access" on public.savings_deposits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.savings_deposits from anon;
grant select, insert, update, delete on public.savings_deposits to authenticated;
