$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (Test-Path -LiteralPath $bundledNode) {
    $nodePath = $bundledNode
} else {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
}
$appPort = if ($env:PORT) { $env:PORT } else { '19393' }
Write-Host "Dianxiaozhi: http://127.0.0.1:$appPort"
Write-Host 'Keep this window open. Press Ctrl+C to stop.'
& $nodePath (Join-Path $appRoot 'server.mjs')
