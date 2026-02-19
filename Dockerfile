FROM node:24-alpine3.21

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy app source
COPY . .

# Expose port (OpenShift will use PORT env var)
EXPOSE 8080

# Start the app
CMD [ "node", "server.js" ]
