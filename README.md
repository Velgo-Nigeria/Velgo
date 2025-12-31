
# Velgo Nigeria

The trusted app bridging the gap between verified local Workers and Clients in Nigeria. Platform ensures 100% of service fees go directly to the worker.

## 🚀 Deployment Guide

### Step 1: Push to GitHub
Click the **"Save to GitHub"** button at the top right of your editor to save this project to your GitHub account.

### Step 2: Deploy to Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Select the `velgo-nigeria` repository you just created.
4. **Important**: Under **Environment Variables**, add the following keys matching your project settings:

| Variable Name | Description |
|---------------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon/Public Key |
| `VITE_PAYSTACK_PUBLIC_KEY` | Your Paystack Public Key (starts with `pk_live_` or `pk_test_`) |
| `GEMINI_API_KEY` | Your Google Gemini API Key |

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
