# SGU Smart-Bite Enterprise

A modern, zero-wait campus dining system built with Vite, React 18, Tailwind CSS, Node.js/Express, and Supabase serverless architecture.

## 🚀 Features

- **Multi-Role Authentication**: Dedicated portals for Students, Campus Vendors, and Admin Managers.
- **Real-Time Kitchen Display System (KDS)**: Instant live ticket queue for vendors with automated status transitions (`Preparing`, `Ready`, `Completed`).
- **Real-Time Order Tracking**: Live visual stepper and digital receipts with instant status broadcasting.
- **Smart Campus Menu & Cart**: Multi-stall browsing, category filtering, search, and dynamic cart management.
- **Automated Digital Invoicing**: EJS email templating with automated receipt dispatching.
- **Admin Control Center**: Campus metrics, stall management, and real-time revenue analytics.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Canvas Confetti
- **Backend**: Node.js, Express, Socket.io, SQLite / Supabase PostgreSQL, EJS Email Engine
- **Deployment**: Vercel Serverless Architecture

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/omgarkal359-gif/Smart-Bite.git

# Install frontend dependencies
npm install

# Install backend dependencies
npm --prefix api install
```

### Running Locally
```bash
# Start Vite Frontend (http://localhost:5173)
npm run dev

# Start Express Backend API (http://localhost:3001)
node api/server.js
```

### Running Tests
```bash
# Run complete test suite (Email templates & Controller unit tests)
node api/tests/runAllTests.js
```

## 🌐 Live Deployment
- **Production URL**: [https://smart-bite-rosy.vercel.app](https://smart-bite-rosy.vercel.app)
