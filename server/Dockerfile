FROM node:22-slim AS builder

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy lockfile and package.json first to cache dependencies
COPY pnpm-lock.yaml package.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the code
COPY . .

# Generate Prisma Client (outputs to src/generated/prisma)
RUN pnpm run generate

# Build TypeScript to dist
RUN pnpm run build

# ---
# Runner Stage
FROM node:22-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Set env to production
ENV NODE_ENV="production"
ENV PORT=3010

# Note: In production you MUST provide the DATABASE_URL environment variable 
# when running the container (e.g., docker run -e DATABASE_URL=...).

# Copy dependencies, built output, and the generated prisma client
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# We must copy src because the custom Prisma generated client lives inside src/generated/prisma
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

EXPOSE 3010

# Start server
CMD ["pnpm", "start"]
