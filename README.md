# Remotion Render Server (Production-Ready)

## Overview
A modular, production-ready Express server for rendering Remotion videos, with:
- Modular routes, services, and middleware
- Zod-based input validation
- S3 video uploads
- CloudWatch and webhook logging
- Rate limiting, security headers, and request logging

## Project Structure
```
server/
  routes/         # Express routers (renders, logs, webhook)
  services/       # Logger, S3, webhook logic
  middleware/     # Error handler, rate limiter, request logger
  utils/          # Zod validation schemas
  render-queue.ts # Render queue logic
  index.ts        # App entrypoint
```

## Environment Setup
Create a `.env` file with:
```
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=your-region
S3_BUCKET=your-bucket-name
CLOUDWATCH_LOG_GROUP=remotion-render-server-logs
CLOUDWATCH_LOG_STREAM=default-stream
```

## Running the Server
```bash
npm install
npm start
```

## API Usage

### 1. Create a Render Job
**POST** `/renders`
```json
{
  "titleText": "Hello, world!",         // (optional, default: "Hello, world!")
  "compositionId": "HelloWorld",        // (required)
  "serveUrl": "http://localhost:3000"   // (required)
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

### 2. Get Render Job Status
**GET** `/renders/:jobId`

### 3. Cancel a Render Job
**DELETE** `/renders/:jobId`

### 4. View Server Logs
**GET** `/logs`

### 5. Health Check
**GET** `/health`

### 6. Webhook Log Delivery
Register to receive real-time logs via HTTP POST.
- **POST** `/webhook-logs/register` `{ "url": "https://your-webhook-endpoint" }`
- **POST** `/webhook-logs/unregister` `{ "url": "https://your-webhook-endpoint" }`
- Payload: `{ "log": "[timestamp] log message" }`

#### Sample Webhook Receiver (Node.js)
```js
const express = require('express');
const app = express();
app.use(express.json());
app.post('/', (req, res) => {
  console.log('Received log from webhook:', req.body.log);
  res.status(200).json({ message: 'Log received' });
});
app.listen(4000);
```

## How to Extend
- Add new routes in `server/routes/` and mount in `index.ts`.
- Add new services in `server/services/`.
- Add new validation schemas in `server/utils/validation.ts`.
- Add new middleware in `server/middleware/`.

## Production Best Practices Used
- Zod for input validation
- CloudWatch and webhook logging
- S3 for video storage
- Helmet for security headers
- CORS enabled
- Rate limiting (60 req/min)
- Request logging (morgan)
- Async error handling
- Modular, maintainable codebase
