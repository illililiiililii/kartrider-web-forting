# 카트라이더 5136 웹 포트 — 개발 중

메인 게임: [http://127.0.0.1:4174/](http://127.0.0.1:4174/)
물리/텔레메트리 테스트 페이지: [http://127.0.0.1:4174/debug.html](http://127.0.0.1:4174/debug.html)
메인 페이지는 제공된 로비/레이스 스크린샷과 `stage/mainMenu`, `stage/timeAttackReady`, `dialog/garageDialog`, `dialog2/selectTrackEx`, `stage/speedIndiGame` 레이아웃을 바탕으로, 원본 P5136 GUI PNG 파일들을 그대로 조합하여 구성되었습니다. 배경의 산, 시계탑, 지붕 및 장식용 캐릭터는 `myRoom/2022_Facelift_main`에서 가져왔으며, 하단의 흰색 작업 표시줄은 `gui/window/menu`에서 가져왔습니다. 또한 카트/캐릭터/트랙 메시, 트랙 카드, 미니맵, 속도 및 타이머 숫자 이미지, V1 엔진 N₂O 슬롯/게이지, 타코미터, 작업 표시줄 아이콘 등이 포함되어 있습니다. 동적 라벨과 계정 관련 필드는 별도로 새로 그려진 UI 아트가 아닌 텍스트로 구현되었습니다. 계정 로그인 화면은 추출된 파일 내에서 발견되지 않아, 현재의 계정 입력 레이아웃은 임시로 구성된 상태입니다.
로컬에서 검증된 트랙들은 원본 `.1s` 파일의 도로 충돌 판정(collision triangles) 데이터를 사용합니다. 벽 충돌 시의 안정성은 현재 추가 확인 중입니다. 원본 `.1s` 파일의 체크포인트 경로(ToRoad), 랩 카운트, 그리고 기본적인 결승 결과 처리 로직은 C/Wasm을 통해 연결되어 있습니다. 멀티플레이어 방/주행 기능은 개발 중이며, 원본 로컬 에셋과 실제 2인 검증이 필요합니다. 이 브라우저 게임은 [KartriderDemoPhysics](https://github.com/overjoy1008/KartriderDemoPhysics)에서 가져온 **수정되지 않은** C 모듈들(`kart_dynamics.c`, `kart_simulation.c`, `kart_camera.c`, `kart_countdown.c`, `kart_course.c`, `kart_course_data.c`, `kart_engine_sound.c`, `kart_input.c` 및 트랙 관련 C 모듈)과 `kart_demo_data.c`, `kart_track_texture.c`, `demo/kart_gauge.h`를 WebAssembly로 연결(링크)합니다. 로컬 빌드 시스템은 KTEX/KTXZ 텍스처 리더를 포함하여 제공된 `src` 디렉토리 내의 13개 C 파일을 모두 컴파일하며, 검토되지 않은 소스 파일 개수 변경 사항이 발생할 경우 빌드를 거부합니다. 시뮬레이션은 데모에서 사용된 5ms 최대 서브스텝(substep)을 비롯하여, 4륜 접지, 서스펜션, 종방향 및 횡방향(드리프트) 힘 계산, 공기 저항, 자세 통합(pose integration), 충돌 반응, 그리고 추적 카메라(chase-camera) 업데이트 로직을 활용합니다. `src-demo/demo_bridge.c`는 테스트를 위한 임시 평면 환경과 사각형 벽을 제공하며, 원본 데이터의 도로 태그가 지정된 삼각형 충돌 처리를 위한 어댑터 역할을 합니다. 또한 데모의 7초 카운트다운, 스타트 부스트 타이밍, 조향 키 제어권, 게이지 시스템(200 유닛/2개 슬롯 구조), 코스 게이트 그래프, 워프(순간 이동), 복구 로직, 그리고 사운드 재생 규칙 등이 모두 통합되어 있습니다. 이는 **2004년형 데모 물리 엔진**이며, P5136 버전의 물리 엔진과는 다릅니다. 렌더링되는 추적 카메라는 C 코드에서 계산된 위치, 전방/상방 벡터, 그리고 75~110도의 시야각(FOV)을 사용하며, 카메라의 부드러운 움직임(smoothing) 또한 C 코드 측에서 처리됩니다. 레이스 카메라 위치는 웹 환경에서의 별도 가림(occlusion) 처리 없이 그대로 적용됩니다. 로비 화면과 탑다운(top-down) 뷰는 별도로 구현되어 있습니다. 카트와 캐릭터는 1.5배 확대되어 표시되지만, 물리 엔진은 원본 'cotten5' 지오메트리와 역학(dynamics)을 그대로 유지합니다. 원본 클라이언트의 카트별 `param@kr.xml`이 준비되면 해당 카트의 무튜닝 기본 성능값을 C/WASM에 적용하며, 해당 파일이 없으면 카트별 5136 성능은 사용할 수 없습니다. 입력 방식(조작 방향 등)은 브라우저 경계에서 한 번 변환 과정을 거칩니다. Windows용 렌더러/재생 기능과 실험적인 다단 기어(multi-gear) 사운드 시스템은 물리 연산용 Wasm(WebAssembly)에 포함되어 있지 않습니다. 데모 버전의 2004년형 코스 테이블은 5136 트랙에 자동으로 적용되지 않으며, 5136 트랙 고유의 'ToRoad' 게이트 데이터는 제공된 `track.1s` 파일과는 별도로 디코딩됩니다. 이전의 Rust 기반 물리 연산 연구 자료는 [`OLD_PYS`](OLD_PYS/README.md) 디렉토리에 보관되어 있으나, 브라우저에서 실행될 때는 로드되지 않습니다.

## 로컬 환경에서의 빌드 및 실행 (Windows)

테스트를 거친 데모 버전의 C 소스 코드는 현재 `third_party/KartriderDemoPhysics` 디렉토리에 포함되어 있습니다(리비전 및 해시 정보는 `SOURCE.json` 파일 참조). 별도의 다운로드 과정은 필요하지 않습니다. Node.js(`node:sqlite` 포함, 버전 22.13 이상 권장), Python 3, PowerShell 7(`pwsh`)이 필요합니다. 프로젝트를 새로 체크아웃한 후, 다음 명령어를 실행하세요:

```powershell
.\tools\build-demo-physics.ps1 -Bootstrap
node server.mjs
```

`node server.mjs`는 시작할 때 `local-assets/{rhoOut,track,kart,character}`의 파일 경로·크기·수정 시각을 확인합니다. 새 파일이나 변경이 감지되면 `prepare-local-all.ps1`을 실행해 원본 모델 카탈로그, GUI, 오디오, 충돌 자료를 Git 제외 웹 경로에 다시 준비합니다. 실행 중 에셋을 넣었다면 서버를 다시 시작하세요. 준비에 실패하면 오류를 표시하고 원본이 없는 기능은 미준비 상태로 남깁니다. 자동 동기화만 건너뛰려면 `KART_SKIP_ASSET_SYNC=1`을 설정할 수 있습니다.

카트별 성능 변환에 사용하는 [P5136_Rust](https://github.com/ILoveKartrider/P5136_Rust) 기본 수치·BodyParam 합산 표는 `tools/p5136-stock-spec.json`에 리비전 `87de9460205cfd6818e1db56673b8ff13c92878e` 기준으로 고정했습니다. 변환 코드는 `tools/prepare-local-kart-physics.py`에 포함되어 있어 별도 Rust 체크아웃이 없어도 작동합니다. 실제 카트별 `param@kr.xml`은 원본 클라이언트의 `E/_rho5Out/kart_`에 있어야 합니다. 이를 `local-assets/client/E/_rho5Out/kart_`에 넣으면 자동 준비 대상이 됩니다. XML이 없으면 카트별 5136 성능은 생성하지 않습니다.

카트별 XML이 없더라도 원본 리소스로 준비된 로비·방 목록·대기실·상점은 볼 수 있습니다. 경기는 실제 카트 성능 JSON이 생길 때까지 출발하지 않으며, 서버가 `KART_PHYSICS_SOURCE_MISSING` 상태를 반환합니다.

`-Bootstrap` 옵션을 사용하면 Zig 0.13.0 버전이 `.tools/` 디렉토리(Git 관리 대상에서 제외됨)로 다운로드되며, 공식 SHA-256 해시값을 통해 무결성이 검증됩니다. 이미 설치된 Zig를 사용하려면 `-ZigExe` 옵션을 통해 경로를 지정할 수 있습니다. 게임 에셋이 없는 경우 `/debug.html`을 통해 물리 연산만 단독으로 실행할 수 있으며, 전체 게임 및 로비 기능을 사용하려면 로컬 에셋이 필요합니다. 빌드 도구는 리소스가 없을 경우 5136 게이트를 생성하지 않으며, 3개 트랙 중 일부만 입력되는 경우 처리를 거부합니다. 데모 버전의 2004년형 게이트 데이터를 5136 트랙에 대신 사용하는 일은 결코 발생하지 않습니다. 원본 파일은 [`local-assets/`](local-assets/README.md) 디렉토리에 배치해야 하며, 모든 준비(prepare) 스크립트는 기본적으로 이 디렉토리를 참조합니다. 입력 데이터가 없는 경우, 과거 다운로드 데이터를 검색하지 않고 `WAITING` 상태를 표시합니다. 서버를 시작하기 전에, 사용자가 압축을 해제한 원본 파일(`local-assets/rhoOut/` 경로)에서 트랙 카드와 미니맵을 준비해야 합니다:

```powershell
.\tools\prepare-local-tracks.ps1
.\tools\prepare-local-ui.ps1
.\tools\prepare-local-audio.ps1
.\tools\prepare-local-lobby-gui.ps1
# 모델 변환을 위해 필요함 (독립형 디버그 물리 모드에서는 불필요):
python -m pip install usd-core==25.5.1 Pillow numpy==2.3.5
# 네이티브 충돌(collision) 변환을 수행하려면 .NET 8 SDK와 Git이 추가로 필요합니다.
.\tools\prepare-local-all.ps1
```

로컬로 복사된 아트워크, 5136 버전에서 파생된 C 게이트 테이블, 그리고 충돌 데이터 출력물은 Git 추적 대상에서 제외(Git-ignored)됩니다. 새로운
메인 페이지는 `beach_I01`, `beach_I02`, `village_R01` 비주얼 메시를 기반으로 하며,
원본에 포함된 `property/road` 메타데이터를 통해 KTRK 충돌 데이터가 선택됩니다.
`prepare-local-all.ps1`은 다음을 탐색합니다.
제공된 모든 USDA 모델은 원본의 트랙 라벨 및 랩 데이터를 그대로 유지하며, 유효한 모든 'ToRoad' 테이블을 생성하고 Wasm을 통해 각 시작 지점의 유효성을 검증합니다. 지원되지 않는 입력 데이터는 `assets/catalog.json` 파일에서 제외되며, 제외된 이유가 함께 기록됩니다. 처리 결과(성공 또는 실패) 중 변경되지 않은 항목은 캐시됩니다. 전체 준비 과정을 수행하려면 .NET 8 SDK, Git, usd-core 25.5.1, Pillow, NumPy 2.3.5가 필요합니다. 체크포인트 게이트는 해당 트랙의 원본 `.1s` ToRoad 레코드에서 디코딩되며, 각각 3/3/2 랩으로 설정됩니다. 웹 트랙, 충돌 삼각형, 그리고 `.1s` 게이트는 이전 프로토타입 대비 10배 확대되었으나, 카트/캐릭터 및 그 'C 바디(C body)'는 원래 크기를 유지합니다. 이후 모델만 1.5배 확대하는 과정이 추가되었지만, 고유 물리 엔진은 변경되지 않았습니다. 이는 의도적으로 프로토타입의 월드 스케일을 조정한 것이며, 원본의 물리적 크기(5136미터)를 그대로 재현하려는 것은 아닙니다. 이번 일괄 확대 전, 원본 스케일에서의 시작 지점 높이는 KTRK 데이터와 0.005m 오차 범위 내에서 일치했습니다. 정사각형 테스트 코스는 `/debug.html`에서 확인할 수 있습니다. 모델 입력 데이터는 파일 서명(USD ASCII/바이너리 또는 FBX)을 통해 감지되며, FBX 파일은 기존 USD 변환기 사용 전 Blender를 거쳐 처리됩니다. 전체 FBX 변환은 입력 파일이 준비되는 대로 진행될 예정입니다. 자세한 내용은 [`DEVELOPMENT_PROGRESS.md`](DEVELOPMENT_PROGRESS.md)를 참조하십시오.

[http://127.0.0.1:4174/](http://127.0.0.1:4174/)에 접속하십시오. 생성된 `web-preview/demo_physics.wasm` 파일은 Git 관리 대상에서 제외되어 있으므로, 로컬 환경에서 직접 빌드해야 합니다. 사용된 업스트림 스냅샷에는 별도의 라이선스 파일이 포함되어 있지 않으나, 관련 고지 사항 및 출처 정보는 [`third_party/README.md`](third_party/README.md)에 보존되어 있습니다. 원본 게임 에셋과 생성된 Wasm 및 코스 테이블은 Git 관리 대상에서 제외됩니다. 조작 방법: 방향키 또는 숫자 키패드 8/2/4/6(W/A/S/D 키도 사용 가능), Shift 키로 드리프트, Ctrl 키로 부스터(드리프트 종료 시 게이지가 가득 차 있을 경우 사용 가능), R 키로 초기화, F3 키로 충돌 와이어프레임 표시. `/debug.html` 페이지에서 슬라이더를 사용해 데모의 `max_steer_angle_deg`(최대 조향 각도)를 1°에서 30°까지 0.1° 단위로 설정할 수 있습니다. 옆의 입력란에 정확한 값을 직접 입력할 수도 있으며, 설정값은 로컬에 저장됩니다. 기본값은 10°입니다. 'Space' 키를 이용한 'Exceed(익시드)' 기능은 향후 P5136 통합 전까지 비활성화되어 있습니다. 별도의 데모 물리 엔진 선택기를 통해 `cotten5`, `practice1`, `saber5`, `solid5` 등 원본의 역학(dynamics) 및 차체 형상을 불러올 수 있습니다. P5136 V1 메시(mesh) 선택은 시각적인 요소일 뿐이며, 해당 데모 카트의 실제 물리적 특성을 재현하는 것은 아닙니다. 시작 시에는 데모와 동일하게 7초 카운트다운이 진행되며, ±100ms 타이밍에 맞춰 가속 키를 누르면 부스터가 발동합니다. 사각형 형태의 디버그 테스트 코스는 P5136 원본 레이스에 포함된 것이 아닙니다. 데모의 게이지 규칙은 원본의 충전 공식을 복원한 것이 아니라, 가설에 기반한 것입니다. V1 패시브 충전 API는 아직 실험적인 단계이므로 메인 게임에서는 비활성화되어 있으며, 대신 기존 데모의 SLIP 게이지가 사용됩니다. 디버그 모드에서 저장한 조향 각도 설정은 메인 게임의 기본 설정값을 덮어쓰지 않습니다. 모든 입력 방식은 '마지막으로 누른 키'를 우선하는 원본 로직을 따르며, 별칭(alias)이나 터치 입력도 동일한 상태를 공유합니다. 화면에 표시되는 랩(바퀴 수) 정보는 원본 `track@zz.xml` 파일에서 가져오며, 원본의 'ToRoad' 체크포인트(0.1초 단위)를 통해 랩 카운트와 결승 통과 상태가 결정됩니다. 외부에서 불러온 트랙의 경우, 'R' 키를 누르면 코스 체크포인트에서 재시작(리스폰)됩니다. 깊은 곳으로 추락했을 때는 타이머를 초기화하지 않고도 임시로 안전한 지상 위치로 복귀할 수 있습니다. `server.mjs`는 (넥슨/P5136 계정이 아닌) 독립적인 웹 게임 계정 기능을 제공합니다:
`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`,
`POST /api/auth/logout` 등이 이에 해당합니다. `/login.html`은 원본 메뉴 패널과 일반적인 빨간색 버튼 스프라이트를 사용한 로컬 계정 로그인 폼을 제공합니다. 비밀번호는 scrypt 알고리즘으로 해싱되며, 해싱된 세션 토큰은 (Git 등에서) 무시되도록 설정된 `local-data/accounts-4174.sqlite` 파일에 저장됩니다. 쿠키는 `HttpOnly` 및 `SameSite=Strict` 속성이 적용되어 있습니다. HTTPS 환경에서는 `KART_COOKIE_SECURE=1`로 설정하십시오. 원본 게임 내 `stage/authenStage`는 별도의 챌린지 화면일 뿐이며, P5136 계정 로그인 레이아웃의 근거가 아닙니다.

저작권이 포함된 에셋을 직접 저장소에 올리지 않고도, 원본 `.1s` 형식의 카트 지오메트리(형태 데이터)를 다음과 같이 변환할 수 있습니다:

```powershell
python .\tools\convert-1s-preview.py '..\..\work\original-assets\whiteKnight1-model.1s' '.\web-preview\assets\whiteKnight1.mesh.json'
python .\tools\convert-1s-preview.py '..\..\work\original-assets\cotton11-model.1s' '.\web-preview\assets\cotton11.mesh.json'
```

해당 로컬 메시(mesh) 파일이 없을 경우, 3D 렌더러는 임시 형태의 카트를 표시합니다. 변환된 카트의 바퀴는 이제 C 언어로 작성된 물리 상태에 따라 조향 및 회전하며, 부스트 사용 시 기본적인 배기 효과가 나타납니다. 새로운 USD 경로를 사용하면 원본 카트/캐릭터 텍스처와 세 가지 원본 트랙 장면이 추가로 로드됩니다. 메인 페이지는 원본 충돌(collision) 메타데이터를 사용하지만, 스켈레탈 애니메이션과 벽면 접촉 시의 안정적인 물리 처리는 아직 구현되지 않았습니다. 트랙 변환 스케일을 변경한 후에는 `prepare-local-usd.ps1`과 `build-demo-physics.ps1`을 함께 다시 실행하여, 시각적인 도로와 KTRK 히트박스, 그리고 ToRoad 체크포인트 게이트가 서로 일치하도록 조정해야 합니다. ## 검증

데모 C의 속도 기반 조향 공식은 변경 없이 그대로 적용되었습니다:
`maxSteer × exp(-abs(forwardVelocity / steer_constraint))`. 슬라이더를 10°로 설정한 상태에서 Wasm을 통해 직접 측정한 결과, 0 m/s에서 10.00°, 15.50 m/s에서 5.77°, 29.15 m/s에서 3.54°의 값이 도출되었습니다. 새로운 회귀 테스트는 이러한 경향을 확인합니다. 드리프트 슬립(drift slip) 계산 시에는 별도의 최대 조향 경로를 사용할 수 있으므로,
이 증거는 드리프트가 없는 조향(non-drift steering)에만 해당합니다.

```powershell
.\tools\build-demo-physics.ps1
.\tools\test-5136-course.ps1
.\tools\test-physics-parity.ps1
python tools/test-usd-conversion.py
node --test tools\test-auth-server.mjs tools\test-demo-physics.mjs tools\test-frame-interpolation.mjs tools\test-local-ui-assets.mjs tools\test-recovery.mjs tools\test-wheel-basis.mjs tools\test-track-collision.mjs tools\test-local-models.mjs tools\test-demo-input.mjs tools\test-kart-pose.mjs tools\test-local-catalog.mjs
```

복구 실행(recovery run)은 17개의 Node 검사와 1개의 Python 형식 검사를 통과했으며, 에셋 의존적 검사 8개는 건너뛰었습니다. Zig 부트스트랩과 오프라인에서의 동일한 재빌드 과정이 검증되었습니다. 과거 에셋 기반 실행(historical asset-backed run)은 22개의 Node 검사를 통과했으며, 원본 전체 경로 3개에 대한 네이티브 합성 주행(native synthetic traversal) 테스트도 완료했습니다. 이러한 검사 항목에는 V1 속도 임계값 충전, 원본 GUI 에셋 해시 검증, 가져온 트랙의 충돌 처리, 3개 트랙 모두에서의 명확한 출발 방향, 속도에 따른 조향, 데모용 게이지/카운트다운/입력/코스 동작, 그리고 회원가입/로그인/로그아웃 기능이 포함됩니다.
직접적인 Wasm 테스트에서, 기본 데모 카트는 평탄한 테스트 환경에서 1.6초 만에 약 156km/h까지 가속되었습니다. 동일한 짧은 입력값을 주었을 때, 5°/10°/20°의 조향 각도에 따라 진행 방향이 그에 맞춰 변화하는 것을 확인했습니다. 브라우저 QA를 통해 Wasm 로딩, 실제 카트 모델, 슬라이더, 그리고 레이스 카운트다운이 정상적으로 작동함을 확인했습니다. 또한 'Beach I01' 트랙에서 수정된 원본 출발선 방향도 브라우저 QA를 통해 검증되었습니다. 네이티브 주행 테스트는 게이트 쿼드(gate quads)에 직접 데이터를 입력하는 방식이며, 사람이 모든 원본 충돌 경로를 따라 전체 랩을 주행할 수 있다는 점까지 보장하지는 **않습니다**. 사용자가 직접 조작하여 랩을 완전히 완주하는 기능이나, 원본 클라이언트와 동일한 이동 경로(궤적)를 구현하는 기능은 아직 검증되지 않았습니다. 남은 과제와 제한 사항에 대해서는 [`reader.md`](reader.md)를 참조하십시오.

공식 로컬 서버는 이제 기본적으로 **4174** 포트를 사용하며, `local-data/accounts-4174.sqlite` 데이터베이스 파일을 사용합니다. `KART_PORT` 및 `KART_DATABASE_PATH` 환경 변수를 설정하여 다른 포트나 데이터베이스를 지정할 수 있습니다. 기존의 4173 포트용 데이터베이스인 `local-data/accounts.sqlite`는 그대로 유지되며, 덮어쓰이지 않습니다. 세션 쿠키는 포트별로 분리되어 있어, 테스트 서버가 기존 로그인 세션을 덮어쓰는 일을 방지합니다. 서버가 실행 중인 상태에서 사용자 데이터나 진행 상황을 안전하게 백업하려면 다음 명령어를 사용하십시오.

```powershell
node tools/backup-user-db.mjs
```

이 명령어를 실행하면 WAL(Write-Ahead Logging) 내용을 포함한 일관된 상태의 SQLite 스냅샷이 `local-data/backups/` 디렉토리에 생성됩니다(해당 디렉토리는 Git 추적에서 제외되어 있습니다). 라이브 상태인 `.sqlite` 파일만 단독으로 백업하지 마십시오(WAL 파일이 반드시 함께 포함되어야 합니다). 계정 데이터베이스 및 백업 파일에는 개인 계정 정보가 포함되어 있으므로, Git 저장소에 포함하지 않도록 주의하십시오.
