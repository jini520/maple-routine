# Live Update (OTA)

> **범위**: 스토어 심사 없이 JS/HTML/CSS 번들을 배포하는 OTA. 사용자 동의형 업데이트 UX, 베타 채널, 관찰용 UI.
> **관련 소스**: `native/live-update.ts`(`@capgo/capacitor-updater` 래퍼) · `features/live-update/`(store, `checkOnBoot`) · `native/network`(셀룰러 감지) · `capacitor.config.ts` · GitHub Releases(`live-update-latest`/`live-update-beta`).
> **관련 ADR**: [[ADR-022]] [[ADR-024]] [[ADR-026]] [[ADR-027]] [[ADR-008]] [[ADR-117]] [[ADR-119]]. **관련 문서**: [../foundation/architecture.md](../foundation/architecture.md), [settings.md](./settings.md), [splash.md](./splash.md), [../trouble/2026-07-15-live-update-testing.md](../trouble/2026-07-15-live-update-testing.md), [../trouble/2026-08-08-ota-apply-stuck-splash.md](../trouble/2026-08-08-ota-apply-stuck-splash.md).

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

`LiveUpdateManifest` 에 **`notes?` 선택 필드**가 붙는다 — 사용자 동의 모달([[ADR-027]])이 *"새 버전 v1.0.3 (2.1MB)"* 까지만 말하고 **무엇이 바뀌는지는 말하지 않던** 자리를 채운다.

- **값의 출처는 `src/data/release-notes.ts`** 다. 배포 스크립트가 `package.json` version 과 같은 버전의 항목을 뽑아 `latest.json` 에 싣는다 — 노트를 손으로 매니페스트에 적지 않는다. 같은 파일을 개발노트 화면(`/settings/release-notes`, [settings.md](./settings.md))이 **과거 전체**로 읽는다(원천 하나 + 소비 둘).
- **`minNativeVersion` 과 같은 선택 필드**다 — `parseLiveUpdateManifest` 의 **필수 검사에 넣지 않는다.** 넣으면 이미 발행된 옛 매니페스트(필드 없음)가 `null` 로 떨어져 **모든 기존 설치본의 업데이트 확인이 `check-error`** 가 된다. 매니페스트는 URL 고정·내용 가변이라 옛 앱이 새 파일을 읽는 조합이 실재한다. `notes` 가 없으면 모달은 지금과 똑같이 동작한다.
- **네이티브 변경 항목에는 「스토어 업데이트 필요」 표식**이 붙는다(버전 전체가 아니라 **항목 단위**). 매니페스트의 `minNativeVersion` 과는 다른 층이다 — 그쪽은 *"이 번들을 적용할 수 있는가"* 를 판정하는 게이트이고, 표식은 *"이 항목이 지금 내 앱에 있는가"* 를 사람에게 설명하는 글이다.
- **노트가 없으면 배포가 중단된다** — 절차는 [../foundation/release.md](../foundation/release.md).

## SQLite 커넥션 주의
`set()`(리로드) 전에 SQLite 커넥션을 정상 종료하지 않으면 stale 커넥션으로 과거 데이터 로드가 멈춘다 → `closeBossProfitDb()` 로 리로드 전 미리 닫음([[ADR-008]] 세 번째 정정, [boss-profit.md](./boss-profit.md)).

**닫기에는 5초 타임아웃이 있다**([[ADR-117]] 결정 5) — 여는 쪽 `withOpenTimeout`(10초)과 대칭이되 더 짧다. 닫기는 파일 생성·마이그레이션이 없어 정상이면 수 ms 이고, 이 값이 곧 적용 경로에서 사용자가 무반응을 견디는 상한이다(`'applying'` 구간의 길이). 실패·타임아웃은 **여전히 삼킨다**(best-effort) — 곧 리로드될 것이고 `openBossProfitDb` 의 stale 감지가 최후 폴백으로 남는다. 타임아웃이 바꾸는 것은 *"실패로 끝난다"* 가 아니라 **"끝난다"** 이다. 같은 함수를 쓰는 캐시 데이터 삭제 경로도 이 타임아웃을 함께 받고, 그쪽 순서도 `close` → 커버 → `reload()` 로 같아진다([[ADR-117]] 결정 8 — [[ADR-065]] 결정 3 의 *"항상 리로드한다"*·`pendingNotice` 정책은 그대로).

## 폐기된 정책 (history)
- ~~번들 호스팅 = Cloudflare R2~~ → GitHub Releases(카드 등록 불필요)([[ADR-022]]).
- ~~네이티브 `versionName` = `1.0`(2단)~~ → `1.0.0`(3단)([[ADR-024]]).
- ~~베타 채널을 런타임 토글로~~ → 빌드 시점 분리([[ADR-024]]).
- ~~조용한 자동 다운로드·적용~~ → 사용자 동의형(부팅은 체크만)([[ADR-027]]).
- ~~배포 = Play Console 내부 테스트 트랙~~ → APK 직접 사이드로딩([[ADR-024]] 정정).
- ~~스플래시 배경색 `#FB8101`(코드 단색)~~ → 이미지 기준 `#F58B0F` 로 6곳 통일(다크 `#D06100` 유지)([[ADR-029]] 정정).
- ~~`notifyAppReady` 를 번들 실행 직후 가장 먼저(첫 문장) 호출한다~~ → **첫 렌더 커밋 뒤**(`AppShell` 마운트 `useEffect` — `ErrorBoundary` **안**이라야 렌더가 던졌을 때 effect 가 안 돈다)([[ADR-022]] 결정 6 → [[ADR-117]] 결정 2). 지키려던 것은 "타임아웃 안에 부른다"이지 "가능한 한 빨리 부른다"가 아니었고, 첫 문장에서 부르면 렌더가 죽는 번들이 SUCCESS 로 찍혀 **영구히 박힌다**.
- ~~`apply()` 는 커버(`showSplashScreen()`)를 먼저 씌우고 그 뒤에 적용을 진행한다~~ → **`closeBossProfitDb()` → 커버 → `set()`**([[ADR-027]] 2026-07-17 추가 → [[ADR-117]] 결정 1). *"스플래시 표시가 실패해도 적용은 계속 진행한다"* 는 그대로 유효하다.
- ~~적용 실패 시의 처리 없음(`void apply()` — catch·타임아웃 없음)~~ → **12초 타임아웃 + catch → 커버 걷고 `'apply-error'`**([[ADR-117]] 결정 1).
