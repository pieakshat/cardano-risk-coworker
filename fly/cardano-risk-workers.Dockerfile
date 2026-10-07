FROM oven/bun:1.3.5-debian
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://github.com/aiken-lang/aiken/releases/download/v1.1.19/aiken-x86_64-unknown-linux-musl.tar.gz | tar -xzf - --strip-components=1 -C /usr/local/bin aiken-x86_64-unknown-linux-musl/aiken
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
