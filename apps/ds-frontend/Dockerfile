# From the bun edge image
FROM jarredsumner/bun:edge

# Set working dir
WORKDIR /usr/src/app

# Copy in your package manifest and lockfile (bun.lock, not bun.lockb)
COPY package.json bun.lock ./

# Install deps
RUN bun install

# Copy the rest of your front-end code
COPY . .

# Expose and run
EXPOSE 3000
CMD ["bun", "run", "start"]
