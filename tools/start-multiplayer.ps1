param([int]$Port=4174)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskListener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if($taskListener){
  if($taskListener.LocalAddress -contains '0.0.0.0'){Write-Output "Multiplayer server already listening on port $Port";return}
  throw "Port $Port is already in use. Stop that server before starting LAN multiplayer."
}
$taskOldHost=$env:KART_HOST;$taskOldPort=$env:KART_PORT;$taskOldDatabase=$env:KART_DATABASE_PATH
try{
  $env:KART_HOST='0.0.0.0';$env:KART_PORT=[string]$Port
  if(-not $env:KART_DATABASE_PATH){$env:KART_DATABASE_PATH=Join-Path $taskRoot 'local-data/accounts-4174.sqlite'}
  & node (Join-Path $taskRoot 'server.mjs')
}finally{$env:KART_HOST=$taskOldHost;$env:KART_PORT=$taskOldPort;$env:KART_DATABASE_PATH=$taskOldDatabase}
