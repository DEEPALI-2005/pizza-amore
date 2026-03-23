# 🍕 The Pizza Amore — Setup Guide

## Ye 4 simple steps mein chalu ho jaayega!

─────────────────────────────────────────────

## STEP 1 — Software Install Karo (pehli baar sirf)

### Node.js
  https://nodejs.org  →  "LTS" version download karo → install karo

### PostgreSQL
  https://postgresql.org/download  →  apne Windows/Mac ke liye download karo

─────────────────────────────────────────────

## STEP 2 — .env File Banao

  pizza-amore folder mein ".env.example" file hai
  usse copy karo aur naam rakho  ".env"
  Phir usme apni details bharo:

    DB_HOST=localhost
    DB_PORT=5432
    DB_NAME=pizza_amore
    DB_USER=postgres
    DB_PASSWORD=APNA_POSTGRESQL_PASSWORD_YAHAN
    PORT=3000
    ADMIN_PASSWORD=APNA_ADMIN_PASSWORD_YAHAN

─────────────────────────────────────────────

## STEP 3 — Database Banao

PostgreSQL ka "pgAdmin" tool kholo (install ke saath aata hai)
Ya terminal/cmd kholo aur type karo:

  psql -U postgres

Phir yeh commands:

  CREATE DATABASE pizza_amore;
  \c pizza_amore
  \i C:/path/to/pizza-amore/schema.sql

  (schema.sql ka poora path likhna hai)

─────────────────────────────────────────────

## STEP 4 — Server Chalu Karo

Terminal/CMD mein pizza-amore folder mein jao:

  cd C:\Users\YourName\pizza-amore

Phir:

  npm install        ← pehli baar sirf ek baar
  node server.js     ← server start karo

Ab browser mein kholo:

  Website  →  http://localhost:3000
  Admin    →  http://localhost:3000/admin

─────────────────────────────────────────────

## STEP 5 — Apna UPI ID Set Karo

  public/index.html file mein dhundho:

    const CAFE_UPI = 'YOUR_UPI@upi';

  Badlo apne UPI se, jaise:

    const CAFE_UPI = '7453950529@ybl';

─────────────────────────────────────────────

## ADMIN PANEL Features

  URL     : http://localhost:3000/admin
  Password: jo .env mein ADMIN_PASSWORD set kiya

  - Aaj ke orders aur revenue dekho
  - Total orders aur kamaai dekho
  - Status, date, phone se filter karo
  - Order status change karo:
      Pending → Confirmed → Preparing → Out for Delivery → Delivered
  - Har 30 second mein auto-refresh

─────────────────────────────────────────────

## File Structure

  pizza-amore/
  ├── server.js          ← Backend (Express + PostgreSQL)
  ├── schema.sql         ← Database tables
  ├── package.json       ← Node dependencies
  ├── .env.example       ← Config template
  ├── README.md          ← Ye file
  └── public/
      ├── index.html     ← Customer website
      └── admin.html     ← Admin dashboard

─────────────────────────────────────────────

## Koi dikkat aaye toh

  📞 Error message copy karke share karo
  Common problems:
  - "DB connection failed" → .env mein password check karo
  - "npm not found"        → Node.js dobara install karo
  - Port 3000 busy         → .env mein PORT=3001 kar do
