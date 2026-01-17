"""
NATS Event Bridge - Connects Flowback events to Solace Agent Mesh

Subscribes to NATS topics from the Node.js ingest service and routes
event batches to the Friction Analyzer agent for analysis.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import nats
from nats.aio.msg import Msg

# Configure logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


class NATSEventBridge:
    def __init__(self, nats_url: str = "nats://localhost:4222"):
        self.nats_url = nats_url
        self.nc: nats.NATS | None = None
        self.event_buffer: Dict[str, List[Dict[str, Any]]] = {}

    async def connect(self):
        """Connect to NATS broker"""
        try:
            self.nc = await nats.connect(self.nats_url)
            log.info(f"✓ Connected to NATS at {self.nats_url}")
        except Exception as e:
            log.error(f"❌ Failed to connect to NATS: {e}")
            raise

    async def subscribe_to_events(self):
        """Subscribe to Flowback event topics"""
        if not self.nc:
            raise RuntimeError("Not connected to NATS")

        # Subscribe to raw signals from ingest service
        await self.nc.subscribe("flowback.signal.raw", cb=self.handle_signal_event)
        log.info("✓ Subscribed to flowback.signal.raw")

        # Subscribe to session feedback
        await self.nc.subscribe("flowback.feedback.recorded", cb=self.handle_feedback_event)
        log.info("✓ Subscribed to flowback.feedback.recorded")

    async def handle_signal_event(self, msg: Msg):
        """Process raw signal events"""
        try:
            event = json.loads(msg.data.decode())
            session_id = event.get("sessionId") or "unknown"
            payload = event.get("payload") or {}
            action = payload.get("action") or event.get("action") or "unknown"

            log.info(f"📥 Signal received: session={session_id[:8]} action={action}")

            # Buffer events by session
            if session_id not in self.event_buffer:
                self.event_buffer[session_id] = []
            self.event_buffer[session_id].append(event)

            log.debug(
                "📥 Buffered signal event: %s (type=%s)",
                action,
                event.get("type", "unknown"),
            )

            # Analyze when we have enough events
            if len(self.event_buffer[session_id]) >= 5:
                await self.analyze_session(session_id)
                self.event_buffer[session_id] = []

        except Exception as e:
            log.error(f"❌ Error handling signal event: {e}", exc_info=True)

    async def handle_feedback_event(self, msg: Msg):
        """Process user feedback events"""
        try:
            event = json.loads(msg.data.decode())
            payload = event.get("payload") or {}
            reaction = payload.get("reaction") or "unknown"
            comment = payload.get("comment") or payload.get("feedback") or ""
            log.info(f"📝 Feedback received: {reaction} {comment}")
        except Exception as e:
            log.error(f"❌ Error handling feedback event: {e}", exc_info=True)

    async def analyze_session(self, session_id: str):
        """Send buffered events to Friction Analyzer agent"""
        events = self.event_buffer.get(session_id, [])
        if not events:
            return

        # Format events for analysis
        event_summary = self.summarize_events(events)

        log.info(f"🔍 Analyzing session {session_id[:8]}... with {len(events)} events")
        log.info(f"   Summary: {event_summary}")

        # In a real implementation, this would call the SAM agent via HTTP or message bus
        # For now, we just log the analysis
        await self.store_analysis_result(session_id, event_summary)

    def summarize_events(self, events: List[Dict[str, Any]]) -> str:
        """Create a summary of events aligned to the schema in docs/EVENT_SCHEMA"""

        def safe_action(event: Dict[str, Any]) -> str:
            payload = event.get("payload") or {}
            return (payload.get("action") or event.get("type") or "unknown").lower()

        def safe_timestamp(event: Dict[str, Any]) -> Optional[int]:
            raw = event.get("timestamp")
            try:
                return int(raw) if raw is not None else None
            except (TypeError, ValueError):
                return None

        actions: Dict[str, int] = {}
        for event in events:
            action = safe_action(event)
            actions[action] = actions.get(action, 0) + 1

        summary = f"Session has {len(events)} interactions: "
        summary += ", ".join([f"{count} {action}" for action, count in actions.items()])

        # Check for rapid clicks (potential rage clicking)
        click_times = [
            ts
            for event in events
            if (safe_action(event) == "click") and (ts := safe_timestamp(event))
        ]

        if len(click_times) >= 2:
            click_times.sort()
            time_diffs = [
                click_times[i + 1] - click_times[i]
                for i in range(len(click_times) - 1)
            ]
            rapid_clicks = sum(1 for diff in time_diffs if diff < 500)
            if rapid_clicks > 0:
                summary += f" [WARNING: {rapid_clicks} rapid click sequences detected]"

        return summary

    async def store_analysis_result(self, session_id: str, analysis: str):
        """Store analysis result via NATS publish or direct HTTP"""
        result = {
            "sessionId": session_id,
            "type": "friction.analysis",
            "timestamp": datetime.now().isoformat(),
            "analysis": analysis,
        }

        if self.nc:
            try:
                await self.nc.publish(
                    "flowback.analysis.friction", json.dumps(result).encode()
                )
                log.info(f"✓ Published analysis for session {session_id[:8]}")
            except Exception as e:
                log.error(f"❌ Failed to publish analysis: {e}")

    async def run(self):
        """Run the NATS event bridge"""
        try:
            await self.connect()
            await self.subscribe_to_events()

            log.info("🚀 NATS Event Bridge running. Listening for Flowback events...")
            log.info("   Events buffered until analysis threshold reached")

            # Keep running
            while True:
                await asyncio.sleep(1)

        except KeyboardInterrupt:
            log.info("Shutting down...")
        finally:
            if self.nc:
                await self.nc.close()


async def main():
    bridge = NATSEventBridge(os.getenv("NATS_URL", "nats://localhost:4222"))
    await bridge.run()


if __name__ == "__main__":
    asyncio.run(main())

