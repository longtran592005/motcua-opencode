$ErrorActionPreference = 'Stop'

docker compose up -d postgres
do {
  Start-Sleep -Seconds 2
  $health = docker inspect --format='{{.State.Health.Status}}' motcua-postgres 2>$null
} while ($health -ne 'healthy')

Push-Location (Join-Path $PSScriptRoot '..\backend')
try {
  npm run migrate:deploy
  $count = docker exec motcua-postgres psql -U motcua -d motcua -tAc "SELECT count(*) FROM users"
  if ([int]$count.Trim() -eq 0) {
    npm run seed
  }
} finally {
  Pop-Location
}

$root = Split-Path $PSScriptRoot -Parent
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\backend'; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\frontend'; npm run dev -- --host 0.0.0.0"
Write-Host 'Backend: http://localhost:8080'
Write-Host 'Frontend: http://localhost:5173'
