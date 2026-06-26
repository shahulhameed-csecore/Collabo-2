param(
    [string]$Message = "feat(frontend): update UI"
)

$ErrorActionPreference = "Continue"

# This repo root is what Vercel watches (vercel.json lives here).
# The frontend source lives in influencertrack-frontend/ and is synced
# into influencertrack-backend/frontend/ before pushing, because the
# Vercel project is connected to influencertrack-backend on GitHub.
$SOURCE = "$PSScriptRoot\influencertrack-frontend"
$TARGET = "$PSScriptRoot\influencertrack-backend\frontend"
$REPO   = "$PSScriptRoot\influencertrack-backend"

$SYNC_DIRS  = @("app", "components", "lib", "public")
$SYNC_FILES = @(
    "next.config.ts",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
    "postcss.config.mjs",
    "eslint.config.mjs"
)

Write-Host ""
Write-Host "  InfluencerTrack Frontend Push → Vercel" -ForegroundColor Cyan
Write-Host "  ----------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# ── Step 1: Sync frontend source into backend/frontend/ ──
Write-Host "  [1/3] Syncing frontend files..." -ForegroundColor Yellow

foreach ($dir in $SYNC_DIRS) {
    $src = Join-Path $SOURCE $dir
    $dst = Join-Path $TARGET $dir
    if (Test-Path $src) {
        $excludeDirs  = ".next", "node_modules"
        $excludeFiles = "*.env.local", "*.tsbuildinfo"
        robocopy $src $dst /MIR /XD @excludeDirs /XF @excludeFiles /NJH /NJS /NFL /NDL | Out-Null
        Write-Host "    OK  $dir/" -ForegroundColor Green
    }
}

foreach ($file in $SYNC_FILES) {
    $src = Join-Path $SOURCE $file
    $dst = Join-Path $TARGET $file
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "    OK  $file" -ForegroundColor Green
    }
}

# ── Step 2: Stage changes ──
Write-Host ""
Write-Host "  [2/3] Staging changes..." -ForegroundColor Yellow

Push-Location $REPO

git add frontend/app frontend/components frontend/public 2>&1 | Out-Null
git add frontend/next.config.ts frontend/tsconfig.json frontend/package.json frontend/package-lock.json frontend/postcss.config.mjs frontend/eslint.config.mjs 2>&1 | Out-Null
git add -f frontend/lib 2>&1 | Out-Null

$staged = git diff --cached --name-only
$frontendStaged = $staged | Where-Object { $_ -match "frontend/" }

if (-not $frontendStaged) {
    Write-Host "    No frontend changes to commit. Already up to date." -ForegroundColor DarkGray
    Pop-Location
    exit 0
}

Write-Host "    Files staged:" -ForegroundColor Green
$frontendStaged | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }

# ── Step 3: Commit and push ──
Write-Host ""
Write-Host "  [3/3] Committing and pushing to GitHub..." -ForegroundColor Yellow

git commit -m $Message
git push origin main

Write-Host ""
Write-Host "  Done! Vercel will auto-deploy in ~1-2 minutes." -ForegroundColor Cyan
Write-Host "  Watch: https://vercel.com/collabo-s-projects/collabo-2" -ForegroundColor DarkGray
Write-Host ""

Pop-Location
