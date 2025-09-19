# PowerShell script to deploy Hello World Node.js app on Windows containers
# Usage: .\deploy-hello-world.ps1

Write-Host "🚀 Deploying Hello World App on Windows Containers" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# Stop and remove any existing container
Write-Host "🛑 Cleaning up existing containers..." -ForegroundColor Yellow
docker stop hello-world-app 2>$null
docker rm -f hello-world-app 2>$null

# Build the updated image with port 8080 configuration
Write-Host "🔨 Building Hello World image with port 8080..." -ForegroundColor Yellow
docker build -t hello-world-nodejs:8080 . --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Image built successfully!" -ForegroundColor Green
    
    # Deploy the container
    Write-Host "🚀 Starting Hello World container..." -ForegroundColor Yellow
    $containerId = docker run -d --name hello-world-app -p 8080:8080 -e PORT=8080 hello-world-nodejs:8080
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Container deployed successfully!" -ForegroundColor Green
        Write-Host "📋 Container ID: $($containerId.Substring(0,12))" -ForegroundColor Blue
        
        # Wait for container to start
        Write-Host "⏳ Waiting for application to start..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        
        # Show container status
        Write-Host "📊 Container Status:" -ForegroundColor Yellow
        docker ps --filter "name=hello-world-app" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
        
        # Show application logs
        Write-Host "`n📝 Application Logs:" -ForegroundColor Yellow
        docker logs hello-world-app
        
        Write-Host "`n🌐 Application should be accessible at:" -ForegroundColor Cyan
        Write-Host "   http://localhost:8080" -ForegroundColor White
        Write-Host "`n📋 Useful Commands:" -ForegroundColor Yellow
        Write-Host "   View logs:     docker logs hello-world-app" -ForegroundColor White
        Write-Host "   Stop app:      docker stop hello-world-app" -ForegroundColor White
        Write-Host "   Remove app:    docker rm hello-world-app" -ForegroundColor White
        Write-Host "   Container info: docker inspect hello-world-app" -ForegroundColor White
        
    } else {
        Write-Host "❌ Failed to start container!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Failed to build image!" -ForegroundColor Red
    exit 1
}

