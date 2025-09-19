# PowerShell script to deploy Hello World Node.js app with Docker
# Usage: .\deploy-docker.ps1

Write-Host "🚀 Hello World Node.js Docker Deployment" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Check if Docker is running
Write-Host "📋 Checking Docker status..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker is available: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running or not installed!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Check Docker context
$dockerInfo = docker version --format json | ConvertFrom-Json
$serverOS = $dockerInfo.Server.Os

if ($serverOS -eq "linux") {
    Write-Host "⚠️  Docker is set to Linux containers mode" -ForegroundColor Yellow
    Write-Host "This application is configured for Windows containers." -ForegroundColor Yellow
    Write-Host "To switch to Windows containers:" -ForegroundColor Yellow
    Write-Host "  Right-click Docker Desktop → Switch to Windows containers" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternatively, you can use the Linux Dockerfile:" -ForegroundColor Yellow
    Write-Host "  docker build -f Dockerfile.linux -t hello-world-nodejs ." -ForegroundColor Yellow
    Write-Host ""
    $choice = Read-Host "Continue with Linux containers? (y/n)"
    if ($choice -ne "y" -and $choice -ne "Y") {
        Write-Host "Deployment cancelled. Please switch to Windows containers and try again." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "✅ Docker is set to Windows containers mode" -ForegroundColor Green
}

# Stop any running containers
Write-Host "🛑 Stopping any existing containers..." -ForegroundColor Yellow
docker-compose down 2>$null

# Build and start the application
Write-Host "🔨 Building and starting the application..." -ForegroundColor Yellow
try {
    if ($serverOS -eq "linux") {
        # Use Linux Dockerfile if on Linux containers
        Write-Host "Using Linux containers..." -ForegroundColor Blue
        docker build -f Dockerfile.linux -t hello-world-nodejs .
        if ($LASTEXITCODE -eq 0) {
            docker run -d -p 3000:3000 --name hello-world-app hello-world-nodejs
        }
    } else {
        # Use Windows containers (default configuration)
        Write-Host "Using Windows containers..." -ForegroundColor Blue
        docker-compose up -d --build
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Application deployed successfully!" -ForegroundColor Green
        Write-Host "🌐 Access your app at: http://localhost:3000" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "📊 Container status:" -ForegroundColor Yellow
        docker ps --filter "name=hello-world"
        Write-Host ""
        Write-Host "📝 Useful commands:" -ForegroundColor Yellow
        Write-Host "  View logs: docker logs hello-world-app" -ForegroundColor White
        Write-Host "  Stop app:  docker-compose down" -ForegroundColor White
        Write-Host "  Restart:   docker-compose restart" -ForegroundColor White
    } else {
        Write-Host "❌ Deployment failed!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
}

