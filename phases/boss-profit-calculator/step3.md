# Step 3: boss-profit-store

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md`의 "4. 주간 보스 수익 계산기" 섹션 전체(대상 보스, 캐릭터 범위, 입력값 검증 규칙 포함)
- `/docs/ARCHITECTURE.md`의 "[보스 수익 계산기 / 물욕 아이템 드랍 ...]" 데이터 흐름 섹션, "패턴" 섹션(혼합 패턴 설명)
- `src/features/boss-scheduler/store.ts` — 이번 스토어가 그대로 따라야 할 기준 패턴(캐릭터 추적 로드/저장, `refresh(ocids)` 시그니처, `schedule-sync` 사용법)
- `src/lib/boss-matching.ts` — `matchBossContent`로 API 원문 보스명을 우리 표기(`matchedBossName`)로 정규화하는 방식
- `src/lib/boss-profit-period.ts`, `src/lib/reset-clock.ts` (이전 step 산출물)
- `src/storage/boss-profit.ts` (이전 step 산출물)
- `src/storage/character-selection.ts` — `trackedCharacters:boss`를 그대로 재사용(별도 추적 UI 없음, PRD 확정 사항)
- `src/data/boss-crystal-prices.json` — 구조 확인 (`prices[].boss`/`difficulty`/`priceMeso`/`maxPartySize`, `partySizeScaling.defaultMaxPartySize`, `partySizeScaling.formula`)

## 작업

`src/features/boss-profit/store.ts`를 작성하라. `boss-scheduler`와 동일하게 `nexon/schedule` 동기화 캐시를 읽기 전용으로 구독하되, **처치된(`isComplete: true`) 보스만**, **weekly+monthly cycle 무관 전체**를 대상으로 한다(등록 여부는 무관 — PRD 핵심 기능 4, ARCHITECTURE.md 확정 사항).

```ts
export interface BossProfitRow {
  ocid: string
  characterName: string
  boss: string                 // matchedBossName ?? apiName (매핑 안 되면 원문 그대로, ADR-008)
  difficulty: BossDifficulty
  cycle: BossCycle
  periodKey: string
  periodLabel: string          // "이번 주" | "이번 달"
  priceMeso: number | null     // 시세표에 없으면 null ("가격 미확정")
  maxPartySize: number
  partySize: number | null     // 사용자가 아직 입력 안 했으면 null
  payoutMeso: number | null    // partySize가 null이거나 priceMeso가 null이면 null
}

export type BossProfitStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface BossProfitStore {
  status: BossProfitStatus
  rows: BossProfitRow[]
  error: ScheduleSyncError | null
  staleCharacterNames: string[]  // 개별 캐릭터 동기화 실패/stale — 마지막 캐시로 표시 중임을 화면에 알리기 위함(ADR-008 "실패는 숨기지 않는다")
  trackedOcids: string[] | null
  loadTrackedOcids(): Promise<void>
  refresh(ocids: string[]): Promise<void>
  setPartySize(row: Pick<BossProfitRow, 'ocid' | 'boss' | 'difficulty' | 'cycle' | 'periodKey'>, partySize: number): Promise<void>
}
```

- **`saveTrackedOcids`를 두지 않는다**: PRD 확정 사항("이 화면 전용의 별도 캐릭터 추적 UI는 두지 않는다")에 따라 이 스토어는 추적 목록을 읽기만 한다 — 쓰기(저장)는 보스 스케줄러 화면의 기존 피커를 통해서만 이뤄진다. `loadTrackedOcids`/`refresh`는 `boss-scheduler`의 `store.ts`와 동일한 패턴을 따르라(`storage/character-selection`의 `getTrackedCharacterOcids('boss')`로 읽기만, `schedule-sync`의 `syncSchedules(ocids)` 호출).
- `refresh(ocids)`가 동기화 결과를 받으면, 각 캐릭터의 `bossContents`를 `matchBossContent`로 정규화하고 **`isComplete === true`인 것만** 남긴다(등록 여부 `isRegistered`는 필터링에 쓰지 않는다 — 처치 기준만 본다). 이 화면은 여러 캐릭터의 보스를 하나의 목록으로 합산해 보여주므로(PRD "캐릭터 범위" 확정 사항 — 화면 안에 캐릭터 선택 UI가 없다), `boss-scheduler`처럼 캐릭터별로 분리된 뷰를 만들지 말고 전체를 평탄화된 `rows` 배열 하나로 만들어라.
- 결과 중 `isStale === true`인 캐릭터가 있으면 그 `characterName`을 모아 `staleCharacterNames`에 담아라(개별 캐릭터 동기화 실패를 화면에서 숨기지 않기 위함, ADR-008).
- 정가(`priceMeso`)·상한(`maxPartySize`) 조회: `boss-crystal-prices.json`의 `prices[]`에서 `boss === matchedBossName && difficulty === difficulty`인 항목을 찾는 순수 헬퍼 함수를 `store.ts` 내부에 작성하라(이 조회 로직의 유일한 소비자이므로 별도 `lib/` 모듈로 뽑지 않는다). 항목이 없으면(벨로나 등) `priceMeso: null`, `maxPartySize`는 `partySizeScaling.defaultMaxPartySize`로 폴백. 항목의 `maxPartySize` 필드가 있으면 그 값을, 없으면 `partySizeScaling.defaultMaxPartySize`를 쓴다.
- 기간 계산: `getCurrentBossProfitPeriod(cycle, new Date())`로 각 행의 `periodKey`/`periodLabel`을 구한다.
- 저장된 기록 병합: `refresh` 마지막에 관련된 `ocids`와 이번에 등장한 모든 `periodKey`들로 `getBossProfitRecords(ocids, periodKeys)`를 호출해, `(ocid, boss, difficulty, periodKey)`가 일치하는 저장 기록이 있으면 그 `partySize`/`payoutMeso`로 행을 채운다. 없으면 `partySize: null`, `payoutMeso: null`(파티원 수 미입력 상태).
- `setPartySize`: 다음을 순서대로 한다.
  1. `partySize`가 1 이상의 정수이고 해당 행의 `maxPartySize` 이하인지 검증한다. 벗어나면 에러를 던지고 저장하지 않는다(PRD "입력값 검증" 확정 사항).
  2. `priceMeso`가 `null`이 아니면 `payoutMeso = Math.floor(priceMeso / partySize)`(`partySizeScaling.formula`)를 계산한다. `priceMeso`가 `null`이면 `payoutMeso`도 `null`로 둔다.
  3. `priceMeso`가 있는 경우에만 `upsertBossProfitRecord`로 저장한다(가격 미확정 항목은 저장할 값이 없으므로 DB에 쓰지 않는다 — `partySize`만 로컬 상태에 반영해 입력값이 화면에서 사라지지 않게 한다).
  4. 로컬 `rows` 상태에서 해당 행을 갱신한다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`features/boss-profit/`)
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? (`storage/`·`schedule-sync`를 거쳐서만 접근, nexon/native 직접 호출 금지)
3. 테스트로 다음을 검증하라: (a) 미처치 보스는 `rows`에서 제외되는지, (b) weekly·monthly 보스가 둘 다 포함되는지, (c) 시세표에 없는 보스는 `priceMeso: null`이고 `payoutMeso`가 항상 `null`인지, (d) `setPartySize`에 0/음수/상한 초과 값을 넣으면 에러가 나고 저장이 호출되지 않는지, (e) 기존에 저장된 기록이 있으면 `refresh` 후 `partySize`/`payoutMeso`가 그 값으로 복원되는지(멱등성), (f) 여러 캐릭터의 처치 보스가 하나의 `rows` 배열로 합쳐지는지, (g) 특정 캐릭터의 동기화 결과가 `isStale: true`면 `staleCharacterNames`에 그 캐릭터명이 포함되는지.
4. 결과에 따라 `phases/boss-profit-calculator/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이 스토어에서 `nexon/*`를 직접 호출하지 마라 — 스케줄 동기화는 반드시 `schedule-sync`를 거치고, 로컬 저장은 `storage/character-selection`(추적 목록 읽기)·`storage/boss-profit`(기록 CRUD) 어댑터만 거쳐라(CLAUDE.md CRITICAL 규칙 — `storage/` 자체를 거치는 건 허용되고 권장되는 패턴이다. `boss-scheduler`의 `store.ts`가 동일하게 `storage/character-selection`을 직접 import한다).
- 이 화면 전용의 별도 캐릭터 추적 목록을 새로 만들지 마라 — `trackedCharacters:boss`를 그대로 재사용한다(PRD 확정 사항).
- `partySize` 입력값 검증(1 이상 정수, 보스별 상한)을 생략하거나 UI 레이어로 미루지 마라 — 스토어 액션 자체가 이 규칙을 강제해야 한다.
- 기존 `boss-scheduler` 스토어·화면을 수정하지 마라(이 스토어는 별도 신규 파일이다).
- 기존 테스트를 깨뜨리지 마라.
