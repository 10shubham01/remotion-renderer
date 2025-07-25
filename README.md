# API Usage

### 1. Create a Render Job

**POST** `/renders`

Start a new render job.

**Request Body:**
```json
{
  "titleText": "Hello, world!",         // (string, optional, default: "Hello, world!")
  "compositionId": "HelloWorld",        // (string, required)
  "serveUrl": "http://localhost:3000"   // (string, required)
}
```

**Example:**
```bash
curl -X POST http://localhost:8989/renders \
  -H "Content-Type: application/json" \
  -d '{
    "titleText": "Hello, world!",
    "compositionId": "HelloWorld",
    "serveUrl": "http://localhost:3000"
  }'
```

**Response:**
```json
{
  "jobId": "<job-id>"
}
```

---

### 2. Get Render Job Status

**GET** `/renders/:jobId`

Get the status and details of a render job.

**Example:**
```bash
curl http://localhost:8989/renders/<job-id>
```

**Response:**
```json
{
  "status": "queued" | "in-progress" | "completed" | "failed",
  // ...other job details
}
```

---

### 3. Cancel a Render Job

**DELETE** `/renders/:jobId`

Cancel a running or queued render job.

**Example:**
```bash
curl -X DELETE http://localhost:8989/renders/<job-id>
```

**Response:**
```json
{
  "message": "Job cancelled"
}
```

---

### 4. View Server Logs

**GET** `/logs`

Get recent server logs (in-memory, last 200 entries).

**Example:**
```bash
curl http://localhost:8989/logs
```

**Response:**
```json
{
  "logs": [
    "[2024-06-07T12:00:00.000Z] ...",
    // ...
  ]
}
```

---

### 5. Health Check

**GET** `/health`

Check if the server is running.

**Example:**
```bash
curl http://localhost:8989/health
```

**Response:**
```json
{
  "status": "ok"
}
```
