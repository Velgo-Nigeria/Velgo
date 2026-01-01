
# Velgo Nigeria

The trusted app bridging the gap between verified local Workers and Clients in Nigeria. Platform ensures 100% of service fees go directly to the worker.

## 🚀 Deployment Guide

### Step 1: Push to GitHub
Click the **"Save to GitHub"** button at the top right of your editor to save this project to your GitHub account.

### Step 2: Database Setup (Crucial!)
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project.
3. Once ready, go to the **SQL Editor** tab in the sidebar.
4. Click **"New Query"**.
5. Copy the entire content of `fix_database.sql` from this project.
6. Paste it into the SQL Editor and click **"Run"**.
   - *This will create all the necessary tables, security policies, and automation triggers for the app to work.*

### Step 3: Deploy to Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Select the `velgo` repository you just created.
4. **Important**: Under **Environment Variables**, add the following keys matching your project settings:

| Variable Name | Description |
|---------------|-------------|
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon/Public Key |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack Public Key |
| `GEMINI_API_KEY` | Google Gemini API Key |

5. Click **Deploy**.

## ✨ Features
- **0% Commission Model**: Workers keep 100% of their earnings.
- **Verification System**: Visual badges for verified IDs.
- **AI Integration**: Text translation (English ↔ Pidgin) and Voice-to-Job posting.
- **PWA Ready**: Installable on mobile devices.

## 🛠️ Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with the variables listed above.
3. Run the app:
   ```bash
   npm run dev
   ```
