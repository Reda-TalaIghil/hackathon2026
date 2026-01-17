FROM solace/solace-agent-mesh:1.13.3

USER root

# No additional dependencies needed - SAM base image has everything

USER solaceai
COPY --chown=solaceai:solaceai configs/ /app/configs/
COPY --chown=solaceai:solaceai src/ /app/src/

WORKDIR /app

CMD ["run", "/app/configs"]
