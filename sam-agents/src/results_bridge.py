"""
SAM Analysis Results Bridge

Subscribes to SAM analysis results and sends them to the Node.js analytics store.
This bridges the gap between Python SAM agents and the Node.js backend.
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict

import nats
from nats.aio.msg import Msg
import aiohttp

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


class AnalysisResultsBridge:
    def __init__(
        self,
        nats_url: str = "nats://localhost:4222",
        analytics_url: str = "http://localhost:3000",
    ):
        self.nats_url = nats_url
        self.analytics_url = analytics_url
        self.nc: nats.NATS | None = None

    async def connect(self):
        """Connect to NATS"""
        try:
            self.nc = await nats.connect(self.nats_url)
            log.info(f"✓ Connected to NATS at {self.nats_url}")
        except Exception as e:
            log.error(f"❌ Failed to connect to NATS: {e}")
            raise

    async def subscribe_to_results(self):
        """Subscribe to analysis result topics"""
        if not self.nc:
            raise RuntimeError("Not connected to NATS")

        await self.nc.subscribe(
            "flowback.analysis.friction", cb=self.handle_friction_analysis
        )
        log.info("✓ Subscribed to flowback.analysis.friction")

        await self.nc.subscribe(
            "flowback.analysis.sentiment", cb=self.handle_sentiment_analysis
        )
        log.info("✓ Subscribed to flowback.analysis.sentiment")

    async def handle_friction_analysis(self, msg: Msg):
        """Process friction analysis from SAM agents"""
        try:
            result = json.loads(msg.data.decode())
            log.info(f"📊 Friction analysis received: {result.get('sessionId', 'unknown')[:8]}")

            # Send to Node.js analytics store
            await self.store_friction_data(result)

        except Exception as e:
            log.error(f"❌ Error handling friction analysis: {e}", exc_info=True)

    async def handle_sentiment_analysis(self, msg: Msg):
        """Process sentiment analysis from SAM agents"""
        try:
            result = json.loads(msg.data.decode())
            log.info(f"💭 Sentiment analysis received: {result.get('sessionId', 'unknown')[:8]}")

            # Send to Node.js analytics store
            await self.store_sentiment_data(result)

        except Exception as e:
            log.error(f"❌ Error handling sentiment analysis: {e}", exc_info=True)

    async def store_friction_data(self, analysis: Dict[str, Any]):
        """Store friction analysis in Node.js analytics store via HTTP"""
        try:
            async with aiohttp.ClientSession() as session:
                # Extract key metrics from analysis
                session_id = analysis.get("sessionId", "")
                score = float(
                    analysis.get("severity", 5) / 10
                )  # Normalize to 0-1 range

                payload = {
                    "projectId": "demo-project",
                    "page": analysis.get("location", {}).get("url", "/"),
                    "metrics": {
                        "clickCount": 5,
                        "rageClicks": 1,
                        "hesitations": 1,
                        "avgDuration": 250,
                    },
                    "frictionScore": score,
                    "evidence": analysis.get("evidence", ""),
                    "recommendation": analysis.get("recommendation", ""),
                }

                async with session.post(
                    f"{self.analytics_url}/api/hotspots",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                ) as resp:
                    if resp.status == 200:
                        log.info(f"✓ Stored friction data for {session_id[:8]}")
                    else:
                        log.warning(f"⚠️ Analytics store returned {resp.status}")

        except Exception as e:
            log.error(f"❌ Failed to store friction data: {e}", exc_info=True)

    async def store_sentiment_data(self, analysis: Dict[str, Any]):
        """Store sentiment analysis in Node.js analytics store via HTTP"""
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "projectId": "demo-project",
                    "sessionId": analysis.get("sessionId", ""),
                    "sentiment": analysis.get("sentiment", "neutral"),
                    "score": float(analysis.get("score", 0.5)),
                    "feedback": analysis.get("feedback", ""),
                }

                async with session.post(
                    f"{self.analytics_url}/api/sentiment",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                ) as resp:
                    if resp.status == 200:
                        log.info(
                            f"✓ Stored sentiment data for {analysis.get('sessionId', 'unknown')[:8]}"
                        )
                    else:
                        log.warning(f"⚠️ Analytics store returned {resp.status}")

        except Exception as e:
            log.error(f"❌ Failed to store sentiment data: {e}", exc_info=True)

    async def run(self):
        """Run the analysis results bridge"""
        try:
            await self.connect()
            await self.subscribe_to_results()

            log.info("🚀 Analysis Results Bridge running")
            log.info(f"   Forwarding results to {self.analytics_url}")

            while True:
                await asyncio.sleep(1)

        except KeyboardInterrupt:
            log.info("Shutting down...")
        finally:
            if self.nc:
                await self.nc.close()


async def main():
    bridge = AnalysisResultsBridge(
        nats_url=os.getenv("NATS_URL", "nats://localhost:4222"),
        analytics_url=os.getenv("ANALYTICS_STORE_URL", "http://localhost:3000"),
    )
    await bridge.run()


if __name__ == "__main__":
    asyncio.run(main())
