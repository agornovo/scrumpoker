FROM node:24-alpine3.21 AS builder

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy app source
COPY . .

# Build the React frontend
RUN npm run build

FROM node:24-alpine3.21

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built frontend and server
COPY --from=builder /usr/src/app/dist ./dist
COPY server.js ./

# Expose port (OpenShift will use PORT env var)
EXPOSE 8080

# Start the app
CMD [ "node", "server.js" ]
