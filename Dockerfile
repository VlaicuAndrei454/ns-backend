# --- deps layer ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# --- runtime layer ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8000
CMD ["node", "server.js"]
