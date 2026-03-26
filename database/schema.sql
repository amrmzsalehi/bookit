-- ============================================================
-- PASTE THIS ENTIRE FILE into Supabase → SQL Editor → Run
-- It creates all 4 tables your app needs
-- ============================================================

-- TABLE 1: profiles
-- Stores every user's info (student or landlord)
create table profiles (
  id text primary key,          -- this will be the Firebase user UID
  role text not null,           -- 'student' or 'landlord'
  name text,
  location text,
  housing_pref text,            -- 'on_campus', 'off_campus', or 'both'
  created_at timestamp default now()
);

-- TABLE 2: listings
-- Landlords create these — one row per room/unit
create table listings (
  id uuid primary key default gen_random_uuid(),
  landlord_id text references profiles(id),
  title text not null,
  description text,
  location text,
  type text,                    -- 'on_campus' or 'off_campus'
  room_type text,               -- 'single' or 'shared'
  price int not null,           -- monthly rent in your currency
  spots int default 1,          -- how many spots available
  amenities text[] default '{}',-- array like: '{"wifi","parking","gym"}'
  distance_km float default 0,  -- distance from campus in km
  created_at timestamp default now()
);

-- TABLE 3: applications
-- Students apply to listings, landlords respond here
create table applications (
  id uuid primary key default gen_random_uuid(),
  student_id text references profiles(id),
  listing_id uuid references listings(id),
  status text default 'pending', -- 'pending', 'accepted', 'rejected'
  priority int default 3,        -- student sets 1 (high) to 5 (low)
  message text,                  -- optional note from student
  created_at timestamp default now()
);

-- TABLE 4: messages
-- Chat between landlord and student, tied to a specific listing
create table messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id),
  sender_id text references profiles(id),
  receiver_id text references profiles(id),
  content text not null,
  created_at timestamp default now()
);

-- ============================================================
-- IMPORTANT: Enable Row Level Security on all tables
-- This makes sure users can only see their OWN data
-- Run each line below separately after creating the tables
-- ============================================================

alter table profiles enable row level security;
alter table listings enable row level security;
alter table applications enable row level security;
alter table messages enable row level security;

-- Allow users to read/write their own profile
create policy "Users manage own profile" on profiles
  for all using (true);

-- Anyone can read listings (for browsing)
create policy "Anyone can read listings" on listings
  for select using (true);

-- Landlords can insert/update their own listings
create policy "Landlords manage listings" on listings
  for all using (true);

-- Students see their applications, landlords see apps to their listings
create policy "Open applications" on applications
  for all using (true);

-- Users see messages they sent or received
create policy "Open messages" on messages
  for all using (true);

-- NOTE: The policies above are OPEN for now (good for MVP/dev).
-- When you launch for real, tighten these with proper auth checks.
