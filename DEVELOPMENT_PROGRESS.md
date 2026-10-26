## 2026-10-26: 멀티플레이·상점 GUI 6화면과 서버 자동 출발 (부분 완료)

- 요청한 효과음 미리듣기 전용 `web-preview/audio-preview.html`을 삭제했다. 원본 카운트다운·출발·완주·버튼음은 기존 `game.js`/`race-audio.mjs`에서 실제 경기 상태와 버튼 입력에 연결된 상태를 유지한다. 일반 랩 완료음과 종료 10초음은 아직 원본 호출 근거가 없어 연결하지 않았다.
- 첨부 화면을 기준으로 멀티플레이 모드·방 목록, 방 만들기 팝업, 8칸 대기실, 7인 준비 상태, 상점 그리드, 구매 확인 팝업을 실제 API 화면에 구성했다. 방 슬롯은 서버 `slot` 순서로 표시하고 준비·방장·채팅·트랙 카드는 방 스냅샷을 따른다. 구매 확인에는 웹 계정 API의 실제 루찌 가격/잔액을 사용한다. 5136 원본 상점의 가격·기간을 재현한 것은 아니다. 웹 서버가 지원하지 않는 팀전/아이템전과 캐릭터 판매는 비활성·빈 목록으로 두었다.
- Drive의 `rhoOut`에서 로비 배경 7장, 작업표시줄과 상점·방 카드 등 **55개 원본 PNG**를 Git 제외 `local-assets/rhoOut`에 복구하고, `tools/prepare-local-lobby-gui.ps1`로 Git 제외 웹 에셋 경로에 복사했다. 실제 이미지 파일은 커밋하지 않는다. 완전한 5136 GUI/폰트·3D 모델은 아직 복구되지 않아 첨부 이미지와 픽셀 단위 동일성을 검증하지 못했다.
- 서버는 2명 이상 방에서 방장을 제외한 모든 참가자가 준비하면 10초 절대 시각 `autoStartAt`을 스냅샷에 기록한다. 방장은 즉시 시작할 수 있고, 방장 미입력 시 10초 후 서버 틱이 자동 출발한다. 준비 취소·새 참가·퇴장 시 기한을 갱신/취소한다. 7인 및 8칸 동작, 수동 시작, 카운트다운 초기화 테스트가 통과했다. 기존 5ms 물리 스텝과 50ms 네트워크 전송은 변경하지 않았다.
- 검증: PNG 준비 스크립트 55개 성공, JS 구문 검사와 `git diff --check` 통과. 멀티플레이 선택 테스트 9개 통과. 전체 멀티 테스트의 실제 WASM 2개는 `web-preview/assets/catalog.json` 부재로 실행되지 않았다. 브라우저에서 원본 로비 배경 복원 및 상점 창 열림을 확인했지만, 원본 카트 성능 JSON과 카탈로그가 없어 상품 목록/방 입장/실제 2인 경기·구매 팝업을 끝까지 실측하지 못했다. 이 상태를 GUI 완성이나 멀티플레이 지연 해결로 간주하지 않는다.
- **다음 중단 지점:** 사용자 Drive에서 누락된 원본 트랙 텍스처·카트/캐릭터 모델·`E/_rho5Out/kart_` 성능 자료와 `rhoOut` 나머지를 복구한 뒤 `prepare-local-all.ps1` 실행. 브라우저에서 여섯 화면을 1600×900으로 확인하고, 2인 실제 방 시작/10초 자동 출발, 7인 준비 UI, 상점 구매 확인·잔액 반영을 수동 검증한다. 남은 멀티 렉·후기 5136 물리 작업은 아래 항목을 따른다.

## 2026-10-26: 원본 5136 효과음 연결 (부분 완료)

- 사용자가 제공한 Drive의 `rhoOut/sound/fx/etc`, `interface`, `kart`, `stage/speedIndiGame/action2d@zz.xml`, `stage/gameReady` 및 `gui` 구조를 확인했다. 원본 `count_n.flac`(0.997초), `count_go.flac`(1.756초), `final_lab.flac`(2.081초), `race_over.flac`(0.484초), `click.flac`(0.139초), `startButton.flac`(1.117초) 등의 FLAC 헤더/길이를 검사하고 원본 파일만 Git 제외 로컬 경로에 내려받았다. 경로·연결 상태·미확인은 `web-preview/audio-map.json`에 기록했다.
- 출발 3/2/1과 GO는 HUD 애니메이션이 아닌 C/WASM 경기 phase/countdown 상태 변화에 연결했다. 랩 번호가 실제 증가할 때만 lap-complete 이벤트를 만들며, 마지막 바퀴 진입에는 `final_lab.flac`, 최종 완주 phase에는 `race_over.flac`을 한 경기당 한 번 재생한다. 일반 랩 완료 음원은 특정하지 못해 이벤트만 두고 재생하지 않는다. `final_lab`/ `race_over`의 **원본 클라이언트 호출 지점은 아직 확인하지 못했으므로 파일명 기반 연결**이다.
- 버튼/선택 변경은 원본 `click.flac`, 출발 버튼은 `startButton.flac`으로 연결했다. 첫 사용자 입력 뒤 오디오를 활성화하고 미디어 객체를 캐시한다. BGM/효과음 볼륨을 설정에서 분리하고, 로비 복귀·재시작 시 상태를 초기화한다. 같은 멀티플레이 프레임을 반복 수신해도 출발/랩/완주음을 반복하지 않는다. 원본별 버튼 호출 근거는 미확인이다.
- 현재 웹 경기는 주행 경과 시간만 있고 경기 종료 10초 규칙/남은 시간 상태가 없다. `action2d@zz.xml`의 종료 카운트 표시와 `flag_timewarn.flac` 후보만으로 규칙을 만들 수 없어 연결하지 않았다. 변신/듀얼 부스터·충돌·아이템·결과 화면의 후보 음원도 실제 이벤트와 원본 호출 근거가 없어 추가 재생을 보류했다. 일반 랩음과 10초 경고는 미완료다.
- 검증: `prepare-local-audio.ps1`으로 16개 원본 음원을 Git 제외 `web-preview/assets/audio`에 준비. 브라우저 미리듣기에서 출발 FLAC `play()` 성공, 정적 서버가 FLAC을 `audio/flac` 200으로 제공함을 확인. 새 이벤트/오디오 단위 테스트를 포함한 선택 Node 9개 통과. 기존 멀티/렌더 포함 21개 중 16개 통과/5개 실패는 복구되지 않은 `catalog.json`, 랩 GUI/캐릭터/효과 이미지 원본 부재에 따른 것으로, 실제 전체 게임 수동 레이스와 멀티플레이 사운드 재생은 아직 검증하지 못했다. 원본 음원은 커밋하지 않는다.
- **다음 중단 지점:** 원본 5136 클라이언트의 일반 랩 완료/완주/종료 10초 및 각 버튼 SFX 호출 근거를 찾고 파일을 청음해 매핑을 확정한다. 전체 rhoOut과 카탈로그를 복구한 뒤 실제 싱글 한 바퀴·완주와 2인 멀티/지연 수신에서 재생 시점을 브라우저로 검증한다. 기존 멀티 렉/5136 물리 미완료 사항은 아래 복구 항목을 따른다.

## 2026-10-26: PC 초기화 복구와 멀티플레이 계측 (진행 중)

- 새 작업 폴더는 Git 저장소가 아니었으므로 `work/kartrider-web-forting`에 GitHub를 별도 복제했다. 시작점 `main`/`origin/main`은 `866242d`로 같고 미커밋 변경은 없었다. 기존 로컬 데이터를 삭제하거나 재설정하지 않았다.
- 사용자가 제공한 [Drive 원작 5136 에셋 폴더](https://drive.google.com/drive/folders/1iVPlSpxvlr39EGtAtxhoNMErGfTi35L6)에서 Beach I01/I02·Village R01의 USDA·`track.1s`·지도 그림·스카이, 백기사/다오 일부 모델을 Git 제외 `local-assets`에 복구했다. 파일 크기를 Drive 메타데이터와 대조했다. **전체 rhoOut/트랙 텍스처/카트/캐릭터/클라이언트 `E/_rho5Out/kart_` 성능 XML은 복구하지 못했다.** 원본을 임의 에셋으로 대체하지 않았다.
- `.tools`에 Zig 0.13.0, usd-core 25.5.1, Pillow, NumPy 2.3.5, .NET SDK 8.0.427을 로컬 설치했다. .NET 실행 시 `$env:PATH=(Resolve-Path .tools/dotnet).Path+';'+$env:PATH`; Python 변환 검사 시 `$env:PYTHONPATH=(Resolve-Path .tools/usd-python).Path`를 설정한다. `build-demo-physics.ps1`이 원작 3개 체크포인트 코스를 포함해 성공했고, 원본 1s 충돌 3개·USDA 모델 일부·스카이 3개를 변환했다. `test-5136-course.ps1` 3/3/2랩, `test-physics-parity.ps1` 1통과/기존 장시간 벽 접촉 TODO 1, USDA 형식 검사 1통과. 선택 Node 32개 중 31통과/실패0/기존 벽 접촉 TODO 1.
- 서버 프레임에 50ms 작업/물리/카트 충돌 시간, 접촉 수, 이벤트 루프 지연, CPU, RSS, 메시지 크기를 계측한다. 방 참가자에게 같은 프레임을 보낼 때 JSON을 한 번만 직렬화한다. 게임 화면 F4는 FPS·렌더 시간·입력 RTT·수신 지터·건너뛴 상태와 서버 값을 보인다. HTTP/SSE에서 실제 패킷 손실과 예측 오차는 측정할 수 없으므로 `—`로 표시한다. 5ms 물리 스텝과 50ms 상태 전송은 유지했다.
- 상대 차량의 기존 50ms 수신 후 보간은 다음 패킷 지연 시 멈췄다가 뛰는 경로였다. 서버 `tick`으로 최근 상태를 버퍼링해 100ms 뒤 시점을 보간하도록 변경했다. 순서가 보장된 50ms 상태 전송에 매 4번째 패킷 80ms 지연을 준 **합성 60 FPS 재현**에서 최대 프레임 위치 변화 0.500→0.333, 정지 프레임 66→16. 실제 2인 외부 PC 지연 측정은 아니다.
- 에셋 없는 모의 엔진 200프레임 계측: 2명 서버 작업 평균 약 0.09ms/p95 약 0.21ms, 8명 평균 약 1.02ms/p95 약 1.79ms. 8명 충돌 평균 약 0.97ms였다. 이 수치로 실제 WASM 병목을 단정하지 않는다. 기존 HTTP 2계정/방 API 및 지연 폴링 테스트와 새 보간 테스트는 통과. 실제 멀티 WASM 테스트 3개는 `web-preview/assets/catalog.json`과 `kart-physics.json` 부재로 실행 불가였으며 실제 2인·8인·WAN 검증은 미실시다.
- Rust P5136의 `kart_physics.rs`는 BodyParam 및 듀얼/변신 계수 필드를 제공하지만 5136 클라이언트 적분기나 발동 조건을 증명하지 않는다. 실제 클라이언트 성능 XML과 동등 조건 주행 기록도 없어 드리프트/변신/듀얼 계수를 임의 조정하지 않았다. 기존 2004 C와 WASM 회귀는 유지했다.
- **다음 중단 지점:** Drive의 나머지 원본 텍스처·rhoOut 및 별도 클라이언트 `E/_rho5Out/kart_` 성능 XML을 안전하게 복구하고, 기존 `prepare-local-all.ps1`로 카탈로그/카트 성능 JSON을 생성한다. 그 후 실제 WASM 2인 LAN과 인위적 지연·지터 및 8인 부하에서 F4 수치를 수집해 병목을 재판정한다. 원작 5136 런타임 근거가 확보되면 카트별 듀얼/변신 발동과 드리프트를 동일 입력으로 대조해 구현한다.

## 2026-10-23: 테스터 주행 물리 재확인

- tools/audit-driving-physics.ps1으로 고정된 2004 C를 별도 빌드하고 같은 S7/평지 KTRK·초기 상태·입력으로 WASM과 비교한다. 백기사/세이버/연습/코튼의 직진·그립·드리프트 12조건 14,400프레임에서 위치/3축 속도/방향/요 각속도/드리프트·부스터/스텝/조향 최대 차 약 .0000876으로 통과했다. 선택 카트별 0/100/200km/h 조향 12개, 기존 입력·카트 검사 11개, 원본 S1/S7 값 대조 2개도 통과.
- 백기사 일반 조향은 100km/h 약3.34도, 200km/h 약1.12도로 정상 감쇠한다. 3초 가속 뒤 같은 1초 입력은 그립 약58.64도/Shift 약172.94도 회전이며 둘 다 2004 C 결과와 일치. 5초 무부스트 최고 약196.18km/h는 원작 5136 대비 과속으로 확정할 수 없다. 실제 5136 동등 조건 실행/테스터 재시승은 미실시.
- 외형 충돌체와 달리 바퀴 지면 접촉/관성은 cotten5 구조 유지: 백기사 표시 바퀴 간격 약.881 vs 물리 접촉 레이 간격1.823. 뒤쪽 질량중심 보정은 없으며 앞뒤 그립5/대칭 관성이고 모델 바퀴 중점 대비 물리 원점은 약.030 뒤다. 접촉 간격 불일치는 확인했으나 후방 무게감의 단독 원인으로 단정하지 않는다. 5136 수치만 적용한 2004 계산, 미연결 듀얼/변신·게이지와 근접 카메라도 구분해야 한다.
- 근거/측정은 PHYSICS_AUDIT.md, 전체 로컬 수치는 local-data/driving-physics-audit.json에 기록. 원작 런타임 근거 없이 조향·가속·마찰·질량중심을 보정하지 않았다. 런타임/유저 DB/에셋 변경 없음. 기존 벽 침하·장시간 접촉 오차 TODO2 유지.

## 2026-10-23: 확대 지도·원본 순위표·카트 간 충돌·외부 접속

- 흑백 xt_bigmap/ToMinimap·차량 방향 회전·30도 기울기는 유지하고 지도 배율만 30% 올렸다. 원본 rankBoard.xml / ranklist_mySpot.xml / ranklist_spot.xml의 숫자 atlas·내 이름 배경을 복사해 싱글/멀티 주행 순위표에 연결했다. 8위 숫자의 atlas 줄바꿈도 처리한다. 원본 PNG/XML 해시 일치 확인. 결과창 원본화는 별도 대기다.
- 서버가 모든 카트를 C와 같은 5ms씩 함께 전진시키며 실제 외형 OBB의 15축 SAT·고속 이동 구간을 검사한다. C의 기존 선형 충돌 응답을 상대 속도로 호출하고 질량에 따라 속도/겹침 해소를 분배한다. 높이가 다른 다리·출발 전·리셋 대기·완주 차량을 구분한다. 이는 웹 카트 간 어댑터이며 5136 원본 차량 충돌 알고리즘 복원을 주장하지 않는다. 주행 계수·트랙 배율·상류 C 원본은 변경하지 않았다.
- 주행 순위는 C의 랩/노드 내 거리와 원본 경로 그래프의 남은 최단 거리로 계산한다. 분기·열린 종점/출발선·랩·완주/동률을 처리하며 숫자 노드 ID를 거리로 쓰지 않는다. 분기 순위 정책은 웹 구현이다.
- tools/start-public.ps1 / stop-public.ps1으로 임시 HTTPS 접속 준비/실행. 공식 cloudflared 2026.10.3을 GitHub SHA256과 대조했다. Quick Tunnel의 SSE 미지원 때문에 공개 주소는 인증 HTTP 폴링, LAN은 기존 SSE를 유지한다. 외부 응답이 입력 전송보다 늦어도 프레임을 버리지 않도록 지연 재현 검사 추가. HTTPS 쿠키 Secure와 실제 외부 IP별 로그인 제한은 로컬 터널 헤더에만 적용한다. 주소·실행 파일·에셋·DB는 Git 제외다.
- 기존 DB 백업·재시작 후 4계정 ID/salt/비밀번호 해시 일치. 공개 HTTPS에서 기존 QA 로그인·트랙 로딩·방 생성/퇴장 및 인증 sync 200 / 익명 sync 401 / Secure 쿠키를 확인했다. 별도 메모리 QA DB의 브라우저+봇 2인으로 HTTP 폴링·공통 출발·상대 모델·1→2위/원본 순위표 표시 확인. QA 서버 종료. 재시작 시 공개 주소가 바뀌며 PC/터널이 실행 중이어야 한다.
- 검증: WASM 재빌드 성공, Node 전체 93개 중 91통과/실패0/기존 벽 접촉 TODO2. 실제 WASM 접촉·선운동량 분배·서버 5ms 접촉 실행·수직 분리·고속 통과·분기 순위·지연 폴링·원본 GUI 해시 검사 통과. Beach I01/I02·Village R01 물리 생성/경로 순위 유효. C native 재빌드 대조 통과(기존 장시간 접촉 오차 TODO 유지). 실제 외부 두 PC 주행·8인 부하/연속 다중 충돌·전 트랙 완주는 미검증이다.
- 아이템전은 구현 가능하나 이번에는 검토만 수행. 원본 개인/팀 확률 XML과 item.rho 존재 확인. Rust의 확률/카트별 변환을 참고할 수 있지만 박스 배치 추출·서버 획득/사용·웹 투사체/피격·방어/상태 효과가 필요하다. 근거와 남은 원작 기능은 ITEM_MODE_REVIEW.md, 외부 접속 방법/한계는 MULTIPLAYER.md에 기록했다. 기존 벽 침하·5136 V1/EX 완전 일치·원본 상점 스킨 대기 사항 유지.

## 2026-10-23: 미니맵 30도·S7·웹 멀티플레이

- 원본 흑백 지도/차량 방향 회전은 유지하고 perspective + rotateX(30deg)로 뒤로 기울였다. Rust의 기본값이 S7(wire 7)임을 확인해 107카트 기본 수치를 S1→S7로 재생성했다. S1/S7 각각 4카트의 독립 최종 로그 대조 통과. 백기사 가속력 2304/조향 감쇠 25.34이며 임의 가속·조향 보정은 없다.
- Rust는 PC용 TCP/UDP 서버라 웹에 직접 연결하지 않았다. S7 계산과 원본 방 8슬롯/Lobby→Loading→Running→Settling 흐름을 참고해 기존 인증 서버에 HTTP 입력/SSE 전송을 구현했다. Rust 원본 복사·PC 클라이언트 호환을 주장하지 않는다.
- 방 생성/입장/퇴장, 준비/방장 시작, 전체 로딩 장벽/공통 카운트다운, 방장 양도, 타임아웃, 방 채팅, 상대 카트·앉은 캐릭터/닉네임·보간, 결과/대기실 복귀를 연결했다. 서버가 각 참가자의 같은 C/WASM·원본 트랙·서버 소유 카트 성능/외형 충돌체로 계산한다(50ms 갱신/내부 최대 5ms). 출발 슬롯은 C의 원본 course_start_pose를 재사용한다. 위치·랩·완주 업로드는 받지 않는다. 멀티 결과만 기존 SQLite의 새 테이블에 저장하며 보상 지급은 미구현이다.
- 기존 4174 영구 DB를 온라인 백업 후 같은 DB/쿠키 이름으로 서버를 재시작했다. 4계정 ID·salt·비밀번호 해시 보존 확인. 실제 서버를 LAN 수신으로 실행했고 재실행은 tools/start-multiplayer.ps1, 사용법/제한은 MULTIPLAYER.md에 기록했다. 에셋/DB/테스트 계정 DB는 Git 제외.
- 검증: Node 전체 84개 중 82통과/기존 물리 TODO 2개 유지, Python S1·S7 로그 대조 2개 통과. 새 자동 검사는 8슬롯/권한/로딩 장벽·버전/방장 이탈/채팅/유령 입력 차단/결과·복귀/인증·출처 제한과 실제 WASM의 서로 다른 두 출발 위치·조작을 확인했다. 별도 QA DB의 두 브라우저 계정으로 입장·채팅·준비·공통 출발·상대 모델 표시 및 같은 11초에 속도 186/3km/h를 확인했다. 실제 4174에서도 기존 계정 로그인 유지와 멀티 메뉴/S7 목록 확인.
- 남음: 카트 간 충돌·아이템/팀전·친구/관전·클라이언트 예측/WAN 지연 보정. 결과 전환은 자동 검사했고 실제 2PC/LAN·8인 부하·수동 전체 완주는 미검증이다. 5136 전체 물리/기존 장시간 벽 접촉/원본 상점 스킨 대기 사항도 그대로 남는다.

## 2026-10-23: 원본 흑백 지도·카트별 S1 성능·외형 충돌체·웹 EX

- 미니맵을 덮어 쓰던 트랙 WebGL 렌더 콜백/별도 렌더러를 제거했다. 각 5136 트랙의 xt_bigmap.png + track.1s/ToMinimap 등록, 차량 중심 이동·방향 회전·빨간 마커를 사용한다. 원본 매핑이 없는 트랙만 기존 충돌 윤곽 대체를 유지한다. 로비의 독립 캐릭터를 180도 돌렸고 디버그 충돌선이 로비까지 남던 문제도 수정했다.
- 충돌 불일치 원인: 축소된 외형과 달리 모든 카트가 예전 데모 차체 폭/길이·고정 중심 +1/높이 1.4를 공유했다. 렌더러와 같은 표시 부품·바퀴 축 변환의 실제 경계에서 현재 주행 배율을 적용한 OBB를 C에 전달한다. 중심 오프셋과 회전·높이도 적용한다. F3에서 주황 카트 박스/청록 트랙 충돌선을 확인할 수 있다. 바퀴 서스펜션·질량중심·관성은 원본 데모 계산으로 유지하며 임의 보정하지 않았다.
- 제공 경로의 실제 Rust 폴더명은 P5136_Rust-main이다. 클라이언트 E/_rho5Out/kart_/<카트>/param@kr.xml(없으면 param.xml)과 Rust의 기본값·합산·단위 변환으로 107개 카트의 무튜닝 S1(wire byte 0) 수치를 준비했다. Speed_01을 S1으로 혼동하지 않는다. 백기사/세이버/연습/코튼은 독립적인 Profile/KartSpac.kr/Speed_00 최종 로그의 50개 이상 수치와 오차 .001 이내 일치했다. 백기사 기준 기존 공통 가속력 3300→2104, 조향 감쇠 28→25.09, 공기저항 .725→.651, 드리프트 탈출력 4000→4570이다. 18개 기본 C 동역학 계수·부스트 배율/지속시간·출발 힘을 선택/리셋 시 실제 적용한다.
- prepare-local-kart-physics.py와 통합 준비 스크립트로 재생성하며 소스 SHA256을 출력 JSON에 기록한다. 수치 JSON·클라이언트 로그·Rust 원본/에셋은 Git 제외다. Rust는 Cargo.toml에 AFL-3.0을 선언하며 전체 소스를 복사하지 않았다. 고정된 2004 C 소스도 변경하지 않고, 빌드 시 .tools/demo-web-overlay에 차체 범위/구동 배율 연결만 생성한다. 선택 카트 어댑터를 켜지 않은 원본 비교 테스트는 동일한 상수를 사용한다.
- EX는 원본 길이·최소량·충전율·배율·재사용 대기 값을 사용하는 웹 C 구현이다. SPACE/X, 별도 EX 충전/소모/쿨다운, 실제 가속·효과/카메라, 원본 v1_exceed 게이지/아이콘/키 안내·exceed.ogg를 연결했다. Rust는 서버 패킷 계산용으로 5136 클라이언트 EX 실행 알고리즘은 없다. 충전율을 초당 비율로 해석한 점과 활성 조건은 웹 정책이며 원작 동일 복원이라고 주장하지 않는다. 벽 감속 충전·변신/듀얼 부스터·5136 드리프트 게이지 계산은 미구현(수치 보존만 함)이다.
- 상점: stage/shop/shop@kr.xml·stage_window@zz.xml·shopCard@zz.xml·shopGrid.xml과 원본 구매 이미지까지 확인했다. ShopCard/DefaultCaptionWindow/InnerFrame의 실제 스킨 연결을 해당 XML/GUI 템플릿에서 확인하지 못했다. 사용자 지시대로 원본 상점 화면/확실한 스킨 조합을 얻기 전 새 UI 제작을 보류하고 기존 임시 상점·DB/보유품은 유지한다.
- 검증: WASM 빌드 성공, Node 전체 77개 중 75통과/기존 TODO 2개. 새 8개 검사는 bitmap 렌더 선택·107카트 적용/리셋·성능 차이·EX 최소량/출발 제한/재사용/실제 가속·5ms 분할·4카트 표시 범위·벽 경계 앞/옆/중심 오프셋/장식물 비충돌을 확인한다. Python 독립 원본 로그 대조 1개 통과. 원본 C를 다시 빌드해 6시나리오 1,830프레임 대조 통과(기존 장시간 벽 접촉 TODO 유지). 실제 4174/Beach I01에서 지도 이동/회전, 충돌선·드리프트·EX 59%→사용 후44%/재사용 대기, 리셋과 로비 정면을 확인했다. 브라우저에서 벽에 오래 붙으면 가라앉는 기존 C 문제도 재확인해 미해결로 남긴다. 전 트랙/카트 조합의 수동 주행, 원작 5136 런타임 완전 일치, 원본 EX 웨이브 1s 애니메이션은 미검증/미완료다. 원작 에셋·유저 DB는 커밋하지 않았다.

## 2026-10-23: 탑승 결합·근접 카메라·선택창 모델 이미지

- 사용자 후속 지시로 카트 0.9배/캐릭터 2배 확대는 취소하고 기존 배율을 유지했다. 원본 USD attach_points의 seat/handle 변환 107개와 캐릭터 관절 90개의 골반·머리·손 위치를 보존한다. 합성 _demoEffect 표시는 좌석 근거로 쓰지 않는다.
- 탑승자의 고정 뒤쪽 -.25/위쪽 .5 위치 대신 원본 seat 원점에서 해당 메시의 표면을 구하고 골반 관절이 닿도록 결합한다. 백기사 좌석 높이는 .17031이며 기존 위치는 골반을 약 .68까지 띄웠다(카트 외형 배율 적용 전). 메타데이터/표면을 못 찾으면 대체 출처를 명시한다. 팔 IK/원본 주행 애니메이션 복원은 아니다.
- C 카메라 위치에서 탑승자 머리 관절 방향으로 거리 25%를 당긴다. C의 시선 방향·up·속도별 FOV/추적 필터 및 실제 물리·충돌체·질량은 유지한다. 선택창 큰 미리보기는 복제한 주행 월드 행렬이 남아 범위가 약 800으로 커지던 원인을 찾아, 로컬 행렬 갱신 후 약 .78의 실제 범위로 카메라를 맞춘다.
- 카트/캐릭터 카드에 실제 변환 메시·원본 텍스처로 렌더한 PNG 미리보기를 표시한다. 보이는 항목부터 단일 렌더러로 순차 생성·캐시하며 카트 선택/구매 상태를 바꾸지 않는다. 큰 결합 미리보기와 카드 이미지 모두 브라우저에서 확인했다.
- 주행 피드백의 비교 대상은 사용자 확인상 원작 5136/방향키+Shift다. 현재 모든 V1 외형은 2004 C 데모 cotten5 공통 설정(질량 100, 최대 조향 10도, 속도 감쇠 28, 앞/뒤 그립 5, 드리프트 슬립 계수 .2)이다. 원본 데모는 드리프트 중 전륜 슬립에 감쇠 전 최대 조향을 사용한다. 따라서 5136 V1과 동일한 성능을 복원한 상태가 아니다. V1 USDA의 일부 추가 파라미터만으로는 기본값/단위·신형 드리프트 계산을 확인할 수 없어 임의의 감속/조향/무게중심 보정은 추가하지 않았다. 5136 주행감 복원은 미완료다.
- 검증: 새 좌석/카메라 테스트 포함 Node 44개 중 42통과, 기존 물리 TODO 2개 유지. 4카트×4캐릭터 골반 접점·기존 배율·누락 메타데이터 처리·카메라 거리/방향 검사 통과. 원본 C를 다시 빌드해 6시나리오 1,830프레임 WASM 대조 통과(기존 장시간 벽 접촉 TODO 제외). 브라우저에서 카트 3종·캐릭터 카드, 다오/배찌 탑승 결합과 Beach I01 근접 시점을 확인했다. 모든 조합의 수동 주행/손과 핸들의 정확한 접촉은 미검증이다.

## 2026-10-23: 제공된 원작 화면 기준 렌더링/HUD 수정

- 원인: USD 변환이 원본 faceVarying 법선을 버리고, 면마다 분리된 정점에 법선을 재계산해 캐릭터가 각져 보였다. indexed/vertex/uniform/corner 법선과 부모 역전치 변환을 보존하고 90개 앉은 자세에도 스키닝 법선을 적용했다. 바퀴 축 교환 뒤의 불필요한 법선 재계산도 제거했다. 원본에 법선이 없는 트랙 면은 기존 기하 법선으로 유지한다.
- 카트 검은 삼각형은 메시가 아니라 bound Material의 kart_alphaBlend 설정 누락이었다. 메시 조상에서 못 찾은 설정은 바인딩된 재질에서 읽으며 명시적 False 우선순위/기존 불투명 픽셀 깊이 선처리는 유지한다. 변환된 PNG를 웹 서버가 읽는 중 덮어 쓰던 Windows 오류도 내용 해시별 출력 재사용으로 해결했다. 충돌 재생성 없이 400개 준비된 모델의 법선/재질을 갱신했다.
- 원본 skydome.1s를 기존 native reader로 읽어 메시·UV·실제 텍스처를 연결했다. native D3D UV는 USDA UV와 달라 sky에만 flipY=false를 사용한다. 79개 원본 하늘 준비, 나머지 124개는 reader의 텍스처 참조 해석 미지원으로 local-data/sky-pending.json에 대기 기록(단색 대체 유지). 3개 우선 트랙은 모두 성공했다.
- 참고 사진과 일치하는 꽃 로고 광고를 zeta/kr/ppl/ingame/20221222_facelift에서 확인했다. 누락된 광고는 같은 테마/원본 파일명 슬롯만 연결한다. 백기사 제공 atlas의 중국어 번호판을 대체할 한국 NEXON atlas는 찾지 못했다. 임의 편집/다른 카트 atlas 대체는 하지 않았다.
- 백기사 대비 배찌 머리 폭의 참고 비율 약 0.9에 맞춰 탑승자 배율을 .42→.80으로 분리 조정하고 배찌를 참고의 주황색으로 맞췄다. 이전 요청의 카트 0.6배와 C 물리/카메라 위치·회전·속도별 FOV는 보존한다. 화면상 차체 중심 차이 약 8%는 투영 창 위치로 보정했다. 동일 주행 지점/해상도의 원작 실행 캡처가 없어 전체 크기·구도의 완전 일치는 미검증이다.
- 참고 화면의 계기판은 v1_exceed/tacho.xml이었다. 원본 배경·34x42 숫자 atlas·EX 레일·SPACE/X 안내·하단 아이콘과 1080행 기준 HUD 배율을 연결했다. 속도/N2O/부스트 아이콘은 실제 C 값, EX 레일·키 안내/자동 충전·드래프트 아이콘은 비활성 장식이다. 원본 C 데모에 없는 V1 EX/충전/드래프트 계산을 구현했다고 주장하지 않는다.
- 미니맵은 같은 원본 트랙 메시/재질/깊이 검사를 공유하는 위쪽 카메라로 주변 44m를 20Hz 표시하고, 차량 중심 고정·방향 회전·큰 빨간 마커를 적용했다. 이는 웹 구현이며 원본 미니맵 엔진 복원이 아니다. 기존 xt_bigmap/ToMinimap 좌표와 충돌 윤곽 대체도 유지한다.
- 검증: USD 합성 테스트 1개(동일 이름 텍스처·상속·명시적 False·반사/비균일 배율 법선·시간 변환) 통과. Node 관련/전체 회귀 66개 중 64통과, 기존 장시간 벽 접촉 물리 TODO 2개 유지. 주요 3맵 정렬/법선·카트 알파·원본 광고·스카이·GUI 해시·90개 자세·투영 위치 검사 통과. 브라우저에서 Beach I01과 Village R01의 하늘·검은 삼각형 제거·HUD를 확인했고 빌리지/백기사/배찌로 실제 전진(174km/h), 벽 접촉, 방향에 따른 미니맵 이동/회전을 확인했다. 전체 맵 수동 주행/정확한 원작 구도·모든 좌석별 자세는 미검증이다. C/WASM 소스/주행 계수, 계정 스키마·암호·보유품은 변경하지 않았다.

## 2026-10-23: 로그인 긴급 복구 / 4174 유저 DB 영구화

- 실제 원인: 사용자가 접속한 4174에 예전 `:memory:` QA 서버가 남아 있었다. 로그인 API는 있었지만 player/profile은 404였고, 프런트가 이를 로그아웃으로 오인해 오류 표시 없이 로그인 화면으로 되돌렸다.
- 실행 중인 임시 SQLite를 일관된 파일로 추출해 4개 계정을 `local-data/accounts-4174.sqlite`에 복구했다. 4개 모두 ID·아이디·salt·비밀번호 해시 일치와 quick_check=ok 확인. 기존 4173 DB는 별도 보존했다(중복 아이디가 있어 덮어 합치지 않음). 원본/복구 전 DB 백업은 local-data/backups에 있다.
- 4174를 실제 영구 DB 서버로 교체하고 `node server.mjs` 기본값도 4174/해당 DB로 통일했다. 유저 프로필·기본 보유품은 기존 계정 마이그레이션 및 가입/로그인 시 영구 저장한다. 포트별 쿠키 이름으로 다른 로컬 서버의 세션 덮어쓰기를 차단했다. 비밀번호 초기화/변경은 하지 않았다.
- 로그인 직후 세션·프로필을 확인하며 프로필 API/DB 오류는 문구로 표시한다. 게임도 서버 오류를 로그인 이동으로 숨기지 않는다. `backup-user-db.mjs`는 실행 중인 DB의 WAL까지 포함한 일관된 백업을 만든다.
- 검증: 인증/경제/핫픽스 Node 6개 통과(기존 스키마·암호 보존·재시작 세션/프로필·포트 쿠키 격리·404/500 표시). 복구된 기존 QA 계정으로 실제 4174 브라우저 로그인과 새로고침 유지 확인. 실제 영구 DB 사용자/프로필 각각 4개, 자격 증명 4/4 보존, 백업 실행 성공. C/렌더링은 이번 핫픽스에서 변경하지 않아 물리 전체 테스트는 재실행하지 않았다.

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
- 검증: 전체 준비 재실행, WASM 빌드, 203코스 시작점 검사 성공. Node 55개 중 50통과/기존 TODO 2, 경로/ToMinimap Python 2통과, 원본 네이티브 3코스 실제 랩 순회 통과. C 실제 출발/드리프트 종료 순간/게이지 부스터 신호와 접지점·낙하 복귀·경사로/점프/착지 검사 통과. 브라우저 Beach I01 주행·드리프트·지도 이동·설정 저장 확인, 효과 신호 합성 전용 화면에서 세 종류/블러 ON/OFF 및 가림 픽셀 검사 통과.
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
