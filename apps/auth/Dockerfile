# Use Bun’s official image (includes node-compat)
FROM jarredsumner/bun:edge

WORKDIR /usr/src/app
# Copy only what’s needed for dependency install
COPY package.json bun.lockb ./
RUN bun install

# Copy rest of source
COPY . .

# Expose the port your auth service listens on
EXPOSE 5000

# Run your Bun server (adjust if your start script differs)
CMD ["bun", "run", "src/index.ts"]
