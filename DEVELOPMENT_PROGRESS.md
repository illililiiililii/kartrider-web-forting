## 2026-10-23: 양면 벽·로비·주행 자세 및 로컬 계정 상점

- 트랙 재질을 양면 표시하며 기존 깊이 검사와 불투명 알파 픽셀 선처리는 유지한다. 브라우저 WebGL 앞/뒤 2방향 픽셀 검사에서 벽 뒤 물체는 가려지고 투명 구멍만 통과했다.
- 로비 카트 방향을 180도 수정하고 카트·탑승/로비 캐릭터 외형을 직전 대비 0.6배로 줄였다. 원본 C 치수·주행 계수·카메라 계산은 변경하지 않았다. 부스터 크기와 장착 위치도 새 외형 경계에 맞춘다.
- USDA의 kart_skelData에 남은 24관절/부모 행렬/가중치로 90개 캐릭터 변형의 앉은 주행 자세를 생성한다. 원래 서 있는 메시·UV·텍스처도 보존하며 로비에서 사용한다. 팔을 앞으로 굽히고 다리를 앉히는 웹 자세이며 원본 애니메이션 클립 복원은 아니다. 새 NumPy 2.3.5 의존성은 설치 문서에 기록했다.
- 타코미터 위 임시 부스터 문구와 첫 바퀴 팝업을 제거했다. 원본 action2d@zz.xml의 2~5lap/finallap 이미지 영역·위치·100/700/300ms 시간을 로컬 JSON으로 준비해 표시한다. 부스터 슬롯은 오른쪽부터 채우고, 미니맵은 차량 중심 고정 + 진행 방향 위쪽으로 회전한다.
- player-store.mjs와 SQLite 새 테이블에 루찌·경험치/레벨·보유 카트·장착·닉네임 변경권·출석·레이스 보상을 저장한다. 기존 users/sessions와 로그인 아이디는 보존한다. 기본 지급은 practiceV1/연습카트 V1, cottonV1/코튼 V1뿐이며 변환 완료된 다른 카트는 상점에서 구매 후 선택한다. 닉네임 변경은 변경권 1개를 소비하고 로그인 아이디는 바꾸지 않는다.
- 경제는 원작 수치가 확인되지 않은 로컬 단독 플레이 정책이다: 최초 3,000루찌, 카트 2,000, 변경권 500, 한국 날짜 기준 일일 출석 500, 완주 100루찌/50경험치. 레벨=1+floor(sqrt(경험치/100)). 카트별 V1 성능 자료가 없어 외형만 다르며 상점에도 표시했다. 가격/증감은 서버가 정하고 구매·소모를 트랜잭션으로 처리한다.
- 완주 보상은 인증된 계정의 레이스 발급표·랩 수·카운트다운 포함 실제 경과 시간과 1회 수령을 확인한다. 클라이언트 WASM의 완주 신고를 바탕으로 하는 로컬 기능이며 서버 주행 검증/멀티플레이 부정행위 방지는 구현하지 않았다. 친구·로비/방 채팅은 사용자 요청대로 멀티플레이 작업으로 보류한다.
- 검증: 전체 에셋 준비/90개 자세/원본 GUI 5패널/WASM 빌드/203개 시작점 성공. Node 57개 중 55통과·기존 물리 TODO 2개 유지. 계정 저장/재시작 복구, 소유권, 가격 변조, 중복 구매·수령, 닉네임 중복 시 변경권 보존, 기존 아이디 로그인, 레벨 경계 검사 통과. 브라우저에서 상점 구매·루찌 차감·변경권 사용·보유 목록·축소한 주행 자세·방향 회전 지도를 확인했다.
- 미검증: 실제 수동 완주에 따른 보상, 모든 카트의 좌석별 자세와 원본 애니메이션, 전체 맵 가림. 기존 원본 C 장시간 벽 접촉 침하/네이티브-WASM 수치 차이는 별도 TODO다. 원작 에셋·생성 모델·계정 DB·QA 파일은 Git에서 제외한다.

## 2026-10-23: 트랙 이동·부스터 표시·미니맵·랩·가림 수정

- 트랙 원본은 `local-assets/track/<맵>/track.1s` 우선(보고된 `.s1`도 지원), 로컬 rhoOut/기존 외부 경로 순으로 읽는다. 충돌·코스·기본/전체 준비 스크립트에 같은 우선순위를 적용했다. 원본 파일은 변경하지 않았다.
- 원작 부스터/flare/wave/blur 이미지 9개를 로컬 출력으로 복사한다. WASM에 실제 일반/출발/순간 부스트 종류를 추가해 불꽃·발광·발동 파동·표시 문구를 구분했다. 설정 버튼의 부스터 블러는 저장/복원되며 HUD에는 적용하지 않는다. 현재 개인전 아이콘은 boostTex_0, 팀전 이미지는 준비만 한다. 원본 효과 .1s의 입자/애니메이션 전체를 복원한 것은 아니며 배치는 모델 뒤쪽 경계를 따른 웹 표현이다.
- 원본 서스펜션을 변경하지 않고 복사 상태로 조회한 실제 뒤 바퀴 접지점에서만 드리프트 자국을 만든다(최대 1,024조각). 공중/정지/텔레포트 구간은 연결하지 않는다. 낙하 1초 이상·마지막 접지보다 8m 아래·하강 중이며 아래에 도로가 없으면 기존 R 복귀를 요청한다. 기존 장면 최저점 복귀도 유지하며, 낮은 착지면이 있는 점프는 강제로 복귀시키지 않는다.
- 각 맵의 원본 ToMinimap 원점/배율/크기를 읽어 512px xt_bigmap과 연결하고 차량을 중앙에 고정해 지도를 확대/이동시킨다. 292개 등록, 나머지는 충돌 윤곽으로 명시적 대체. 기본 3맵 게이트 중심 36/41/73개가 모두 이미지 영역 안에 있으며, 원본 그림의 모든 분기/장식까지 일치함을 보증하지는 않는다.
- 조기 완주의 원인은 원본 C progress.lap(현재 1부터 시작)을 완료 횟수로 해석한 >= 비교였다. 완료 횟수=현재 번호-1로 수정. 변경 없는 원본 코스 순회에서 I01/I02/빌리지 실제 3/3/2회 완료(109/70/123 게이트) 후에만 종료한다. 각 바퀴 시작에 n번째 바퀴, 최종 바퀴에 마지막 바퀴!! 표시.
- alphaBlend 전체에 depthWrite=false를 적용하던 탓에 불투명한 담장 픽셀도 뒤쪽 물체를 차단하지 못했다. 원본 혼합/알파를 보존하고 알파 0.999 이상 픽셀만 깊이 선처리한다. 투명 구멍/반투명 재질은 유지한다.
- 검증: 전체 준비 재실행, WASM 빌드, 203코스 시작점 검사 성공. Node 52개 중 50통과/기존 TODO 2, 경로/ToMinimap Python 2통과, 원본 네이티브 3코스 실제 랩 순회 통과. C 실제 출발/드리프트 종료 순간/게이지 부스터 신호와 접지점·낙하 복귀·경사로/점프/착지 검사 통과. 브라우저 Beach I01 주행·드리프트·지도 이동·설정 저장 확인, 효과 신호 합성 전용 화면에서 세 종류/블러 ON/OFF 및 가림 픽셀 검사 통과.
- 남음: 원본 C의 장시간 벽 접촉 침하 및 네이티브/WASM 접촉 수치 차이(TODO 2개), 전체 맵·실제 수동 완주 검수. 이번 작업에서 가속·조향·마찰을 변경하지 않았다. 원작/생성 에셋과 QA 로그·화면은 Git에 넣지 않는다.

## 2026-10-23: 원본 데모 입력·물리 재연결 및 전체 로컬 목록 확장

- 이전 수정에서 좌우 변환을 제거한 판단은 잘못이었다. C 화면의 right와 Three.lookAt이 구하는 right가 반대임을 투영 검사로 확인했다. `demo-input.mjs`에서만 조향 부호를 변환하며, 키보드 별칭·터치·양쪽 키 우선순위는 원본 C 입력 상태를 공유한다. 실제 화면 좌/우 회전 회귀 검사 통과.
- 주행 중 `maxSteer * exp(-abs(forwardSpeed / steer_constraint))`를 0/15/30/45 m/s 구간에서 검사했다. 숨겨진 저장 조향각 덮어쓰기와 V1 자동 충전을 메인에서 해제하고 원본 cotten5 치수·질량·서스펜션·저항 설정을 사용한다. V1 모델별 고유 물리를 복원했다는 뜻은 아니다.
- 카운트다운 중 물리 정지를 제거해 원본처럼 서스펜션을 계속 계산한다. 출발 부스트의 GO 이후 창과 Ctrl을 먼저 누르고 가속하는 입력도 원본 Win32 호출 방식으로 연결했다. 실행 간격은 정수 실제 경과 시간(최대 50ms), C 내부는 최대 5ms로 분할한다. 웹의 16ms 누적/추가 보간과 레이스 카메라 가림 보정을 제거했다.
- 차체 쿼터니언을 C에서 내보내 실제 피치·롤·요를 모델과 탑승 캐릭터에 적용한다. 임의 캐릭터 기울기는 제거했다. 낙하 복귀는 출발 높이-20 대신 원본 `kart_demo_track_fall_limit`과 실제 장면 최저 높이를 따른다. 가속도·마찰·조향 계수를 임의 조정하지 않았다.
- 원본 네이티브 엔진·게이지·카메라와 WASM을 6종/1,830프레임 비교했다. 비접촉 5종(가속·감속·조향, 드리프트, 전체 카운트다운/출발 부스트, 후진, 가변 시간) 최대 수치 차 0.000091615 이내이며 실제 조향각도 비교한다. 벽에 오래 밀착한 장면은 위치 최대 약 0.038, 진행 방향 약 0.051rad, 카메라 위치 약 0.313의 차이가 남아 엄격한 비교 검사를 TODO로 유지했다. 원본 C 자체의 벽 접촉 침하도 미해결이다. 새 보정으로 숨기지 않았다.
- `prepare-local-all.ps1`은 기존 USDA·원본 road 충돌 변환기를 재사용한다. 제공된 트랙 318개, 카트 107종, 캐릭터 4종의 90개 표정/모델 변형을 검색해 로컬 카탈로그를 생성한다. 트랙 한글 이름·랩 수는 원본 XML을 사용한다. 기본 3코스 인덱스 제한을 제거하고 원본 ToRoad 코스 203개를 C에 생성했다.
- 현재 트랙 318개 중 203개는 실제 WASM의 충돌 로드·원본 시작점·지면·체크포인트 활성화 검사를 전부 통과했다. 나머지 115개는 준비 필요로 표시한다: 랩 정보 없음/비랩 코스 85개, 원본 리더 형식 미지원 17개, 좌표 정렬 실패 3개, 원본 비정상(NaN) 기하 10개. 실패 입력도 캐시해 같은 데이터의 반복 변환을 피하며, 원본이 바뀌면 다시 검사한다.
- 카트·캐릭터 표시 크기를 이전 대비 각각 1.5배로 확대했다(레이스·로비·선택 모델). 물리 치수는 원본 데모 값을 유지한다. 새 카트 선택은 외형 선택이며 원본 5136 V1 성능 수치를 추측하지 않는다. 캐릭터 변형은 정적 모델이며 스켈레톤 애니메이션 복원은 별도다.
- 검증: 전체 준비 명령 재실행/캐시 복구 성공, WASM 빌드, 203개 시작점 검사, Node 45개 중 43통과/미해결 TODO 2개, 기존 3개 코스 네이티브 랩 순회 검사, USDA 합성 변환 검사 통과. 내장 브라우저에서 318/107/90 선택 목록, Beach I01 좌회전, 새 포레스트 통나무·aceV1·마리드 조합의 주행/우회전 및 확대 모델을 확인했다. 해당 실행 콘솔 오류 0. 모든 코스 완주나 모든 모델 외형의 정확성을 검증한 것은 아니다.
- 남은 작업: 위 벽 접촉 2개 TODO, 준비 필요 맵의 원본 자료/리더 지원, 새 모델별 재질·장착 검수 및 애니메이션. Beach/Village 외 테마 BGM의 정확한 원본 곡 연결도 대기이며 다른 테마에 Beach 음악을 대신 재생하지 않는다. 원작 파일과 생성 JSON/KTRK/WASM/카탈로그·캐시는 Git에 넣지 않는다.

## 렌더링·충돌·물리 비교 수정 (현재 상태)

- 바퀴: 원본 차축은 X, 기존 애니메이션은 Z 회전이었다. 바퀴에만 X/Z 기저 교환과 역변환을 적용해 장착 위치를 보존하고 회전·앞바퀴 조향을 수정했다. 백기사/세이버 각 4개 바퀴 검사 통과. 차체·캐릭터 좌표는 유지했다.
- V1 계기판: 원본 `gui/tachometer/v1/tacho.xml`의 `1234567890`, 36×43 숫자 아틀라스를 WASM 속도에 연결했다. 원본에 없는 바늘은 추가하지 않았다.
- USDA: 상속 재질 바인딩, 실제 diffuse 연결, 반복 UV, 양면·알파 플래그와 반사 행렬의 정점 순서를 보존했다. 텍스처 출력 이름에 내용 해시를 붙여 동명 충돌을 막고 DDS/TGA는 RGBA로 변환한다. UV V값은 그대로 유지한다(Three 업로드가 Y를 뒤집음). 누락 이미지는 다른 그림으로 대체하지 않는다.
- 시간 샘플만 있고 기본값이 없는 부모 변환을 Default 시간으로 읽던 것이 큰 배치 오류 원인이었다. 시작 시간의 변환·점·UV를 읽도록 수정했다. 물/새/투명물 및 특정 텍스처를 이름으로 숨기던 트랙 필터를 해제했다. 카트의 미확인 분리형 mod 애니메이션은 여전히 보류한다.
- 현재 사용자가 교체한 트랙 USDA는 `trackSourceScale=1.0`에서 원본 `.1s`와 맞는다. 이전 파일용 2/3 설정을 해제했다. 기존 0.01 변환, 10배 트랙 기준과 1.04/1.52 반폭·반길이 충돌체는 유지했다.
- 충돌: 데모의 변경 없는 C# exporter와 핀 고정 리더를 이용해 원본 `.1s`의 상속 `property/road` 플래그를 추출한다. 이름 추정 충돌은 정상 준비 경로에서 제거했다. X 반사·삼각형 순서 보정 후 렌더 메시의 월드 경계와 비교한다. .NET 8 SDK/Git 필요; 의존성·라이선스·읽기 전용 속성 노출 패치는 `tools/native-collision-exporter/SOURCE.json` 참조.
- 결과: Beach I01 77개/1,989삼각형, I02 167개/7,207, Village R01 55개/2,997 충돌 메시. 시각 메시 정렬 883/885, 787/841, 372/376; 일치 경계 최대 오차 0.01049/0.01936/0.00503 월드 단위. 미일치 2/54/4개는 임의 확정하지 않았다. 충돌체 자체의 시각 메시 대응은 I01 77/77, I02 148/167, Village 55/55이며, I02의 19개 미일치 충돌체는 추가 정렬 검증이 필요하다. 텍스처 없는 메시 23/14/0개도 보류한다. 상세는 로컬 `collision-info.json`.
- F3와 debug 페이지 버튼으로 C가 읽는 동일 KTRK의 충돌 삼각형을 반투명 와이어프레임 표시한다. 미니맵도 원본 collidable 플래그를 따른다. 미니맵 윤곽에는 충돌 가능한 넓은 지형도 포함된다.
- 물리 차이: 웹이 원본 조향키 값을 반대로 전달했고, 스텝 후 지면 탐색 실패/높이 차이를 이유로 위치를 되돌리고 속도를 -0.32배 하거나 차체 높이를 강제로 올렸다. 저속 속도 0 고정도 추가되어 있었다. 이를 제거해 원본 충돌·서스펜션·낙하를 사용한다. 가속·조향·마찰 계수는 바꾸지 않았다. 렌더러가 시작 높이 0.5를 계속 빼 차체를 도로에 묻던 오류도 수정했다(원본 서스펜션 평지 평형 높이는 0).
- 비교: `tools/test-physics-parity.ps1`이 변경 없는 13개 C 모듈을 네이티브로 빌드하고 같은 초기 상태/입력을 WASM과 비교한다. 평지 가속·조향·감속/드리프트/출발 부스트 480×5ms 최대 수치 오차 0.000003855. 추가 Beach 벽 접촉 690×16ms에서 위치 최대 차 0.004304, 진행 방향 0.002536rad; 속도 벡터 최대 차 0.30203, 요 각속도 0.16837로 접촉 시 수치 차이가 남는다. 드리프트/부스트 상태·스텝 수는 같았다. 보고서는 로컬 `physics-parity.json`; 원본 실행 파일 전체와의 동일성 주장은 아니다.
- 확인된 미해결: 벽에 계속 밀착하면 원본 네이티브 C도 지면 341.663 부근에서 차체 Z 340.281까지 가라앉는다(시나리오 3). 해당 기존 회귀 검사는 TODO로 남겼으며 높이 순간이동으로 숨기지 않았다. 원본 ray/접촉 해석 후 수정 필요. 충돌체는 원본 cotten5보다 약 19% 넓고 33% 길며, V1 자동 충전·트랙 스케일·카메라 가림 보정도 의도된 차이로 남는다. 원본 적분은 최대 5ms: 16ms 요청은 5+5+5+1, 웹 누적 시간 100ms 제한으로 긴 프레임에서 시간이 버려질 수 있다.
- 검증: WASM 빌드, 7종 USDA 및 3개 원본 충돌 재생성 성공. Node 38개 중 37 통과/벽 접촉 TODO 1; USD 합성 재질·UV·시간 변환 검사 통과; 3개 트랙 네이티브 체크포인트 3/3/2랩 통과. 합성 도로/벽/장식물/다리 높이/경사로/점프/착지 검사 통과. Chrome Beach I01에서 주행·드리프트·카메라·지도·V1 숫자·와이어프레임 확인, 콘솔 오류 0. BGM/드리프트 오디오 시간 진행 확인(빠른 전환 시 play/pause Abort 경고 있음). 모든 트랙 완주/모든 벽/실제 점프 구간/분리형 카트 부품/부스트음 재생은 이번 브라우저 검증 범위 밖이다.
- 원작 에셋은 Git에 포함하지 않는다. 업로드는 사용자 직접 진행으로 변경했다. 기존 4개 ZIP과 해시 목록은 로컬 `local-data/drive-backup/`에 있다.

## 2026-10-22 supplied local assets connected

- Recognized 419 track / 214 kart / 90 character USDA files without FBX assumptions. The local `rhoOut/` actually held duplicate converted tracks; the user's real `D:\12\KartRider_5136\KartRider_5136_01_UNPACK\_rhoOut` is now mapped in ignored `local-data/asset-paths.json`. Shared path resolution supports explicit overrides/environment/config/default local folders. Raw originals were neither changed nor uploaded.
- Existing USDA -> JSON pipeline converted Beach I01/I02, Village R01, White Knight/Saber V1 and Dao/Bazzi, preserving transforms, UVs and original textures/material flags. Fixed exact `saberV1` selection when the `saberV1_knight` variant also exists. Optional ignored `.tools/usd-python` holds pinned usd-core 25.5.1.
- The supplied `usda_relement` 1.2.0 tracks were 1.5x the existing coordinate convention: Beach I01 start-stripe edge X ~1826.21 versus original gate X ~1217.48. Machine-local `trackSourceScale=2/3` normalizes these inputs before the established 0.01 conversion. Visual/KTRK world scale, original ToRoad positions and kart hitbox remain unchanged. All three native start/ground/first-gate regressions now pass; no 2004 gates were substituted.
- Existing scripts copied original GUI/HUD/fonts, track cards/minimaps, BGM and drift/boost OGGs from the real unpack root. Main race now reuses the debug page's original sound choices/levels, starts BGM on the race-start gesture and triggers effects from Wasm drift/boost state; GUI layout was preserved.
- Verified: asset-backed Wasm build; 7 model conversions / 3 KTRKs; 25 Node tests passed, zero skips (including GUI SHA-256, ground/collision/idle/start gates/camera/map/auth); native full synthetic route traversal passed at 3/3/2 laps. Chrome QA on isolated in-memory account server :4174 confirmed original lobby/setup/HUD, both kart/character combinations, Beach I01 driving, collision counter, C camera and moving/rotating map marker, without captured console errors. Main BGM/drift advanced in gameplay; actual BGM/drift/boost media all decoded (readyState=4) and advanced in a browser probe, whose effect events were synthetic. No claim of a naturally earned booster or full manual lap.
- Remaining: human-driven full laps; verified original collision tags instead of heuristic proxy; original ToMinimap bitmap registration; animation/seat/material details (black roadside faces still visible). Existing GUI gaps await user screenshots. Local logs/screenshots and probe pages stay ignored under local-data/assets.

## 2026-10-22 format recovery (current status)

- Restored the GitHub history without replacing local code (local/remote code differed only by line endings before these edits).
- Added ignored `local-assets/{rhoOut,track,kart,character}` with tracked placeholders/instructions. Prepare scripts use these defaults and report empty inputs once. USD/FBX signatures are detected; FBX routes through Blender into the existing USD pipeline without modifying originals.
- Vendored the tested demo revision `a9eade1f343764b10fb6dce5fec3828756fad2e6`: 13 C modules, headers, gauge, ToRoad parser and inspected Win32 minimap/sound references. SHA-256 manifest, compiler version check and checksum-verified Zig bootstrap make debug physics rebuildable from Git alone. No upstream license file was present; provenance/notices retained without adding a license grant.
- Missing 5136 resources now produce an explicit debug-only build, overwriting stale gate tables; partial track inputs fail. 2004 course tables remain separate and are never used for 5136 tracks.
- Chase renderer now applies C position, forward/up (including roll), full FOV and C smoothing. Existing web obstruction adjustment remains; lobby composition is preserved. Top-down height now follows actual vehicle altitude.
- Inspected upstream `kart_minimap_win32.c`: it does contain Win32 projection/ToMinimap mappings, but those constants belong to 2004 tracks. Web fallback adapts its world-to-panel axis convention using the actually loaded 5136 KTRK geometry and live vehicle position/heading; it does not apply those old bitmap mappings. Accurate original 5136 bitmap registration awaits `ToMinimap` metadata/assets.
- Already connected C dynamics/drift/boost/collision/suspension, input/countdown/start boost, gauge/speed and course/recovery are retained. C engine pitch/volume/crash laws are computed, but main-game playback, Win32 audio mixer, skid marks and exact original minimap camera are not restored; sound samples and verified 5136 mapping remain pending.
- Verified: checksum-checked `-Bootstrap` install and full 13-module Wasm build; repeat offline build has identical SHA-256; Node 17 passed / 8 asset-dependent skipped; Python signature test passed; PowerShell/JS syntax and empty-input preparation passed. HTTP-served Wasm executes, C camera vectors/FOV reach Three camera math, synthetic KTRK projection is tested. Actual original-model/Blender FBX conversion, GUI hashes, 5136 route traversal and browser visual QA await missing resources. No GUI redesign or extracted asset upload.

# P5136 web port — development progress

## 2026-10-22 race framing, mirrored track correction, original setup GUI

- Rebuilt the single-play setup, My Items, and track selection overlays around
  unchanged local P5136 dialog/stage sprites. The race HUD now uses the
  original V1 tachometer base, booster bar, and `item/slot/slot_v1.png`, with
  rank/time/map positioned against the supplied race screenshots. Buttons
  for the available karts, characters, tracks, race start, and lobby return
  are wired; missing original inventory content is not fabricated.
- The USDA track had been mirrored in both rendering and demo collision, so
  the three scenes now render in original USD horizontal orientation and
  the KTRK exporter cancels the demo reader's X mirror. Verified solid spawn
  heights and clear initial forward motion on Beach I01, Beach I02, and
  Village R01. Village's old spawn faced a building; it now starts on the
  roadway at (14.5, 49) toward the visible original start banner.
- Race model scale 0.50 is matched by bridge body half-width 0.42 m and
  half-length 0.62 m. Lobby-only kart/character scales are 0.75/0.80 after
  screenshot calibration. In tall app panels, horizontal camera field of
  view is retained so the kart does not grow disproportionately. Camera and
  road framing were checked in the live browser at 1280×720.
- The extracted Beach I01 `bc_br_002.png` cards at `Object49s0` and
  `Object274363279s0` formed an opaque green bar across the drivable lane;
  only these broken visual placements are hidden pending native transform
  recovery. UV orientation and PNG alpha flags were corrected in the local
  USDA converter. Track edge rebound/floor support and wall-count debounce
  live only in the bridge, leaving upstream demo C unchanged.
- The V1 speed-threshold automatic gauge charge reported by the user remains
  a separate future V1 behavior; no unsupported threshold/rate was guessed
  into the demo gauge hypothesis. Browser QA confirmed original lobby,
  setup, My Items, track selection, Beach I01 race, and Village R01 race.

## 2026-10-22 original-only game GUI pass

- Matched the user-supplied 1280×720 lobby reference using unchanged
  `myRoom/2022_Facelift_main/backboard_01`–`06.png` and `obj.png` for the
  mountain/clock-tower/roof and decorative riders. Mode choice, right-hand
  pass/event stack, account bars, and 66-pixel white taskbar now follow the
  screenshot's principal placement. The tiled backboard is a screen-space
  approximation, not recovered original room geometry/camera.
- Separated the lobby backdrop from the original track drive scene. The
  transparent WebGL layer shows the real 3D kart and character in the lobby;
  entering the race restores the original track scene and demo camera.
  Lobby-only framing and scale were adjusted against the supplied reference.
  Browser QA at 1280×720 confirmed lobby, race entry, and lobby return.
- Rebuilt `/` rather than layering another style over the provisional UI.
  Lobby modes, list/promotion frames, arrows, start button, notice, taskbar,
  race rank/time digit sheets, REC sheet, N₂O gauge/slot, tachometer, and
  minimap frame are unchanged PNGs from original `_rhoOut` stage/gui folders.
  Their positioning follows `mq_window@kr.xml`, `taskBar@kr.xml`,
  `rankBoard.xml`, `timeInfo.xml`, `boostGauge.xml`, and `tachometer.xml` where
  the present practice-mode game has matching state. No new UI artwork was
  generated. The account form uses the original list frame and generic red
  button art; its precise P5136 login layout is unavailable.
- Original fonts now load locally. A SHA-256 regression test checks each
  referenced local GUI file against `_rhoOut` and rejects CSS gradients.
  The sprite assets remain Git-ignored and are copied by
  `tools/prepare-local-ui.ps1` from the user's installation.
- Mobile race touch buttons use the original `gui/tablet` direction,
  Drift, and Item sprites, including their pressed-state images.
- Browser QA confirmed lobby selection labels/button and race rank, timer,
  speed, N₂O, REC, and minimap render. Removed a static fake minimap player
  marker; actual map-coordinate mapping is still unimplemented.

## 2026-10-21 original GUI, visual scale, camera, and local login

- Retained the upstream demo C physics as the chosen driving model; removed
  P5136 numerical-parity comparison from the active work plan.
- Race kart/driver visual scale is now 0.22 by default (previously 0.55),
  adjustable from `/debug.html` without changing collision or speed. The
  original C camera pose/forward vector is used directly: removed an extra JS
  smoothing pass and independent look-at pitch. Camera obstruction tests now
  ignore obvious non-solid decorative meshes.
- Removed the fabricated blue showroom pad. The lobby shows original Beach
  track geometry and the original kart and character with separate lobby
  display calibration. Visual placement remains provisional.
- Replaced the custom lobby panel/button graphics with the unchanged P5136
  `stage/mainMenu` / Korean override PNGs chosen from `mq_window@kr.xml`;
  HUD N₂O frame/bar now uses `stage/speedIndiGame/boostGauge.xml` assets.
  Some layout/text controls are still browser-native rather than XML-complete.
- Added a local-account login/register screen using the original menu panel
  art because no normal account-entry screen was found; `authenStage` is an
  additional challenge screen. The login page calls the existing SQLite
  server APIs. The lobby displays account state and supports logout.
- Replaced the old 4173 static preview server with `node server.mjs` on the
  same URL. Browser QA confirmed the lobby and login page load. The race
  kart is visibly smaller, but original attachment/collision data remain
  unresolved.

## 2026-10-21 idle collision and original localized textures

- Reproduced ~37 m of idle creep over eight simulated minutes on the imported
  Beach I01 collision proxy. A bridge-only sub-0.15 m/s grounded/no-input
  deadzone now holds the kart in place without changing upstream demo C.
  Added a 480-second local-track regression; all 14 automated tests pass.
- Reduced the original kart/driver presentation scale from 0.72 to 0.55 after
  visual comparison against the imported Beach I01 roadway. This does not
  change the demo's collision body and still needs original unit verification.
  Bumped module URLs so an already-open browser reload actually receives the
  new scale; visually verified a narrower kart on the road.
- Found Village R01's six previously missing dynamic ad images in the
  original `_rhoOut/zeta/kr/ppl/ingame/hangul/village/` folder. The local
  converter resolves them by exact filename and theme; no generated image or
  cross-theme substitution is used. Beach's equivalent files remain missing.
- Original collision tags and source GUI/login layout are still unverified;
  no new speculative UI was added in this update.
- Inspected `stage/mainMenu/mq_window@kr.xml` and prepared its original base
  and Korean override sprite namespaces plus `stage/speedIndiGame` locally:
  404 + 984 + 92 PNGs. These are ignored local assets; the current provisional
  page has **not** yet been replaced by the XML-derived layout.

## 2026-10-21 demo C integration, model calibration, and account server

- Kept the upstream demo C dynamics/simulation/camera/track code unmodified and
  additionally linked its countdown, input, course graph/data, engine-sound
  laws, and `demo/kart_gauge.h` into the locally built Wasm. Restored the
  demo's 7-second start sequence, ±100 ms start boost, last-pressed steering
  ownership, gauge handoff at drift exit (200 units / two slots), and course
  gate/warp/500 ms recovery functions. Upstream gauge charging is explicitly
  a simulator hypothesis, not original-client recovery.
- The demo's 13 course tables build in Wasm, but P5136 Beach track selection
  still does not attach them: they refer to different track versions. The new
  game remains practice mode until P5136 gate geometry is established.
- Browser screenshot showed an oversized kart on the Beach I01 road. Scaled
  only the displayed original kart and driver model to 0.72; physical demo
  body dimensions are unchanged pending P5136 BodyParam mapping. Missing
  dynamic advertisement textures no longer appear as opaque grey planes.
  The USD converter now checks inherited material bindings and an exact
  same-category `_rhoOut` fallback; it does not substitute other-track art.
- Added local Node/SQLite account endpoints with scrypt password hashes,
  hashed sessions, HttpOnly SameSite=Strict cookies, origin check, and request
  throttling. This is not Nexon login. No invented account UI was added.
- Browser QA: new Wasm loads and race screen shows the smaller original kart.
  `node --test` reports 13 passing checks. Separate auth server was served at
  `http://127.0.0.1:4174/` during QA.

Next: validate P5136 source collision/route metadata, original GUI layout and
missing material references, then wire account forms using verified original
assets. Native REA decompilation was unavailable because no Ghidra/IDA provider
was configured; source XML and PNG assets were inspected directly instead.

## 2026-10-21 new game page and rendering fixes

- Replaced the public-facing prototype page with a new lobby and race HUD at
  `/`; the old telemetry/steering test UI now lives at `/debug.html`.
- The new page loads supplied White Knight/Saber, Dao/Bazzi, three original
  track scenes, original menu button, track cards/minimaps and tachometer.
  Its converted USD collision candidates feed demo C ground/body callbacks.
  This permits practice driving, not verified original-course laps.
- Confirmed in the linked Wasm that normal steering decreases from 10.00° at
  rest to 5.77° at 15.50 m/s and 3.54° at 29.15 m/s with the same setting.
  Added a regression test; demo drift slip uses a different steer path.
- Matched the track X mirror used by the C collision reader in Three.js;
  added camera occlusion checks. Set the default Beach I01 spawn on the road.
- Reduced character visual scale from 0.60 to 0.42. PNG alpha cutouts now use
  alpha testing, fixing opaque rectangular leaf/fence cards. Static USD nodes
  with missing effect transforms are hidden until animation support exists;
  the static Saber V1 still has small red triangles near its body, requiring
  a material/mesh attachment pass rather than another blind scale change.
  Offset the kart mesh from the demo body-centre pose so wheels meet the road.
- Browser QA confirmed all three track loads, the new lobby, countdown/HUD,
  Beach I01 road view, and the separate debug page. Automated tests: 10 passed.
  Additional material/UV alignment and collision validation remain needed.

## Current playable state

- Active driving uses the locally built 2004 KartRider demo C physics in Wasm.
  The old experimental Rust physics is archived in `OLD_PYS`. The C bridge
  still provides a flat test surface, square walls, a hypothesized drift gauge,
  and a four-gate test race; it does not claim to reproduce P5136 formulas.
- Original P5136 kart and character USDA geometry and referenced PNG textures
  now render together in the browser: White Knight V1, Saber V1, Dao, and
  Bazzi. Their positions currently use manual seat scaling/offset; the USDA
  attach points and skeletal animation are not yet applied.
- Three original P5136 tracks (`beach_I01`, `beach_I02`, `village_R01`) can be
  selected and driven using textured 3D scene meshes and heuristic collision
  triangles. Original checkpoint/lap metadata remain unconnected.
- Original P5136 tachometer sprite is locally copied from
  `gui/tachometer/default/tachometer.png`. Speed and gauge displays read live
  Wasm state; the present CSS crop/placement is provisional.
- A user-gesture button starts locally copied original OGG audio: beach/village
  BGM selected by theme and drift/booster effects triggered by live Wasm state.
  This is a provisional audio mapping, not recovered per-track sound metadata.

## Supplied asset inventory (recursive `_rhoOut` scan, 2026-10-21)

The user-supplied `_rhoOut` tree contains approximately 50,175 PNG, 33,054
`.1s`, 7,254 DDS, 5,209 XML, 4,172 OGG, 2,100 KAP, 603 KSV, 452 JPG,
48 FLAC, and 2 OTF files. Notable top-level directories include `character`,
`effect`, `gui`, `sound`, `stage`, `theme`, `track`, and `zeta`. These counts are
inventory only; filenames do not establish runtime semantics.

The separate `KartRider_5136_02_CONVERT` tree described as FBX by the request
actually contains **USD ASCII (`.usda`)**, not FBX: 419 track, 214 kart, and
183 character USDA files. The track tree additionally contains 47,971 PNG
textures. The USDA files have mesh topology, UVs, material texture references,
scene transforms, and some animation metadata. `tools/convert-usd-local.py`
uses OpenUSD's `pxr` parser and exports browser JSON with textures, avoiding a
second reverse-engineering pass over `.1s` for geometry.

## Verification performed

- Local USD conversion: 2 karts, 2 characters, 3 tracks. `beach_I01` exported
  885 meshes / 7.16 MB JSON; its local texture+JSON folder is about 10.7 MB.
- Browser QA at `http://127.0.0.1:4173/`: original White Knight V1 with Dao
  visibly rendered; original Beach I01 track overview visibly rendered; local
  demo Wasm running. Direct visual QA identified and corrected an oversized
  skydome/fog issue in the track viewer.
- `node --test tools/test-demo-physics.mjs tools/test-frame-interpolation.mjs`:
  9 passed. JavaScript syntax checks passed.

## Next implementation order

1. Verify the imported track collision candidates against original drive,
   wall, ramp and jump surfaces; repair material/attachment transforms.
2. Manually drive one complete original `.1s` ToRoad course in the browser,
   confirming each lap and finish through the provisional collision mesh.
3. Read USDA seat/attachment points and skeleton/animation to align and animate
   the driver and kart parts. Eliminate the manual offset.
4. Map original UI XML/sprite atlases for HUD/lobby and connect selections to
   real race state. Verify the original audio's per-track mapping and timing.
5. Add room multiplayer after a stable single-player track race. Continue
   labeling the driving simulation as the chosen 2004 demo model.

## Distribution boundary

Generated USD JSON, copied PNG/audio, and the demo C derivative Wasm remain
Git-ignored. The user plans to make the GitHub repository private later, but
it is currently public. A future privacy change does not itself grant
redistribution rights, so do not push these extracted assets or the demo C
source/compiled derivative without clear permission. Source conversion scripts
and local build instructions are tracked.

## 2026-10-22: V1 passive charging and rider material pass

- The C/Wasm bridge now supports a separate V1 passive N₂O charger. Above a
  configurable forward-speed threshold, a grounded kart gains gauge even
  without drifting. The initial 25 m/s threshold and 2 gauge units/s rate are
  **provisional**, not recovered P5136 constants. The demo's original drift
  calculation and charge formula remain unchanged.
- Dao and Bazzi's supplied neutral body atlas now receives a material tint;
  their separately textured original face is unchanged. A small rigid-body
  steering/slip pose is applied to the original imported character mesh. This
  is not the original skeletal animation, which remains unconverted.
- The HUD's total-lap denominator now follows `_rhoOut/track/common/track@zz.xml`:
  Beach I01/I02 have 3, Village R01 has 2. The numerator/finish still require
  5136-compatible checkpoint gates; the practice UI explicitly says so.
- On imported tracks, `R` or a deep fall now returns to the most recently
  verified grounded pose after 500 ms without resetting the race clock. This
  rolling safety point is a temporary fallback, not an original checkpoint.
- New-browser visual QA confirmed the blue Dao lobby model, original race
  scenery/HUD, and Beach I01 `/3` readout. Automated tests: 19/19 passed.

## 2026-10-22: original 5136 ToRoad checkpoints and finish

- `tools/prepare-local-course.py` reads the supplied original `track.1s`
  files with the separately obtained demo ToRoad parser. It emits ignored
  local C tables for Beach I01, Beach I02 and Village R01; the Wasm builder
  links those tables to the unchanged demo course implementation.
- Original start positions divided by 10 agree with the converted road surface
  within 0.005 m. Spawn headings now follow the original course instead of
  manually guessed directions. Three 5136 route graphs contain 36/23/61
  built nodes and use the original metadata's 3/3/2 laps.
- The race HUD shows live lap and best-lap time. On C/Wasm finish it opens a
  minimal result view using the original `stage/timeAttack/mq_window@zz.xml`
  panel dimensions and supplied `laptime_*`/button sprites, with retry/lobby.
- Native synthetic traversal tests pass all three complete course graphs;
  Node/Wasm tests pass 20 checks including original spawn/first gate. Browser
  QA confirmed the Beach I01 start stripe is ahead of the kart. A complete
  human-driven lap still needs collision/route QA and is not claimed here.

## 2026-10-22: tenfold track-to-kart scale correction

- Regenerated all three local original 3D tracks and their KTRK collision
  meshes at 10× the previous conversion size. Their original `.1s` ToRoad
  course positions receive the identical 10× transform in generated C/Wasm.
  The imported kart/character, physical kart footprint and chase-camera
  distance stay at their prior size, so the body is now one-tenth as large
  relative to the track instead of merely looking smaller.
- Browser QA at Beach I01 confirms the full road fills the view while the kart
  remains visible, and the original start stripe/course still align. Added
  a side-wall steering collision regression alongside ground, spawn and gate
  tests. Full manual racing on all three enlarged tracks remains to verify.

## 2026-10-22: demo source completeness and kart size follow-up

- The local Wasm builder now compiles all 13 supplied demo `src/*.c` files;
  `kart_track_texture.c` was previously absent. A KTEX decode test exercises
  the added C module through a Wasm bridge. This does not mean the browser
  renderer uses the demo's Windows texture pipeline; it still loads converted
  original PNGs with Three.js.
- Race kart and mounted character renders are 2.5× their immediately prior
  size. The P5136 kart body footprint changed from 0.84×1.24 m to 2.08×3.04 m
  to match the visible model; the web camera was repositioned for the larger
  kart. This hitbox override is deliberately outside the unmodified demo C.
- The proxy-track adapter now rejects sudden upward ground-height steps and
  no longer lifts the kart onto fence tops through its seam correction.
  The roadside regression checks collision, no fall-through, and maximum
  vertical climb. Legitimate jumps still follow demo suspension/gravity.
- The demo's 2004 kart dynamics C is in use, but the selected kart dimensions,
  heuristic P5136 KTRK collision, provisional V1 charger, and visible web
  camera are concrete remaining differences from the demo desktop sample.
  Browser QA confirmed a proportionate kart at Beach I01 start, original HUD,
  and no console errors. Automated suite: 22 Node checks plus native course
  traversal pass; full wall coverage on every original track remains open.
