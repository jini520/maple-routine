# Step 0: docs-adr

이 step 은 **문서만 쓴다. 소스 코드를 단 한 줄도 고치지 마라.** (`docs-first` — CLAUDE.md 개발
프로세스 CRITICAL) 이 phase 의 나머지 step 9 개가 여기서 쓴 ADR 을 계약으로 삼아 구현한다.

## 배경 (이 파일 안에서 자기완결적으로 읽어라)

이슈 **#175** — 테스터 보고(2026-08-08, iPhone 16 Pro). 앱 설치 후 실행 → 업데이트 모달에서
`다운로드` → **`지금 적용 (재시작)`** 을 눌렀더니 **브랜드 주황 스플래시에서 무한 로딩**. 앱이 더
진행되지 않는다. 화면은 "로딩 중"으로 보이지만 실제로는 `#boot-cover` + 네이티브 스플래시가 걷히지
않은 상태이고, iOS `SplashScreen.show()` 가 `parentView.isUserInteractionEnabled = false` 를 걸어두므로
**터치도 죽는다.**

같은 흐름을 iOS 시뮬레이터에서 재현하면 **정상 통과한다**(zip 체크섬·매니페스트·`set()` → 리로드 →
부팅까지 전부). 즉 "1.0.2 를 받으면 누구나 죽는다"가 아니라 **그 순간의 상태·타이밍에 따라 갈리는
실패**다. 문제는 그 실패가 **복구 불가능한 형태로 설계돼 있다**는 것이다.

### 원인 — 적용 경로가 되돌아올 수 없는 일방통행이다

`src/features/live-update/store.ts:160-167` 현재 코드:

```ts
async apply() {
  const id = get().downloadedBundleId
  if (id === null) return
  await showSplashScreen().catch(() => {})   // ← 화면을 먼저 덮는다
  await applyDownloadedLiveUpdate(id)        // ← catch 없음, 타임아웃 없음
}
```

호출부는 `onClick={() => void apply()}`(`src/app/UpdatePromptModal.tsx:159`). **화면을 먼저 가린 뒤에
실패·행(hang) 가능한 작업 둘을 아무 방어 없이 실행한다.** 여기서 뭐가 잘못되든 커버를 걷는 코드는
존재하지 않는다. 끊어질 수 있는 고리 셋 — 셋 다 증상이 "주황 스플래시 무한"으로 같다:

1. **`showSplashScreen()` 자체가 안 끝날 수 있다.** iOS `SplashScreen.show()` 는 `UIView.transition`
   완료 콜백 안에서만 resolve 한다. 그런데 `src/native/splash-screen.ts:27-31` 은 그 await **전에**
   DOM 커버 div 를 먼저 붙인다. 애니메이션 완료가 지연되면 커버만 남고 `set()` 은 영영 호출되지 않는다.
2. **`closeBossProfitDb()` 에 타임아웃이 없다.** `src/storage/sqlite/db.ts` 의 `getBossProfitDb` 는
   10초 타임아웃(`OPEN_TIMEOUT_MS`)이 있는데 `closeConnection` 은 맨몸이다. 이 저장소는
   **"iOS 실기기에서 SQLite 네이티브 호출이 응답 없이 멈춘다"** 를 두 번 기록했다([[ADR-008]]
   2026-07-17 정정, [[ADR-050]] 결정 2). 온보딩을 끝낸 상태면 `prehydrateTabStores` 가 커넥션을 열어둔
   채라 이 경로가 열린다.
3. **`CapacitorUpdater.set()` 이 reject 할 수 있다.** `void apply()` 라 이 reject 는 아무 데도 도달하지 않는다.

### 안전망 셋이 전부 꺼져 있다

- **① 자동 롤백이 무력화돼 있다.** `src/main.tsx:12` 가 번들의 **첫 문장**으로 `notifyAppReady()` 를
  부른다. capgo 의 유일한 안전망은 "`appReadyTimeout`(**기본 10초** — `capacitor.config.ts` 에 이 값을
  설정하지 않았으므로 기본값이 적용된다) 안에 `notifyAppReady` 가 없으면 직전 정상 번들로 되돌린다"
  인데, 렌더 한 픽셀 전에 "정상"을 선언한다. **한 번 SUCCESS 로 찍힌 번들은 이후 어떤 실행에서도
  롤백되지 않는다.** 메인 청크만 로드되고 그 뒤에 죽는 번들은 **영구히 박힌다.** `main.tsx:10-11` 의
  주석은 이 호출을 **롤백을 피하려고** 앞당긴 근거로 적혀 있는데, 롤백은 피해야 할 사고가 아니라
  **우리가 유일하게 가진 복구 장치**다. 의도가 뒤집혀 있다.
- **② 커버를 걷는 타이머가 언마운트 때 취소된다.** `src/App.tsx` 의 스플래시 useEffect 는
  `setTimeout(() => void hideSplashScreen(), remaining)` 을 걸고 클린업에서 `clearTimeout` 한다.
  `hideSplashScreen()` 은 `#boot-cover` 를 지우는 **저장소 전체에서 유일한 코드**다. 첫 1초
  (`MIN_SPLASH_MS`) 안에 렌더가 던지면 → ErrorBoundary 가 언마운트 → 클린업이 타이머를 취소 →
  **커버는 영원히 남는다.**
- **③ ErrorBoundary 폴백이 커버 밑에 그려진다.** 폴백은 `#root` 안이고 `#boot-cover` 는
  `index.html:17` 의 `position:fixed; z-index:2147483647`(32비트 정수 최댓값)이다. 게다가
  `SplashScreen.show()` 가 건 `isUserInteractionEnabled = false` 는 네이티브 `tearDown()` 에서만
  풀린다 — **폴백은 안 보이고 '다시 시작' 버튼은 눌리지도 않는다.**

### 코드를 읽다 추가로 발견한 결함 (이슈 본문에 없다)

**`showSplashScreen()` 이 붙이는 `[data-splash-cover]` div 를 걷는 코드가 저장소에 아예 없다.**
`hideSplashScreen()` 은 `#boot-cover` 만 지운다. `splash-screen.ts:25-26` 의 주석은 "문서와 함께
사라지므로 별도 정리가 필요 없다"고 적혀 있는데, 그건 **리로드가 성공한다는 전제**다. 적용이 실패해
문서가 안 죽으면 이 오버레이가 영구히 남는다 — 즉 `apply()` 에 catch 를 달아도 **커버를 걷을 수단이
없다.** 이 phase 는 이것도 함께 고친다.

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스 — 이 phase 의 write 대상은 `features/live-update.md` · `features/splash.md`)
- `/docs/ADR.md` (**슬림 인덱스만** — 전문은 필요한 것만 아래에서 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/adr/ADR-027.md` — 사용자 동의형 OTA UX(체크만 → 다운로드 → `set()` 적용) · 리로드 커버 정정
- `/docs/adr/ADR-022.md` — capgo 플러그인 채택, `notifyAppReady` 와 자동 롤백
- `/docs/adr/ADR-065.md` — 결정 2(check-error / download-error 구분) · 결정 3(캐시 삭제 실패 플래그) ·
  결정 5(ErrorBoundary 폴백)
- `/docs/adr/ADR-008.md` · `/docs/adr/ADR-050.md` — SQLite 네이티브 호출이 응답 없이 멈춘 두 사례
- `/docs/features/live-update.md` · `/docs/features/splash.md` (write 대상)
- 코드는 **읽기만** 하라: `/src/features/live-update/store.ts` · `/src/native/live-update.ts` ·
  `/src/native/splash-screen.ts` · `/src/storage/sqlite/db.ts` · `/src/app/UpdatePromptModal.tsx` ·
  `/src/main.tsx` · `/src/App.tsx` · `/index.html` · `/src/features/settings/cache-data.ts` ·
  `/src/components/organisms/ErrorBoundary/ErrorBoundary.tsx`

## 작업

### 1. `/docs/adr/ADR-117.md` 신규 작성

기존 ADR 파일(`ADR-116.md` 등)의 형식을 그대로 따라라 — 제목 줄, `**날짜**` / `**상태**` / `**관련**`
머리, `## 맥락`, `## 결정`, `## 트레이드오프`(또는 그에 준하는 절), 필요하면 `## 미검증`.

- **날짜**: 2026-08-08
- **상태**: **(설계, 구현 전 — 이슈 #175)**. 이 phase 의 step 9 가 '구현 완료'로 바꾼다.
- **제목**: OTA 적용 경로에 복구 장치를 넣는다 — 일방통행을 끊고, 커버는 앱이 죽어도 걷힌다

맥락에는 위 "배경" 절의 사실을 정리해 담아라(고리 3개 · 안전망 3개 · 추가 발견 결함). **원인 사슬의
어느 고리를 어느 결정이 끊는지 명시하라** — 완화책이 아니라 각 결정이 사슬의 어느 자리를 자르는지가
보여야 한다.

**결정은 아래 8개다. 이 내용에서 벗어나지 마라 — 사용자가 확정한 것이다.**

**결정 1 — `apply()` 는 되돌아올 수 있어야 한다.**
순서를 **`closeBossProfitDb()` → 커버 → `set()`** 으로 뒤집는다(지금은 커버가 먼저다). 전체에
**12초 타임아웃 + catch**. 실패하면 **커버를 걷고** `'apply-error'` 로 전환한다. 근거: 커버가 올라가
있는 시간을 실제 리로드 구간으로 좁히고, 어떤 고리가 끊겨도 화면이 돌아온다.

**결정 2 — `notifyAppReady()` 를 첫 렌더 커밋 뒤로 옮긴다.**
`main.tsx` 번들 첫 문장 → **`App` 컴포넌트 마운트 `useEffect`**. "정상"의 정의가 "메인 청크가
평가됐다"에서 **"React 가 마운트에 성공했다"** 로 바뀐다. 렌더가 던지면 `useEffect` 가 안 돌아
10초 뒤 직전 번들로 자동 롤백된다.
**하이드레이션 완료 뒤(더 뒤)로 옮기는 안은 채택하지 않는다** — 사용자 결정. 이유: `appReadyTimeout`
이 10초인데 `prehydrateTabStores` 는 SQLite·저장소 읽기에 의존하고, 이 저장소는 그 호출이 **응답 없이
멈춘 사례를 두 번** 기록했다([[ADR-008]]·[[ADR-050]]). 느린 기기에서 10초를 넘기면 **멀쩡한 번들까지
롤백**돼 업데이트가 영영 안 붙는 역효과가 난다. 첫 렌더 커밋은 네트워크·저장소에 의존하지 않아
그 위험이 없으면서, 가장 흔한 실패인 부팅 크래시를 잡는다.

**결정 3 — `#boot-cover` 에 컴포넌트 밖 실패 안전 타이머를 둔다(8초).**
`index.html` 인라인 스크립트. **`#boot-cover` 가 아직 DOM 에 있을 때만** 동작한다 — 있다는 것은
부팅이 끝나지 않았다는 뜻이다. 이미 걷혔으면(정상 부팅) **아무것도 하지 않는다.**
근거: 정상 부팅은 `MIN_SPLASH_MS`(1초) + 첫 렌더라 8초는 8배 여유이고, capgo 롤백 타임아웃(10초)보다
짧아 "커버가 걷힌 화면"을 사용자가 롤백보다 먼저 본다. 오탐 시 노출되는 것은 테마 적용 전 첫 렌더
정도이고, 그것은 영구 벽돌보다 낫다.
**"아직 있을 때만" 가드의 이유**: 이 가드가 없으면 앱이 정상 부팅한 뒤 8초 시점에 사용자가 마침
`지금 적용` 을 눌러 올라간 리로드 커버까지 걷어버린다. 그 구간은 결정 1 의 타임아웃이 맡는다.

**결정 4 — `hideSplashScreen()` 이 `[data-splash-cover]` 도 걷는다.**
위 "추가로 발견한 결함". 커버를 붙이는 함수는 있는데 걷는 함수가 없었다. `querySelectorAll` 로
**전부** 지운다(중복 호출로 여러 장 쌓였을 수 있다). 이 하나가 결정 1 의 "커버를 걷고"를 실현 가능하게
만든다 — 없으면 catch 를 달아도 화면이 안 돌아온다.

**결정 5 — `closeBossProfitDb()` 에 타임아웃(5초)을 준다.**
`getBossProfitDb` 의 `withOpenTimeout`(10초)과 대칭이되 **더 짧다**. 근거: 여는 것은 파일 생성·마이그
레이션을 포함하지만 닫는 것은 그렇지 않아 정상이면 수 ms 다. 이 값은 **적용 경로에서 사용자가
무반응을 견디는 시간의 상한**이기도 하다. 실패·타임아웃은 지금처럼 **삼킨다**(best-effort) — 곧
리로드될 것이고 `openBossProfitDb` 의 stale 감지가 최후 폴백으로 남는다.

**결정 6 — ErrorBoundary 폴백은 마운트 시 `hideSplashScreen()` 을 부른다.**
커버 제거 + 네이티브 스플래시 해제(터치 복구)를 한 번에 얻는다. 안전망 ②·③ 을 동시에 끊는다.
**폴백의 z-index 를 올리는 안은 채택하지 않는다** — 사용자 결정. 이유 셋: ⑴ `#boot-cover` 가 이미
`2147483647`(32비트 정수 최댓값)이라 더 올릴 숫자가 없고 DOM 순서에 기대야 한다, ⑵ 같은 매직 넘버가
`index.html` 과 컴포넌트 두 곳에 생겨 한쪽만 바뀌면 조용히 깨진다, ⑶ **z-index 로는 진짜 문제가 안
풀린다** — 폴백을 보이게 만들어도 `isUserInteractionEnabled = false` 때문에 '다시 시작' 버튼이 눌리지
않는다. 커버를 지우면 위에 아무것도 없으므로 z-index 는 올릴 이유 자체가 사라진다.

**결정 7 — `'applying'` 상태를 추가한다.**
결정 1 이 순서를 뒤집으면서 **새로 열리는 창**을 막는다. 지금은 커버가 클릭과 같은 틱에 붙어 버튼을
덮으므로 중복 탭이 사실상 불가능한데, 뒤집으면 `closeBossProfitDb()` 가 도는 동안(최대 5초) 모달이
살아 있고 버튼도 눌린다. 그동안 화면은 여전히 "업데이트 준비 완료"라고 **거짓말**을 한다.
`'applying'` 을 두면 ⑴ 중복 탭이 막히고 ⑵ 그 구간에 정직한 피드백이 생긴다. 후자가 본래 이득이다 —
이 이슈가 지적하는 "아무 반응 없음"의 축소판을 우리가 새로 만들지 않는다.
**단순 재진입 가드(플래그만)는 채택하지 않는다** — 버튼이 살아 있는데 눌러도 무반응이면 같은 문제다.

**결정 8 — `clearCacheDataAndReload` 도 같은 순서로 고친다.**
`src/features/settings/cache-data.ts` 가 `커버 → closeBossProfitDb() → reload()` 순이라 **동일한
결함**을 갖는다(닫기가 매달리면 `reload()` 에 도달하지 못하고 커버만 남는다). `closeBossProfitDb()`
→ 커버 → `reload()` 로 뒤집는다. 결정 5 의 타임아웃이 여기에도 함께 적용된다.
**이 경로에는 `'apply-error'` 같은 실패 UX 를 만들지 않는다** — [[ADR-065]] 결정 3 이 이미 "항상
리로드한다"로 확정했고 실패는 `pendingNotice` 플래그로 부팅 후 토스트에 알린다. 그 정책을 바꾸지 않는다.

### 2. `/docs/ADR.md` 인덱스에 한 줄 추가

표 마지막(`ADR-116` 다음)에 `| [ADR-117](./adr/ADR-117.md) | **제목** — 요약 |` 형식으로 한 줄.
기존 줄들과 같은 밀도로 결정 8개의 요지를 담아라. **ADR.md 의 다른 줄을 건드리지 마라.**

### 3. `/docs/features/live-update.md` 갱신

- 인덱스 헤더의 **관련 ADR** 에 `[[ADR-117]]` 추가.
- `## 적용 경로의 복구 장치 ([[ADR-117]])` 절 신설 — 순서(close → 커버 → set) · 12초 타임아웃 ·
  `'applying'`/`'apply-error'` 두 상태 · `notifyAppReady` 가 첫 렌더 커밋 뒤라는 것.
- 기존 `## SQLite 커넥션 주의` 절에 타임아웃(5초)이 생긴다는 사실을 반영.
- **정책을 바꾸는 문장은 지우지 말고** 하단 `## 폐기된 정책 (history)` 로 옮겨라(CLAUDE.md 규칙).
  최소 두 줄이 내려간다: `~~notifyAppReady 를 번들 첫 문장에서 호출~~ → 첫 렌더 커밋 뒤([[ADR-117]])`,
  `~~apply() 는 커버를 먼저 씌운다~~ → close → 커버 → set([[ADR-117]])`.

### 4. `/docs/features/splash.md` 갱신

- 인덱스 헤더의 **관련 ADR** 에 `[[ADR-117]]` 추가.
- `#boot-cover` 실패 안전 타이머(8초, "아직 있을 때만") 와 `hideSplashScreen` 이
  `[data-splash-cover]` 까지 걷는다는 것을 정책 절에 적어라.
- ErrorBoundary 가 폴백 마운트 시 `hideSplashScreen()` 을 부른다는 것도 여기에 남겨라 —
  "스플래시를 내리는 주체가 둘"이라는 사실은 이 문서가 알아야 한다.

## Acceptance Criteria

```bash
test -f docs/adr/ADR-117.md
grep -q 'ADR-117' docs/ADR.md
grep -q 'ADR-117' docs/features/live-update.md
grep -q 'ADR-117' docs/features/splash.md
grep -c '결정 8' docs/adr/ADR-117.md            # 1 이상 — 결정 8개가 다 적혔는지
git status --porcelain -- src/ index.html | wc -l   # 0 — 소스는 손대지 않는다
npm run build
npm test
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. 문서 체크리스트:
   - ADR 형식이 `docs/adr/ADR-116.md` 와 같은 골격인가(날짜·상태·관련·맥락·결정·트레이드오프)?
   - 결정 8개가 **번호와 함께** 다 있는가? 채택하지 않은 안(하이드레이션 뒤 `notifyAppReady` ·
     z-index 상향 · 단순 재진입 가드) 셋이 **각각 왜 기각됐는지** 적혔는가?
   - 두 feature 문서의 옛 정책이 **지워지지 않고** history 섹션으로 내려갔는가?
   - `docs/README.md` 의 인덱스 표는 이 phase 로 바뀌는 것이 없다(새 기능·새 소스 디렉터리가 없다) —
     **건드리지 마라.**
3. `phases/ota-apply-recovery/index.json` 의 step 0 을 갱신한다. summary 에 **ADR 번호(117)와 결정
   8개의 한 줄 제목**을 반드시 담아라 — 이후 9개 step 이 전부 이것을 계약으로 읽는다.

## 금지사항

- **`src/` 와 `index.html` 을 한 글자도 고치지 마라.** 이유: 이 phase 는 docs-first 이고, 구현은
  step 1~8 이 레이어별로 나눠 맡는다. 여기서 미리 고치면 그 step 들의 AC(변경 파일 범위 검사)가 깨진다.
- **`docs/ADR.md` 를 쪼개거나 기존 줄을 고치지 마라.** 이유: 슬림 인덱스이고 append 만 한다(CLAUDE.md).
- **다른 ADR 전문을 컨텍스트에 통째로 올리지 마라.** 이유: `docs/ADR.md` 전체는 100KB 에 육박한다.
- **결정 내용을 임의로 바꾸거나 새 결정을 추가하지 마라.** 이유: 8개는 사용자가 확정한 것이다.
  구현 중 문제가 보이면 ADR 을 고치지 말고 `blocked` 로 세우고 사유를 남겨라.
- 기존 테스트를 깨뜨리지 마라.
