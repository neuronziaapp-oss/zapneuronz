# Production Dockerfile for backend service
FROM node:20-alpine AS base

WORKDIR /app

# Install OS packages required for native dependencies (e.g., sqlite)
RUN apk add --no-cache python3 make g++ sqlite-dev

COPY package*.json ./

RUN npm ci --omit=dev

COPY . ./

ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

CMD ["node", "src/server.js"]
