#!/bin/bash
# Shell script to deploy Hello World Node.js app with Docker
# Usage: ./deploy-docker.sh

echo "🚀 Hello World Node.js Docker Deployment"
echo "======================================="

# Check if Docker is running
echo "📋 Checking Docker status..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Please install Docker and try again."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

DOCKER_VERSION=$(docker --version)
echo "✅ Docker is available: $DOCKER_VERSION"

# Check Docker context
SERVER_OS=$(docker version --format '{{.Server.Os}}')

if [ "$SERVER_OS" = "windows" ]; then
    echo "✅ Docker is set to Windows containers mode"
    echo "This application is configured for Windows containers."
else
    echo "⚠️  Docker is set to Linux containers mode"
    echo "This application is configured for Windows containers."
    echo "To switch to Windows containers:"
    echo "  Right-click Docker Desktop → Switch to Windows containers"
    echo ""
    echo "Alternatively, you can use the Linux Dockerfile:"
    echo "  docker build -f Dockerfile.linux -t hello-world-nodejs ."
    echo ""
    read -p "Continue with Linux containers? (y/n): " choice
    if [ "$choice" != "y" ] && [ "$choice" != "Y" ]; then
        echo "Deployment cancelled. Please switch to Windows containers and try again."
        exit 0
    fi
fi

# Stop any running containers
echo "🛑 Stopping any existing containers..."
docker-compose down 2>/dev/null || true

# Build and start the application
echo "🔨 Building and starting the application..."
if [ "$SERVER_OS" = "linux" ]; then
    # Use Linux Dockerfile if on Linux containers
    echo "Using Linux containers..."
    docker build -f Dockerfile.linux -t hello-world-nodejs .
    if [ $? -eq 0 ]; then
        docker run -d -p 3000:3000 --name hello-world-app hello-world-nodejs
    fi
else
    # Use Windows containers (default configuration)
    echo "Using Windows containers..."
    docker-compose up -d --build
fi

if [ $? -eq 0 ]; then
    echo "✅ Application deployed successfully!"
    echo "🌐 Access your app at: http://localhost:3000"
    echo ""
    echo "📊 Container status:"
    docker ps --filter "name=hello-world"
    echo ""
    echo "📝 Useful commands:"
    echo "  View logs: docker logs hello-world-app"
    echo "  Stop app:  docker-compose down"
    echo "  Restart:   docker-compose restart"
else
    echo "❌ Deployment failed!"
    exit 1
fi

