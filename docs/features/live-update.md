# Live Update (OTA)

> ⚠️ **이 문서는 두 앱을 함께 설명한다.** 아래 「정책」부터 「SQLite 커넥션 주의」까지는 **capacitor
> 앱(@capgo)** 의 것이고, RN 앱은 **프로토콜이 다르다**([[ADR-137]] — `expo-updates`). 전환이 끝날
> 때까지 배포 절차가 두 벌이다. RN 쪽은 맨 아래 「RN — expo-updates」 절을 보라.

> **범위**: 스토어 심사 없이 JS/HTML/CSS 번들을 배포하는 OTA. 사용자 동의형 업데이트 UX, 베타 채널, 관찰용 UI.
> **관련 소스**: `native/live-update.ts`(`@capgo/capacitor-updater` 래퍼) · `features/live-update/`(store, `checkOnBoot`) · `native/network`(셀룰러 감지) · `capacitor.config.ts` · GitHub Releases(`live-update-latest`/`live-update-beta`).
> **관련 ADR**: [[ADR-022]] [[ADR-024]] [[ADR-026]] [[ADR-027]] [[ADR-008]] [[ADR-117]] [[ADR-119]] [[ADR-126]] [[ADR-154]]. **관련 문서**: [../foundation/architecture.md](../foundation/architecture.md), [settings.md](./settings.md), [splash.md](./splash.md), [../trouble/2026-07-15-live-update-testing.md](../trouble/2026-07-15-live-update-testing.md), [../trouble/2026-08-08-ota-apply-stuck-splash.md](../trouble/2026-08-08-ota-apply-stuck-splash.md).

## 정책 ([[ADR-022]])
- `@capgo/capacitor-updater` 플러그인 사용(Capgo 매니지드 백엔드 미사용 — `autoUpdate`/`statsUrl` 명시적으로 끔). 번들 호스팅은 **GitHub Releases 자체 호스팅**(이 저장소 고정 릴리스 `live-update-latest`). Cloudflare R2도 검토했으나 무료 한도에서도 카드 등록 필수라 카드 없이 되는 GitHub Releases로 변경.
- `native/live-update.ts` 단일 파일 어댑터로 캡슐화(`notifications.ts` 와 동일 패턴). 앱 시작 시 `latest.json` 조회 → 신버전 다운로드·검증·적용, 크래시 시 자동 롤백. TDD로 버전 비교·오케스트레이션 검증.
- **OTA 대상 범위**: JS/HTML/CSS 번들만. 네이티브 플러그인·권한 변경은 여전히 스토어 심사 대상, 게임 데이터 값 변경은 여전히 [[ADR-006]] 사용자 확인.
- **버전 형식**([[ADR-024]]): 네이티브 `versionName` 을 `1.0.0`(3단)으로 통일 — `1.0`(2단)은 `isNewerVersion` 의 `x.y.z` 파싱을 못 맞춰 OTA가 한 번도 작동 안 했음(이 버그를 늦게 발견).
- **베타 채널**([[ADR-024]]): 빌드 시점 분리(별도 매니페스트 URL·릴리스 태그 `live-update-beta`), 런타임 토글 미채택. 배포는 Play Console 내부 테스트가 아니라 **APK 직접 배포(사이드로딩)** — 앱 미출시·스토어 정책 미완료 상태라, 베타 빌드 전부 동일 서명 키 유지.

### production 전환과 1.0.0 리셋 (2026-08-04)

App Store 첫 출시를 앞두고 **버전을 1.0.0으로 리셋**했다(`package.json` 1.0.48 → 1.0.0).

- **사용자에게 보이는 버전만 리셋한다.** 빌드 번호는 단조 증가를 유지했다 — Android `versionCode` 18 → 19, iOS `CURRENT_PROJECT_VERSION` 10 → 11. 내리면 사이드로딩 기기가 업데이트를 거부하고, iOS는 이미 쓴 빌드 번호를 다시 올릴 수 없다. 둘 다 화면에 안 보이는 값이라 리셋해서 얻는 것이 없다.
- **production 채널(`live-update-latest`)은 이 리셋 시점까지 한 번도 발행된 적이 없어** 1.0.0으로 시작해도 깨끗했다. 첫 App Store 빌드의 내장 번들이 1.0.0이 되고, 다음 OTA는 1.0.1부터다.
- **2026-08-04 첫 발행 완료 — 1.0.0.** 릴리스가 없는 동안 production 빌드는 매니페스트 조회가 404로 떨어져 설정 화면에 항상 "확인에 실패했습니다"가 떴다(`checkForLiveUpdate` 의 비2xx → `kind:'error'` → `check-error`). **채널을 전환하면 그 채널의 릴리스를 곧바로 한 번 발행할 것** — 릴리스가 없는 채널은 "업데이트 없음"이 아니라 오류로 보인다. 발행 후에는 내장 번들과 매니페스트가 모두 1.0.0이라 `isNewerVersion` 이 false → "최신입니다"로 뜬다.
- ⚠️ **베타 채널은 이 리셋으로 사실상 끊긴다.** 베타에 이미 1.0.4x가 발행돼 있어, 앞으로 `--beta` 로 1.0.x를 올려도 `isNewerVersion` 이 false를 돌려 기존 베타 사용자에게 가지 않는다. 베타를 되살리려면 1.0.48보다 높은 버전을 쓰거나 `live-update-beta` 릴리스를 비워야 한다.
- 릴리스 생성 시 **production 은 더 이상 `--prerelease` 가 아니다**(2026-08-04 수정). 두 채널이 같은 저장소의 고정 태그라, production 이 prerelease 로 남으면 목록에서 어느 쪽이 정식인지 구분되지 않았다. 제목도 `(production)`/`(beta)` 로 갈랐다.


**다운로드 실패 표시 ([[ADR-065]] 결정 2)**: `MODAL_STATUSES` 에 `'error'` 가 없어 모달이 소리 없이 닫히던 것을 고쳤다. 기존 5분기와 같은 골격에 배지 톤만 error이고 `다시 시도` / `나중에` 를 준다. **매니페스트 조회 실패(자동 확인)는 모달을 띄우지 않는다** — 사용자가 시작하지 않은 실패라 조용히 넘긴다(스토어가 두 실패를 구분한다). 부 동작 버튼(`GHOST_BTN`)은 주 동작보다 작게(`px-4 py-1.5 text-xs`) 줄였고 4개 분기가 함께 쓴다.

## 사용자 동의형 UX ([[ADR-027]])
조용한 자동 적용을 재설계 — 부팅은 "체크만"(자동 다운로드/적용 제거). 새 버전 있으면 실행 시 모달(버전+용량 nMB, 매번 물음, 거절 시 현 버전 유지) → 다운로드(진행률 0~100%, 셀룰러면 데이터 경고) → `set()` 으로 사용자 동의 적용. 매니페스트에 `size`·`minNativeVersion` 추가 — `minNativeVersion` > 설치 네이티브면 "스토어 업데이트 필요"로 구분해 스토어 이동(`window.open(_system)`, 미출시라 URL placeholder). 셀룰러 감지용 `@capacitor/network` 신규 네이티브 플러그인(그 부분만 OTA 불가).

## 관찰용 UI ([[ADR-026]])
설정 화면에 "앱 업데이트" 섹션(현재 실행 번들 버전 + 상태 + 채널) + 수동 "업데이트 확인" 버튼 + 준비 시 인앱 "지금 적용(재시작)" 버튼(`CapacitorUpdater.reload()`). 부팅 백그라운드 체크를 `features/live-update` 스토어 `checkOnBoot` 으로 경유시켜 부팅 발견분이 섹션에 즉시 반영되고 수동 체크와 한 소스로 일원화(이중 다운로드 없음). 부팅 시 `applyPendingLiveUpdate()` 로 "다음 앱 실행 시 자동 적용"을 양 플랫폼 보장(`autoUpdate:'off'` 의 Android는 capgo가 `next()` 큐를 재시작에도 자동 적용 안 함, iOS는 콜드 스타트 네이티브 자동 적용).

## 리로드 커버 ([[ADR-027]] 정정)
리로드 커버 스플래시(`SplashScreen.show()`)가 Android에서 `FIT_XY` 로 눌리고 `fitsSystemWindows` 로 시스템 바를 못 덮는 문제 → `capacitor.config.ts` `androidScaleType: 'CENTER_CROP'` + `backgroundColor: '#FB8101'`. 플러그인 창이 구조적으로 못 덮는 하단 내비 바 인셋 띠는 리로드 전 DOM 오버레이 + 신 문서 정적 `#boot-cover` div(앱 준비 시 제거)로 커버(첫 렌더는 테마 비동기 복원이라 항상 라이트 플래시가 띠에 노출됨). 단색 통일은 [splash.md](./splash.md) 참고.

## 적용 경로의 복구 장치 ([[ADR-117]])

적용(`지금 적용 (재시작)`)은 **되돌아올 수 있어야 한다**. 테스터가 이 버튼을 누른 뒤 브랜드 주황 스플래시에서 무한 로딩에 갇혔고(이슈 #175), 원인은 적용 확률이 아니라 **적용 경로가 일방통행이라는 형태**였다 — 화면을 먼저 덮고 실패·행(hang) 가능한 작업을 catch·타임아웃 없이 실행하는데 커버를 걷는 코드가 없었다.

- **순서는 `closeBossProfitDb()` → 커버(`showSplashScreen()`) → `set()`** 이다. 커버가 올라가 있는 시간을 [[ADR-027]] 2026-07-17 추가가 원래 말한 **실제 리로드 구간**으로 좁힌다 — 준비 작업까지 덮지 않는다. **이 순서는 어댑터 `applyDownloadedLiveUpdate` 한 함수가 통째로 소유한다**(설계는 어댑터에 `set()` 만 남기고 닫기를 스토어로 올리려 했으나, 구현은 반대로 갔다 — 순서를 두 파일이 나눠 가지면 *"순서가 곧 결함이었다"* 는 이 결정의 순서를 다음 사람이 두 곳에서 읽어야 한다). 스토어가 맡는 것은 **그 위를 덮는 것들**이다 — 타임아웃·catch·커버 걷기·상태 전이.
- **전체에 12초 타임아웃 + catch.** 세 고리(스플래시 `show()` 의 미완료 · 커넥션 닫기 무응답 · `set()` reject) 중 어느 것이 끊겨도 **커버를 걷고** `'apply-error'` 로 전환한다. 고리별로 타임아웃을 나누지 않는다 — 어디서 멈췄는지에 따라 사용자가 볼 화면이 달라질 이유가 없다. 성공 경로에서는 `set()` 이 그 자리에서 문서를 죽이므로 이 타임아웃에 도달할 수 없다.
- **상태가 둘 는다**(11 → 13). `'applying'` 은 닫기가 도는 구간(최대 5초)에 정직한 피드백을 주고 중복 탭을 막는다 — 그 구간에 모달이 살아 있는데 화면이 "업데이트 준비 완료"라고 말하면 이 이슈가 지적한 *"아무 반응 없음"* 의 축소판을 새로 만드는 것이다. `'apply-error'` 는 [[ADR-065]] 결정 2 의 실패 분류표에 한 줄 더해지는 것이라 `download-error` 와 같은 골격의 모달 분기를 쓴다. 둘 다 `MODAL_STATUSES` 에 들어간다.
  - **`'applying'` 모달에는 버튼이 하나도 없다**(`나중에` 도 없다 — `dismiss` 가 번들 id 를 비워 재시도 경로를 없앤다). 진행률 바가 아니라 **스윕 스피너**다 — 적용은 퍼센트가 나오지 않아 결정형 진행률이 거짓 정보가 된다([[ADR-061]] 결정 1). 배경 탭도 막는다(`downloading` 과 같은 취급).
  - **`'apply-error'` 는 `downloadedBundleId` 를 유지한다** — `download-error` 와 갈리는 지점이 정확히 이것이라, `다시 시도` 는 **다시 받지 않고 `apply()` 만** 재호출한다. 재진입 가드는 `'applying'` 만 막으므로 이 재시도는 통과한다.
  - **성공 경로에는 상태 전환 코드가 없다** — `set()` 이 그 자리에서 JS 컨텍스트를 파괴해 도달하지 않으므로, 성공 후 상태를 쓰면 그것은 거짓 정보다.
- **`notifyAppReady()` 는 번들 첫 문장이 아니라 `AppShell` 마운트 `useEffect`** 에서 부른다. "정상"의 정의가 *"메인 청크가 평가됐다"* 에서 **"React 가 마운트에 성공했다"** 로 바뀌어, 렌더가 던지면 capgo 가 `appReadyTimeout`(기본 10초, config 미설정) 뒤 직전 번들로 **자동 롤백**한다. 하이드레이션 완료 뒤로 더 미루지 않는다 — `prehydrateTabStores` 가 SQLite 에 의존해 10초를 넘기면 멀쩡한 번들까지 롤백된다.
  - **`App` 이 아니라 `AppShell` 이어야 한다.** `App` 은 `ErrorBoundary` 를 *렌더하는* 쪽이라 **자식이 렌더 중에 던져도 자기 effect 는 돌아**, 부팅 크래시로 죽은 번들이 그대로 "정상"으로 찍힌다 — 옮긴 의미가 통째로 무너진다. `AppShell` 은 `ErrorBoundary` **안**이라 렌더가 던지면 커밋되지 않아 effect 도 안 돈다.
- 커버가 걷히는 경로는 넷이다 — 정상 부팅(`hideSplashScreen`) · 위 catch · `#boot-cover` 8초 실패 안전 타이머 · ErrorBoundary 폴백. 뒤 둘은 [splash.md](./splash.md) 를 보라.

## 매니페스트의 릴리스 노트 ([[ADR-119]])

`LiveUpdateManifest` 에 **`highlights?: string[]` 선택 필드**가 붙는다 — 사용자 동의 모달([[ADR-027]])이 *"새 버전 v1.0.3 (2.1MB)"* 까지만 말하고 **무엇이 바뀌는지는 말하지 않던** 자리를 채운다. 실리는 것은 **전체 노트가 아니라 핵심 목록 3~4줄**이다([[ADR-126]] 결정 2 — 원래는 항목 전체를 이어 붙인 평문 `notes` 였고, 그 형식은 아래 «폐기된 정책» 으로 갔다).

- **값의 출처는 `src/data/release-notes.ts`** 다. 배포 스크립트가 `package.json` version 과 같은 버전의 `highlights` 를 뽑아 `latest.json` 에 싣는다 — 노트를 손으로 매니페스트에 적지 않는다. 같은 파일을 개발 노트 화면(`/settings/release-notes`, [settings.md](./settings.md))이 **과거 전체**로 읽는다(원천 하나 + 소비 둘).
- **핵심 목록은 항목에서 파생하지 않고 손으로 쓴다**([[ADR-126]] 결정 3). 앞 N개를 자르거나 `category === 'feature'` 만 거르지 않는다 — "핵심"은 데이터가 아니라 판단이고(1.0.4 의 첫 변경은 `improvement` 로 적힌 보스 카드 인원 수정이다), `일부 버그 및 사용성 개선` 처럼 **여러 항목을 한 줄로 뭉치는 것**은 어떤 파생 규칙으로도 안 나온다.
- **`minNativeVersion` 과 같은 선택 필드**다 — `parseLiveUpdateManifest` 의 **필수 검사에 넣지 않는다.** 넣으면 이미 발행된 옛 매니페스트(필드 없음)가 `null` 로 떨어져 **모든 기존 설치본의 업데이트 확인이 `check-error`** 가 된다. 매니페스트는 URL 고정·내용 가변이라 옛 앱이 새 파일을 읽는 조합이 실재한다. `highlights` 가 없으면 모달은 지금과 똑같이 동작한다(버튼째 안 뜬다 — [[ADR-126]] 결정 6).
- **네이티브 변경 항목의 「스토어 업데이트 필요」 표식은 개발 노트 화면에만 남는다**(버전 전체가 아니라 **항목 단위** — [[ADR-119]] 결정 3 은 그대로다). 매니페스트에서는 사라지고, 그 자리에서 *"이 번들을 적용할 수 있는가"* 를 판정하는 것은 원래부터 `minNativeVersion` 이다.
- **쓰는 쪽에서는 조건부 필드가 아니다** — 읽는 쪽(`parseLiveUpdateManifest`)은 `minNativeVersion` 과 같은 조건부 전개지만, 배포 스크립트는 아래 가드를 통과한 시점에 `highlights` 를 **반드시** 갖고 있다. `minNativeVersion` 은 CLI 인자라 정말 없을 수 있고 이쪽은 아니라, 조건부로 쓰면 계약과 어긋나는 죽은 분기가 된다.
- **노트·핵심 목록이 없으면 배포가 중단된다**([[ADR-119]] 결정 6 → [[ADR-126]] 결정 8 확장 — `items` 와 `highlights` 를 함께 보고 어느 쪽이 비었는지 문구가 말한다). 절차는 [../foundation/release.md](../foundation/release.md).

## 모달의 「자세히 보기」 ([[ADR-126]])

같은 이름의 버튼이 **두 자리에 있고 하는 일이 다르다.** 갈리는 근거는 하나 — 모달이 뜨는 시점마다 앱이 가진 것이 다르다.

| 시점 | 새 버전 노트가 앱 안에 있나 | 「자세히 보기」 |
|---|---|---|
| `update-available`(받기 전) | **없다** — 아직 안 받은 번들 안에 있다 | **모달 안에서 펼친다**(매니페스트 `highlights`) |
| 적용·재시작 후(`updated`) | **있다** — 지금 도는 번들이 그 번들이다 | **`/settings/release-notes` 로 이동** |

- **받기 전에 화면을 옮기지 않는 이유**: 모달을 닫아야 하고 돌아왔을 때 다시 띄우는 처리가 필요한데, 정작 그 화면에는 새 버전이 **없다**. 판단 재료를 주려다 판단하던 흐름을 끊는다.
- **`store-required`·`ready-to-apply` 에는 붙이지 않는다**([[ADR-126]] 결정 7). `ready-to-apply` 는 받아만 뒀고 아직 그 번들이 돌지 않아 개발 노트 목록에 새 버전이 없다. `store-required` 는 노트가 있어도 OTA 로 못 받아 판단이 안 바뀐다.
- **`'updated'` 상태**(14번째)는 부팅 때 판정한다 — `Preferences` 에 적어 둔 **마지막으로 실행된 번들 버전**과 지금 도는 번들 버전을 비교한다(적용 성공 경로에는 상태 전환 코드가 없다 — [[ADR-117]] 결정 1). 저장값이 **없으면 안 띄우고**(근거 없이 "업데이트했다"고 말하지 않는다) 판정은 `isNewerVersion` 이라 **자동 롤백이 걸러진다**(되돌아간 것을 완료라고 부를 수 없다). 스토어 업데이트로 내장 번들이 올라가는 것도 같은 신호로 함께 잡힌다.
- **판정은 확인보다 앞이고 전환은 확인보다 뒤다** — `loadCurrentVersion` → 완료 여부 판정(기록은 여기서 끝낸다) → `check()` → 결과가 `up-to-date`·`check-error` 일 때만 `'updated'`. 새 업데이트가 또 있으면 **그쪽이 이긴다**(회고보다 행동이 먼저다). 밀린 완료 안내는 다시 오지 않는다 — 큐를 만들면 "언젠가 뜨는 안내"라는 지속 상태가 생긴다([[ADR-119]] 결정 7 이 싫어한 것).
- **키는 `KEEP_KEYS` 에 넣지 않는다**([[ADR-052]]). 캐시 삭제로 지워져도 다음 부팅이 조용히 다시 기록할 뿐이고, 없어져서 생기는 것은 거짓 안내가 아니라 **안내 없음**이다.
- ⚠️ **완료 안내는 1.0.4 → 1.0.5 부터 실제로 보인다.** 1.0.3 은 마지막 실행 버전을 기록하지 않으므로, 1.0.4 로 올라오는 그 순간에는 저장값이 없어 뜨지 않는다(위 첫 줄 규칙).

## SQLite 커넥션 주의
`set()`(리로드) 전에 SQLite 커넥션을 정상 종료하지 않으면 stale 커넥션으로 과거 데이터 로드가 멈춘다 → `closeBossProfitDb()` 로 리로드 전 미리 닫음([[ADR-008]] 세 번째 정정, [boss-profit.md](./boss-profit.md)).

**닫기에는 5초 타임아웃이 있다**([[ADR-117]] 결정 5) — 여는 쪽 `withOpenTimeout`(10초)과 대칭이되 더 짧다. 닫기는 파일 생성·마이그레이션이 없어 정상이면 수 ms 이고, 이 값이 곧 적용 경로에서 사용자가 무반응을 견디는 상한이다(`'applying'` 구간의 길이). 실패·타임아웃은 **여전히 삼킨다**(best-effort) — 곧 리로드될 것이고 `openBossProfitDb` 의 stale 감지가 최후 폴백으로 남는다. 타임아웃이 바꾸는 것은 *"실패로 끝난다"* 가 아니라 **"끝난다"** 이다. 같은 함수를 쓰는 캐시 데이터 삭제 경로도 이 타임아웃을 함께 받고, 그쪽 순서도 `close` → 커버 → `reload()` 로 같아진다([[ADR-117]] 결정 8 — [[ADR-065]] 결정 3 의 *"항상 리로드한다"*·`pendingNotice` 정책은 그대로).

## 캐패시터 앱의 종료 — 스토어 유도 ([[ADR-154]])

> **여기부터가 이 앱의 마지막 상태다.** RN 전환이 끝나 스토어 바이너리는 `app-rn` 이고,
> 캐패시터 OTA 는 «업데이트를 나르는 관» 에서 **«스토어로 보내는 관»** 으로 용도가 바뀐다.

갱신이 끝난 앱이 부팅마다 **「최신 버전입니다」** 라고 답하는 것은 거짓이고, 그 거짓이 사용자를 옛
앱에 붙잡아 둔다. 그래서 매니페스트가 «이 플랫폼은 이제 스토어로 가야 한다» 를 직접 말한다.

- **`storeRequiredPlatforms?: string[]`** — 값은 `Capacitor.getPlatform()` 문자열(`'android'` ·
  `'ios'`). 판정은 포함 여부 하나다.
- **판정은 버전 비교보다 앞에 선다.** 그래야 ⓐ 갱신이 끝난 플랫폼에 `up-to-date` 를 안 돌려주고
  ⓑ **`manifest.version` 이 사용자 번들과 같아도 게이트가 켜진다** — 버전을 1.0.6 에 고정한 채
  플랫폼만 늘렸다 줄일 수 있다. `minNativeVersion` 분기는 그 뒤에 그대로 남는다.
- **선택 필드다.** 필수 검사에 넣지 않는다 — 넣으면 옛 매니페스트를 읽는 기존 설치본이 전부
  `check-error` 로 떨어진다([[ADR-119]] 결정 5 와 같은 이유). 배열이 아니거나 원소가 문자열이
  아니면 필드가 없는 것과 같게 다룬다.
- **`minNativeVersion` 은 폐기가 아니다** — 답하는 질문이 다르다(«이 번들을 적용할 수 있나» vs
  «이 플랫폼이 아직 이 앱을 쓰는 게 맞나»). 읽는 코드도 테스트도 그대로 두고 이번에 쓰지 않을 뿐이다.

### 배포는 3단계다 — 번들은 한 번뿐

| | 매니페스트 | 캐패시터 소스 | 사용자 다운로드 | 조건 |
|---|---|---|---|---|
| **1단계** | 번들 1.0.6, **게이트 없이** | **필요** | 6MB | 없음 |
| **2단계** | `storeRequiredPlatforms: ["android"]` | 불필요 | 없음 | Play 게시 확인 |
| **3단계** | `["android","ios"]` | 불필요 | 없음 | App Store 게시 확인 |

**1단계에 게이트를 안 켜는 이유**: 2026-08-21 실측으로 **두 스토어 모두 아직 새 바이너리가 없다**
(Play 상세 페이지 HTTP 404 · iTunes Lookup `id6797579391` = **1.0.0**). 지금 목록에 넣으면 받을 것이
없는 곳으로 보낸다. 그래도 1단계가 할 일은 다 한다 — `storeRequiredPlatforms` 를 읽는 코드와
`APP_STORE_ID` 수정을 기기에 **심는 것**이 그것이다.

2·3단계가 `gh release upload live-update-latest latest.json --clobber` 한 줄인 것이 핵심 이득이다 —
**1단계 직후 `packages/app-capacitor` 를 지워도 나머지를 칠 수 있고 어느 스토어도 기다리지 않는다.**
그리고 목록에서 플랫폼을 빼면 **되돌아간다**(종전 `--min-native` 계획은 되돌릴 수 없는 지점이었다).

> **게시 확인은 조회로 한다** — 콘솔 상태나 심사 통과 알림이 아니라
> `curl -o /dev/null -w '%{http_code}' 'https://play.google.com/store/apps/details?id=com.mapleroutine.app'`
> 와 `curl -s 'https://itunes.apple.com/lookup?id=6797579391' | ...`(`version` 필드).

### 1단계 번들에 반드시 실려야 하는 것

- **`APP_STORE_ID` 를 실제 값 `6797579391` 로.** placeholder(`'0000000000'`) 탓에 iOS
  「스토어로 이동」이 죽은 링크다(Android 는 `market://details?id=…` 라 무관). **게이트가 켜지면
  새 번들은 다운로드 자체가 안 되므로 여기서 안 고치면 영영 안 닿는다.**
- **매니페스트 `highlights` 는 배포 인자로 덮어쓴다.** 1.0.6 노트는 **RN 의 것**이라 넷 중 셋이
  캐패시터 번들에 없는 기능이다(`app/today/` 없음 · 다계정 UI 없음 — 벨로나만 core 게임
  데이터라 실제로 들어간다). `release-notes.ts` 원천 한 벌([[ADR-119]] 결정 1)과 배포
  가드는 그대로 돌고 **싣는 값만** 바뀐다.

### 대가 — 게이트를 켜는 순간의 유도는 OTA 한 홉 뒤다

`storeRequiredPlatforms` 를 읽는 코드가 1.0.6 번들에 있으므로 1.0.5 에 있는 사람은 그 번들을 받아야
게이트에 들어온다. 즉시 거는 유일한 장치(`minNativeVersion`)가 **양 플랫폼을 함께 걸어서** 고른
대가다. 홀드아웃은 방치되지 않는다 — 부팅마다 `update-available` 모달을 받는다.

**1단계와 2·3단계 사이에는 이 대가가 없다** — 그 구간엔 게이트가 꺼져 있어 잃는 것이 없고, 그 사이
1.0.6 을 받아 두는 사람이 늘수록 게이트를 켜는 순간의 도달률이 올라간다. **먼저 내보낼수록 유리하다.**

## RN — expo-updates ([[ADR-137]])

> **관련 소스**: `app-rn/src/native/adapters/rn-live-update.ts` · `workers/ota-manifest/` ·
> `scripts/publish-rn-ota.mjs` · GitHub Releases(`live-update-rn`) · `app-rn/app.json` 의 `updates`.

- **프로토콜은 Expo Updates v1**, 호스팅은 **자체**다(EAS Update 미사용 — [[ADR-022]] 의 근거가 그대로
  유효). 갈리는 지점은 하나뿐이다: `expo-updates` 는 매니페스트 응답에 `expo-protocol-version` 헤더를
  요구하는데 **GitHub Releases 도 Pages 도 커스텀 헤더를 못 붙인다.**
- **두 층으로 가른다** — 매니페스트는 **Cloudflare Worker**(`workers/ota-manifest/`, 상태 없음),
  번들·에셋은 **GitHub Releases** (`live-update-rn`). `launchAsset.url` 이 GitHub 을 직접 가리켜
  **대역폭이 Worker 를 안 지나간다**(Worker 는 수 KB JSON 만 낸다).
- **배포는 `node scripts/publish-rn-ota.mjs`.** `expo export` → 에셋 업로드(이름이 내용에서 나오므로
  **이미 있는 것은 건너뛴다**) → 매니페스트 생성·업로드 → **왕복 확인**. JS 만 고친 배포는 번들 2개만
  오른다(실측 확인).
- ⚠️ **순서 규칙: 네이티브를 건드렸으면 `expo prebuild` 를 먼저 끝내고 배포하라.** `runtimeVersion` 이
  fingerprint 라 **네이티브 트리의 함수**다 — 배포 뒤에 트리가 바뀌면 매니페스트가 «아무도 안 묻는
  이름» 으로 남고 앱은 204(업데이트 없음)를 받는다. 에러는 어디에서도 안 난다([[ADR-137]] 정정 2).
- **배포 성공의 정의는 «올렸다» 가 아니라 «받아진다» 다.** 스크립트 `[6/6]` 이 클라이언트가 묻는
  그대로 매니페스트를 물어보고 **번들을 내려받아 해시까지 대조**한다 — 그 대조가 없어서
  *"배포 성공 · 매니페스트 정상 · 앱만 못 받음"* 을 한 번 겪었다([[ADR-137]] 정정 1).
- **`runtimeVersion` 정책은 `fingerprint`** — 네이티브 그래프에서 **계산된다.** @capgo 시절
  `minNativeVersion` 을 손으로 적던 자리이고, 안 올리면 앱이 죽는 종류의 사고라 사람이 기억할 일이
  아니다([[ADR-137]] 결정 3).
- **「스토어 업데이트 필요」만 우리 축에 남는다** — 런타임이 안 맞으면 프로토콜은 **204(업데이트 없음)**
  를 주고, 그대로 두면 사용자에게 *"최신 버전입니다"* 라는 **거짓**이 보인다. 그래서 확인이 「최신」으로
  떨어졌을 때만 Worker 의 `/latest` 를 한 번 더 묻는다([[ADR-137]] 결정 4).
- **우리 축의 값 넷은 매니페스트 `extra` 에 싣는다** — `appVersion`(사용자 표시 버전) ·
  `highlights`([[ADR-126]] 결정 2) · `sizeBytes` · `storeUrl`. **[[ADR-119]] 결정 1(원천 한 벌)과
  배포 가드는 글자 하나 안 바뀐다.**
- **채널이 폐기됐다**([[ADR-024]] 빌드 시점 분리) — 사이드로딩 베타를 위한 것이었고 App Store 출시로
  용도가 끝났다. 그리고 그것이 **core 의 `import.meta.env` 벽을 없앴다**([[ADR-137]] 결정 7).
- **`notifyAppReady()` 가 없다.** `expo-updates` 에는 그 신호를 받는 JS API 가 없고 네이티브
  `ErrorRecovery` 가 부팅 크래시를 직접 관찰해 되돌린다. [[ADR-117]] 결정 2 가 지키려던 것은 살아 있고
  **그것을 선언하는 주체가 런타임으로 옮겨 갔다.**
- **셀룰러 경고가 없다**([[ADR-027]] 결정 6) — RN 에 네트워크 종류를 묻는 내장 API 가 없고
  `@react-native-community/netinfo` 는 새 네이티브 의존성이라 재빌드를 부른다. 어댑터가 `'unknown'`
  을 돌려 호출부의 기존 폴백(경고 생략)으로 떨어진다. 되살리려면 그 패키지가 선행 조건이다.

### 최초 1회 설정 (사용자 작업)

1. Cloudflare 가입(카드 불필요) → `cd workers/ota-manifest && npx wrangler deploy`
2. 배포된 주소(`https://maple-routine-ota.<서브도메인>.workers.dev`)를 `app-rn/app.json` 의
   `expo.updates.url` 에 넣는다 — **`/manifest` 경로까지** 포함해서.
3. `expo-updates` 는 네이티브 의존성이라 **재빌드가 필요하다**(`npx expo prebuild` → 스토어 릴리스).
   이 릴리스 자체는 OTA 로 못 나간다([[ADR-137]] 대가 2).

## 폐기된 정책 (history)
- ~~번들 호스팅 = Cloudflare R2~~ → GitHub Releases(카드 등록 불필요)([[ADR-022]]).
- ~~네이티브 `versionName` = `1.0`(2단)~~ → `1.0.0`(3단)([[ADR-024]]).
- ~~베타 채널을 런타임 토글로~~ → 빌드 시점 분리([[ADR-024]]).
- ~~베타 채널(`live-update-beta`)~~ → **폐기**([[ADR-137]] 결정 7). 사이드로딩 베타를 위한 것이었고
  App Store 출시(2026-08-06)로 용도가 끝났다. 릴리스도 지웠다(1.0.46~1.0.48 이 담겨 있었다).
- ~~`LiveUpdatePort` 가 프로토콜을 드러낸다(`httpGet` · `download({url, checksum})` ·
  `applyBundle(id)`)~~ → **행위로 다시 그었다**(`check` · `download(onProgress)` · `apply`) —
  셋 다 `expo-updates` 에 짝이 없어 두 앱이 한 포트를 쓸 수 없었다([[ADR-137]] 결정 6). 매니페스트
  형식·버전 비교는 **capacitor 어댑터로 옮겼다**(지운 것이 아니다).
- ~~조용한 자동 다운로드·적용~~ → 사용자 동의형(부팅은 체크만)([[ADR-027]]).
- ~~배포 = Play Console 내부 테스트 트랙~~ → APK 직접 사이드로딩([[ADR-024]] 정정).
- ~~스플래시 배경색 `#FB8101`(코드 단색)~~ → 이미지 기준 `#F58B0F` 로 6곳 통일(다크 `#D06100` 유지)([[ADR-029]] 정정).
- ~~`notifyAppReady` 를 번들 실행 직후 가장 먼저(첫 문장) 호출한다~~ → **첫 렌더 커밋 뒤**(`AppShell` 마운트 `useEffect` — `ErrorBoundary` **안**이라야 렌더가 던졌을 때 effect 가 안 돈다)([[ADR-022]] 결정 6 → [[ADR-117]] 결정 2). 지키려던 것은 "타임아웃 안에 부른다"이지 "가능한 한 빨리 부른다"가 아니었고, 첫 문장에서 부르면 렌더가 죽는 번들이 SUCCESS 로 찍혀 **영구히 박힌다**.
- ~~매니페스트 `notes?: string` — 항목 전체를 `[카테고리] 텍스트 (스토어 업데이트 필요)` 줄로 이어 붙인 **평문 한 덩어리**(`formatReleaseNotes` 가 형식을 고정)~~ → **`highlights?: string[]`(핵심 목록 3~4줄)**([[ADR-119]] 구현 확정 → [[ADR-126]] 결정 2). 그 형식이 겨냥한 소비자가 바로 업데이트 모달이었고, **그리는 방식이 정해지면서 형식도 함께 정해졌다** — 1.0.3 은 10줄·1.0.4 는 8줄이라 `max-w-xs` 모달에 펼치면 읽지 않고 닫는다. 둘 다 싣지 않는 이유는 같은 릴리스를 한 파일이 두 번 설명하게 되어서다([[ADR-119]] 결정 1 의 이중관리가 산출물 쪽에서 되살아난다). 「스토어 업데이트 필요」 표식(**항목 단위**, [[ADR-119]] 결정 3)과 카테고리 묶음(결정 9)은 **폐기가 아니다** — 개발 노트 화면에서 그대로 산다.
- ~~`apply()` 는 커버(`showSplashScreen()`)를 먼저 씌우고 그 뒤에 적용을 진행한다~~ → **`closeBossProfitDb()` → 커버 → `set()`**([[ADR-027]] 2026-07-17 추가 → [[ADR-117]] 결정 1). *"스플래시 표시가 실패해도 적용은 계속 진행한다"* 는 그대로 유효하다.
- ~~적용 실패 시의 처리 없음(`void apply()` — catch·타임아웃 없음)~~ → **12초 타임아웃 + catch → 커버 걷고 `'apply-error'`**([[ADR-117]] 결정 1).
