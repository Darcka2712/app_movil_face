# verify-android-env.ps1 — checks JDK 17+ and Android SDK for Expo run:android
# Exit 0 = OK, 1 = missing requirements. See docs/RUNBOOK_ANDROID.md

$failed = $false

Write-Host "=== FACE Mobile Android env check ==="

# Node
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $nv = & node --version
  Write-Host "[OK] node $nv"
} else {
  Write-Host "[FAIL] node not found"
  $failed = $true
}

# Java major version
$java = Get-Command java -ErrorAction SilentlyContinue
if ($java) {
  $jv = (& java -version 2>&1 | Select-Object -First 1) -replace '.*"(\d+)(\.\d+)?(\.\d+)?.*', '$1'
  $major = 0
  [void][int]::TryParse($jv, [ref]$major)
  if ($major -ge 17) {
    Write-Host "[OK] java major=$major"
  } else {
    Write-Host "[FAIL] java major=$major (need >=17). JAVA_HOME=$env:JAVA_HOME"
    $failed = $true
  }
} else {
  Write-Host "[FAIL] java not found"
  $failed = $true
}

# Android SDK
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if ($sdk -and (Test-Path $sdk)) {
  Write-Host "[OK] ANDROID_HOME=$sdk"
  $adb = Join-Path $sdk "platform-tools\adb.exe"
  if (Test-Path $adb) {
    Write-Host "[OK] adb present"
  } else {
    Write-Host "[FAIL] platform-tools/adb missing under $sdk"
    $failed = $true
  }
} else {
  Write-Host "[FAIL] ANDROID_HOME/ANDROID_SDK_ROOT not set or missing"
  $failed = $true
}

if ($failed) {
  Write-Host "RESULT: FAIL — see docs/RUNBOOK_ANDROID.md"
  exit 1
}
Write-Host "RESULT: OK"
exit 0
