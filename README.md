# API Rate Limiter Dashboard

Monitor your API usage in real-time. Never hit rate limits unexpectedly. Now with a full Node.js backend!

## Features

- **26 API Presets** — OpenAI, Claude, Gemini, GitHub, Stripe, Discord, and more
- **Real-time Monitoring** — WebSocket-powered live updates
- **Rate Limit Tracking** — Progress bars with warning/block thresholds
- **Smart Alerts** — Configurable warning (default 80%) and blocked (100%) alerts
- **Browser Notifications** — Get notified when rate limits are hit
- **Cooldown Timer** — Auto-reset when limit expires
- **Key Management** — Edit, organize, add notes, set expiry dates
- **Folder System** — Organize keys into folders
- **Category Filters** — Filter presets by AI, Dev, Payment, Social, etc.
- **Bulk Operations** — Select and reset/delete multiple keys at once
- **Usage Charts** — Usage over time (1H/24H/7D) and requests by service
- **Category Breakdown** — See usage stats per category
- **Health Check** — Check individual key health status
- **Export/Import** — Backup and restore your data
- **Dark/Light Mode** — Toggle with one click
- **Keyboard Shortcuts** — N (name focus), Ctrl+R (refresh), / (search), ? (help)
- **Toast Notifications** — Non-intrusive feedback messages
- **Connection Status** — Visual indicator of server connection
- **Responsive** — Works on mobile, tablet, and desktop

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/SirYadav1/api-rate-limiter.git
cd api-rate-limiter

# Install dependencies
npm install

# Start the server
npm start
```

### Development Mode

```bash
npm run dev
```

The server will start at `http://localhost:3000`

## API Endpoints

### Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/keys` | Get all keys (supports ?folder, ?category, ?search, ?sort) |
| GET | `/api/keys/:id` | Get single key |
| POST | `/api/keys` | Create new key |
| PUT | `/api/keys/:id` | Update key |
| DELETE | `/api/keys/:id` | Delete key |
| POST | `/api/keys/:id/simulate` | Simulate a request |
| POST | `/api/keys/:id/reset` | Reset key usage |
| POST | `/api/keys/bulk` | Bulk operations (delete/reset) |
| GET | `/api/keys/meta/folders` | Get all folders |
| POST | `/api/keys/meta/folders` | Create folder |
| DELETE | `/api/keys/meta/folders/:name` | Delete folder |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/stats` | Get overall statistics |
| GET | `/api/analytics/usage` | Get usage history (?period=hour/day/week) |
| GET | `/api/analytics/services` | Get service breakdown |
| GET | `/api/analytics/health/:id` | Get key health status |

### Logs & Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/logs` | Get request logs |
| DELETE | `/api/logs` | Clear all logs |
| GET | `/api/alerts` | Get alerts (?type, ?unread_only) |
| PUT | `/api/alerts/:id/read` | Mark alert as read |
| PUT | `/api/alerts/read-all` | Mark all alerts as read |
| DELETE | `/api/alerts` | Clear all alerts |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |

## WebSocket Events

Connect to `ws://localhost:3000` for real-time updates:

```javascript
// Server sends:
{ type: 'key:created', data: { ... } }
{ type: 'key:updated', data: { ... } }
{ type: 'key:deleted', data: { id: '...' } }
{ type: 'request:logged', data: { service, status, response_time } }
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | Focus on name input |
| `Ctrl+R` | Refresh data |
| `/` | Focus on search |
| `?` | Show shortcuts |

## Tech Stack

- **Backend:** Node.js, Express, SQLite (better-sqlite3)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Real-time:** WebSocket (ws)
- **Charts:** Chart.js
- **Database:** SQLite with WAL mode

## Project Structure

```
api-rate-limiter/
├── server.js          # Express server + WebSocket
├── db.js              # SQLite database setup
├── routes/
│   ├── keys.js        # API key CRUD + simulate
│   ├── logs.js        # Request log endpoints
│   ├── alerts.js      # Alert management
│   └── analytics.js   # Stats and health checks
├── public/
│   ├── index.html     # Frontend HTML
│   ├── app.js         # Frontend JavaScript
│   └── style.css      # Styles + dark/light theme
├── .env               # Environment config
├── .gitignore
└── package.json
```

## Supported APIs

| Category | APIs |
|----------|------|
| AI | OpenAI, Claude, Gemini, Groq, HuggingFace |
| Dev | GitHub, GitLab, NPM, Docker Hub |
| Payment | Stripe, Razorpay, PayPal |
| Social | Twitter/X, Discord, Telegram |
| Media | Spotify, YouTube |
| Comm | Twilio, SendGrid, Mailgun |
| Cloud | Firebase, AWS, Cloudflare, Supabase |
| DB | MongoDB, Redis |

## Author

SirYadav1 — [GitHub](https://github.com/SirYadav1)

## License

ISC
