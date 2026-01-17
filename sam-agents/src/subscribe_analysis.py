import asyncio
import os

import nats


async def main():
    nats_url = os.getenv("NATS_URL", "nats://localhost:4222")
    wait_seconds = int(os.getenv("WAIT_SECONDS", "10"))
    got_message = asyncio.Event()

    nc = await nats.connect(nats_url)

    async def handler(msg):
        print("Received analysis:", msg.subject, msg.data.decode())
        got_message.set()

    await nc.subscribe("flowback.analysis.friction", cb=handler)
    print(f"Subscribed to flowback.analysis.friction; waiting up to {wait_seconds}s...")

    try:
        await asyncio.wait_for(got_message.wait(), timeout=wait_seconds)
    except asyncio.TimeoutError:
        print(f"No analysis received in {wait_seconds} seconds")
    finally:
        if nc.is_connected:
            await nc.close()


if __name__ == "__main__":
    asyncio.run(main())
