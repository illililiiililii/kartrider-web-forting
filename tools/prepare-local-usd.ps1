param(
  [string]$ConvertedRoot = 'C:\Users\user\Downloads\kart web\KartRider_5136_02_CONVERT'
)

$ErrorActionPreference = 'Stop'
python -c 'from pxr import Usd' 2>$null
if ($LASTEXITCODE -ne 0) {
  throw 'Python usd-core is required. Install locally: python -m pip install usd-core==25.5.1'
}

$output = Join-Path $PSScriptRoot '..\web-preview\assets\usd'
$items = @(
  @('kart\whiteKnightV1\whiteKnightV1_demo.usda', 'whiteKnightV1', 0.01),
  @('kart\saberV1\saberV1_demo.usda', 'saberV1', 0.01),
  @('character\dao\dao.usda', 'dao', 0.01),
  @('character\bazzi\bazzi_f00.usda', 'bazzi', 0.01),
  @('track\beach_I01_비치 수상비행장\beach_I01.usda', 'beach_I01', 0.001),
  @('track\beach_I02_비치 여객선\beach_I02.usda', 'beach_I02', 0.001),
  @('track\village_R01_빌리지 고가의 질주\village_R01.usda', 'village_R01', 0.001)
)
foreach ($item in $items) {
  $source = Join-Path $ConvertedRoot $item[0]
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Missing supplied USD asset: $source"
  }
  $target = Join-Path (Join-Path $output $item[1]) 'model.mesh.json'
  if ($item[0].StartsWith('track\')) {
    $collisionFile = Join-Path (Split-Path -Parent $target) 'collision.ktrk'
    python (Join-Path $PSScriptRoot 'convert-usd-local.py') $source $target --scale $item[2] --ktrk $collisionFile
  } else {
    python (Join-Path $PSScriptRoot 'convert-usd-local.py') $source $target --scale $item[2]
  }
  if ($LASTEXITCODE -ne 0) { throw "USD conversion failed: $source" }
}
