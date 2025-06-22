FROM jarredsumner/bun:edge

WORKDIR /usr/src/app
COPY package.json bun.lockb ./
RUN bun install

COPY . .

EXPOSE 3000

# Assuming your server entrypoint is in server.ts
CMD ["bun", "run", "server.js"]
