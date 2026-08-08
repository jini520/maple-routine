# Step 4: apply-error-store

이 step 은 **`src/features/live-update/store.ts` 를 고친다** — 적용 경로를 되돌아올 수 있게 만들고
상태 두 개를 추가한다. 모달(`src/app/UpdatePromptModal.tsx`)은 **step 5 몫이다.**
예외로 `src/app/settings/AppUpdateSection.tsx` 에 **컴파일에 필요한 최소 치환**만 허용한다(아래 3번).

## 이 step 이 끊는 고리

`apply()` 는 **되돌아올 수 없는 일방통행**이다:

```ts
async apply() {
  const id = get().downloadedBundleId
  if (id === null) return
  await showSplashScreen().catch(() => {})   // ← 화면을 먼저 덮는다
  await applyDownloadedLiveUpdate(id)        // ← catch 없음, 타임아웃 없음
}
```

호출부는 `onClick={() => void apply()}` 다. `void` 라 reject 는 **아무 데도 도달하지 않는다.**
그래서 `CapacitorUpdater.set()` 이 `Update failed, id doesn't exist` 로 reject 하든, 어느 await 가
매달리든, 증상은 똑같이 **"브랜드 주황 화면 무한"** 이고 기기에 남는 흔적은 **0** 이다.

이 step 이 그 경로에 **catch·타임아웃·화면 복구**를 넣는다. step 3 이 순서를 뒤집고
`hideSplashScreen()` 이 리로드 커버까지 걷게 만들어뒀으므로, 여기서 "커버를 걷는다"가 실제로 동작한다.

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(**슬림 인덱스만** — 지정한 것만 열어라)
- `/docs/adr/ADR-117.md` — **이 phase 의 계약**. 이 step 은 **결정 1**(catch·타임아웃·복구)과
  **결정 7**(`'applying'`) 이다
- `/docs/adr/ADR-027.md` — 사용자 동의형 UX(체크만 → 다운로드 → 적용) · `/docs/adr/ADR-065.md` 결정 2
  (`check-error` / `download-error` — 사용자가 시작했는지로 실패를 가른다)
- `/docs/features/live-update.md` — step 0 이 갱신한 정책
- `/src/features/live-update/store.ts` (**전문** — 상태 주석 블록·`CLEARED`·`runDownload`·`apply`)
- `/src/features/live-update/__tests__/store.test.ts` (**전문**)
- `/src/native/live-update.ts` 의 `applyDownloadedLiveUpdate` — **step 3 이 순서를
  `closeBossProfitDb()` → `showSplashScreen()` → `set()` 으로 바꿔뒀고, 커버를 이 함수가 붙인다**
- `/src/native/splash-screen.ts` — **step 3 이 `hideSplashScreen()` 을 `#boot-cover` +
  `[data-splash-cover]` 둘 다 걷게 만들어뒀다**
- `/src/app/UpdatePromptModal.tsx` (**읽기만** — step 5 몫)
- `/src/app/settings/AppUpdateSection.tsx` (`statusText: Record<LiveUpdateStatus, string>` 이
  **exhaustive** 라 상태를 추가하면 여기서 타입 오류가 난다)

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. 상태 두 개 추가

```ts
export type LiveUpdateStatus =
  | …기존 그대로…
  | 'applying'      // 적용 진행 중 — 되돌릴 수 없는 구간에 들어갔다
  | 'apply-error'   // 적용 실패·타임아웃. 받아둔 번들은 그대로 살아 있다
```

파일 상단의 상태 설명 주석 블록에 두 줄을 같은 형식으로 더하라. `'apply-error'` 는
`download-error` 와 마찬가지로 **사용자가 시작한 실패**라 모달로 알린다([[ADR-065]] 결정 2 의 분류를
그대로 따른다) — 그 근거를 주석에 남겨라.

### 2. `apply()` 재작성

```ts
const APPLY_TIMEOUT_MS = 12_000
```

계약:

1. `downloadedBundleId` 가 `null` 이면 지금처럼 **아무것도 하지 않는다.**
2. **재진입 가드** — 이미 `status === 'applying'` 이면 **즉시 반환**한다. UI 가 버튼을 감추더라도
   스토어가 자기 불변식을 스스로 지켜야 한다.
3. **`'applying'` 으로 전환한 뒤** `applyDownloadedLiveUpdate(id)` 를 부른다. 이 전환은
   `await` 보다 **앞**이어야 한다 — 그 사이가 원자적이라야 중복 탭이 접힌다.
4. 전체를 **12초 타임아웃**과 경쟁시킨다. 성공 경로에서는 `set()` 이 JS 컨텍스트를 파괴하므로
   그 뒤 코드는 실행되지 않는다 — **성공 시 상태를 바꾸는 코드를 쓰지 마라**(도달하지 않는다).
5. **실패·타임아웃이면**: `await hideSplashScreen()` 으로 **커버를 걷고**(실패해도 무시),
   `status: 'apply-error'` 로 전환한다.
6. **`downloadedBundleId` 를 지우지 마라.** 받아둔 번들은 그대로 살아 있고, 모달의 `다시 시도` 가
   `apply()` 를 다시 부른다(step 5). `CLEARED` 를 여기서 쓰면 재시도가 불가능해진다.
7. 타임아웃 타이머는 **반드시 `clearTimeout`** 하라(성공 경로에서 컨텍스트가 파괴되므로 실질적으로는
   실패 경로에서만 의미가 있지만, 테스트 환경에서 타이머가 새는 것을 막는다).

**12초의 근거를 주석에 남겨라**: 내부에서 `closeBossProfitDb()` 가 최대 5초(step 2)를 쓸 수 있고
그 뒤 커버·`set()` 이 남는다. 상한을 두는 목적은 **정확한 진단이 아니라 벽돌 방지**다.

### 3. `AppUpdateSection.tsx` — 컴파일 최소 치환

`statusText` 는 `Record<LiveUpdateStatus, string>` 이라 두 상태를 넣지 않으면 **빌드가 깨진다.**
아래만 하고 **그 외에는 이 파일을 건드리지 마라**:

- `applying: '적용하고 있어요'` — 대기 문구는 `~하고 있어요`([[ADR-061]] 결정 9, 같은 파일 주석 참고)
- `'apply-error': '적용에 실패했습니다'` — `'download-error': '다운로드에 실패했습니다'` 와 대칭
- `isBusy` 에 `'applying'` 을 더한다(스피너가 도는 것이 맞다)
- `highlight` 의 에러 분기(`text-error-ink`)에 `'apply-error'` 를 더한다

### 4. 테스트 — `store.test.ts`

- **성공 경로**: `applyDownloadedLiveUpdate` 가 호출되고, 그 전에 상태가 `'applying'` 이 된다.
- **재진입**: `apply()` 를 연달아 두 번 부르면 `applyDownloadedLiveUpdate` 는 **1회**만 불린다.
- **reject 경로**: `applyDownloadedLiveUpdate` 가 reject 하면 → `hideSplashScreen` **1회** 호출 +
  상태 `'apply-error'` + **`downloadedBundleId` 가 남아 있다.**
- **타임아웃 경로**: `applyDownloadedLiveUpdate` 가 영영 resolve 하지 않을 때 가짜 타이머로 12초를
  전진시키면 → `hideSplashScreen` 호출 + `'apply-error'`. **11.9초에는 아직 `'applying'`** 이다
  (상수가 조용히 줄어드는 것을 막는다).
- **재시도**: `'apply-error'` 에서 `apply()` 를 다시 부르면 정상적으로 `'applying'` 으로 들어간다
  (재진입 가드가 재시도를 막지 않는다).
- **`hideSplashScreen` 이 던져도 상태는 `'apply-error'` 가 된다.**
- `downloadedBundleId` 가 `null` 이면 아무 일도 없다(기존 케이스 유지).

`src/native/live-update` 와 `src/native/splash-screen` 은 **mock 하라** — 이 테스트는 스토어의
오케스트레이션만 본다.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                    # errors 0 (warnings 17 은 baseline)
grep -q "'applying'" src/features/live-update/store.ts
grep -q "'apply-error'" src/features/live-update/store.ts
grep -q 'APPLY_TIMEOUT_MS' src/features/live-update/store.ts
grep -c 'showSplashScreen' src/features/live-update/store.ts    # 0 — 커버는 이제 어댑터가 붙인다(step 3)
# 이 step 은 features/live-update 와 AppUpdateSection 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -v 'features/live-update' | grep -v 'settings/AppUpdateSection.tsx' | wc -l   # 0
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력을 확인하라**(둘 다, 결과를 summary 에):
   - `catch` 절에서 `hideSplashScreen()` 호출을 빼면 **reject 경로 케이스만** 실패하는가?
     확인 후 되돌려라. (이것이 "영구 벽돌"을 막는 한 줄이다.)
   - 재진입 가드를 빼면 **재진입 케이스만** 실패하는가? 확인 후 되돌려라.
3. 아키텍처 체크: `features/` 가 **`storage/`·`native/` 어댑터를 통해서만** 바깥과 만나는가
   (CLAUDE.md CRITICAL). 스토어가 `@capgo/*`·`@capacitor/*` 를 직접 import 하면 위반이다.
4. `phases/ota-apply-recovery/index.json` 의 step 4 갱신 — summary 에 **새 상태 두 개의 정확한
   문자열**과 **`apply-error` 가 `downloadedBundleId` 를 유지한다**는 계약을 담아라(step 5 가 그것에
   기대어 `다시 시도` 를 만든다).

## 금지사항

- **`src/app/UpdatePromptModal.tsx` 를 고치지 마라.** 이유: step 5 몫이고, 변경 범위 AC 가 서로를 깬다.
  이 step 이 끝난 시점에 `'applying'`·`'apply-error'` 는 모달에서 아무것도 그리지 않는 상태가 되지만
  (모달이 조용히 닫힌다) step 5 가 곧바로 해소한다.
- **`AppUpdateSection.tsx` 에서 위 4줄 외의 것을 고치지 마라.** 이유: 그 파일은 관찰용 섹션이고
  이 phase 의 대상이 아니다. 컴파일을 위한 최소 치환만 허용한다.
- **성공 경로에서 상태를 바꾸는 코드를 쓰지 마라.** 이유: `set()` 이 JS 컨텍스트를 파괴해 도달하지
  않는다. 도달하지 않는 코드는 다음 사람에게 거짓 정보를 준다.
- **`apply-error` 에서 `CLEARED` 를 쓰거나 `downloadedBundleId` 를 비우지 마라.** 이유: 다시 받지
  않고 재시도할 수 있어야 한다. 그게 `download-error` 와 다른 점이다.
- **`showSplashScreen` 을 스토어에서 부르지 마라.** 이유: step 3 이 커버를 어댑터 안으로 들여왔다.
  두 곳에서 부르면 커버가 두 장 쌓인다.
- **타임아웃을 `native/live-update.ts` 로 옮기지 마라.** 이유: 실패 시 화면을 되돌리는 주체가
  스토어라 타임아웃도 같은 곳에 있어야 책임이 한곳에 모인다.
- 기존 테스트를 깨뜨리지 마라.
