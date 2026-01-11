# Submission Guide (Checklist)

Use this as a checklist to make sure you don't lose easy points due to packaging
or formatting.

## 1) Deploy (4 processes)

You must provide **4 URL addresses**, one per microservice:

1. Users service (users endpoints)
2. Costs service (costs endpoints + monthly report)
3. Logs service (logs endpoint)
4. Admin service (about/team)

If you deploy on a single server, the safest interpretation of the requirement
is that each service should run on a different port. This scaffold defaults to:

- Users: 3001
- Costs: 3002
- Logs: 3003
- Admin: 3004

## 2) Database initial state (very important)

Before submitting, reset your MongoDB database so it is empty except for the
single imaginary user:

- id: 123123
- first_name: mosh
- last_name: israeli

Because the project spec also requires a `birthday` field, the reset script
inserts a default birthday.

From repo root:

```bash
node scripts/reset-db.js --env services/users-service/.env
```

## 3) Video (<= 60 seconds)

Record a short screen capture showing:

- All 4 services are running (4 terminals or a process manager dashboard)
- A couple of successful API calls (curl/Postman) showing JSON replies
- A quick look at the MongoDB Atlas collections (users/costs/logs/reports)

Upload to YouTube as **Unlisted** and copy the link into your PDF header.

## 4) ZIP (without node_modules)

Create a ZIP that includes:

- All services source code
- Any tests you wrote
- Docs (README, etc.)

But **exclude** `node_modules`.

Example command from repo root:

```bash
zip -r final_project.zip . \
  -x "**/node_modules/**" \
  -x "**/.git/**" \
  -x "**/.env"
```

## 5) PDF (all code files + filenames)

The PDF must contain the code for every file you wrote, with the file name
next to the code.

This repository includes a helper script:

```bash
pip install reportlab
python scripts/make_submission_pdf.py \
  --header submission/HEADER_TEMPLATE.txt \
  --output moshe_israeli.pdf
```

Edit `submission/HEADER_TEMPLATE.txt` first.

## 6) Fill the form with 4 URLs

Prepare 4 URLs (one per microservice) and paste them into the submission form.

Example format:

- Users: `http://<host>:3001/api/users`
- Costs: `http://<host>:3002/api/report?id=123123&year=2026&month=1`
- Logs: `http://<host>:3003/api/logs`
- Admin: `http://<host>:3004/api/about`
