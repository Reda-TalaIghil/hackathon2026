# Flowback Widget Development

## Local Dev Server

```bash
cd widget
npm install
npm run dev
```

Widget loads at http://localhost:5173/flowback.js

## Testing Widget Integration

### Method 1: Test HTML Page (in widget directory)

Create `test.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Flowback Widget Test</title>
</head>
<body>
    <h1>Test Page</h1>
    <button id="checkout-btn">Proceed to Checkout</button>
    <input type="email" placeholder="Email" />
    <button id="pay-btn">Pay Now</button>

    <script>
        window.flowbackConfig = {
            projectId: 'test-project',
            apiUrl: 'http://localhost:3001',
            consent: true,
            promptTheme: 'light'
        };
    </script>
    <script src="http://localhost:5173/flowback.js"></script>
</body>
</html>
```

Open in browser and interact.

### Method 2: Build & Embed

```bash
npm run build
# Output: dist/flowback.js, dist/flowback.umd.js

# Serve from CDN or embed directly
<script src="path/to/flowback.js"></script>
```

## Debugging

### Browser Console

```javascript
// Access widget instance
window.flowback.getSessionId()  // → "session_..."

// Check queue size
console.log(flowbackQueue.size())
```

### Network Tab

Look for POST requests to `http://localhost:3001/events`

Each request body:
```json
[
  {
    "sessionId": "...",
    "type": "signal.raw",
    "payload": { "action": "click", ... }
  },
  ...
]
```

### Local Storage

```javascript
// Check consent state
localStorage.getItem('flowback_consent_test-project')

// Check throttle window
sessionStorage.getItem('flowback_throttle')

// Check persisted queue (if offline)
localStorage.getItem('flowback_queue')
```

## Building for Production

```bash
npm run build

# Output:
# dist/flowback.js (UMD, ~15KB gzipped)
# dist/flowback.js.map (source map)
```

Upload to CDN and reference in `<script>` tag.

## Widget Configuration Reference

```typescript
interface FlowbackConfig {
  // Required
  projectId: string;
  apiUrl: string;

  // Optional
  consent?: boolean;           // Pre-grant (false = show banner)
  sampleRate?: number;         // 0-1, default 1.0
  throttleMs?: number;         // default 30000
  batchSize?: number;          // default 50
  batchIntervalMs?: number;    // default 5000
  promptTheme?: 'light'|'dark';
  disableAI?: boolean;         // skip AI insights
}
```

