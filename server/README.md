# Website Backend

Minimal Node.js + Express backend providing:
- /api/messages (GET, POST, DELETE)
- /api/tree (GET)
- /api/water (POST)
- /api/harvest (POST) — requires admin password

Setup

1. Install dependencies:

```bash
cd server
npm install
```

2. Start server:

```bash
npm start
```

By default the admin password is `971314`. Change it by setting `ADMIN_PW` environment variable.

The server also serves the static site root (one directory up) for convenience.
