FROM node:20-alpine

WORKDIR /app

# Copy only the manifests first: if the code changes but the dependencies don't,
# Docker reuses this layer and doesn't reinstall everything
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY config ./config

ENV NODE_ENV=production
EXPOSE 3000

# Runs as an unprivileged user (it already exists in the official Node image)
USER node
CMD ["node", "src/server.js"]
