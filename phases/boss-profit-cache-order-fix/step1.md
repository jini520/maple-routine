# Step 1: boss-profit-cache-first

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-017 "결정 1" 전체 (보스 수익 계산기에도 스케줄 캐시 우선 표시 적용)
- `/docs/ADR.md`의 ADR-016 전체 (캐시 우선 표시의 원래 패턴과 이유)
- `/docs/ARCHITECTURE.md`의 "[보스 수익 계산기 / 물욕 아이템 드랍 ...]" 데이터 흐름 섹션 중 "캐시 우선 표시(2026-07-12, [[ADR-017]])" 문단
- `src/features/boss-scheduler/store.ts` (참고 구현 — `refresh()`가 `syncSchedules` 호출 전에 `getCachedSchedulerState`로 캐시 rows를 먼저 `set`하는 패턴을 그대로 이식할 대상. `cachedCharacters`를 만드는 부분과 `set({ status: 'loading', characters: cachedCharacters })` 호출 순서를 정확히 참고하라)
- `src/features/boss-profit/store.ts` (이번 step에서 수정할 파일 — 현재 `refresh()`가 `syncSchedules` 이후에만 `rows`를 만드는 구조를 정확히 파악하라)
- `src/storage/scheduler-cache.ts` (`getCachedSchedulerState(ocid)`)
- `src/lib/boss-matching.ts` (`matchBossContent`)
- `src/features/boss-profit/__tests__/store.test.ts` (기존 테스트 스타일 — `vi.mock('../../../storage/...', ...)` 패턴)

## 작업

`src/features/boss-profit/store.ts`의 `refresh(ocids)`를 수정하라. 새 인터페이스나 새 상태 필드는 추가하지 않는다 — `refresh()` 내부 로직만 바뀐다.

`ocids.length === 0`일 때의 early return은 그대로 둔다. 그 다음, 기존 `syncSchedules(ocids)` 호출 **이전에** 아래 캐시 우선 단계를 추가하라:

1. `ocids` 각각에 대해 `getCachedSchedulerState(ocid)`를 병렬로(`Promise.all`) 조회한다.
2. 캐시가 있는(`null`이 아닌) 항목만, `cached.state.bossContents`를 `matchBossContent`로 변환한 뒤 `isComplete`인 것만 걸러 `BossProfitRow`를 만든다. 컬럼 계산(`bossName`, `getCurrentBossProfitPeriod`, `findPriceEntry`로 `priceMeso`/`maxPartySize` 조회)은 기존 실시간 경로의 로직과 동일하게 재사용하되, `partySize`와 `payoutMeso`는 항상 `null`로 둔다 — **이 단계에서는 `getBossProfitRecords`/`getLatestPartySize`/`upsertBossProfitRecord`를 호출하지 않는다**(ADR-017 결정 1: 캐시 단계는 화면을 비워두지 않는 용도일 뿐이고, `boss_profit_records` 조회·기록은 실제 재검증 이후에만 수행한다 — 캐시 단계에서 두 번 기록하거나 낡은 캐시로 잘못된 파티원 수를 기록하는 걸 방지하기 위함이다).
3. `set({ status: 'loading', rows: cachedRows, error: null, staleCharacterNames: [] })`으로 캐시 rows를 먼저 화면에 반영한다.
4. 그 다음은 기존 로직(`syncSchedules` 호출 → 완료 보스로 `rows` 재구성 → `getBossProfitRecords` 병합 → 자동 기록 → 최종 `set({ status: 'loaded', ... })`)을 지금 그대로 이어간다 — 이 부분은 수정하지 않는다.

행 하나를 `BossProfitRow`로 만드는 로직(`bossName`/`period`/`priceEntry` 계산)이 캐시 단계와 실시간 단계 양쪽에 필요하다 — 함수로 추출해 재사용해도 되고, 간단히 중복 작성해도 된다(로직이 10줄 내외로 짧으므로 어느 쪽이든 괜찮다. 다만 계산 공식 자체가 두 곳에서 어긋나지 않게 하라).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/boss-profit/`는 `storage/scheduler-cache`·`storage/boss-profit`만 거쳐서 접근하는가(`nexon/`이나 `sqlite`를 직접 호출하지 않는가)?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/features/boss-profit/__tests__/store.test.ts`에 케이스를 추가해 다음을 검증하라(`getCachedSchedulerState`를 `vi.mock`에 추가):
   - 캐시에 완료된 보스가 있으면, `syncSchedules`가 아직 resolve되지 않은 시점에도(예: `syncSchedules`를 즉시 resolve하지 않는 Promise로 모킹) `rows`에 그 보스가 `status: 'loading'` 상태로 이미 채워져 있는지
   - 캐시 rows의 `partySize`/`payoutMeso`는 항상 `null`인지
   - 캐시가 없는 ocid는 캐시 rows에 포함되지 않는지(기존과 동일하게 실시간 결과만 반영)
   - 캐시 단계에서 `getBossProfitRecords`/`getLatestPartySize`/`upsertBossProfitRecord`가 호출되지 **않는지**
   - 최종적으로 `syncSchedules` 결과가 도착하면 캐시 rows가 실시간 값(자동 기록된 `partySize`/`payoutMeso` 포함)으로 교체되는지
4. 결과에 따라 `phases/boss-profit-cache-order-fix/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `getBossProfitRecords`/`upsertBossProfitRecord`/`getLatestPartySize`를 캐시 단계(`syncSchedules` 호출 전)에서 호출하지 마라 — 이 셋은 실시간 재검증 이후에만 호출되어야 한다(ADR-017 결정 1 명시).
- `BossProfitRow`/`BossProfitState`/`BossProfitStore` 인터페이스에 새 필드를 추가하지 마라.
- `src/app/boss-profit/BossProfitScreen.tsx`를 수정하지 마라(화면 레이아웃 변경은 이 phase의 마지막 step에서 한다).
- `setPartySize` 액션을 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
