# Step 1: auto-record-on-refresh

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-014 전체 — 특히 결정 1("사용자가 화면에 들어와 파티원 수를 입력하기 전에도 즉시 수익 기록을 자동 생성한다. 기본 파티원 수는 같은 캐릭터+보스+난이도 조합의 가장 최근 기록값을 이어 쓰고, 과거 기록이 없으면 1")과 결정 2, 트레이드오프 섹션
- `/docs/PRD.md`의 "4. 주간 보스 수익 계산기" 섹션 중 "확정(2026-07-11) — 파티원 수 자동 기록 및 기억" 항목
- `/docs/ARCHITECTURE.md`의 "[보스 수익 계산기 / 물욕 아이템 드랍 ...]" 데이터 흐름 섹션 — "자동 기록" 단계 서술
- `src/features/boss-profit/store.ts` (이번 step에서 수정할 파일 — 현재 `refresh()`가 `rows`를 만들고 `getBossProfitRecords`로 기존 기록을 병합하는 방식을 정확히 파악하라)
- `src/storage/boss-profit.ts` (이전 step 산출물 — 새로 추가된 `getLatestPartySize(ocid, boss, difficulty)`)
- `src/features/boss-profit/__tests__/store.test.ts` (기존 테스트 스타일 — `vi.mock('../../../storage/boss-profit', ...)` 패턴을 그대로 따른다)

## 작업

`src/features/boss-profit/store.ts`의 `refresh(ocids)`를 수정하라. 새 인터페이스나 새 상태 필드는 추가하지 않는다 — `refresh()` 내부 로직만 바뀐다.

현재 흐름(완료된 보스로 `rows` 구성 → `getBossProfitRecords`로 기존 기록 병합 → `set(...)`) 뒤에 다음 단계를 추가하라:

- 병합 후에도 `partySize === null`(= 그 `(ocid, boss, difficulty, periodKey)` 조합에 저장된 기록이 없음)이면서 `priceMeso !== null`(가격이 확정된 보스)인 행 각각에 대해:
  1. `getLatestPartySize(row.ocid, row.boss, row.difficulty)`를 호출해 그 캐릭터+보스+난이도 조합의 가장 최근 파티원 수를 조회한다(다른 주차 기록이어도 무방 — `period_key` 무관 조회, step 0 산출물).
  2. 결과가 `null`이면(과거 기록이 전혀 없음) 기본값 `1`을 쓴다.
  3. `payoutMeso = Math.floor(row.priceMeso / defaultPartySize)`를 계산한다.
  4. `upsertBossProfitRecord`로 즉시 저장한다(`recordedAt`은 `refresh` 시작 시점의 현재 시각을 그대로 재사용 — 이미 `refresh`가 `now`를 만들고 있다면 그걸 쓰고, 없다면 이 로직을 위해 한 번 만들어 재사용하라. 행마다 새로 `new Date()`를 호출하지 마라).
  5. 그 행의 `partySize`/`payoutMeso`를 위에서 계산한 값으로 갱신한다.
- `priceMeso === null`인 행(가격 미확정)은 기존과 동일하게 건드리지 않는다 — 저장할 값이 없으므로 자동 기록 대상이 아니다.
- 이미 저장된 기록이 있어 `partySize !== null`인 행은 **절대 건드리지 않는다** — 사용자가 이미 확인/수정한 값을 자동 기록 로직이 덮어쓰면 안 된다(멱등성, ADR-014 결정 2 — "사용자가 파티원 수를 수정하면 해당 주의 기록만 갱신된다").
- 여러 행에 대한 자동 기록은 병렬로 처리해도 되고 순차로 처리해도 된다(성능상 큰 차이가 없는 규모) — `Promise.all` 등으로 모두 완료된 뒤 한 번에 `set({ status: 'loaded', rows: ..., ... })`을 호출해, 화면이 "일부만 자동 기록된" 중간 상태를 짧게라도 렌더링하지 않게 하라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`features/boss-profit/`)
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? (`storage/boss-profit`만 거쳐서 접근, `nexon/`·`sqlite`를 직접 호출하지 않는지)
3. `src/features/boss-profit/__tests__/store.test.ts`에 케이스를 추가해 다음을 검증하라(`getLatestPartySize`도 `vi.mock`에 추가):
   - 저장된 기록이 없는 새 완료 보스이고 `getLatestPartySize`가 `null`을 반환하면, `upsertBossProfitRecord`가 `partySize: 1`로 호출되고 `rows`에도 그 값이 반영되는지
   - `getLatestPartySize`가 이전 값(예: `4`)을 반환하면 그 값으로 `upsertBossProfitRecord`가 호출되고 `payoutMeso`도 그 값 기준으로 계산되는지
   - 이미 저장된 기록이 있는 조합(기존 `'저장된 기록이 있으면 refresh 후 partySize/payoutMeso가 복원된다'` 테스트 케이스)은 `getLatestPartySize`나 자동 `upsertBossProfitRecord`가 **호출되지 않는지**(기존 기록을 덮어쓰지 않는다는 걸 명시적으로 검증)
   - `priceMeso`가 `null`인 보스(예: 벨로나)는 `getLatestPartySize`/자동 `upsertBossProfitRecord`가 호출되지 않고 `partySize`가 계속 `null`인지
4. 결과에 따라 `phases/boss-profit-autorecord-layout/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이미 기록이 있는 `(ocid, boss, difficulty, periodKey)` 조합을 자동 기록 로직으로 다시 `upsert`하지 마라 — 사용자가 수정한 값을 덮어쓰는 회귀 버그다.
- `setPartySize` 액션의 기존 검증 로직(1 이상 정수, `maxPartySize` 이하)이나 시그니처를 바꾸지 마라. 자동 기록 로직은 `setPartySize`를 재사용하지 않고 별도로 구현한다(자동 기록은 사용자 입력 검증 대상이 아니라 시스템이 계산한 기본값이므로 — 단, 계산 자체는 항상 유효한 범위 안에 있다: `getLatestPartySize`가 반환하는 값은 과거에 이미 `setPartySize` 검증을 통과한 값이고, 폴백 `1`도 항상 유효하다).
- `BossProfitStore`/`BossProfitRow` 인터페이스에 새 필드를 추가하지 마라(이번 step은 동작 변경만, 시그니처는 그대로).
- `src/app/boss-profit/BossProfitScreen.tsx`를 수정하지 마라(레이아웃 변경은 다음 step에서 한다).
- 기존 테스트를 깨뜨리지 마라.
