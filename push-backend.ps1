param(
    [string]$Message = "feat(backend): update API"
)

$ErrorActionPreference = "Continue"

$REPO = "$PSScriptRoot\influencertrack-backend"

Write-Host ""
Write-Host "  InfluencerTrack Backend Push → Render" -ForegroundColor Cyan
Write-Host "  ----------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# ── Guard: make sure the repo exists ──
if (-not (Test-Path $REPO)) {
    Write-Host "  ERROR: Backend repo not found at $REPO" -ForegroundColor Red
    exit 1
}

Push-Location $REPO

# ── Step 1: Show what's changed ──
Write-Host "  [1/3] Checking for changes..." -ForegroundColor Yellow

$changed = git status --short
if (-not $changed) {
    Write-Host "    No changes detected. Nothing to push." -ForegroundColor DarkGray
    Pop-Location
    exit 0
}

Write-Host "    Changed files:" -ForegroundColor Green
$changed | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }

# ── Step 2: Stage everything (excluding secrets) ──
Write-Host ""
Write-Host "  [2/3] Staging changes..." -ForegroundColor Yellow

git add app requirements.txt render.yaml 2>&1 | Out-Null
git add -A -- ':!.env' ':!.env.local' ':!venv' ':!.venv' 2>&1 | Out-Null

$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "    Nothing staged (all changes may be in excluded files)." -ForegroundColor DarkGray
    Pop-Location
    exit 0
}

Write-Host "    Files staged:" -ForegroundColor Green
$staged | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }

# ── Step 3: Commit and push ──
Write-Host ""
Write-Host "  [3/3] Committing and pushing to GitHub..." -ForegroundColor Yellow

git commit -m $Message
git push origin main

Write-Host ""
Write-Host "  Done! Render will auto-redeploy in ~1-2 minutes." -ForegroundColor Cyan
Write-Host "  Watch: https://dashboard.render.com" -ForegroundColor DarkGray
Write-Host ""

Pop-Location
