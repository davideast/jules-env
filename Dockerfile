FROM oven/bun:latest AS builder
WORKDIR /app
COPY . .
RUN bun install && bun run build

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git sudo && \
    rm -rf /var/lib/apt/lists/*

# Copy Bun runtime (needed by bin/jules-env shim)
COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

# Copy built CLI
COPY --from=builder /app/dist /opt/jules-env/dist
COPY --from=builder /app/bin /opt/jules-env/bin
RUN chmod +x /opt/jules-env/bin/jules-env

ENV PATH="/opt/jules-env/bin:$PATH"

CMD ["/bin/bash"]
