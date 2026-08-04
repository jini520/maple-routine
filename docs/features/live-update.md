# Live Update (OTA)

> **범위**: 스토어 심사 없이 JS/HTML/CSS 번들을 배포하는 OTA. 사용자 동의형 업데이트 UX, 베타 채널, 관찰용 UI.
> **관련 소스**: `native/live-update.ts`(`@capgo/capacitor-updater` 래퍼) · `features/live-update/`(store, `checkOnBoot`) · `native/network`(셀룰러 감지) · `capacitor.config.ts` · GitHub Releases(`live-update-latest`/`live-update-beta`).
> **관련 ADR**: [[ADR-022]] [[ADR-024]] [[ADR-026]] [[ADR-027]] [[ADR-008]]. **관련 문서**: [../foundation/architecture.md](../foundation/architecture.md), [settings.md](./settings.md), [../trouble/2026-07-15-live-update-testing.md](../trouble/2026-07-15-live-update-testing.md).

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

## SQLite 커넥션 주의
`set()`(리로드) 전에 SQLite 커넥션을 정상 종료하지 않으면 stale 커넥션으로 과거 데이터 로드가 멈춘다 → `closeBossProfitDb()` 로 리로드 전 미리 닫음([[ADR-008]] 세 번째 정정, [boss-profit.md](./boss-profit.md)).

## 폐기된 정책 (history)
- ~~번들 호스팅 = Cloudflare R2~~ → GitHub Releases(카드 등록 불필요)([[ADR-022]]).
- ~~네이티브 `versionName` = `1.0`(2단)~~ → `1.0.0`(3단)([[ADR-024]]).
- ~~베타 채널을 런타임 토글로~~ → 빌드 시점 분리([[ADR-024]]).
- ~~조용한 자동 다운로드·적용~~ → 사용자 동의형(부팅은 체크만)([[ADR-027]]).
- ~~배포 = Play Console 내부 테스트 트랙~~ → APK 직접 사이드로딩([[ADR-024]] 정정).
- ~~스플래시 배경색 `#FB8101`(코드 단색)~~ → 이미지 기준 `#F58B0F` 로 6곳 통일(다크 `#D06100` 유지)([[ADR-029]] 정정).
