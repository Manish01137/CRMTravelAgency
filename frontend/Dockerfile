# --- Build stage --------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage: Nginx serves the built SPA + reverse-proxies /api ---
# nginx.conf is mounted at run time (see docker-compose.prod.yml) rather than
# baked in here, so it can be tuned without rebuilding this image.
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
