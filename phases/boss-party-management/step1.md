# Step 1: boss-party-settings-storage

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `storage/` 디렉토리 설명, ADR-019 관련 서술
- `/docs/ADR.md` — ADR-019 "파티 관리" 전체(결정 1~8)
- `/src/storage/sqlite/db.ts` — **이전 step(sqlite-boss-party-settings)에서 추가된** `boss_party_settings` 테이블 스키마를 확인할 것(정확한 컬럼명을 이 파일에서 그대로 가져다 쓸 것)
- `/src/storage/boss-profit.ts` — 이번 step에서 그대로 따라야 할 CRUD 어댑터 패턴(같은 DB를 쓰는 유사 테이블의 실제 예시)
- `/src/storage/__tests__/boss-profit.test.ts` — 테스트 컨벤션(모킹 방식, upsert/조회 검증 스타일) 참고

이전 step에서 만들어진 `boss_party_settings` 테이블 스키마를 정확히 이해한 뒤 작업하라.

## 작업

`storage/boss-profit.ts`와 동일한 패턴으로 `src/storage/boss-party-settings.ts` 신규 파일을 작성한다. `features/*` 코드가 SQLite에 직접 접근하지 않고 이 어댑터를 거치도록 하는 것이 목적이다(CLAUDE.md CRITICAL 규칙).

```ts
export interface BossPartySetting {
  ocid: string
  boss: string
  difficulty: string
  partySize: number
  updatedAt: string // ISO 8601
}

// ON CONFLICT(ocid, boss, difficulty) DO UPDATE로 멱등하게 upsert한다.
export async function setBossPartySize(
  ocid: string,
  boss: string,
  difficulty: string,
  partySize: number,
  updatedAt: string,
): Promise<void>

// 없으면 null을 반환한다(테이블에 행이 없음 = 솔로, ADR-019 결정 3).
export async function getBossPartySize(
  ocid: string,
  boss: string,
  difficulty: string,
): Promise<number | null>

// ocids가 빈 배열이면 DB를 호출하지 않고 빈 배열을 반환한다(storage/boss-profit.ts의
// getBossProfitRecords와 동일한 가드).
export async function getBossPartySettings(ocids: string[]): Promise<BossPartySetting[]>
```

구현 시 참고:
- `getBossProfitDb()`(`storage/sqlite/db.ts`에서 export)를 그대로 재사용한다 — 새 커넥션 함수를 만들지 않는다.
- `setBossPartySize`의 SQL은 `storage/boss-profit.ts`의 `UPSERT_SQL` 패턴을 그대로 따른다: `INSERT INTO boss_party_settings (...) VALUES (...) ON CONFLICT(ocid, boss, difficulty) DO UPDATE SET party_size = excluded.party_size, updated_at = excluded.updated_at`.
- `getBossPartySettings`는 `ocid IN (?, ?, ...)` 형태로 벌크 조회한다(`getBossProfitRecords`의 플레이스홀더 생성 방식을 그대로 참고).
- row → 객체 변환 시 snake_case(`party_size`, `updated_at`) → camelCase(`partySize`, `updatedAt`) 매핑을 빠뜨리지 마라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `storage/boss-party-settings.ts` 하나만 신규 생성했는가(ARCHITECTURE.md 디렉토리 구조 — storage 레이어)?
   - `features/*`가 이 어댑터를 거치지 않고 SQLite에 직접 접근하는 코드를 추가하지 않았는가(CLAUDE.md CRITICAL)?
   - `setBossPartySize` 호출을 두 번 같은 키로 했을 때 두 번째 호출이 UPDATE로 덮어쓰는지(멱등성) 테스트로 검증했는가?
3. 결과에 따라 `phases/boss-party-management/index.json`의 `step: 1`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `features/boss-scheduler`나 `features/boss-profit`를 이 step에서 수정하지 마라. 이유: 이 step은 순수 storage 레이어이며, 이를 소비하는 feature 레이어 통합은 다음 step들의 범위다.
- `getLatestPartySize`(`storage/boss-profit.ts`)를 이 step에서 건드리거나 삭제하지 마라. 이유: 그 함수를 대체하는 작업은 `boss-profit-party-default` step(Step 3)의 범위이며, 그때 해당 step에서 명시적으로 삭제를 지시한다.
- 기존 테스트를 깨뜨리지 마라.
