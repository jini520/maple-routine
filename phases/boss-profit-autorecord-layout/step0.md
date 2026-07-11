# Step 0: latest-party-size-query

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-014("보스 수익 계산기 — 완료 감지 시 파티원 수 자동 기록 및 캐릭터별 레이아웃") 전체, 특히 결정 2("별도의 '기본값' 저장소나 테이블을 새로 두지 않고, 기존 `boss_profit_records` 테이블에서 `period_key` 조건 없이 `(ocid, boss, difficulty)`로 가장 최근 `recorded_at` 레코드 1건을 조회하는 쿼리로 구현")
- `/docs/PRD.md`의 "4. 주간 보스 수익 계산기" 섹션 중 "확정(2026-07-11) — 파티원 수 자동 기록 및 기억" 항목
- `src/storage/boss-profit.ts` (기존 `BossProfitRecord`/`upsertBossProfitRecord`/`getBossProfitRecords` — 이번 step은 이 파일에 함수를 추가한다)
- `src/storage/sqlite/db.ts`의 `getBossProfitDb()`와 `boss_profit_records` 테이블 스키마(특히 `recorded_at` 컬럼)
- `src/storage/__tests__/boss-profit.test.ts` (기존 테스트 스타일 — `getBossProfitDb`를 `vi.mock`으로 대체하는 방식을 그대로 따른다)

## 작업

`src/storage/boss-profit.ts`에 다음 함수를 추가하라:

```ts
export async function getLatestPartySize(
  ocid: string,
  boss: string,
  difficulty: string,
): Promise<number | null>
```

- `boss_profit_records`에서 `ocid`/`boss`/`difficulty`가 모두 일치하는 레코드를 **`period_key` 조건 없이** 조회하고, `recorded_at DESC` 정렬 후 `LIMIT 1`로 가장 최근 레코드 1건만 가져온다.
- 결과가 있으면 그 레코드의 `party_size`를 반환한다. 결과가 없으면 `null`을 반환한다(호출부가 "과거 기록 없음"으로 판단해 기본값 1을 적용할 것 — 이 함수 자체는 1로 폴백하지 않는다).
- 기존 `getBossProfitRecords`와 동일하게 `getBossProfitDb()`로 커넥션을 얻고 `db.query(sql, params)`를 쓴다. 파라미터 바인딩 방식(`?` placeholder)도 기존 함수와 동일하게 맞춘다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`storage/`에 배치, 새 테이블·스키마 변경 없음)
   - ADR.md 기술 스택을 벗어나지 않았는가? (ADR-014 결정 2 — 새 테이블을 만들지 않았는가)
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/storage/__tests__/boss-profit.test.ts`에 케이스를 추가해 다음을 검증하라(기존 `getBossProfitDb` mock 재사용):
   - 조회 결과가 없으면(`values: []` 또는 `undefined`) `null`을 반환하는지
   - 조회 결과가 있으면 그 행의 `party_size`를 반환하는지
   - SQL에 `period_key` 조건이 **없고** `ORDER BY recorded_at DESC`와 `LIMIT 1`이 포함되는지(쿼리 문자열 검증으로 확인 — `period_key`가 WHERE 절에 등장하지 않는지까지 확인해 이 함수가 특정 주차로 좁혀 조회하지 않는다는 걸 명확히 증명하라)
   - 호출 파라미터가 `[ocid, boss, difficulty]` 순서로 바인딩되는지
4. 결과에 따라 `phases/boss-profit-autorecord-layout/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 새 테이블이나 별도 "기본값" 저장 컬럼/테이블을 만들지 마라 — ADR-014가 명시적으로 기각한 대안이다. 기존 `boss_profit_records`에서 조회만 한다.
- 기본값 1로의 폴백 로직을 이 함수 안에 넣지 마라 — 그건 다음 step(`features/boss-profit/store.ts`)의 책임이다. 이 함수는 "과거 기록이 있는지"와 "있다면 무엇인지"만 정직하게 반환한다.
- `upsertBossProfitRecord`/`getBossProfitRecords`의 기존 동작이나 시그니처를 바꾸지 마라.
- 기존 테스트를 깨뜨리지 마라.
