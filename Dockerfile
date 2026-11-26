# Folio v4.2 Production Container (Cloud Run 8-32 GiB / Linux VPS + Swap / Railway / Fly.io)
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=3072"

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    sqlite3 \
    tar \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build && npm run folio -- kb ingest-docs && npm run folio -- kb train-datasets

EXPOSE 3000

CMD ["npm", "start"]
