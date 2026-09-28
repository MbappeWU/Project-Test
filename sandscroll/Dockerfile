# SandScroll 24/7 broadcaster: Node renders the sand painting + music, ffmpeg streams to YouTube.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN sh tools/fetch-fonts.sh

ENV NODE_ENV=production \
    SANDSCROLL_HEARTBEAT=/tmp/sandscroll.heartbeat
HEALTHCHECK --interval=60s --timeout=10s --start-period=180s --retries=3 CMD node tools/healthcheck.mjs
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/node/stream.mjs"]
