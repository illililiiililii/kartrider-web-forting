function Enable-LocalPython([string]$PythonExe='python',[switch]$Usd) {
  $project=Split-Path -Parent $PSScriptRoot
  $packages=Join-Path $project '.tools/python-packages'
  $usdCache=Join-Path $project '.tools/usd-python'
  New-Item -ItemType Directory -Force -Path $packages | Out-Null
  $env:PYTHONPATH="$packages$([IO.Path]::PathSeparator)$usdCache$([IO.Path]::PathSeparator)$env:PYTHONPATH"
  $requirements=@()
  & $PythonExe -c 'import PIL' 2>$null
  if ($LASTEXITCODE -ne 0) { $requirements+='Pillow==11.3.0' }
  & $PythonExe -c 'import numpy' 2>$null
  if ($LASTEXITCODE -ne 0) { $requirements+='numpy==2.3.5' }
  if ($Usd) {
    & $PythonExe -c 'from pxr import Usd' 2>$null
    if ($LASTEXITCODE -ne 0) { $requirements+='usd-core==25.5.1' }
  }
  if ($requirements.Count) {
    & $PythonExe -m pip install --target $packages --disable-pip-version-check @requirements
    if ($LASTEXITCODE -ne 0) { throw "Python dependencies unavailable: $($requirements -join ', ')" }
  }
}
