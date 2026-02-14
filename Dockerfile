FROM node:22-bookworm

# Install Bun (required for build scripts) and curl for health checks
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

# Install curl for health checks
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

WORKDIR /app

ARG AGENTO_DOCKER_APT_PACKAGES=""
RUN if [ -n "$AGENTO_DOCKER_APT_PACKAGES" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $AGENTO_DOCKER_APT_PACKAGES && \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*; \
    fi

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
# Force pnpm for UI build (Bun may fail on ARM/Synology architectures)
ENV AGENTO_PREFER_PNPM=1
RUN pnpm ui:build

ENV NODE_ENV=production

# Create data directory for persistent storage
RUN mkdir -p /data && chown -R node:node /data /app

# Security hardening: Run as non-root user
# The node:22-bookworm image includes a 'node' user (uid 1000)
# This reduces the attack surface by preventing container escape via root privileges
USER node

# Expose gateway port
EXPOSE 18789

# Health check for production deployments
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:18789/api/health || exit 1

# Start gateway server with default config.
# Binds to loopback (127.0.0.1) by default for security.
#
# For container platforms requiring external health checks:
#   1. Set AGENTO_GATEWAY_TOKEN or AGENTO_GATEWAY_PASSWORD env var
#   2. Override CMD: ["node","agento.mjs","gateway","--allow-unconfigured","--bind","lan"]
#
# Production deployment tips:
#   - Mount /data for persistent storage: -v /host/path:/data
#   - Set AGENTO_STATE_DIR=/data for data location
#   - Set AGENTO_GATEWAY_TOKEN for authentication
#   - Set gateway.auth.requireLocalAuth=true in config for max security
CMD ["node", "agento.mjs", "gateway", "--allow-unconfigured"]
