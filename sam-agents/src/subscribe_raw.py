import asyncio
import os
import nats

async def main():
    nats_url = os.getenv("NATS_URL", "nats://localhost:4222")
    nc = await nats.connect(nats_url)

    async def handler(msg):
        print("Raw:", msg.subject, msg.data.decode())
        # Exit after 5 messages
        handler.count += 1
        if handler.count >= 5:
            await nc.close()
            raise SystemExit(0)
    handler.count = 0

    await nc.subscribe("flowback.signal.raw", cb=handler)
    print("Subscribed to flowback.signal.raw; waiting up to 5s...")
    try:
        await asyncio.sleep(5)
    except SystemExit:
        return
    finally:
        if nc.is_connected:
            await nc.close()
    print("No raw events received in 5 seconds")

if __name__ == "__main__":
    asyncio.run(main())
