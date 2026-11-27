param(
  [string]$LocalUrl = "http://localhost:5173",
  [string]$QrOutput = "YAKU_ALERT_QR_ACTUAL.png"
)

$ErrorActionPreference = "Stop"
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  throw "No encuentro cloudflared. Instálalo o agrega cloudflared.exe al PATH."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$qrPath = Join-Path $repoRoot $QrOutput
$tempRoot = [System.IO.Path]::GetTempPath()
$backendOut = Join-Path $tempRoot "yaku-alert-backend-out.log"
$backendErr = Join-Path $tempRoot "yaku-alert-backend-err.log"
$frontendOut = Join-Path $tempRoot "yaku-alert-frontend-out.log"
$frontendErr = Join-Path $tempRoot "yaku-alert-frontend-err.log"
$stdoutPath = Join-Path $tempRoot "yaku-alert-cloudflared-out.log"
$stderrPath = Join-Path $tempRoot "yaku-alert-cloudflared-err.log"
Remove-Item -LiteralPath $backendOut, $backendErr, $frontendOut, $frontendErr, $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue

if (-not (Test-Path (Join-Path $repoRoot "frontend/node_modules"))) {
  throw "Faltan dependencias de la web. Ejecuta 'npm install' dentro de frontend y vuelve a intentarlo."
}

$python = Get-Command python -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $python -or -not $npm) {
  throw "Necesitas Python y Node.js/npm instalados para iniciar la app sin Docker."
}

$backend = Start-Process -FilePath $python.Source `
  -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000") `
  -WorkingDirectory (Join-Path $repoRoot "backend") `
  -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr `
  -PassThru -WindowStyle Hidden

$frontend = Start-Process -FilePath $npm.Source `
  -ArgumentList @("run", "dev", "--", "--host", "0.0.0.0", "--port", "5173") `
  -WorkingDirectory (Join-Path $repoRoot "frontend") `
  -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr `
  -PassThru -WindowStyle Hidden

$tunnel = Start-Process -FilePath $cloudflared.Source `
  -ArgumentList @("tunnel", "--url", $LocalUrl, "--no-autoupdate") `
  -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath `
  -PassThru -WindowStyle Hidden

try {
  Write-Host "Iniciando backend y web localmente (sin Docker)..."
  $readyDeadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $readyDeadline) {
    if ($backend.HasExited) { throw "El backend no inició. Revisa el entorno Python y sus dependencias." }
    if ($frontend.HasExited) { throw "La web no inició. Revisa las dependencias de frontend." }
    $webReady = Test-NetConnection -ComputerName 127.0.0.1 -Port 5173 -InformationLevel Quiet -WarningAction SilentlyContinue
    $apiReady = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($webReady -and $apiReady) { break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $webReady -or -not $apiReady) { throw "La web o el backend no respondió en el tiempo esperado." }

  Write-Host "Esperando el enlace público de Cloudflare..."
  $publicUrl = $null
  $deadline = (Get-Date).AddSeconds(60)

  while (-not $publicUrl -and (Get-Date) -lt $deadline -and -not $tunnel.HasExited) {
    foreach ($logFile in @($stdoutPath, $stderrPath)) {
      $log = Get-Content -LiteralPath $logFile -Raw -ErrorAction SilentlyContinue
      if ($log -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
        $publicUrl = $Matches[0]
        break
      }
    }
    if (-not $publicUrl) { Start-Sleep -Milliseconds 500 }
  }

  if (-not $publicUrl) {
    throw "Cloudflare no entregó un enlace en 60 segundos. Revisa tu conexión e inténtalo de nuevo."
  }

  $mobileUrl = "$publicUrl/?mobile=1"
  $qrService = "https://api.qrserver.com/v1/create-qr-code/?size=800x800&format=png&data=$([uri]::EscapeDataString($mobileUrl))"
  Invoke-WebRequest -Uri $qrService -OutFile $qrPath
  Set-Content -LiteralPath (Join-Path $repoRoot "YAKU_ALERT_URL_ACTUAL.txt") -Value $mobileUrl -Encoding utf8

  Write-Host "Web móvil: $mobileUrl"
  Write-Host "QR generado: $qrPath"
  Write-Host "El túnel seguirá activo. Presiona Ctrl+C para detenerlo."
  while (-not $tunnel.HasExited) { Start-Sleep -Seconds 1 }
}
finally {
  if (-not $tunnel.HasExited) {
    Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($process in @($backend, $frontend)) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
  Remove-Item -LiteralPath $backendOut, $backendErr, $frontendOut, $frontendErr, $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
}
