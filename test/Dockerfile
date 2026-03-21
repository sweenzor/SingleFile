FROM node:22-slim

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ src/
COPY vitest.config.js ./

# Copy test files
COPY test/ test/

# Copy pre-built WASM artifacts (must be present before building the image)
COPY lib/wasm/ lib/wasm/

# Increase Node.js heap for the 100MB fixture
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Default: run correctness tests
CMD ["npx", "vitest", "run", "--reporter=verbose", "test/mhtml-parse-correctness.test.js"]
