# Use Node.js LTS version
FROM node:22-slim

# Install necessary packages for Baileys
RUN apt-get update && apt-get install -y \
    libpng-dev \
    libjpeg-dev \
    libgif-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Create auth directory
RUN mkdir -p auth_info_baileys

# Expose port (not really needed for worker but good practice)
EXPOSE 3000

# Start the worker
CMD ["npm", "start"]
