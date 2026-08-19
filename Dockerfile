FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Disable puppeteer download
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Try to force IPv4 for npm to avoid Alpine network freezes
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm install --loglevel=verbose

# Copy all application files
COPY . .

# Install bash and coreutils which are required by the build script
RUN apk add --no-cache bash coreutils

# Build the application
RUN npm run build

# Start the Node.js server
CMD ["npm", "start"]
