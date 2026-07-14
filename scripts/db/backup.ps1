<#
.SYNOPSIS
  Safe local/test PostgreSQL backup for Nelna FG.
.DESCRIPTION
  Creates a custom-format pg_dump, SHA256 checksum, and optional row-count snapshot.
  Does not upload dumps or write secrets. Never commits output to git.
.PARAMETER OutputDir
  Directory for dump artifacts (created if missing).
.PARAMETER DatabaseUrl
  Optional. Defaults to $env:DATABASE_URL.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDir,
  [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is not set. Pass -DatabaseUrl or set the environment variable."
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  Write-Error "pg_dump not found on PATH. Install PostgreSQL client tools."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$base = Join-Path $OutputDir "nelna_fg_$stamp"
$dumpPath = "$base.dump"
$hashPath = "$base.sha256"
$countsPath = "$base.counts.txt"

Write-Host "Writing dump to $dumpPath"
& pg_dump -Fc --no-owner --no-acl -f $dumpPath $DatabaseUrl
if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump failed with exit $LASTEXITCODE" }

$hash = Get-FileHash -Algorithm SHA256 -Path $dumpPath
"$($hash.Hash)  $(Split-Path $dumpPath -Leaf)" | Set-Content -Encoding ascii $hashPath
Write-Host "Checksum: $($hash.Hash)"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$reconcileSql = Join-Path $repoRoot "scripts\db\reconcile_counts.sql"
if ((Get-Command psql -ErrorAction SilentlyContinue) -and (Test-Path $reconcileSql)) {
  Write-Host "Capturing pre-backup counts"
  & psql $DatabaseUrl -f $reconcileSql -o $countsPath
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Count capture failed; dump and checksum are still valid."
  }
} else {
  Write-Warning "psql or reconcile_counts.sql unavailable; skipped count snapshot."
}

Write-Host "Backup complete."
Write-Host "  Dump:     $dumpPath"
Write-Host "  Checksum: $hashPath"
if (Test-Path $countsPath) { Write-Host "  Counts:   $countsPath" }
