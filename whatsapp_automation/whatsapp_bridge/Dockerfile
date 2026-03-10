FROM ghcr.io/puppeteer/puppeteer:24.6.1

USER root

# Set environment variables for Puppeteer/Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Create app directory
WORKDIR /app

# Create non-root user with home directory
RUN groupadd -r whatsapp && useradd -r -g whatsapp -m whatsapp \
    && mkdir -p /home/whatsapp/.local/share/applications \
    && chown -R whatsapp:whatsapp /home/whatsapp

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create directories for sessions and downloads
RUN mkdir -p sessions downloads/audio logs && \
    chown -R whatsapp:whatsapp /app

# Switch to non-root user
USER whatsapp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "src/index.js"]
