FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency files first
COPY server/package*.json ./

# Install packages
RUN npm install --production

# Copy server files
COPY server/ .

# Ensure environment variable defaults (Hugging Face binds to port 7860)
ENV PORT=7860
ENV NODE_ENV=production

# Expose port
EXPOSE 7860

# Run server
CMD ["node", "src/server.js"]
