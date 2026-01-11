# Cost Manager (4-process Express + MongoDB Atlas)

This is a **learning scaffold** that matches your project requirements:

- MongoDB Atlas + Mongoose
- Express.js REST endpoints
- Pino logging **stored in MongoDB** (`logs` collection)
- **Computed Design Pattern** for monthly reports (`reports` collection cache)
- Four separate **processes** (4 services):
  1. `users-service` (users endpoints)
  2. `costs-service` (costs endpoints + monthly report)
  3. `logs-service` (logs endpoint)
  4. `admin-service` (about/team endpoint)

> All services connect to the **same** MongoDB database.

---

## 1) Prerequisites

- Node.js 18+ recommended
- A MongoDB Atlas cluster and connection string

---

## 2) Setup

### A. Create `.env` files
Each service has its own `.env.example`. Copy it to `.env` and fill values.

Example:
```bash
cp services/users-service/.env.example services/users-service/.env
cp services/costs-service/.env.example services/costs-service/.env
cp services/logs-service/.env.example services/logs-service/.env
cp services/admin-service/.env.example services/admin-service/.env
```

### B. Install dependencies (all services)
From the repository root:
```bash
npm run install:all
```

---

## 3) Run (4 processes)

From the repository root:
```bash
npm run dev
```

This starts:

- Users service:  http://localhost:3001
- Costs service:  http://localhost:3002
- Logs service:   http://localhost:3003
- Admin service:  http://localhost:3004

---

## 4) Quick manual test (curl)

### Add a user (users-service)
```bash
curl -X POST http://localhost:3001/api/add \
  -H "Content-Type: application/json" \
  -d '{"id":123123,"first_name":"Dana","last_name":"Levi","birthday":"1999-04-21"}'
```

### Add a cost (costs-service)
```bash
curl -X POST http://localhost:3002/api/add \
  -H "Content-Type: application/json" \
  -d '{"description":"choco","category":"food","userid":123123,"sum":12}'
```

### Monthly report (costs-service)
```bash
curl "http://localhost:3002/api/report?id=123123&year=2026&month=1"
```

### User details (users-service)
```bash
curl http://localhost:3001/api/users/123123
```

### Team/about (admin-service)
```bash
curl http://localhost:3004/api/about
```

### Logs (logs-service)
```bash
curl http://localhost:3003/api/logs
```

---

## Notes on the Computed Design Pattern

- For **past months** (relative to the server date), `/api/report` first checks the `reports` collection.
- If a cached report exists, it returns it immediately.
- If not, it computes it from `costs`, stores it to `reports`, and returns it.
- The server rejects adding a cost with a `createdAt` date-time in the past (tolerance: 5 seconds).

---

## Collections used

Required:
- `users`
- `costs`
- `logs`

Extra (for computed design pattern cache):
- `reports`

---

## 5) Reset DB to the required submission state

The submission guidelines require the database to be **empty**, except for a
single imaginary user:

- `id: 123123`
- `first_name: mosh`
- `last_name: israeli`

Because the project spec also requires a `birthday` field, the reset script
inserts a default birthday as well.

Run from repo root:

```bash
node scripts/reset-db.js --env services/users-service/.env
```

This clears: `users`, `costs`, `logs`, `reports` and inserts the imaginary user.

---

## 6) Deployment options (4 processes)

You must deploy **4 separate processes** and provide **4 URLs**.

### Option A (simple + robust): One VPS, 4 ports

1. Create a VPS (Ubuntu) and open firewall/security-group ports:
   - 3001, 3002, 3003, 3004
2. Install Node.js and run each service with `npm start` using a process manager
   (PM2 is a common choice).
3. Your URLs will look like:
   - `http://<server-ip>:3001/api/users`
   - `http://<server-ip>:3002/api/report?...`
   - `http://<server-ip>:3003/api/logs`
   - `http://<server-ip>:3004/api/about`

### Option B: Docker Compose on one VPS

1. Install Docker + Docker Compose on the VPS.
2. Copy `.env` files to the server.
3. Run:

```bash
docker compose up -d --build
```

---

## 7) Generate the submission PDF (code + filenames)

The course requires a single PDF that contains all the code files you wrote,
with each file name next to its code.

This repo includes a helper script:

```bash
pip install reportlab
python scripts/make_submission_pdf.py \
  --header submission/HEADER_TEMPLATE.txt \
  --output moshe_israeli.pdf
```

Edit `submission/HEADER_TEMPLATE.txt` before generating the PDF.
