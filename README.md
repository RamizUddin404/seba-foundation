# SEBA - Premium Blood Network 🩸✨

SEBA is a futuristic, high-performance digital blood donor platform built with **React (Vite)** and **Supabase**. It features real-time updates, advanced profile management, and a pro-level UI designed for maximum impact and speed.

---

## 🚀 Key Features
- **Instant Fast Interaction:** Optimistic UI updates for a lag-free experience.
- **Real-time Sync:** Dashboard and Live Feed update instantly for all users using Supabase Broadcast.
- **Pro Profile System:** Comprehensive user profiles with blood group, location, phone, address, and donation history.
- **Advanced Search:** Filter donors by Blood Group, Location, or Address.
- **Admin Dashboard:** Powerful admin access for `admin@seba.com` to manage all posts.
- **Password Recovery:** Built-in "Forgot Password" flow with email reset links.
- **Auto Dark/Light Mode:** Seamlessly follows your system's theme.

---

## ⚙️ Database Setup (Supabase)

To make the platform functional, you **MUST** run the following SQL script in your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql):

```sql
-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  blood_group text,
  phone text,
  location text,
  address text,
  status text default 'Active Donor',
  role text default 'user',
  donations_count int default 0,
  bio text,
  last_donation date,
  updated_at timestamp with time zone default now()
);

-- 2. Blood Requests Table
create table if not exists public.blood_requests (
  id uuid default gen_random_uuid() primary key,
  patient_name text not null,
  blood_group text not null,
  location text not null,
  phone text not null,
  posted_by text not null,
  status text default 'pending', -- pending, accepted, completed
  accepted_by text,
  created_at timestamp with time zone default now()
);

-- 3. Security (RLS)
alter table public.profiles enable row level security;
alter table public.blood_requests enable row level security;

create policy "Public Profiles" on public.profiles for select using (true);
create policy "User Update Profile" on public.profiles for upsert with check (auth.uid() = id);
create policy "Public Requests" on public.blood_requests for select using (true);
create policy "Auth Insert Requests" on public.blood_requests for insert with check (true);
create policy "Auth Update Requests" on public.blood_requests for update using (true);
create policy "Delete Requests" on public.blood_requests for delete using (auth.email() = posted_by or (select role from profiles where id = auth.uid()) = 'admin');

-- 4. Auto-Profile Creation Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, blood_group)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'blood_group');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
```

---

## 🛠️ Installation & Deployment

### 1. Clone & Install
```bash
cd seba-foundation
npm install
```

### 2. Environment Variables (`.env`)
Create a `.env` file and add your Supabase credentials:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Run Development
```bash
npm run dev
```

### 4. Deploy to Netlify
```bash
npx netlify deploy --prod
```

---

## 🛡️ Critical Configuration (Must Do)
To enable **Instant Real-time Stats**, go to **Supabase Dashboard -> Database -> Replication** and enable `supabase_realtime` for both `blood_requests` and `profiles` tables.

---

© 2026 Seba Blood Bank | Created with ❤️ for Humanity.
