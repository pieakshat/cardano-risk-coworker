FROM oven/bun:1.3.5-debian
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://github.com/aiken-lang/aiken/releases/download/v1.1.19/aiken-x86_64-unknown-linux-musl.tar.gz | tar -xzf - --strip-components=1 -C /usr/local/bin aiken-x86_64-unknown-linux-musl/aiken
# cardano-ctf 01_sell_nft and bank_01_deposit_vulnerability pin aiken-lang/stdlib 1.x, which only
# type-checks under the legacy v1.0.24-alpha compiler. Installed alongside the modern one so the
# exploit confirm step can pick the matching binary per project (see AIKEN_LEGACY_BIN below).
RUN mkdir -p /opt/aiken-legacy \
  && curl -fsSL https://github.com/aiken-lang/aiken/releases/download/v1.0.24-alpha/aiken_v1.0.24-alpha_linux_amd64.tar.gz | tar -xzf - -C /opt/aiken-legacy \
  && chmod +x /opt/aiken-legacy/aiken
ENV AIKEN_BIN=/usr/local/bin/aiken
ENV AIKEN_LEGACY_BIN=/opt/aiken-legacy/aiken
WORKDIR /app
COPY worker/package.json worker/
RUN cd worker && bun install
COPY engine engine
COPY memo memo
COPY settle settle
COPY security security
COPY worker/src worker/src
WORKDIR /app/worker
ENV NODE_ENV=production
