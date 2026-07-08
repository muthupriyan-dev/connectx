# ConnectX ⚡

Anonymous, secure random video chat platform built with **WebRTC**, **Node.js**, **Express**, and **Socket.IO**.

---

## Features

- 🎥 Random video, audio, and text-only chat matching
- ⏭️ Instant skip / 📞 leave
- 💬 Live text chat with typing indicator, timestamps, auto-scroll
- 🎤 Mic toggle, 📹 camera toggle, 🔄 camera switch, ⛶ fullscreen, 🗗 Picture-in-Picture
- 🌗 Dark/light theme, glassmorphism UI, smooth animations
- 🚩 Report & 🚫 Block tools, anonymous auto-generated usernames
- 🔒 Helmet, CORS, HTTP + Socket-level rate limiting, XSS-safe input handling
- 📱 Fully responsive, mobile-first controls

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Real-time signaling & chat | Socket.IO |
| Peer video/audio | WebRTC (STUN + TURN) |
| Security | Helmet, CORS, express-rate-limit, validator |

---

## Project Structure

```
connectx/
├── server/
│   ├── config/config.js          # env-driven app configuration
│   ├── controllers/statsController.js
│   ├── routes/{index.js, api.js}
│   ├── socket/{index.js, matchmaking.js, events.js}
│   ├── utils/{logger.js, validator.js, rateLimiter.js}
│   └── server.js                 # entry point
├── client/public/
│   ├── index.html
│   ├── css/{style.css, animations.css}
│   └── js/{ui.js, socket-client.js, webrtc.js, chat.js, app.js}
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Installation

### 1. Clone / upload the project

Upload the full `connectx/` folder to a new GitHub repository (works fine via GitHub's web upload UI if you don't have a laptop).

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on (default `5000`) |
| `NODE_ENV` | `development` or `production` |
| `CLIENT_ORIGIN` | Allowed origin(s) for CORS, comma-separated |
| `STUN_SERVER` | STUN server URL (Google's public STUN works free) |
| `TURN_SERVER_URL` / `TURN_SERVER_USERNAME` / `TURN_SERVER_CREDENTIAL` | TURN credentials (needed for production - see below) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | HTTP API rate limiting |
| `SOCKET_MAX_MESSAGE_LENGTH` / `SOCKET_MESSAGE_RATE_LIMIT` | Chat spam protection |
| `MAX_ROOM_LIFETIME_MS` | Safety cap on how long a single room may stay open |

### 4. Run in development

```bash
npm run dev
```

Visit `http://localhost:5000`.

### 5. Run in production

```bash
npm start
```

---

## How WebRTC Works Here

1. **Signaling (via Socket.IO):** Two matched users exchange an SDP *offer*, an SDP *answer*, and *ICE candidates* through the server — the server only relays these messages, it never touches the media itself.
2. **STUN:** Helps each peer discover its public IP/port so a direct peer-to-peer connection can be attempted (works for most home/mobile networks).
3. **TURN:** When a direct connection isn't possible (symmetric NATs, strict corporate firewalls), traffic is relayed through a TURN server instead. **TURN is required for reliable production use** — without it, a meaningful percentage of pairings will fail to connect.
4. Once signaling completes, video/audio flows **directly between the two browsers** (or through TURN) — the Node server is never in the media path, keeping bandwidth costs low.

## How Socket.IO Is Used

- **Matchmaking:** `find-partner`, `skip-partner`, `leave-chat` events manage a FIFO waiting queue and pairing.
- **Signaling relay:** the generic `signal` event carries `{ type: 'offer' | 'answer' | 'ice-candidate', data }` between exactly two peers in a private Socket.IO room.
- **Chat:** `chat-message` and `typing` events, rate-limited per socket to prevent flooding.
- **Moderation:** `report-user` and `block-user` events; blocked pairs are excluded from future matches.
- **Presence:** `online-count` is broadcast to all clients whenever someone connects/disconnects.

---

## Deployment Guide

### Deploying to Render

1. Push your project to a GitHub repository.
2. On [Render](https://render.com), create a **New Web Service** and connect your repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all variables from `.env.example` under **Environment**.
6. Set `CLIENT_ORIGIN` to your Render URL, e.g. `https://your-app.onrender.com`.
7. Deploy — Render auto-detects the Node app and provides HTTPS out of the box (required for camera/mic access in browsers).

### Deploying to Railway

1. Push to GitHub, then on [Railway](https://railway.app) choose **Deploy from GitHub repo**.
2. Railway auto-detects `npm start`. Add environment variables under the **Variables** tab.
3. Generate a public domain under **Settings → Networking** and set `CLIENT_ORIGIN` accordingly.
4. Deploy.

### Deploying to a VPS

1. Install Node.js 18+, then `git clone` your repo and run `npm install --production`.
2. Use a process manager: `npm install -g pm2 && pm2 start server/server.js --name connectx`.
3. Put Nginx in front as a reverse proxy with a valid TLS certificate (Let's Encrypt) — **HTTPS is mandatory** for `getUserMedia()` to work in browsers, except on `localhost`.
4. Ensure your Nginx config supports WebSocket upgrade headers for Socket.IO:
   ```nginx
   location / {
     proxy_pass http://localhost:5000;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
   }
   ```

### Configuring a TURN Server for Production

Public STUN alone will fail to connect roughly 10-20% of real-world users (corporate networks, some mobile carriers, symmetric NAT). For production you need a TURN server:

- **Managed options (fastest):** [Metered.ca](https://www.metered.ca/tools/openrelay/), Twilio Network Traversal Service, or Xirsys — all offer free tiers plus paid scaling.
- **Self-hosted:** Install [coturn](https://github.com/coturn/coturn) on a VPS with a static IP and open UDP/TCP ports `3478` and a relay range (e.g. `49152-65535`).
- Once you have credentials, set `TURN_SERVER_URL`, `TURN_SERVER_USERNAME`, and `TURN_SERVER_CREDENTIAL` in your environment — `config.js` automatically includes them in the ICE server list sent to clients via `/api/ice-config`.

---

## Troubleshooting

| Issue | Likely Cause / Fix |
|---|---|
| Camera/mic permission denied | Browsers require **HTTPS** (or `localhost`) for `getUserMedia`. Check your deployment has valid TLS. |
| Video never connects between two peers | Missing TURN server — test by adding TURN credentials; roughly 1 in 5 real networks need it. |
| "Too many requests" errors | Adjust `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` in `.env`. |
| Socket.IO fails to connect / CORS errors | Ensure `CLIENT_ORIGIN` in `.env` exactly matches the URL users load the app from (including protocol). |
| Messages not appearing for partner | Confirm both sockets joined the same room — check server logs for `Paired` entries. |
| High memory usage over time | The socket rate-limiter auto-sweeps stale entries; ensure `disconnect` handlers are firing (check logs). |
| App works locally but not after deploy | Re-check environment variables are set on the hosting platform's dashboard, not just in a local `.env` file (which is git-ignored). |

---

## Security Notes

- Chat messages are HTML-escaped server-side (`validator.escape`) before broadcast, and rendered client-side via `textContent` (never `innerHTML`) as defense in depth.
- The server never inspects or stores SDP/media content — it only relays signaling data shape-validated as `offer` / `answer` / `ice-candidate`.
- Usernames are auto-generated and anonymous; no personal data is collected or persisted.
- Report/Block are client-triggered safety tools; in a full production deployment, reports should be persisted to a moderation database and reviewed by a human team.

---

## License

MIT — feel free to adapt ConnectX for your own projects.
