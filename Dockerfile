FROM oven/bun:latest AS builder
WORKDIR /app
COPY . .
RUN bun install && bun run build

FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git sudo gnupg wget && \
    rm -rf /var/lib/apt/lists/*

# Copy Bun runtime (needed by bin/jules-env shim)
COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

# Copy built CLI
COPY --from=builder /app/dist /opt/jules-env/dist
COPY --from=builder /app/bin /opt/jules-env/bin
RUN chmod +x /opt/jules-env/bin/jules-env

ENV PATH="/opt/jules-env/bin:$PATH"

# Run as non-root user to match the Jules VM environment
RUN useradd -m -s /bin/bash -u 1001 jules && \
    echo 'jules ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
USER jules
WORKDIR /home/jules

CMD ["/bin/bash"]
