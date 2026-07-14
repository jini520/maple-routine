# Step 3: profit-store

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 "ADR-023" 전체(결정 1~10, "미확정" 문단 포함) — 이 step에서 다루는 것은 결정 3(기간 네비게이터)·4(로컬 우선 캐싱·백필)·5(월간 탭 구성)이고, 결정 6~10(아코디언 UI)은 다음 step(UI)의 몫이다. "미확정 — 과거 기록 편집 가능 여부"는 **이번 라운드에 편집을 허용하기로 확정**됐다(사용자 확인) — 읽기 전용으로 만들지 마라.
- `/docs/ARCHITECTURE.md`의 "패턴" 섹션 중 `boss-profit`을 설명하는 문단("혼합 패턴" — 보스 목록은 `nexon/schedule` 캐시 구독, 기록은 `storage/` 직접 소유)
- `src/features/boss-profit/store.ts` (이번 step에서 재구성할 파일 — 기존 `refresh`의 캐시 우선 표시·자동 기록 로직은 최대한 그대로 재사용하고, 새 기능을 추가하는 방식으로 확장한다)
- `src/features/boss-profit/__tests__/store.test.ts` (기존 테스트 스타일 — `vi.hoisted`로 모듈 모킹)
- `src/lib/boss-profit-period.ts` — Step 0에서 추가된 `getAdjacentPeriodKey`/`isLatestPeriod`/`formatBossProfitPeriodLabel`/`getWeeklyPeriodKeysInMonth`/`getBackfillQueryDate`를 반드시 확인하고 그대로 가져다 쓴다(재구현 금지)
- `src/nexon/schedule/client.ts` — Step 1에서 추가된 `fetchSchedulerCharacterState(apiKey, ocid, date?)`
- `src/storage/boss-profit-period-checks.ts` — Step 2에서 추가된 `isPeriodChecked`/`markPeriodChecked`
- `src/storage/boss-profit.ts` (`BossProfitRecord`, `getBossProfitRecords`, `upsertBossProfitRecord`)
- `src/storage/boss-party-settings.ts` (`getBossPartySize`)
- `src/storage/character-basic-cache.ts` (`getCachedCharacterBasic` — 과거 기간 조회 시 캐릭터명 조회에 쓴다)
- `src/storage/api-key.ts` (`getAuthConfig` — 백필 조회용 apiKey를 얻는다)
- `src/nexon/errors.ts` (`NexonAuthError`, `NexonRateLimitError`)
- `src/features/schedule-sync/schedule-sync.ts` (백필 호출의 순차 처리·rate limit 대응 방식을 참고 — 여러 ocid를 `Promise.all`로 동시 호출하지 않고 순차 처리하는 기존 관례를 그대로 따른다)

## 배경 — 이 step에서 고쳐야 하는 기존 버그

`mergeRecordsIntoRows`(현재 `store.ts:71-88`)는 저장된 기록에서 `partySize`/`payoutMeso`만 복원하고 `priceMeso`는 복원하지 않는다. 과거 기간을 다시 보여줄 때 이 함수를 그대로 쓰면 과거 기록이 조용히 "오늘의" 라이브 시세로 재계산되는 데이터 무결성 버그가 생긴다. 이 step에서 **기록이 있으면 `priceMeso`도 기록값으로 덮어쓰도록** 고쳐야 한다.

## 작업

### 1. 타입 변경

```ts
export interface BossProfitRow {
  ocid: string
  characterName: string
  boss: string
  difficulty: BossDifficulty
  cycle: BossCycle
  periodKey: string
  periodLabel: string // formatBossProfitPeriodLabel(cycle, periodKey, now).primary — 기존 필드 유지, 계산 방식만 확장
  priceMeso: number | null
  maxPartySize: number
  partySize: number | null
  payoutMeso: number | null
}

export type WeeklySubtotalState = 'confirmed' | 'inProgress' | 'upcoming'

export interface BossProfitWeeklySubtotal {
  ocid: string
  characterName: string
  periodKey: string
  totalMeso: number
  state: WeeklySubtotalState
}

export interface BossProfitState {
  status: BossProfitStatus
  tab: BossCycle // 기본값 'weekly'
  periodKey: string // 현재 tab 기준으로 선택된 기간
  rows: BossProfitRow[] // 선택된 (tab, periodKey)의 보스 row. monthly 탭이면 그 달의 monthly-cycle 보스만(주간 합계는 weeklySubtotals가 별도 제공)
  weeklySubtotals: BossProfitWeeklySubtotal[] // monthly 탭에서만 채워짐. weekly 탭에서는 항상 []
  isPeriodLoading: boolean // periodKey 이동 후 백필 조회 중
  periodUnavailable: boolean // 직전 백필 시도가 실패해 이 기간 일부를 지금 볼 수 없음(재시도 가능하도록 checked로 기록하지 않았다는 뜻)
  error: ScheduleSyncError | null
  staleCharacterNames: string[]
  trackedOcids: string[] | null
}

export interface BossProfitStore extends BossProfitState {
  loadTrackedOcids(): Promise<void>
  refresh(ocids: string[]): Promise<void>
  setTab(tab: BossCycle): Promise<void>
  goToPreviousPeriod(): Promise<void>
  goToNextPeriod(): Promise<void>
  setPartySize(row: BossProfitRowKey, partySize: number): Promise<void>
}
```

`BossProfitRowKey`(= `Pick<BossProfitRow, 'ocid' | 'boss' | 'difficulty' | 'cycle' | 'periodKey'>`)는 그대로 유지한다.

### 2. `refresh(ocids)` 동작 규칙

기존 로직(캐시 우선 표시 → `syncSchedules` → 완료 감지 시 자동 기록)을 그대로 유지한다. 다만:

- `refresh`가 호출되면 항상 그 순간의 `tab`을 유지한 채 `periodKey`를 그 tab의 **현재** 기간(`getCurrentBossProfitPeriod(tab, now).periodKey`)으로 리셋한다 — "새로고침"은 항상 "지금"으로 돌아오는 동작이다.
- 완료된 보스는 (기존과 동일하게) weekly·monthly cycle 구분 없이 전부 계산한 뒤, `rows`에는 **현재 tab의 cycle에 해당하는 것만** 반영한다.
- `mergeRecordsIntoRows`를 고쳐 기록이 있으면 `priceMeso`도 함께 복원한다(위 "배경" 참고).
- `tab === 'monthly'`인 상태에서 `refresh`가 호출되면, 이번 달에 포함된 weekly periodKey들(`getWeeklyPeriodKeysInMonth`)에 대해 로컬 기록(`getBossProfitRecords`)을 조회해 `weeklySubtotals`도 함께 갱신한다(이번 주는 방금 `refresh`로 얻은 최신 값을 반영해야 하므로, 방금 계산한 weekly rows의 합계를 그대로 쓰는 편이 낫다 — 굳이 다시 DB를 읽지 않아도 된다).

### 3. `setTab(tab)` / `goToPreviousPeriod()` / `goToNextPeriod()` 동작 규칙

- `setTab`: `tab`을 바꾸고 `periodKey`를 그 cycle의 현재 기간으로 리셋한 뒤, 아래 "기간 로드" 규칙에 따라 `rows`/`weeklySubtotals`를 채운다.
- `goToPreviousPeriod`/`goToNextPeriod`: 현재 `tab`의 `periodKey`를 `getAdjacentPeriodKey(tab, periodKey, 'prev' | 'next')`로 이동한 뒤 "기간 로드" 규칙을 따른다. `next` 방향은 이동 전 `isLatestPeriod(tab, periodKey, now)`가 `true`면 아무 것도 하지 않는다(이미 최신 기간이므로 더 미래로 갈 수 없다).
- **기간 로드 규칙** (하나의 내부 헬퍼로 구현해도 좋다):
  - 이동한 `periodKey`가 그 tab의 현재 기간이면 → 네트워크 호출 없이, 최근 `refresh`가 채워둔 데이터에서 즉시 슬라이스해 `rows`/`weeklySubtotals`를 구성한다.
  - 과거 기간이면 → **로컬 우선**. 대상이 되는 (ocid, cycle, periodKey) 조합을 모은다:
    - weekly tab: `(ocid, 'weekly', periodKey)` 단 하나.
    - monthly tab: `(ocid, 'monthly', periodKey)` 하나 + 그 달의 각 weekly periodKey마다 `(ocid, 'weekly', weeklyPeriodKey)`. 단, `getWeeklyPeriodKeysInMonth`가 반환한 주차 중 **그 cycle의 현재 periodKey보다 미래인 것은 백필 대상에서 제외**하고 `state: 'upcoming'`으로만 표시한다(아직 일어나지 않은 주는 조회할 데이터 자체가 없다).
  - `isPeriodChecked(ocid, cycle, periodKey)`로 각 조합이 이미 확인됐는지 확인한다. **전부 확인됐다면** `getBossProfitRecords`로 로컬 기록만 읽어 row/subtotal을 구성하고 끝낸다(API 호출 없음).
  - 확인 안 된 조합이 하나라도 있으면 `isPeriodLoading = true`로 설정하고, `getAuthConfig()`로 얻은 apiKey로 각 조합을 **순차적으로**(동시 호출 금지, rate limit 때문) 백필한다:
    - `fetchSchedulerCharacterState(apiKey, ocid, getBackfillQueryDate(cycle, periodKey))` 호출
    - 성공 시: 응답의 `bossContents`에서 해당 `cycle`이고 `isComplete`인 보스만 골라(다른 cycle 보스는 무시), 각 보스마다 `getBossPartySize(ocid, boss, difficulty)`(없으면 1)로 기본 파티원 수를 정해 `upsertBossProfitRecord`로 저장한다(기존 `refresh`의 자동 기록 로직과 동일한 방식). 완료된 보스가 하나도 없어도 `markPeriodChecked(ocid, cycle, periodKey, now.toISOString())`는 반드시 호출한다(다시 조회하지 않기 위해).
    - 실패 시(어떤 이유든 — 네트워크/인증/rate-limit): 그 조합은 `markPeriodChecked`를 호출하지 **않는다**(다음 방문 때 재시도 가능하게) 대신 `periodUnavailable = true`로 설정한다. 나머지 조합의 백필은 계속 진행한다(한 캐릭터의 실패가 다른 캐릭터를 막지 않는다 — 기존 `syncSchedules`의 개별 실패 처리 관례와 다르게, 여기서는 401/403/429도 전역 중단시키지 않고 그 조합만 실패 처리하고 계속 진행한다. 이유: 백필은 사용자가 특정 과거 시점을 보고 싶어 요청한 동작이라, 한 캐릭터의 일시적 실패로 나머지 캐릭터까지 막을 이유가 없다).
    - 백필이 모두 끝나면 `isPeriodLoading = false`로 바꾸고, 로컬 기록을 다시 읽어 `rows`/`weeklySubtotals`를 구성한다.
  - `rows`/`weeklySubtotals`를 로컬 기록으로 구성할 때 캐릭터명은 `getCachedCharacterBasic(ocid)`의 `profile.name`으로 조회한다. 캐시가 없는 극단적 케이스(계정 예열이 안 된 캐릭터)는 그 ocid를 결과에서 제외한다.
  - `weeklySubtotals`의 `state`는 위 "배경" 규칙대로: `periodKey < 그 cycle의 현재 periodKey` → `'confirmed'`, `===` → `'inProgress'`, `>` → `'upcoming'`(문자열 비교로 충분).

### 4. `setPartySize(rowKey, partySize)`

기존 로직을 그대로 유지한다(범위 검증, `row.priceMeso`로 `payoutMeso` 재계산, `upsertBossProfitRecord` 호출, `rows` 갱신). **과거 기간이라는 이유로 거부하는 로직을 추가하지 마라** — 이번 라운드는 과거 기록 편집을 허용하기로 확정됐다. `payoutMeso` 재계산은 항상 그 row가 이미 들고 있는 `priceMeso`를 쓴다(라이브 시세를 다시 조회하지 않는다) — 이 부분은 기존 코드가 이미 올바르게 동작하므로 그대로 둔다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. `app/boss-profit/BossProfitScreen.tsx`는 이 step에서 건드리지 않으므로, 컴파일이 계속 통과하려면 `BossProfitRow`/`BossProfitState`의 **기존 필드는 하나도 제거하거나 타입을 바꾸지 말고 추가만** 해야 한다(`periodLabel` 필드는 이름과 타입을 그대로 유지 — 계산 로직만 `formatBossProfitPeriodLabel`을 쓰도록 확장한다).
2. 아키텍처 체크리스트를 확인한다:
   - `features/boss-profit/` 레이어에만 변경이 있는가(예외: 없음 — `storage/`·`nexon/`·`lib/`·`app/` 모두 이전 step에서 이미 완성됐으므로 이 step은 순수하게 가져다 쓰기만 한다)?
   - CLAUDE.md CRITICAL 규칙(features는 storage/native에 직접 접근 금지 — 이 규칙은 features 코드가 `storage/`·`nexon/` "어댑터"를 거치는 것 자체는 허용한다는 뜻이며, 위 지시대로 `storage/boss-profit-period-checks`·`storage/character-basic-cache`·`storage/api-key`·`nexon/schedule/client`를 직접 import하는 것은 정상이다)를 위반하지 않았는가?
3. `src/features/boss-profit/__tests__/store.test.ts`에 케이스를 추가해 다음을 검증하라:
   - `mergeRecordsIntoRows`(또는 그 역할을 하는 내부 로직)가 기록이 있는 row에 `priceMeso`도 기록값으로 덮어쓰는지 (기존 "행 생성" 테스트에 `priceMeso`가 기록값과 다른 라이브 시세 케이스를 추가해 검증)
   - `setTab('monthly')` 호출 시 API를 다시 부르지 않고(`syncSchedulesMock`이 추가로 호출되지 않음) `tab`/`periodKey`가 바뀌는지
   - `goToPreviousPeriod()`: 이미 로컬에 기록이 있는(= `getBossProfitRecordsMock`이 값을 반환하도록 설정) 과거 주로 이동하면 `fetchSchedulerCharacterState`를 호출하지 않고 `rows`가 그 기록 기반으로 채워지는지
   - `goToPreviousPeriod()`: 기록도 없고 체크도 안 된 과거 주로 이동하면 `isPeriodLoading`이 `true`→`false`로 전환되고, `fetchSchedulerCharacterState`가 `date` 파라미터와 함께 호출되고, 성공 응답의 완료 보스가 `upsertBossProfitRecord`로 저장되고 `markPeriodChecked`가 호출되는지
   - 위 백필이 실패(예: `fetchSchedulerCharacterState`가 reject)하면 `periodUnavailable`이 `true`가 되고 `markPeriodChecked`는 호출되지 않는지
   - `goToNextPeriod()`를 현재 기간에서 호출하면 `periodKey`가 바뀌지 않는지(최신 기간 이상으로 이동 불가)
   - `setPartySize`가 과거 기간의 row에도 정상 동작하는지(거부되지 않는지)
4. 결과에 따라 `phases/boss-profit-redesign/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `app/boss-profit/BossProfitScreen.tsx`를 수정하지 마라. UI 리디자인은 다음 step의 몫이다 — 이 step은 화면이 계속 지금 모습 그대로(주간 탭·이번 주만 표시) 컴파일·동작하는 채로 끝나야 한다.
- 과거 기간 편집을 막는 로직(읽기 전용 처리)을 추가하지 마라 — 사용자가 이번 라운드에 편집 허용을 확정했다.
- 결정 시세 이력화(`boss-crystal-prices.json` 수정 등)를 시도하지 마라 — 이번 라운드 범위 밖이다([[ADR-006]], 실측 수치 없이 임의로 채우면 안 됨).
- 백필 조회에 `Promise.all` 등 동시 호출을 쓰지 마라 — Nexon API rate limit 때문에 반드시 순차 호출한다.
- 기존 테스트를 깨뜨리지 마라.
