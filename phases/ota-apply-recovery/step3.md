# Step 3: native-apply-path

이 step 은 **`src/native/` 두 파일만 고친다** — `splash-screen.ts`(커버를 걷을 수 있게) 와
`live-update.ts`(적용 순서를 뒤집는다). `features/`·`app/` 은 건드리지 않는다.

## 이 step 이 끊는 고리

**⑴ 걷을 수 없는 커버 (이 phase 에서 새로 발견한 결함).**
`showSplashScreen()` 은 `[data-splash-cover]` 속성을 가진 전체 화면 div 를 `document.body` 에 붙인다.
그런데 **그것을 지우는 코드가 저장소 어디에도 없다.** `hideSplashScreen()` 은 `#boot-cover` 만
제거한다. `splash-screen.ts` 의 주석은 "문서와 함께 사라지므로 별도 정리가 필요 없다"고 적혀 있는데,
그건 **리로드가 성공한다는 전제**다. 적용이 실패해 문서가 살아남으면 이 오버레이는 영구히 남는다 —
즉 step 4 에서 `apply()` 에 catch 를 달아도 **화면을 되돌릴 수단이 없다.** 이 step 이 그 수단을 만든다.

**⑵ 화면을 먼저 가린 뒤 실패 가능한 작업을 하는 순서.**
지금은 `store.apply()` 가 `showSplashScreen()` → `applyDownloadedLiveUpdate(id)`(내부에서
`closeBossProfitDb()` → `set()`) 순이다. 즉 **커버가 올라간 뒤에** SQLite 닫기가 돈다. 그 닫기가
매달리면 사용자는 주황 화면만 본다. 순서를 뒤집으면 커버가 올라가 있는 구간이 **실제 리로드
직전으로 좁아진다.**

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(**슬림 인덱스만** — 지정한 것만 열어라)
- `/docs/adr/ADR-117.md` — **이 phase 의 계약**. 이 step 은 **결정 1의 순서 부분**과 **결정 4** 다
- `/docs/adr/ADR-027.md` — 사용자 동의형 OTA UX + **리로드 커버 정정**(커버가 왜 존재하는지, 플러그인
  스플래시가 하단 내비 바 인셋을 못 덮어 DOM 오버레이를 덧댄 경위)
- `/docs/features/live-update.md` · `/docs/features/splash.md` — step 0 이 갱신한 정책
- `/src/native/splash-screen.ts` (**전문** — 32줄, 주석이 대부분이다)
- `/src/native/live-update.ts` (**전문** — 특히 `applyDownloadedLiveUpdate` 와 그 위 주석)
- `/src/native/__tests__/splash-screen.test.ts` · `/src/native/__tests__/live-update.test.ts` (**전문**)
- `/src/features/live-update/store.ts` 의 `apply()` (**읽기만** — 고치는 것은 step 4 다)
- `/src/storage/sqlite/db.ts` 의 `closeBossProfitDb` (**읽기만** — step 2 가 5초 타임아웃을 넣었고
  **던지지 않는다**. 이 step 은 그 성질에 기댄다)

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `splash-screen.ts` — `hideSplashScreen` 이 리로드 커버도 걷는다

```ts
export async function hideSplashScreen(): Promise<void>   // 시그니처 그대로
```

- 기존 `#boot-cover` 제거는 **그대로 두고**, `[data-splash-cover]` 도 함께 제거한다.
- **`querySelectorAll` 로 전부 지워라.** `querySelector` 하나만 쓰지 마라 — 중복 호출로 여러 장이
  쌓였을 수 있다(step 4 의 `'applying'` 가드가 정상 경로에서는 막지만, 걷는 쪽이 한 장만 아는 것은
  그 자체로 약한 계약이다).
- **DOM 제거는 지금처럼 플랫폼 가드(`getPlatform() === 'web'` 조기 반환)보다 먼저, 그리고 어떤
  `await` 보다 먼저** 실행돼야 한다. 이유 둘: 웹 개발 서버에서도 커버는 걷혀야 하고, 네이티브
  `SplashScreen.hide()` 가 매달려도 **DOM 커버만큼은 이미 사라진 뒤**여야 하기 때문이다.
- `showSplashScreen` 쪽의 "문서와 함께 사라지므로 별도 정리가 필요 없다"는 주석은 **틀린 전제**임이
  드러났다. 지우지 말고 정정하라 — 리로드가 성공하면 그렇지만 **실패하면 남는다**, 그래서
  `hideSplashScreen` 이 걷는다는 사실을 양쪽 주석에 남겨라([[ADR-117]] 결정 4).

### 2. `live-update.ts` — 적용 순서를 뒤집는다

```ts
export async function applyDownloadedLiveUpdate(id: string): Promise<void>   // 시그니처 그대로
```

새 순서는 **`closeBossProfitDb()` → `showSplashScreen()` → `CapacitorUpdater.set({ id })`** 다.

- **커버를 이 함수 안으로 들여온다.** 지금은 `store.apply()` 가 `showSplashScreen()` 을 부르는데,
  그러면 "닫기 → 커버 → set" 순서를 스토어와 어댑터가 나눠 갖게 돼 순서 보장이 두 파일에 흩어진다.
  이 함수가 셋을 순서대로 책임진다. `store` 쪽 `showSplashScreen` import 제거는 step 4 가 한다 —
  **이 step 에서 `store.ts` 를 고치지 마라**(중복 호출이 되지만 step 4 가 곧바로 없앤다. 그때까지
  타입·빌드는 깨지지 않는다).
- **`showSplashScreen()` 실패가 적용을 막으면 안 된다** — 기존 `store.apply()` 의 `.catch(() => {})`
  의도를 여기로 옮겨라. 커버는 시각적 장치일 뿐이고, 그것 때문에 `set()` 에 도달하지 못하면 본말이
  전도된다.
- **`closeBossProfitDb()` 는 이미 던지지 않는다**(step 2). 여기서 또 감싸지 마라 — 중복 방어는
  "어디가 실패를 삼키는가"를 흐린다.
- 함수 위 주석을 갱신하라: **왜 커버가 닫기 뒤인지**(닫기가 매달릴 때 사용자가 주황 화면에 갇히지
  않도록 커버 구간을 리로드 직전으로 좁힌다, [[ADR-117]] 결정 1)를 남겨라. 기존 stale 커넥션 주석
  (2026-07-17 사용자 보고)은 **지우지 말고 유지**하라.
- **타임아웃은 여기에 넣지 마라.** 전체 12초 타임아웃은 step 4 의 스토어가 건다. 이유: 여기에 또
  걸면 두 겹이 되고, 실패 시 화면을 되돌리는(커버를 걷고 상태를 바꾸는) 주체는 스토어뿐이라
  타임아웃도 그쪽에 있어야 책임이 한곳에 모인다.

### 3. 테스트

`splash-screen.test.ts`:
- `hideSplashScreen` 이 `[data-splash-cover]` 를 제거한다 — **여러 장 붙어 있어도 전부.**
- `#boot-cover` 제거 기존 케이스는 그대로 통과.
- **웹 플랫폼에서도 두 커버가 다 제거된다**(네이티브 `hide` 는 호출되지 않는다).
- 기존 헬퍼 `findReloadCover()`(`document.querySelector('[data-splash-cover]')`)를 그대로 쓰되,
  "전부" 를 단언하려면 개수를 세는 헬퍼를 더해라.

`live-update.test.ts`:
- **순서 단언이 이 step 의 핵심이다.** `closeBossProfitDb` → `SplashScreen.show` → `CapacitorUpdater.set`
  **이 순서로** 불린다는 것을 호출 순서 기록(공유 배열에 push 하는 mock 등)으로 단언하라.
  `toHaveBeenCalled` 만으로는 순서가 안 잡힌다 — 이 step 이 바꾸는 것이 바로 순서다.
- `showSplashScreen` 이 reject 해도 `set()` 은 호출된다.
- 기존 "`set()` 전에 `closeBossProfitDb` 를 부른다" 케이스는 그대로 통과해야 한다.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                    # errors 0 (warnings 17 은 baseline)
grep -q 'querySelectorAll' src/native/splash-screen.ts
grep -q 'showSplashScreen' src/native/live-update.ts
# 이 step 은 src/native 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -v 'src/native' | wc -l    # 0
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력을 확인하라**(둘 다, 결과를 summary 에):
   - `applyDownloadedLiveUpdate` 를 옛 순서(커버 → 닫기 → set)로 되돌리면 **순서 단언 케이스만**
     실패하는가? 확인 후 되돌려라.
   - `hideSplashScreen` 에서 `[data-splash-cover]` 제거를 빼면 해당 케이스만 실패하는가?
     확인 후 되돌려라.
3. 아키텍처 체크: `native/` 어댑터가 `features/`·`app/` 을 import 하지 않는가(의존 방향).
   `native/live-update.ts` 가 `storage/sqlite/db` 와 `native/splash-screen` 을 쓰는 것은 정상이다 —
   전자는 이미 그러고 있고, 후자는 같은 레이어다.
4. `phases/ota-apply-recovery/index.json` 의 step 3 갱신 — summary 에 **새 호출 순서**와
   **`hideSplashScreen` 이 이제 커버 둘을 다 걷는다**는 사실을 담아라(step 4·7 이 이것에 기댄다).

## 금지사항

- **`src/features/live-update/store.ts` 를 고치지 마라.** 이유: step 4 몫이고, 변경 범위 AC 가
  서로를 깬다. 이 step 이 끝난 시점에 `showSplashScreen` 이 두 번 불리는 상태가 되지만
  (스토어 + 어댑터) 타입도 빌드도 깨지지 않으며 step 4 가 곧바로 해소한다.
- **`applyDownloadedLiveUpdate` 의 시그니처를 바꾸거나 함수를 쪼개지 마라.** 이유: 호출부가
  `store.apply()` 하나뿐이고, 쪼개면 "닫기 → 커버 → set" 순서 보장이 다시 두 파일로 흩어진다.
- **여기에 타임아웃을 넣지 마라.** 이유: 12초 타임아웃과 실패 시 화면 복구는 step 4 의 스토어가
  한 곳에서 책임진다. 두 겹이면 어느 쪽이 먼저 터졌는지 알 수 없다.
- **`closeBossProfitDb()` 를 try/catch 로 다시 감싸지 마라.** 이유: step 2 가 "던지지 않는다"를
  계약으로 만들었다. 중복 방어는 책임 소재를 흐린다.
- **`showSplashScreen` 이 커버를 붙이는 시점을 첫 `await` 뒤로 옮기지 마라.** 이유: 클릭과 같은 틱에
  커버가 붙는 성질이 리로드 직전 깜빡임을 막는다([[ADR-027]] 정정).
- 기존 테스트를 깨뜨리지 마라.
