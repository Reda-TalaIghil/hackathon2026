import asyncio
import json
import os
import time

import nats

async def main():
    nats_url = os.getenv("NATS_URL", "nats://localhost:4222")
    nc = await nats.connect(nats_url)
    base = int(time.time() * 1000)
    actions = [
        {"action": "click", "target": "#btn"},
        {"action": "click", "target": "#btn"},
        {"action": "click", "target": "#btn"},
        {"action": "hover", "target": "#btn"},
        {"action": "nav", "target": "/checkout"},
    ]
    events = [
        {
            "sessionId": "s_demo",
            "projectId": "demo",
            "timestamp": base + i * 200,
            "type": "signal.raw",
            "payload": actions[i],
        }
        for i in range(len(actions))
    ]
    for e in events:
        await nc.publish("flowback.signal.raw", json.dumps(e).encode())
    await nc.flush()
    await nc.close()
    print(f"Published {len(events)} events to NATS at {nats_url}")

if __name__ == "__main__":
    asyncio.run(main())
