# Seba Blood Bank Foundation 🩸✨

এটি একটি প্রিমিয়াম ব্লাড ব্যাংক ম্যানেজমেন্ট সিস্টেম। এটি রিয়্যাক্ট (React JS) এবং সুপাবেস (Supabase) দিয়ে তৈরি।

## কিভাবে শুরু করবেন?

১. **Supabase Setup:**
   - [Supabase](https://supabase.com/) এ লগইন করে একটি নতুন প্রজেক্ট খুলুন।
   - SQL Editor-এ গিয়ে নিচের কোডটি রান করুন টেবিল তৈরি করার জন্য:
     ```sql
     create table blood_requests (
       id bigint primary key generated always as identity,
       patient_name text not null,
       blood_group text not null,
       location text not null,
       phone text not null,
       posted_by text not null,
       created_at timestamp with time zone default now()
     );
     ```

২. **API Keys:**
   - প্রজেক্টে একটি `.env` ফাইল তৈরি করুন ( `.env.example` ফাইলটি রিনেম করতে পারেন)।
   - সেখানে আপনার `VITE_SUPABASE_URL` এবং `VITE_SUPABASE_ANON_KEY` বসান।

৩. **Run Project:**
   - টার্মিনালে লিখুন: `npm install`
   - এরপর লিখুন: `npm run dev`

৪. **Login Details:**
   - **ইমেইল:** `admin@seba.com`
   - **পাসওয়ার্ড:** `admin`

## কেন এই ওয়েবসাইট সেরা? 💎
- **Ultra Premium UI:** আধুনিক গ্লাস-মর্ফিজম ডিজাইন।
- **Real-time Database:** সুপাবেস দিয়ে ইনস্ট্যান্ট ডেটা লোড।
- **Local Fallback:** ইন্টারনেট বা কি (key) না থাকলেও লোকাল স্টোরেজে কাজ করবে।
- **Fully Responsive:** মোবাইল এবং ডেক্সটপ সব ডিভাইসের জন্য পারফেক্ট।

© 2026 Seba Foundation | মানবতার কল্যাণে।
