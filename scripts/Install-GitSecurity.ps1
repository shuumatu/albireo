$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$existing = git -C $repository config --get core.hooksPath
if ($existing -and $existing -ne '.githooks') {
    throw "An existing hooksPath is configured: $existing. Merge these security hooks with it first."
}
$scanner = Get-Command gitleaks -ErrorAction SilentlyContinue
$localScanner = Join-Path $env:USERPROFILE '.local/bin/gitleaks.exe'
if (-not $scanner -and -not (Test-Path -LiteralPath $localScanner)) {
    throw 'Install Gitleaks in PATH or ~/.local/bin/gitleaks.exe before enabling the hooks.'
}
git -C $repository config --local core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) { throw 'Failed to enable Git security hooks.' }
Write-Output 'Enabled staged credential checks and outgoing-history checks.'
