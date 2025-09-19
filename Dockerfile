# Use the official Node.js Windows Nano Server image
# This works with Windows containers in Docker Desktop
FROM mcr.microsoft.com/windows/nanoserver:ltsc2022 AS base

# Install Node.js
FROM mcr.microsoft.com/powershell:nanoserver-ltsc2022 AS installer
SHELL ["pwsh", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

# Download and install Node.js
RUN Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.20.4/node-v18.20.4-win-x64.zip' -OutFile 'node.zip'; \
    Expand-Archive node.zip -DestinationPath C:\; \
    Rename-Item 'C:\node-v18.20.4-win-x64' 'C:\nodejs'

# Final stage
FROM mcr.microsoft.com/windows/nanoserver:ltsc2022
COPY --from=installer C:/nodejs C:/nodejs

# Set up environment
ENV PATH="C:\nodejs;C:\nodejs\node_modules\.bin;${PATH}"
ENV NODE_ENV=production
ENV NPM_CONFIG_LOGLEVEL=warn

# Set the working directory
WORKDIR C:/app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Add health check for Windows
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8080/health' -UseBasicParsing -TimeoutSec 5; if ($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"

# Define the command to run the application
CMD ["C:\\nodejs\\npm.cmd", "start"]
