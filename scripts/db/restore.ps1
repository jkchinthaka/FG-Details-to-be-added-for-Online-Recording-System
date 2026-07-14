<#
.SYNOPSIS
  Restore a Nelna FG custom-format dump into a target database.
.PARAMETER DumpPath
  Path to .dump from backup.ps1
.PARAMETER DatabaseUrl
  Target database URL (should be empty/disposable).
.PARAMETER SkipChecksum
  Skip SHA256 verification when companion .sha256 is missing.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$DumpPath,
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,
  [switch]$SkipChecksum
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DumpPath)) { Write-Error "Dump not found: $DumpPath" }
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  Write-Error "pg_restore not found on PATH."
}

$hashPath = [System.IO.Path]::ChangeExtension($DumpPath, ".sha256")
if (-not $SkipChecksum) {
  if (-not (Test-Path $hashPath)) {
    Write-Error "Checksum file missing: $hashPath (pass -SkipChecksum to override)."
  }
  $expected = ((Get-Content $hashPath -Raw) -split "\s+")[0].Trim()
  $actual = (Get-FileHash -Algorithm SHA256 -Path $DumpPath).Hash
  if ($expected.ToUpperInvariant() -ne $actual.ToUpperInvariant()) {
    Write-Error "Checksum mismatch. Expected $expected got $actual"
  }
  Write-Host "Checksum OK"
}

Write-Host "Restoring into target database (clean/if-exists)..."
& pg_restore --clean --if-exists --no-owner --no-acl -d $DatabaseUrl $DumpPath
# pg_restore may return non-zero for benign notices; surface the code for operators
Write-Host "pg_restore exit code: $LASTEXITCODE"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$reconcileSql = Join-Path $repoRoot "scripts\db\reconcile_counts.sql"
if ((Get-Command psql -ErrorAction SilentlyContinue) -and (Test-Path $reconcileSql)) {
  $out = [System.IO.Path]::ChangeExtension($DumpPath, ".restore.counts.txt")
  & psql $DatabaseUrl -f $reconcileSql -o $out
  Write-Host "Post-restore counts: $out"
  Write-Host "Compare against pre-backup *.counts.txt — see docs/database/DATA_RECONCILIATION.md"
}

Write-Host "Restore procedure finished. Mark RESTORE_TEST_EVIDENCE.md only after manual comparison."
