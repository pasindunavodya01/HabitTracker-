-- Supabase schema for LifeOS
-- Run this in Supabase SQL editor to create initial tables

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Profiles table (linked to Supabase Auth users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  full_name text,
  avatar_url text,
  timezone text,
  bio text,
  created_at timestamptz default now()
);

-- Categories (user-specific)
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz default now()
);

-- Habits / Tasks / Routines
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'habit', -- habit | task | routine | bad_habit | goal
  category_id uuid references categories(id),
  is_archived boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Completions: when a habit/task is completed (supports quick logging)
create table if not exists completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  habit_id uuid references habits(id) on delete cascade,
  completed_at timestamptz default now(),
  note text,
  created_at timestamptz default now()
);

-- Simple achievements / badges
create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  key text not null,
  title text not null,
  description text,
  awarded_at timestamptz default now()
);

-- Journal entries for the diary feature
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  entry_date date not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, entry_date)
);

-- Timetables for daily schedule
create table if not exists timetables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  activity text not null,
  start_time text not null,
  end_time text not null,
  days_of_week jsonb not null default '[0,1,2,3,4,5,6]'::jsonb,
  created_at timestamptz default now()
);

-- Projects for big plans
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_date text,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Indexes for queries
create index if not exists idx_habits_user on habits(user_id);
create index if not exists idx_completions_user on completions(user_id, completed_at);
