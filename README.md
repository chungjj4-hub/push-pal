# Push Pal

Personal AI fitness coaching app for Justin. Syncs WHOOP recovery data automatically, imports COROS workouts via .fit files, and uses Claude to generate daily briefings and conversational coaching.

---

## Setup

### 1. Prerequisites

Install Node.js 22 (required — Node 26 has native module compatibility issues):

```bash
brew install node@22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

Add the export line to your `~/.zshrc` to make it permanent.

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

**Anthropic API Key**
- Get from https://console.anthropic.com
- Paste into `ANTHROPIC_API_KEY=`

**WHOOP OAuth2**
- Go to https://developer.whoop.com and create a new app
- Set the redirect URI to: `http://localhost:3001/whoop/callback`
- Copy the Client ID and Client Secret into your `.env`

### 3. Install Dependencies

```bash
# From the coach/ root:
npm install
npm install --prefix server
npm install --prefix client
```

### 4. Run the App

```bash
npm run dev
```

This starts:
- Backend API at `http://localhost:3001`
- Frontend at `http://localhost:5173`

### 5. Connect WHOOP (one-time)

Visit `http://localhost:3001/whoop/auth` in your browser. This redirects to WHOOP's OAuth flow. After authorizing, you'll be redirected back to the app.

On first launch, Push Pal automatically backfills 90 days of WHOOP recovery and sleep data. After that, it syncs every hour in the background.

### 6. Import COROS Workouts

Push Pal does not use the COROS API. Instead, export .fit files directly from the COROS app:

1. Open the COROS app on your phone
2. Tap Profile → Settings → Export Data
3. Select the activities you want to import
4. Export as .fit
5. AirDrop or transfer to your Mac
6. Open Push Pal → Log tab → "Import from COROS" section
7. Drag and drop the .fit files (or click to browse)

You can import multiple files at once. Re-importing the same file is safe — duplicates are detected by a hash of the activity's date, type, and duration.

---

## Architecture

```
COROS Watch → .fit files → Push Pal (drag & drop upload)
WHOOP Band  → WHOOP Cloud  ← Express backend (polls hourly)
                                      ↓
                               SQLite (data/coach.db)
                                      ↓
                              React frontend (Vite)
                                      ↓
                          Anthropic (claude-sonnet-4-6)
```

**Stack:** Node.js 22 + Express · SQLite (better-sqlite3) · React + Vite + Tailwind · Recharts · Anthropic SDK · node-cron · multer + fit-file-parser
