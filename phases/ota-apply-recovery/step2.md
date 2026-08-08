# Step 2: sqlite-close-timeout

이 step 은 **`src/storage/sqlite/db.ts` 의 `closeBossProfitDb` 하나만 고친다.** 그 밖의 소스는
건드리지 않는다(테스트는 `src/storage/sqlite/__tests__/db.test.ts` 에 추가).

## 이 step 이 끊는 고리

`closeBossProfitDb()` 는 **맨몸이다** — 같은 파일의 `getBossProfitDb` 는 `withOpenTimeout`(10초)으로
"무응답"을 재시도 가능한 실패로 바꾸는데, 닫는 쪽에는 그런 장치가 없다. 그래서 네이티브
`closeConnection` 이 응답하지 않으면 이 함수는 **영원히 resolve 하지 않는다.**

그게 왜 화면을 죽이냐면, 이 함수를 부르는 두 곳이 **둘 다 그 뒤에 화면을 되살리는 일을 하기 때문**이다:

- `src/native/live-update.ts` 의 `applyDownloadedLiveUpdate` → 이 뒤에 `CapacitorUpdater.set()`(리로드)
- `src/features/settings/cache-data.ts` 의 `clearCacheDataAndReload` → 이 뒤에 `reload()`

여기서 매달리면 **그 뒤가 영영 실행되지 않는다.** 그리고 이 저장소는 iOS 실기기에서 SQLite 네이티브
호출이 응답 없이 멈춘 사례를 **두 번** 기록했다([[ADR-008]] 2026-07-17 정정, [[ADR-050]] 결정 2) —
가정이 아니라 관측된 실패다.

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(**슬림 인덱스만** — 지정한 것만 열어라)
- `/docs/adr/ADR-117.md` — **step 0 이 만든 이 phase 의 계약**. 이 step 은 **결정 5** 다
- `/docs/adr/ADR-008.md` · `/docs/adr/ADR-050.md` — SQLite 무응답 사례 두 건(결정 5 의 근거)
- `/docs/features/live-update.md` 의 `## SQLite 커넥션 주의` 절
- `/src/storage/sqlite/db.ts` (**전문** — 특히 `OPEN_TIMEOUT_MS` · `withOpenTimeout` ·
  `getBossProfitDb` · `closeBossProfitDb` 와 그 위의 긴 주석들)
- `/src/storage/sqlite/__tests__/db.test.ts` (**전문** — `describe('closeBossProfitDb')` 의 기존 4개
  케이스, 특히 **"종료 중에 getBossProfitDb가 동시에 호출돼도 새 커넥션을 만들지 않는다(레이스 방지)"**)
- `/src/features/settings/cache-data.ts` · `/src/native/live-update.ts` (**읽기만** — 호출부가 이
  변경을 어떻게 쓰는지 파악용. 고치는 것은 step 3·8 이다)

## 작업

TDD 다 — **테스트를 먼저 쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `db.ts` — 닫기에 타임아웃을 준다

```ts
const CLOSE_TIMEOUT_MS = 5_000
```

`closeBossProfitDb()` 가 **5초 안에 반드시 settle 하게** 만들어라. 대상은 함수 본체의 대기 구간
**전체**(`await dbPromise` + `closeConnection`)다 — 여는 쪽이 매달리면 닫기도 그 앞에서 매달릴 수
있으므로 한 구간만 감싸면 상한이 보장되지 않는다.

지켜야 할 성질 — **하나도 바꾸지 마라. 지금 코드가 가진 것들이다**:

- **던지지 않는다.** 타임아웃이든 네이티브 에러든 `closeBossProfitDb()` 는 항상 `resolve` 한다
  (best-effort). 이유: 이 함수 뒤에 오는 리로드가 실행되지 못하면 그게 바로 이 이슈의 증상이다.
- **`dbPromise` 는 닫기가 끝난 뒤(성공·실패·타임아웃 모두)에만 `null` 로 비운다.** 먼저 비우면
  그 사이의 동시 `getBossProfitDb()` 가 새 `createConnection` 을 시작해 네이티브에서
  `Connection boss_profit already exists` 가 난다. 기존 주석에 이 근거가 길게 적혀 있으니 **지우지 마라.**
- **한 번도 연 적 없으면(`dbPromise === null`) 아무것도 하지 않는다.** 타이머도 걸지 마라.
- **타이머를 반드시 `clearTimeout` 하라** — `withOpenTimeout` 이 `.finally` 에서 하는 것과 같은 방식.
  안 그러면 테스트 프로세스와 앱 이벤트 루프에 5초짜리 타이머가 남는다.

`withOpenTimeout` 과 **한 몸으로 읽히게** 만들어라. 헬퍼를 하나 더 만들어 두 곳이 공유하든, `close`
전용 헬퍼를 옆에 두든 재량이다 — 다만 상수 이름은 `OPEN_TIMEOUT_MS` 와 대칭인 `CLOSE_TIMEOUT_MS` 로
하고, **왜 여는 쪽(10초)보다 짧은지**를 주석으로 남겨라: 여는 것은 파일 생성·마이그레이션을 포함하지만
닫는 것은 그렇지 않아 정상이면 수 ms 이고, 이 값이 곧 **OTA 적용 경로에서 사용자가 무반응을 견디는
시간의 상한**이 되기 때문이다([[ADR-117]] 결정 5).

### 2. 테스트 — `db.test.ts` 의 `describe('closeBossProfitDb')` 에 추가

기존 4개 케이스는 **그대로 통과해야 한다.** 아래를 더한다:

- **타임아웃이 실제로 푼다**: `closeConnectionMock` 이 영영 resolve 하지 않는 Promise 를 돌려주게
  하고, 가짜 타이머로 5초를 전진시키면 `closeBossProfitDb()` 가 **resolve 한다**(reject 아님).
- **타임아웃 뒤에도 다음 `getBossProfitDb()` 가 새로 연다** — `dbPromise` 가 비워졌는지 확인.
- **4.9초에는 아직 안 끝난다** — 상수가 조용히 줄어드는 것을 막는다.
- **한 번도 연 적 없을 때는 타이머를 걸지 않는다** — 가짜 타이머 환경에서 `closeBossProfitDb()` 가
  **즉시** resolve 하고, 대기 중 타이머가 남지 않는다(`vi.getTimerCount()` 등으로 확인).

가짜 타이머를 쓰는 케이스는 **해당 케이스 안에서만** 켜고 끄라(`vi.useFakeTimers()` /
`vi.useRealTimers()`). 이유: 같은 파일의 기존 레이스 케이스는 마이크로태스크 순서에 의존해서 짜여
있어, 파일 전역으로 가짜 타이머를 켜면 그 케이스가 깨질 수 있다.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                    # errors 0 (warnings 17 은 baseline)
grep -q 'CLOSE_TIMEOUT_MS' src/storage/sqlite/db.ts
grep -q '5_000\|5000' src/storage/sqlite/db.ts
# 이 step 은 storage/sqlite 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -v 'storage/sqlite' | wc -l    # 0
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력을 확인하라**(결과를 summary 에): 타임아웃 race 를 걷어내면 새 케이스 중
   **"타임아웃이 실제로 푼다"** 가 **행(hang)이 아니라 실패**로 끝나는가? (테스트가 타임아웃으로
   죽는 것도 실패로 친다.) 확인 후 되돌려라.
3. **기존 레이스 케이스가 여전히 통과하는지 반드시 확인하라** — 이 파일에서 가장 깨지기 쉬운 것이
   "종료 중 동시 호출" 케이스다.
4. 아키텍처 체크: `storage/` 는 어댑터 레이어다 — **`features/` 나 `native/` 를 import 하지 마라.**
   의존 방향이 뒤집힌다.
5. `phases/ota-apply-recovery/index.json` 의 step 2 갱신 — summary 에 **상수 이름·값과 "던지지
   않는다"는 계약**을 담아라(step 3·8 이 이 성질에 기대어 짜인다).

## 금지사항

- **타임아웃 시 던지게 만들지 마라.** 이유: 호출부 둘 다 이 함수 뒤에 리로드가 있고, 던지면 그
  리로드에 도달하지 못한다 — 고치려는 증상을 그대로 재현하게 된다.
- **`dbPromise` 를 닫기 전에 `null` 로 비우지 마라.** 이유: 동시 `getBossProfitDb()` 가 새
  `createConnection` 을 시작해 `Connection boss_profit already exists` 가 난다(기존 주석 참고).
- **`getBossProfitDb`·`OPEN_TIMEOUT_MS`·`openBossProfitDb` 의 동작을 바꾸지 마라.** 이유: 이 step 의
  범위는 닫는 쪽이다. 여는 쪽은 이미 타임아웃이 있고 잘 돌고 있다.
- **`src/features/settings/cache-data.ts` 와 `src/native/live-update.ts` 를 고치지 마라.**
  이유: 각각 step 8·3 몫이고, 변경 범위 AC 가 서로를 깬다.
- **기존 주석을 지우지 마라.** 이유: 그 주석들은 실기기에서 실제로 겪은 사고의 기록이다(레이스 조건·
  stale 커넥션). 새 주석은 더하되 옛것은 남겨라.
- 기존 테스트를 깨뜨리지 마라.
