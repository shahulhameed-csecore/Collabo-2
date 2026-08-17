# Collabo

**AI-Powered Influencer Campaign Manager for D2C Brands**

**Live Website:** [https://mycollabo.online](https://mycollabo.online)

---

## Overview

Collabo is a SaaS platform that helps D2C brands and agencies manage micro-influencer campaigns without spreadsheets or messy WhatsApp chats.

Brands can:
- Forward WhatsApp chats, voice notes, or screenshots
- Automatically extract campaign details using **Google Gemini AI**
- Track deadlines, payments, and deliverables in one dashboard
- Send Magic Links so influencers can upload proof without creating an account

---

## Key Features

### 1. AI Campaign Extraction
- Upload WhatsApp screenshots, PDFs, or voice notes
- Google Gemini automatically extracts:
  - Influencer name & handle
  - Platform (Instagram, YouTube, etc.)
  - Deliverables
  - Deadline
  - Payment amount
- Human-in-the-loop review before saving

### 2. WhatsApp Bot Integration
- Forward chats or send voice notes directly to the Collabo WhatsApp bot
- Campaign is created automatically
- No need to open the website

### 3. Magic Link Proof Upload
- Each campaign gets a unique Magic Link
- Influencer opens the link and uploads video/screenshot
- No login required for the influencer
- Brand receives the proof for review

### 4. Campaign Management Dashboard
- Track campaigns through statuses: Draft → Active → In Review → Approved → Paid
- Calendar view of upcoming deadlines
- Automated email + WhatsApp reminders
- Export campaigns to CSV

### 5. Influencer CRM
- Store influencer details and campaign history
- Track performance and payment history

---

## Tech Stack

| Layer           | Technology                                  |
|-----------------|---------------------------------------------|
| Frontend        | Next.js 15, Tailwind CSS, shadcn/ui         |
| Backend         | FastAPI (Python)                            |
| Database & Auth | Supabase (PostgreSQL + Auth + RLS)          |
| AI              |          Google Gemini API                  |
| Payments        |      Razorpay                               |
| Hosting         |     Vercel (Frontend) + Render (Backend)    |

---

## How It Works

1. Brand negotiates with influencer on WhatsApp
2. Brand forwards the chat / screenshot / voice note to Collabo
3. Gemini extracts structured campaign data
4. Brand reviews and activates the campaign
5. Influencer receives a Magic Link to upload proof
6. Brand reviews the content and marks it as Approved / Needs Revision
7. Automated reminders keep both sides on track

---

## Project Structure
Collabo-2/
├── app/                    # FastAPI backend

│   ├── api/                # API routes

│   ├── services/           # Gemini, WhatsApp, Reminders

│   └── core/               # Config, security, limiter

├── frontend/               # Next.js frontend

└── supabase_migrations/    # Database schema & RLS



---

## Getting Started (Local Development)

### Backend

bash:
cd influencertrack-backend

python -m venv venv

source venv/bin/activate   # or venv\Scripts\activate on Windows

pip install -r requirements.txt

uvicorn app.main:app --reload




FRONTEND

cd influencertrack-frontend

npm install

npm run dev





Environment Variables

Backend (Render)

SUPABASE_URL

SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

GEMINI_API_KEY

RAZORPAY_KEY_ID

RAZORPAY_KEY_SECRET

WHATSAPP_TOKEN

WHATSAPP_PHONE_NUMBER_ID

Frontend (Vercel)

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

NEXT_PUBLIC_API_URL

NEXT_PUBLIC_RAZORPAY_KEY_ID


Built for

Build with Gemini XPRIZE 2026
