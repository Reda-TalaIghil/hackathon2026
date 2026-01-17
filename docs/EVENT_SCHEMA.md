# Event Schema Reference

## Signal Events

### signal.raw

Raw UI interaction emitted by widget.

```json
{
  "sessionId": "session_1705424400000_abc123",
  "projectId": "proj_456",
  "timestamp": 1705424400000,
  "type": "signal.raw",
  "payload": {
    "action": "click",
    "target": "#checkout-btn",
    "dwellMs": 2500,
    "scrollDepth": 45,
    "details": {
      "pageX": 640,
      "pageY": 350
    }
  }
}
```

### signal.normalized

Normalized signal with pattern detection applied.

```json
{
  "sessionId": "session_1705424400000_abc123",
  "projectId": "proj_456",
  "timestamp": 1705424401000,
  "type": "signal.normalized",
  "payload": {
    "action": "rage_click",
    "target": "#pay-btn",
    "metrics": {
      "count": 5,
      "spanMs": 450
    },
    "evidence": [
      { "ts": 1705424399500, "target": "#pay-btn" },
      { "ts": 1705424399650, "target": "#pay-btn" }
    ]
  }
}
```

**Normalized Actions:**
- `rage_click`: 3+ clicks on same target in <500ms
- `hesitation`: hover/idle >3sec on element
- `backtrack`: browser back button
- `scroll_milestone`: 25%, 50%, 75%, 100% depth

---

## Feedback Events

### feedback.recorded

1-tap user reaction to micro-prompt.

```json
{
  "sessionId": "session_1705424400000_abc123",
  "projectId": "proj_456",
  "timestamp": 1705424405000,
  "type": "feedback.recorded",
  "payload": {
    "reaction": "thumbs_down",
    "promptId": "prompt_checkout_latency",
    "page": "/checkout/payment",
    "dwellBeforeMs": 6200
  }
}
```

**Reaction Values:**
- `thumbs_up`: Positive experience
- `thumbs_down`: Negative experience
- `neutral`: Neutral / unclear

---

## Context Events

### context.enriched

Signal or feedback + enrichment metadata.

```json
{
  "sessionId": "session_1705424400000_abc123",
  "projectId": "proj_456",
  "timestamp": 1705424405100,
  "type": "context.enriched",
  "payload": {
    "page": "/checkout/payment",
    "device": "mobile",
    "userAgent": "Mozilla/5.0 (iPhone...",
    "cohortId": "test_variant_b",
    "consentGranted": true,
    "originalEvent": {
      "type": "feedback.recorded",
      "payload": { "reaction": "thumbs_down" }
    }
  }
}
```

**Device Values:**
- `mobile`: Smartphone (including tablets)
- `tablet`: iPad or similar
- `desktop`: Desktop/Laptop

---

## Policy Events

### policy.updated

Throttling / consent state update.

```json
{
  "sessionId": "session_1705424400000_abc123",
  "projectId": "proj_456",
  "timestamp": 1705424406000,
  "type": "policy.updated",
  "payload": {
    "canPrompt": true,
    "reason": "throttle_ready",
    "nextAvailableMs": 0
  }
}
```

**Reasons:**
- `throttle_ready`: Minimum interval passed
- `throttle_active`: Within throttle window
- `consent_denied`: User rejected consent
- `regional_block`: Regional privacy law

---

## Session & Friction Events

### session.friction

Journey-level friction analysis.

```json
{
  "sessionId": "session_1705424400000_abc123",
  "projectId": "proj_456",
  "timestamp": 1705424410000,
  "type": "session.friction",
  "payload": {
    "path": ["/cart", "/checkout", "/payment"],
    "frictionMetrics": {
      "rageClicks": 3,
      "hesitations": 2,
      "backtracks": 1,
      "scrollAbandonment": false
    },
    "frictionScore": 0.68,
    "evidence": [
      {
        "timestamp": 1705424405000,
        "action": "rage_click",
        "details": { "count": 3, "spanMs": 450 }
      },
      {
        "timestamp": 1705424407000,
        "action": "hesitation",
        "details": { "dwellMs": 4200 }
      }
    ]
  }
}
```

**Friction Score Calculation:**
```
frictionScore = (rageClicks × 0.3 + hesitations × 0.2 + backtracks × 0.2) / total_signals
Range: 0.0 (no friction) to 1.0 (extreme friction)
```

---

## Insight Events

### insight.summary

AI-generated insight from clustering.

```json
{
  "clusteringRunAt": 1705424800000,
  "clusterId": "cluster_rage_click_payment_1705424800000",
  "projectId": "proj_456",
  "type": "insight.summary",
  "payload": {
    "title": "High friction in payment step",
    "description": "Users experience repeated clicking on the submit button.",
    "frictionType": "payment",
    "sentimentTrend": "negative",
    "evidenceCount": 47,
    "hypothesis": "Payment API slowness or UX clarity issue on mobile.",
    "affectedPages": [
      "/checkout/payment",
      "/checkout/review"
    ],
    "recommendations": [
      "Check payment API latency in production",
      "Conduct mobile UX review",
      "A/B test clearer CTA button"
    ]
  }
}
```

**Friction Types:**
- `payment`: Payment processing issues
- `checkout`: Checkout flow friction
- `navigation`: Navigation/wayfinding confusion
- `performance`: Performance/loading delays
- `ux`: General UX friction

**Sentiment Trends:**
- `positive`: 👍 dominant
- `negative`: 👎 dominant
- `neutral`: Balanced or 😕 dominant

---

## Example: Multi-Event Session

**Timeline:**

1. **00s**: User lands on `/cart`
   ```json
   { "type": "signal.raw", "payload": { "action": "click", "target": "#checkout" } }
   ```

2. **02s**: Click detected, navigates to `/checkout`
   ```json
   { "type": "signal.raw", "payload": { "action": "nav" } }
   ```

3. **05s**: User hovers on form field for 4 seconds
   ```json
   { "type": "signal.raw", "payload": { "action": "hover", "dwellMs": 4000 } }
   ```
   Signal Agent detects hesitation:
   ```json
   { "type": "signal.normalized", "payload": { "action": "hesitation", "metrics": { "dwellMs": 4000 } } }
   ```

4. **08s**: User rapid-clicks submit 5 times in 400ms
   ```json
   { "type": "signal.raw", "payload": { "action": "click", "target": "#submit" } }
   ```
   (× 5 times)
   Signal Agent detects rage-click:
   ```json
   { "type": "signal.normalized", "payload": { "action": "rage_click", "metrics": { "count": 5, "spanMs": 400 } } }
   ```

5. **10s**: User clicks 👎 reaction button
   ```json
   { "type": "feedback.recorded", "payload": { "reaction": "thumbs_down", "page": "/checkout" } }
   ```

6. **12s**: User hits back button
   ```json
   { "type": "signal.raw", "payload": { "action": "backtrack" } }
   ```

**Correlator Agent Stitches:**

```json
{
  "type": "session.friction",
  "payload": {
    "path": ["/cart", "/checkout"],
    "frictionMetrics": {
      "rageClicks": 1,
      "hesitations": 1,
      "backtracks": 1
    },
    "frictionScore": 0.47
  }
}
```

**Insight Agent (batch, 2min later):**

Clusters with similar sessions, generates:

```json
{
  "type": "insight.summary",
  "payload": {
    "title": "Checkout form clarity issue",
    "hypothesis": "Users hesitate on shipping form, then rage-click submit.",
    "frictionType": "checkout"
  }
}
```

