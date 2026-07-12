# Step 4: boss-profit-screen-cleanup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-017 "결정 4"와 "결정 5" 전체 (수익금 중복 표시 제거, 월간 보스 표시 제거)
- `/docs/ARCHITECTURE.md`의 "[보스 수익 계산기 / 물욕 아이템 드랍 ...]" 데이터 흐름 섹션 중 "화면 레이아웃 ([[ADR-014]])" 문단의 2026-07-12 정정 부분
- `/docs/PRD.md`의 "4. 주간 보스 수익 계산기" 섹션 중 "정정(2026-07-12, [[ADR-017]])" 항목
- `src/app/boss-profit/BossProfitScreen.tsx` (이번 step에서 수정할 파일 — `PERIOD_ORDER`, `BossProfitSection`, `CharacterAccordion`의 현재 구조를 정확히 파악하라)
- `src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` (수정할 테스트 파일 — 특히 128번째 줄 근처 "rows를 이번 주/이번 달 섹션으로 분리해 렌더링하고 각 섹션 합계를 보여준다" 테스트는 이 step으로 인해 **의도적으로** 깨진다)

## 작업

### 월간 보스 섹션 제거 (ADR-017 결정 5)

`PERIOD_ORDER` 상수를 `['이번 주', '이번 달']`에서 `['이번 주'] as const`로 바꿔라. `CharacterAccordion`의 `sections` 계산(`PERIOD_ORDER.map(...).filter(...)`)은 그대로 둔다 — `PERIOD_ORDER`가 하나로 줄었으니 자동으로 "이번 달" 섹션이 렌더링되지 않는다.

- `features/boss-profit/store.ts`나 `rows` 자체(월간 보스 데이터, 자동 기록 로직)는 건드리지 마라 — 월간 보스 수익 기록은 계속 SQLite에 쌓여야 한다(ADR-017: "데이터 유실은 없고, 이 화면에서의 노출만 잠시 멈추는 것"). 이번 step은 순수하게 이 화면의 렌더링 범위만 좁히는 것이다.
- 화면 최상단의 "이번 주 총 수익" 카드(`weeklyTotalMeso` 계산)는 이미 `periodLabel === '이번 주'`로 필터링되어 있으므로 변경할 필요 없다.

### 수익금 중복 표시 제거 (ADR-017 결정 4)

`BossProfitSection` 컴포넌트에서 `<h2>{props.label} 합계 {total.toLocaleString()} 메소</h2>` 줄을 제거하라. 섹션에는 보스별 개별 행(`<ul>{...rows.map(...)}</ul>`)만 남긴다. `total` 계산 자체가 더 이상 이 컴포넌트에서 쓰이지 않으면 관련 코드(`const total = ...`)도 함께 제거해라 — 안 쓰는 변수를 남기지 마라.

`PERIOD_ORDER`가 하나로 줄어든 뒤에는 이 화면에 섹션이 항상 하나뿐이므로, `BossProfitSection`이 여전히 `label` prop을 받아야 하는지도 확인하라 — 렌더링에 안 쓰이게 됐다면(제목을 아예 안 보여주므로) prop에서 제거해도 되고, 향후 재확장 여지를 위해 남겨둬도 된다(어느 쪽이든 무방 — 안 쓰는 prop을 타입에만 남기지 말고, 남기기로 했으면 실제로 쓰임새가 있는지 다시 확인해라).

캐릭터 아코디언 헤더(`{group.characterName} · {weeklyTotal.toLocaleString()} 메소`)는 그대로 유지한다 — 합계 표시는 이 헤더 하나로 충분하다는 것이 이번 결정의 핵심이다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `app/boss-profit/BossProfitScreen.tsx`만 수정했는가(스토어·다른 화면 변경 없음)?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/app/boss-profit/__tests__/BossProfitScreen.test.tsx`를 갱신하라:
   - 기존 "rows를 이번 주/이번 달 섹션으로 분리해 렌더링하고 각 섹션 합계를 보여준다" 테스트(128번째 줄 근처)를 새 동작에 맞게 다시 작성하라 — 이제 이 화면은 `cycle: monthly`(periodLabel `'이번 달'`) 행이 섞여 있어도 그 섹션을 렌더링하지 않는다는 것과, "이번 주 합계 N 메소" 같은 섹션 타이틀 텍스트가 더 이상 존재하지 않는다는 것을 검증하는 테스트로 바꿔라.
   - 새 테스트 추가: `periodLabel: '이번 달'`인 row만 있는 캐릭터의 아코디언을 펼쳐도 보스 행이 보이지 않는지(월간 섹션 자체가 없으므로), 또는 최소한 "이번 달" 텍스트가 화면에 나타나지 않는지.
   - 기존 "상단 합계가 여러 캐릭터의 이번 주 payoutMeso만 합산해 보여주고 월간 보스는 제외한다" 테스트(229번째 줄 근처)는 이번 변경과 무관하게 그대로 통과해야 한다 — 깨지면 원인을 파악해라.
4. 결과에 따라 `phases/boss-profit-cache-order-fix/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `features/boss-profit/store.ts`를 수정하지 마라 — 월간 보스 데이터와 자동 기록 로직은 그대로 유지되어야 한다(스토어는 여전히 weekly+monthly 완료 보스를 전부 `rows`로 반환한다. 화면만 필터링한다).
- 캐릭터 아코디언 헤더의 합계 표시(`weeklyTotal`)를 제거하거나 계산 방식을 바꾸지 마라.
- 이번 step과 무관한 테스트(예: 파티원 수 입력, stale 안내, 새로고침 버튼)를 건드리지 마라.
- 기존 테스트를 깨뜨리지 마라 — 단, 위 "검증 절차"에서 명시한 대로 월간/섹션 타이틀 관련 테스트는 새 동작에 맞게 의도적으로 다시 작성해야 한다.
