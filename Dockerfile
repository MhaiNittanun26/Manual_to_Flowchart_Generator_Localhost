# Production container: builds the app and serves it with the vinext production
# server. Nginx on the host proxies /workflow-intelligence to this port
# (see deploy/nginx-workflow-intelligence.conf).
FROM node:22-alpine

WORKDIR /app

# basePath is baked in at build time, so it must be set before `vinext build`.
ARG BASE_PATH=/workflow-intelligence
ENV BASE_PATH=${BASE_PATH}

COPY package.json package-lock.json .npmrc ./
# vinext/vite are devDependencies but are required to build and to serve.
RUN npm ci --include=dev

COPY . .
RUN npx vinext build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/node-server.mjs"]
