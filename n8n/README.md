# TaskPilot AI — n8n Automation Workflows

This directory contains importable workflow JSON definitions and integration guides for running **TaskPilot AI** reminders, automated deadline alerts, and productivity summaries through **n8n**.

---

## 1. Overview of Workflows

| File | Name | Trigger Schedule | Primary Function |
| :--- | :--- | :--- | :--- |
| [`workflow_a_custom_reminders.json`](./workflows/workflow_a_custom_reminders.json) | Custom Task Reminders | Every 1 minute | Polls due reminders, claims them atomically with a lease, sends email alerts, and records delivery outcome with bounded retry backoff. |
| [`workflow_b_deadline_reminders.json`](./workflows/workflow_b_deadline_reminders.json) | Deadline Reminders | Hourly (8:00 AM – 10:00 PM) | Evaluates incomplete tasks across 4 stages (`upcoming`, `approaching`, `overdue`, `high_priority_unfinished`), deduplicates via persistent database ledger, and sends alerts. |
| [`workflow_c_morning_briefing.json`](./workflows/workflow_c_morning_briefing.json) | Daily Morning Briefing | Daily at 8:00 AM Asia/Kolkata | Fetches today's tasks, overdue items, and habit streak; structures non-overlapping focus timeblocks; dispatches responsive HTML morning briefing. |
| [`workflow_d_evening_review.json`](./workflows/workflow_d_evening_review.json) | Daily Evening Review | Daily at 8:30 PM Asia/Kolkata | Summarizes tasks completed today based on actual `completedAt` timestamps, fetches routine streak, and suggests priorities for tomorrow. |
| [`workflow_e_weekly_report.json`](./workflows/workflow_e_weekly_report.json) | Weekly Productivity Report | Mondays at 8:00 AM Asia/Kolkata | Reviews preceding Monday-to-Sunday performance, habit consistency, top 3 priorities, and 3 practical workflow improvements. |

---

## 2. Server-to-Server Authentication

The backend exposes secured integration endpoints under `/api/n8n/*`. Every request must include the integration secret via the `X-N8N-API-KEY` HTTP header or as a Bearer token in the `Authorization` header:

```http
X-N8N-API-KEY: <N8N_AUTOMATION_SECRET>
```

### Required Backend Environment Variables (`server/.env`)
```bash
# Target recipient email for personal alerts
MY_EMAIL=your-email@example.com

# Timezone for local date calculations and waking hours
DEFAULT_TIMEZONE=Asia/Kolkata

# Shared secret for n8n server-to-server calls (min 16 chars)
N8N_AUTOMATION_SECRET=taskpilot_n8n_sec_994a318e27c15ba8

# Base URL of your backend (default for local dev)
TASKPILOT_API_URL=http://localhost:4000
```

---

## 3. How to Import Workflows into n8n

1. Open your n8n instance in a browser (e.g. `http://localhost:5678`).
2. Go to **Workflows** in the left navigation sidebar.
3. Click the **+ Add Workflow** button (or the three dots `...` in the top right).
4. Select **Import from File...** (or copy the JSON and use **Import from URL / Clipboard**).
5. Choose one of the workflow files from `n8n/workflows/`.
6. Once imported, configure your SMTP or Gmail email credentials on the email node.
7. Click **Save** and toggle the workflow to **Active**.

---

## 4. Email Credential Configuration in n8n

Each workflow uses standard n8n email nodes (`n8n-nodes-base.emailSend` or `n8n-nodes-base.gmail`):

### Option A: SMTP (Recommended for simplicity)
- **Host:** `smtp.gmail.com` (or your SMTP provider)
- **Port:** `587` (STARTTLS) or `465` (SSL/TLS)
- **User:** Your email address
- **Password:** Google App Password (generated under Google Account Security > 2-Step Verification > App Passwords)

### Option B: Gmail OAuth2
- Create a Gmail OAuth2 credential in n8n using your Google Cloud Client ID and Secret.
- Replace the `Send Email` node with the native `Gmail` node, mapping `To`, `Subject`, `Body (HTML)`, and `Body (Text)`.

---

## 5. Testing & Verification

### Test Integration Connectivity via cURL:
```bash
curl -X GET http://localhost:4000/api/n8n/health \
  -H "X-N8N-API-KEY: taskpilot_n8n_sec_994a318e27c15ba8"
```
Expected response:
```json
{
  "ok": true,
  "user": {
    "id": "6724fa...",
    "name": "Your Name",
    "email": "your-email@example.com",
    "timezone": "Asia/Kolkata"
  },
  "recipientEmail": "your-email@example.com",
  "timestamp": "2026-10-25T04:30:00.000Z"
}
```

### Test Due Reminders:
```bash
curl -X GET http://localhost:4000/api/n8n/reminders/due \
  -H "X-N8N-API-KEY: taskpilot_n8n_sec_994a318e27c15ba8"
```

### Test Morning Briefing Dataset:
```bash
curl -X GET http://localhost:4000/api/n8n/reports/morning \
  -H "X-N8N-API-KEY: taskpilot_n8n_sec_994a318e27c15ba8"
```
