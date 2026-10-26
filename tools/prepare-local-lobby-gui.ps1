param([string]$AssetRoot)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-asset-paths.ps1')
$AssetRoot = Resolve-LocalRhoRoot $AssetRoot
$output = Join-Path $PSScriptRoot '..\web-preview\assets\ui'
$files = @(
  'myRoom/2022_Facelift_main/backboard_01.png',
  'myRoom/2022_Facelift_main/backboard_02.png',
  'myRoom/2022_Facelift_main/backboard_03.png',
  'myRoom/2022_Facelift_main/backboard_04.png',
  'myRoom/2022_Facelift_main/backboard_05.png',
  'myRoom/2022_Facelift_main/backboard_06.png',
  'myRoom/2022_Facelift_main/obj.png',
  'gui/window/menu/lobby_btm_bg.png',
  'gui/window/menu/img_levelBG.png',
  'gui/window/menu/img_lucciBG.png',
  'gui/window/menu/btn_menuAllmenu_1.png',
  'gui/window/menu/btn_menuLobby_1.png',
  'gui/window/menu/btn_menuReward_1.png',
  'gui/window/menu/btn_menuQuest_1.png',
  'gui/window/menu/btn_menuChatting_1.png',
  'gui/window/menu/btn_menuMessenger_1.png',
  'gui/window/menu/btn_menuSearch_1.png',
  'gui/window/menu/btn_menuOption_1.png',
  'gui/window/menu/btn_mainMulti_1@zz.png',
  'gui/window/menu/btn_mainSingle_1@zz.png',
  'gui/window/menu/btn_mainMyroom_1@zz.png',
  'gui/window/menu/btn_mainShop_1@zz.png',
  'gui/window/menu/튜닝_01@zz.png',
  'gui/window/menu/클럽_01@zz.png',
  'gui/window/menu/kartPass_lobby_passShortcut_1@zz.png',
  'zeta/kr/stage/mainMenu/타임어택경쟁전_1.png',
  'zeta/kr/stage/mainMenu/btn_speedIndi_1.png',
  'stage/mainMenu/main_event_1.png',
  'stage/mainMenu/lobby_promotion_BG.png',
  'stage/mainMenu/lobby_notice_BG.png',
  'stage/mainMenu/kartPass_lobby_passIcon5_2.png',
  'stage/mainMenu/kartPass_lobby_passIcon4_2.png',
  'stage/mainMenu/kartPass_lobby_passIcon0_1.png',
  'stage/mainMenu/kartPass_lobby_passBtnPC_1@zz.png',
  'stage/mainMenu/kartPass_lobby_passBtnKart_1@zz.png',
  'stage/mainMenu/kartPass_lobby_passBtnEvent_1@zz.png',
  'stage/mainMenu/event_time_01.png',
  'stage/mainMenu/event_single_01.png',
  'stage/timeAttackReady/btn_gameStart_1@kr.png',
  'stage/timeAttackReady/btn_myItem_1@kr.png',
  'stage/timeAttackReady/btn_myItem_trackSelect_1@kr.png',
  'stage/mainMenu/leftbg.png',
  'stage/mainMenu/img_titleBlue.png',
  'stage/mainMenu/roomSlot_1.png',
  'stage/common/img_playerBG.png',
  'stage/gameReady/mycard_blue@zz.png',
  'stage/gameReady/mycard_red@zz.png',
  'gui/windowTemplate/card@zz.png',
  'gui/windowTemplate/trackcard.png',
  'dialog2/userReport/report_btn_confirm_1.png',
  'dialog2/userReport/report_btn_cancel_1.png',
  'stage/shop/shop_cash_bg.png',
  'stage/shop/shop_lucci_bg.png',
  'stage/shop/루찌구입1@zz.png',
  'stage/shop/원래대로1@kr.png'
)
foreach ($relative in $files) {
  $source = Join-Path $AssetRoot ($relative -replace '/', [IO.Path]::DirectorySeparatorChar)
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Original GUI asset missing: $source" }
  $target = Join-Path $output ($relative -replace '/', [IO.Path]::DirectorySeparatorChar)
  New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Output "Prepared original GUI: $relative"
}
