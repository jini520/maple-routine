# Step 3: boss-profit-party-default

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "보스 수익 계산기" 데이터 흐름 중 자동 기록(ADR-014) 관련 서술과 ADR-019에 의한 정정 부분
- `/docs/ADR.md` — ADR-014(기존 "가장 최근 기록값 이어받기" 로직 원문)와 ADR-019 결정 7(그 로직을 완전히 폐기하고 `boss_party_settings` 조회로 대체한다는 결정, "사용자 확정, 2026-07-13"이라 재검토 없이 그대로 적용할 것)
- `/docs/PRD.md` — 핵심 기능 4 "파티원 수 자동 기록 및 기억" 항목의 2026-07-13 정정 서술
- `/src/storage/boss-party-settings.ts` — **Step 1에서 만들어진** `getBossPartySize(ocid, boss, difficulty): Promise<number | null>`
- `/src/storage/boss-profit.ts` — 이번 step에서 **삭제할** `getLatestPartySize` 함수의 현재 구현
- `/src/storage/__tests__/boss-profit.test.ts` — `getLatestPartySize`를 검증하는 기존 `describe` 블록(삭제 대상)
- `/src/features/boss-profit/store.ts` — 이번 step에서 수정할 자동 기록 로직(`refresh()` 안, 완료 감지 후 기록이 없는 조합에 기본 파티원 수를 채워 upsert하는 부분)

이전 step(들)에서 만들어진 `storage/boss-party-settings.ts`의 정확한 함수 시그니처를 확인한 뒤 작업하라.

## 작업

ADR-019 결정 7: 보스 수익 계산기(`features/boss-profit/store.ts`)의 자동 기록 로직에서 기본 파티원 수를 정하던 "같은 (ocid, boss, difficulty)의 가장 최근 완료 기록값 이어받기"(ADR-014) 로직을 **완전히 폐기**하고, `boss_party_settings` 조회로 대체한다.

1. `features/boss-profit/store.ts`의 `refresh()` 안에서 아래 부분을 찾는다:
   ```ts
   const latestPartySize = await getLatestPartySize(row.ocid, row.boss, row.difficulty)
   const partySize = latestPartySize ?? 1
   ```
   이 두 줄을 `storage/boss-party-settings.ts`의 `getBossPartySize(row.ocid, row.boss, row.difficulty)` 호출로 교체한다. `null`이면 그대로 1(솔로)을 기본값으로 쓴다 — 이 부분의 **동작 자체**(기록이 없으면 1, 있으면 그 값을 payoutMeso 계산에 사용, upsert)는 바뀌지 않는다. 조회 소스만 바뀐다.
   - import 문에서 `getLatestPartySize`를 `storage/boss-profit`에서 가져오던 것을 제거하고, `getBossPartySize`를 `storage/boss-party-settings`에서 import한다.
2. **주차별 override는 그대로 유지**(ADR-019 결정 7·8) — 사용자가 보스 수익 계산기 화면에서 `setPartySize`로 특정 주(달)만 값을 직접 수정하는 기존 기능은 이 step에서 손대지 않는다. `boss_party_settings` 조회는 오직 "기록이 아예 없어서 새로 자동 생성할 때"의 기본값에만 관여한다 — 이미 있는 `boss_profit_records` 레코드를 조회 결과로 덮어쓰지 마라.
3. `storage/boss-profit.ts`에서 이제 아무도 쓰지 않게 된 `getLatestPartySize` 함수를 **삭제**한다(이 step의 변경이 직접 만든 orphan 코드이므로 CLAUDE.md "Surgical Changes" 규칙에 따라 제거 대상 — 다른 미사용 코드까지 찾아 지우지는 마라).
4. `storage/__tests__/boss-profit.test.ts`에서 `describe('getLatestPartySize', ...)` 블록 전체를 삭제한다.
5. `features/boss-profit/__tests__/store.test.ts`에서 `getLatestPartySize` 모킹을 사용하던 기존 테스트를 `getBossPartySize`(`storage/boss-party-settings`) 모킹으로 갱신한다 — "기록 없음 + 파티 설정 없음 → 1로 자동 기록", "기록 없음 + 파티 설정 있음(예: 4) → 4로 자동 기록" 두 케이스를 반드시 검증하라(TDD, CLAUDE.md).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `getLatestPartySize`가 코드베이스 전체에서 완전히 제거되었는가(`grep -rn getLatestPartySize src`로 잔존 참조가 없는지 확인)?
   - 주차별 override 기능(사용자가 특정 주 값을 직접 수정)이 여전히 정상 동작하는 테스트가 남아있는가?
   - `boss_profit_records`의 과거 레코드가 이 변경으로 소급 변경되지 않는가(ADR-019 결정 8 — 이 step은 신규 자동 기록 시점의 기본값 조회만 바꾼다)?
3. 결과에 따라 `phases/boss-party-management/index.json`의 `step: 3`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 기존 사용자의 과거 `boss_profit_records`를 `boss_party_settings`로 옮기는 마이그레이션 코드를 작성하지 마라. 이유: 사용자가 명시적으로 마이그레이션을 하지 않기로 결정했다(신규 배포 후 모든 보스가 솔로로 시작, 사용자가 직접 재설정). 이 결정은 ADR.md/PRD.md에 아직 반영되지 않았을 수 있으니, 구현 중 이 문서들과 다르게 보이더라도 마이그레이션은 추가하지 마라.
- `setPartySize`(사용자가 화면에서 직접 파티원 수를 수정하는 기존 함수)의 동작을 바꾸지 마라. 이유: 이번 변경은 오직 "자동 기록 시 기본값을 어디서 가져오는지"만 바꾸는 것이지, 사용자의 수동 입력 경로는 ADR-019 범위 밖이다.
- `storage/boss-profit.ts`의 다른 함수(`upsertBossProfitRecord`, `getBossProfitRecords`)를 건드리지 마라.
- 기존 테스트를 깨뜨리지 마라(단, `getLatestPartySize` 테스트 블록은 위 지시에 따라 의도적으로 삭제하는 것이므로 예외).
