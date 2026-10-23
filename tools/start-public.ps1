param([int]$Port=4174)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskBinary=Join-Path $taskRoot '.tools/cloudflared.exe'
$taskData=Join-Path $taskRoot 'local-data'
New-Item -ItemType Directory -Force -Path (Split-Path $taskBinary),$taskData | Out-Null
if(-not(Test-Path -LiteralPath $taskBinary)){
  # Official release, verified against GitHub's published SHA256 digest.
  $taskRelease=Invoke-RestMethod 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest'
  $taskAsset=$taskRelease.assets | Where-Object name -EQ 'cloudflared-windows-amd64.exe'
  if(-not $taskAsset.digest){throw 'Official release has no SHA256 digest.'}
  Invoke-WebRequest $taskAsset.browser_download_url -OutFile $taskBinary
  $taskHash=(Get-FileHash -LiteralPath $taskBinary -Algorithm SHA256).Hash.ToLower()
  if($taskAsset.digest -ne "sha256:$taskHash"){throw 'cloudflared download digest mismatch.'}
}
$taskState=Join-Path $taskData 'public-tunnel.json'
if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){
  $taskServer=Join-Path $PSScriptRoot 'start-multiplayer.ps1'
  Start-Process powershell -WindowStyle Hidden -WorkingDirectory $taskRoot -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$taskServer`"",'-Port',"$Port") -RedirectStandardOutput (Join-Path $taskData 'server-public-launcher.log') -RedirectStandardError (Join-Path $taskData 'server-public-launcher-errors.log') | Out-Null
  for($taskAttempt=0;$taskAttempt -lt 40;$taskAttempt++){
    if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){break}
    Start-Sleep -Milliseconds 250
  }
}
Invoke-WebRequest "http://127.0.0.1:$Port/login.html" -UseBasicParsing | Out-Null
if(Test-Path -LiteralPath $taskState){
  $taskPrevious=Get-Content -LiteralPath $taskState -Raw | ConvertFrom-Json
  $taskProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($taskPrevious.processId)" -ErrorAction SilentlyContinue
  if($taskProcess.ExecutablePath -eq $taskBinary){
    if($taskPrevious.port -ne $Port){throw "An active tunnel already uses port $($taskPrevious.port). Stop it before changing the public port."}
    Write-Output $taskPrevious.url;return
  }
}
$taskLog=Join-Path $taskData 'public-tunnel.log'
$taskTunnel=Start-Process -FilePath $taskBinary -WindowStyle Hidden -WorkingDirectory $taskRoot -ArgumentList @('tunnel','--url',"http://127.0.0.1:$Port",'--no-autoupdate','--protocol','http2') -RedirectStandardOutput (Join-Path $taskData 'public-tunnel-out.log') -RedirectStandardError $taskLog -PassThru
for($taskAttempt=0;$taskAttempt -lt 120;$taskAttempt++){
  $taskText=Get-Content -LiteralPath $taskLog -Raw -ErrorAction SilentlyContinue
  if($taskText -match 'https://[a-z0-9-]+\.trycloudflare\.com'){
    $taskUrl=$Matches[0]
    @{url=$taskUrl;processId=$taskTunnel.Id;port=$Port} | ConvertTo-Json | Set-Content -LiteralPath $taskState -Encoding utf8
    Write-Output $taskUrl;return
  }
  if($taskTunnel.HasExited){throw "Tunnel stopped; see $taskLog"}
  Start-Sleep -Milliseconds 250
}
throw "Tunnel URL was not issued; see $taskLog"
