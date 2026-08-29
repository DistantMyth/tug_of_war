# Tug of War: Production Event Day Runbook

This runbook outlines the exact step-by-step procedures for operating the **Tug of War** real-time multiplayer orientation game on event day.

---

## 1. Pre-Event Checklist (T-60 Minutes)

### Infrastructure & Deployments
1. **Verify Backend Health**:
   - Make an HTTP request to `https://YOUR-BACKEND.onrender.com/health`.
   - Ensure the JSON response reports `"ok": true`, `"redis": "ok"`, and `"mongo": "ok"` (or `"not_configured"` if running in local test mode).
2. **Verify Frontend SPA Routes**:
   - Open `https://YOUR-FRONTEND.vercel.app/join` in a private browser window.
   - Open `https://YOUR-FRONTEND.vercel.app/display` on the projector machine (16:9 1080p+ fullscreen, press `F11`).
   - Open `https://YOUR-FRONTEND.vercel.app/admin` on the host control laptop.
3. **Verify Secrets & Audio**:
   - On the `/admin` laptop, enter the `ADMIN_PASSWORD` to authenticate.
   - On the `/display` projector, test the audio toggle (unmute if venue sound system is connected).
4. **Permanent PPT QR Check**:
   - Scan the permanent slide QR code with a test phone.
   - Verify it immediately resolves `https://YOUR-FRONTEND.vercel.app/join`, bootstraps participant token, and renders `/game`.
5. **Staging / Deployment Capacity Testing (300 & 500 Clients)**:
   - Before the event, run the staging load test CLI against the deployed Render/Upstash backend:
     ```bash
     LOADTEST_BASE_URL=https://tow-game-server.onrender.com \
     LOADTEST_ADMIN_SECRET=YOUR_ADMIN_PASSWORD \
     LOADTEST_DISPLAY_SECRET=YOUR_DISPLAY_SECRET \
     LOADTEST_CLIENT_COUNT=300 \
     pnpm --filter @tow/server loadtest:staging
     ```
   - Verify that 300/300 clients connect and 100% lossless tap scores are reported.
   - Repeat with `LOADTEST_CLIENT_COUNT=500`.
6. **Pre-Show Dry Run**:
   - In `/admin`, click **Open / Reset Lobby**.
   - Select teams with 2 test phones.
   - Click **Lock Roster** $\rightarrow$ **Start Countdown** $\rightarrow$ Tap $\rightarrow$ **End Round**.
   - Verify that winner reveals and confetti renders on the projector.
   - Click **Open / Reset Lobby** to reset state for the real orientation audience.

> [!CAUTION]
> **DO NOT** trigger code deployments or flush Redis live state once audience members begin entering the auditorium.

---

## 2. Live Event Execution Flow

### Step 1: Open Game & Show Permanent QR
- In `/admin`, click **Open / Reset Lobby**.
- Display slide with the permanent join QR code (`https://YOUR-FRONTEND.vercel.app/join`).
- The `/display` projector screen will show the dynamic live QR code and real-time team participant counters.

### Step 2: Audience Joins & Selects Teams
- Students scan the QR code and land on `/game`.
- Students freely tap **Team Cyan** or **Team Amber** on their phones.
- Watch live counts update dynamically on the projector distribution meter.

### Step 3: Host Locks Roster
- When the host announces *"Teams locked!"*, click **Lock Roster** in `/admin`.
- If counts are even: Projector automatically starts the 3-2-1 countdown.
- If counts are imbalanced: Projector transitions to **Team Balancing** scene showing *"WE NEED X HEROES"*.
- Surplus players see an animated **"Volunteer & Switch Team ⚡"** button on their phones.

### Step 4: Auto-Balance (If needed)
- If volunteers do not balance the teams within 10–15 seconds, the host clicks **Confirm Auto-Balance** in `/admin`.
- The system deterministically balances rosters and assigns **1 Chaos Player** if the total is odd.
- The Chaos Player's phone displays the special violet/gold Wildcard Hero badge.

### Step 5: Countdown & Battle (RUNNING)
- 3-2-1-GO cinematic countdown triggers on projector and phones.
- Audience taps the giant responsive TAP button on their phones.
- The central tug-of-war meter and score counters update at ~10 Hz on the projector screen.

### Step 6: Host Match Controls (Optional)
- **Pause**: Click **Pause** in `/admin` to freeze the match (e.g. for MC announcements). Click **Resume** to continue with remaining time.
- **Extend**: Click **+5s**, **+10s**, or **+15s** in `/admin` to add extra time to close battles.

### Step 7: Round Conclusion & Winner Reveal
- Server-authoritative round clock reaches 00:00.0.
- Projector triggers celebratory confetti, displays the winning team, margin of victory, and final scores.
- Phones display victory or effort cards.

### Step 8: Play Again (Rematch)
- To play another round with the **same audience teams**, click **Play Next Round (Same Teams)** in `/admin`.
- Round 2 countdown launches automatically without participants needing to rescan or re-register.

---

## 3. Emergency Procedures

| Issue | Immediate Action |
|---|---|
| **Projector browser disconnected** | Simply refresh the `/display` tab or press `F5`. The screen will re-sync with live state within 100ms. |
| **Admin laptop reloaded** | Re-enter admin password in `/admin`. All live telemetry and controls instantly restore. |
| **Single participant phone dropped** | The participant simply refreshes `/game`. Identity and team assignments are restored from `localStorage`. |
| **Unruly / accidental match start** | Click **Pause** or **End Round** in `/admin` to reset or conclude immediately. |
| **Server process reboot** | Server automatically recovers active round clocks or countdowns from authoritative Redis live state. |

---

## 4. Required Production Environment Variables

### Backend (Render Web Service)
```env
NODE_ENV=production
PORT=3001
CLIENT_ORIGIN=https://YOUR-FRONTEND.vercel.app
REDIS_URL=rediss://default:YOUR_PASSWORD@YOUR_UPSTASH_ENDPOINT:6379
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASS@YOUR_CLUSTER.mongodb.net/tug_of_war?retryWrites=true&w=majority
PLAYER_TOKEN_SECRET=YOUR_RANDOM_SECURE_JWT_SECRET_KEY_MIN_16_CHARS
ADMIN_PASSWORD=YOUR_STRONG_HOST_ADMIN_SECRET
DISPLAY_SECRET=YOUR_STRONG_PROJECTOR_SECRET
```

### Frontend (Vercel)
```env
VITE_API_URL=https://YOUR-BACKEND.onrender.com
VITE_SOCKET_URL=https://YOUR-BACKEND.onrender.com
```
