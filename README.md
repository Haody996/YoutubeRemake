# YoutubeRemake

A self-hosted, YouTube-style video sharing app. Users can upload videos, browse a gallery, watch with view tracking, like, comment, and keep a personal watch history and library. Video files and thumbnails are stored in Cloudflare R2 (S3-compatible) object storage.

## Stack

- **Client** — React 19 + Vite 7, Tailwind CSS 4
- **Server** — Node.js + Express 5, SQLite (`better-sqlite3`)
- **Auth** — JWT cookies + Google OAuth (`google-auth-library`), passwords hashed with `bcryptjs`
- **Storage** — Cloudflare R2 via the AWS S3 SDK (presigned URLs for upload/playback)
- **Deploy** — Docker / Docker Compose

## Features

- Email/password and Google sign-in
- Video upload to R2 with thumbnail upload/generation
- Video gallery, watch page, and per-video view counts
- Likes and comments
- Personal watch history and library ("my videos")
- Age gate
- Optional admin users via `ADMIN_USERNAMES`

## Project structure

```
.
├── client/              # React + Vite frontend
│   └── src/components/   # AgeGate, AuthModal, VideoGallery, WatchPage, etc.
├── server/              # Express API
│   ├── index.js          # All routes + SQLite setup
│   └── data/             # SQLite database (gitignored, created at runtime)
└── docker-compose.yml   # Builds and runs client + server
```

## Configuration

Create a `.env` file in the project root (it is gitignored). Required variables:

| Variable | Description |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket for videos/thumbnails |
| `JWT_SECRET` | Secret for signing JWTs — generate with `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (server) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID (client build) |
| `ADMIN_USERNAMES` | Optional, comma-separated list of admin usernames |
| `PORT` | Server port (default `5000`) |
| `NODE_ENV` | `development` or `production` |

## Running locally

**Server**

```bash
cd server
npm install
node index.js          # serves the API on http://localhost:5000
```

**Client**

```bash
cd client
npm install
npm run dev            # Vite dev server, default http://localhost:5173
```

The SQLite database is created automatically under `server/data/` on first run.

## Running with Docker

The Compose file expects an external Docker network named `web_proxy` (intended to sit behind a reverse proxy):

```bash
docker network create web_proxy   # once, if it doesn't exist
docker compose up -d --build
```

This builds the `lustbuster_web` (client) and `lustbuster_api` (server) containers. The server's `./server/data` directory is mounted as a volume so the database persists.

## API overview

All endpoints are under `/api`. Routes marked 🔒 require authentication.

- **Auth** — `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/google`, `POST /api/auth/logout`, `GET /api/auth/me` 🔒
- **Videos** — `GET /api/videos`, `GET /api/videos/url`, `GET /api/videos/thumbnail`, `POST /api/videos/upload` 🔒, `POST /api/videos/thumbnail/upload` 🔒, `GET /api/videos/my` 🔒, `DELETE /api/videos/my` 🔒
- **Views** — `POST /api/views`, `GET /api/views/all`
- **Likes** — `GET /api/likes/video`, `GET /api/likes/my` 🔒, `POST /api/likes` 🔒, `DELETE /api/likes` 🔒
- **Comments** — `GET /api/comments`, `POST /api/comments` 🔒, `DELETE /api/comments/:id` 🔒
- **History** — `GET /api/history` 🔒, `POST /api/history` 🔒, `DELETE /api/history/item` 🔒, `DELETE /api/history` 🔒
- **Health** — `GET /health`

## Notes

- `.env` files and `server/data/` (the database and its `-wal`/`-shm` files) are gitignored and never committed.
