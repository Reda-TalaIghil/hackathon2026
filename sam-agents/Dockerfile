FROM solace/solace-agent-mesh:1.13.3

WORKDIR /app

# Copy dependencies
COPY pyproject.toml .
RUN python3.11 -m pip install --no-cache-dir -e .

# Copy configs and source
COPY configs/ configs/
COPY src/ src/

# Create startup script that runs both SAM and bridges
RUN echo '#!/bin/bash\necho "🚀 Starting Flowback SAM Agents..."\nsam run configs/ &\nSAM_PID=$!\nsleep 5\necho "🌉 Starting Analysis Results Bridge..."\npython src/results_bridge.py &\nRESULTS_PID=$!\necho "🌉 Starting NATS Event Bridge..."\npython src/nats_bridge.py &\nNATS_PID=$!\nwait $SAM_PID $RESULTS_PID $NATS_PID' > /entrypoint.sh && \
    chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
