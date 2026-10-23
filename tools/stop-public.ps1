$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskState=Join-Path $taskRoot 'local-data/public-tunnel.json'
if(-not(Test-Path -LiteralPath $taskState)){Write-Output 'No public tunnel recorded.';return}
$taskPrevious=Get-Content -LiteralPath $taskState -Raw | ConvertFrom-Json
$taskProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($taskPrevious.processId)" -ErrorAction SilentlyContinue
if($taskProcess){
  if($taskProcess.ExecutablePath -ne (Join-Path $taskRoot '.tools/cloudflared.exe')){throw 'Recorded PID belongs to a different process.'}
  Stop-Process -Id $taskProcess.ProcessId
}
Remove-Item -LiteralPath $taskState
Write-Output 'Public tunnel stopped. Local game server remains running.'
