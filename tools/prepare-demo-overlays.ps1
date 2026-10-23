# Build-only adapters: pinned source files remain byte-for-byte unchanged.
# With adapters disabled, both substitutions evaluate to original constants.
function Get-WebDemoModules([string]$Source, [string]$Root) {
  $folder=Join-Path $Root '.tools/demo-web-overlay'
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  $modules=@()
  foreach($file in Get-ChildItem -LiteralPath (Join-Path $Source 'src') -Filter '*.c' -File | Sort-Object Name) {
    if($file.Name -eq 'kart_track_collision.c') {
      $text=[IO.File]::ReadAllText($file.FullName)
      $text=$text.Replace('#define KART_BODY_HALF_HEIGHT 0.699999988079071f',"extern float demo_body_half_height;`nextern KartVec3 demo_body_center(const KartSimulationState *state);`n#define KART_BODY_HALF_HEIGHT demo_body_half_height")
      $text=$text.Replace('centre = add(state->position, body_up);','centre = demo_body_center(state);')
      if(-not $text.Contains('centre = demo_body_center(state);')) {throw 'Body query source changed; review overlay'}
    } elseif($file.Name -eq 'kart_dynamics.c') {
      $text=[IO.File]::ReadAllText($file.FullName)
      $text=$text.Replace('const float boost = boost_active ? 1.5f : 1.0f;',"extern float demo_drive_multiplier(bool boosting, float base_force);`n    const float boost = demo_drive_multiplier(boost_active, base_force);")
      if(-not $text.Contains('demo_drive_multiplier(boost_active, base_force)')) {throw 'Drive source changed; review overlay'}
    } else {$modules+=$file.FullName;continue}
    $output=Join-Path $folder $file.Name
    [IO.File]::WriteAllText($output,$text)
    $modules+=$output
  }
  return $modules
}
