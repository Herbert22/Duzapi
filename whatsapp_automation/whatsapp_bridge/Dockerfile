FROM ghcr.io/puppeteer/puppeteer:24.6.1

USER root

# Chrome path from Puppeteer image cache
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/home/pptruser/.cache/puppeteer/chrome/linux-135.0.7049.84/chrome-linux64/chrome

# Create app directory
WORKDIR /app

# Create non-root user with home directory
RUN groupadd -r whatsapp && useradd -r -g whatsapp -m whatsapp \
    && mkdir -p /home/whatsapp/.local/share/applications \
    && chown -R whatsapp:whatsapp /home/whatsapp

# Copy package files
COPY package*.json ./

# Install dependencies (ci uses lock file for deterministic builds)
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create directories for sessions and downloads
RUN mkdir -p sessions downloads/audio logs && \
    chown -R whatsapp:whatsapp /app

# Create entrypoint that fixes volume permissions then drops to whatsapp user
RUN echo '#!/bin/bash\nchown -R whatsapp:whatsapp /app/sessions /app/downloads /app/logs 2>/dev/null || true\nexec gosu whatsapp "$@"' > /entrypoint.sh \
    && chmod +x /entrypoint.sh \
    && apt-get update && apt-get install -y gosu --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["/entrypoint.sh"]

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "src/index.js"]
