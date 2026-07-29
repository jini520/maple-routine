# Step 4: world-crystal-summary

이 step은 GitHub 이슈 **#53**(보스 수익 — 월드별 주간 결정석 판매 한도 90개 대비 처치 수 표시)을 구현한다. 메이플에는 **주간 결정석 판매 개수 제한이 월드당 주 90개**로 정해져 있고, 캐릭터 하나는 최대 12개까지 팔 수 있다(그 캐릭터별 `n/12` 배지는 이전 step에서 이미 구현됐다).

수정 대상은 **`src/app/boss-profit/BossProfitScreen.tsx` 한 파일과 그 테스트**뿐이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — TDD: 테스트를 먼저 쓰고 통과시키는 구현을 쓴다)
- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 관련 ADR만 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/adr/ADR-054.md` (**이 task의 정책 원장 — 반드시 먼저 읽어라**. 특히 결정 1·4·6·7·8·9)
- `/docs/adr/ADR-046.md` (총 수익 헤드라인 설계 — 이번에 여기에 줄을 추가한다)
- `/docs/adr/ADR-049.md` (헤드라인 라벨행 뱃지를 `absolute` 로 뺀 이유 — **이번 배치 결정의 근거**)
- `/docs/features/boss-profit.md` (이 화면의 정책 전문. **"총 수익 헤드라인 결정석 줄" 레시피가 여기에 확정돼 있다 — 그대로 구현하라**)
- `/src/app/boss-profit/BossProfitScreen.tsx` (이번 step의 유일한 수정 대상. 전체를 읽어라 — 특히 `countGroupClearedWeeklyBosses`(이전 step 산출물)와 총 수익 헤드라인 JSX)
- `/src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` (기존 테스트 — 목 구성 방식을 그대로 따라 여기에 추가한다)
- `/src/features/boss-profit/store.ts` (`BossProfitRow` — `world`·`isComplete`·`cycle`·`boss` 필드 확인)
- `/src/lib/boss-matching.ts` (`WEEKLY_CRYSTAL_SALE_LIMIT`, `isSeasonBossName`)
- `/src/lib/world-emblem.ts` (`worldEmblemUrl(world): string | null` — 계정 선택·보스 관리 화면이 이미 쓰는 공용 함수)
- `/src/lib/item-icons.ts` (`getItemIconUrlByFile`)

## 작업

### 1. 월드별 합산 파생

이전 step이 만든 **`countGroupClearedWeeklyBosses(group)` 를 그대로 재사용한다. 처치 수 계산을 두 벌 만들지 마라.** 그 위에 월드 묶음만 얹는다:

```ts
interface WorldCrystalSummary {
  world: string
  cleared: number
}

function summarizeWorldCrystals(groups: CharacterGroup[]): WorldCrystalSummary[]
```

규칙:

- 그룹의 월드는 `group.bossRows[0]?.world ?? null` 로 판정한다(한 캐릭터의 모든 행은 같은 캐릭터에서 나오므로 월드가 동일하다).
- **월드가 `null` 인 그룹은 집계에서 제외한다**([[ADR-054]] 결정 6). `CharacterBasicProfile.world` 는 옵셔널이라(구버전 캐시) `null` 일 수 있는데, 어느 월드 한도에도 넣을 수 없기 때문이다. "미분류" 줄을 만들지 마라.
- 같은 월드의 그룹들은 처치 수를 합산한다.
- 결과 순서는 **결정적**이어야 한다. 입력 `groups` 는 이미 캐릭터 정렬 순서(레벨 내림차순 → 이름순)를 따르므로, **월드가 처음 등장하는 순서**를 유지하라(`Map` 삽입 순서). 이유: 렌더마다 순서가 흔들리면 [[ADR-036]]이 잡아둔 "표시 순서 고정" 원칙이 헤드라인에서 다시 깨진다.
- `CharacterGroup` 에 `world` 필드를 새로 추가할 필요는 없다. 다만 추가하는 편이 읽기 좋다고 판단하면 `buildCharacterGroups` 에서 함께 채워도 된다(재량).

### 2. 표시 — 총 수익 헤드라인의 금액행 아래

`docs/features/boss-profit.md` 에 확정된 레시피(재게시):

```
총 수익 헤드라인 결정석 줄 — 금액행 다음, 헤어라인(mt-3 h-px bg-border) 위
결정석행: mt-2 flex items-center gap-2
  아이콘 img h-5 w-5 flex-none object-contain
  주간 탭: 수치 text-sm font-bold tabular-nums text-text + " / 90" span text-xs font-semibold text-text-muted
  월간 탭: 수치 text-sm font-bold tabular-nums text-text + "개" span text-xs font-semibold text-text-muted (분모 없음)
  복수 월드일 때만 우측: ml-auto flex items-center gap-1
      "N개 월드" text-xs text-text-muted + ChevronDown/ChevronUp h-3.5 w-3.5 text-text-muted
  복수 월드면 이 줄 전체가 button(type="button"), 단일 월드·월간 탭이면 button 아님(펼칠 것이 없음)
펼침(복수 월드에서 열었을 때만): mt-1.5 space-y-1 pl-7
  줄: flex items-center gap-1.5
      엠블럼 img h-4 w-4 flex-none (worldEmblemUrl, null이면 엠블럼만 생략)
      월드명 text-xs text-text-muted
      ml-auto "34 / 90" text-xs font-semibold tabular-nums text-text
```

동작 규칙:

- **주간 탭 — 월드 1개**: `[아이콘] 34 / 90` 한 줄. 월드 수 표기·chevron·펼침 없음, 엠블럼도 없음. 분모는 `WEEKLY_CRYSTAL_SALE_LIMIT`.
- **주간 탭 — 월드 N개(N ≥ 2)**: `[아이콘] 46 / 180` + `2개 월드` + chevron. 분모는 **`WEEKLY_CRYSTAL_SALE_LIMIT × 월드 수`**. 탭하면 월드별 줄이 펼쳐진다. 펼침 상태는 이 화면의 로컬 `useState` 로 두면 된다(저장 불필요).
- **월간 탭**: `[월간 아이콘] 3개`. 분모 없음, 월드 분해 없음, chevron 없음. 이유([[ADR-054]] 결정 1·8): 90은 주간 전용 한도이고 월간 보스(검은마법사) 결정석은 거기 포함되지 않는다. 개수는 모든 캐릭터 그룹에서 `cycle === 'monthly'` 이고 `isComplete` 인 행의 보스명 distinct 합이다.
- **아이콘**: 주간 탭 `getItemIconUrlByFile('intense_power_crystal_weekly.webp')`, 월간 탭 `getItemIconUrlByFile('intense_power_crystal_monthly.webp')`. `null` 이면 아이콘만 생략하고 숫자는 그대로 보여준다.
- **표시 조건**: 총 수익 헤드라인이 이미 렌더되는 조건(`!isPeriodLoading && characterGroups.length > 0`) 안에서, **현재 기간일 때만** 이 줄을 렌더한다. 과거 기간에서는 렌더하지 않는다.
- **집계 대상이 하나도 없으면 줄 자체를 렌더하지 않는다** — 주간 탭에서 모든 캐릭터의 `world` 가 `null` 이면(구버전 캐시만 있는 경우) 보여줄 월드가 없다. 반면 월드는 알지만 처치 수가 0이면 `0 / 90` 을 그대로 보여준다(정보로서 유효하다).
- **접근성**: 수치 텍스트만으로는 무엇의 비율인지 읽히지 않는다. 줄 전체에 `aria-label` 을 준다(예: 주간 `"주간 결정석 판매 34 / 90"`, 월간 `"월간 결정석 3개"`). 펼침 토글이 되는 경우 `aria-expanded` 를 붙여라.
- **숫자와 단위 사이에 실제 공백 문자를 남겨라**(마진만으로 띄우지 마라). 이유: `textContent` 가 붙어버리면 스크린리더가 이어 읽는다 — [[ADR-046]]이 "메소" 단위에서 이미 정한 규약이다.

### 3. 배치에서 반드시 지킬 것

- **라벨행("{기간} 총 수익") 우측에 넣지 마라.** 그 자리는 기간 전체 고가 드롭 뱃지가 `absolute right-0 top-1/2 -translate-y-1/2` 로 점유하고 있고, 그 뱃지를 흐름 밖에 둔 이유가 있다([[ADR-049]] — 뱃지 유무로 라벨행이 16↔24px로 튄다). 결정석 줄은 **금액행 아래 새 줄**로 둔다.
- 헤어라인(`mt-3 h-px bg-border`)은 헤드라인의 맨 아래를 유지한다 — 결정석 줄은 그 **위**에 들어간다.
- 헤드라인이 길어지면 sticky 페이지 헤더 전체가 높아진다. 그 높이는 이미 `ResizeObserver` 로 실측돼 펼친 카드의 sticky 오프셋에 쓰이므로 **자동 반영된다** — 상수를 새로 만들거나 오프셋 계산에 손대지 마라.

## 테스트 (먼저 작성할 것 — TDD)

`src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` 에 추가하라. 기존 `mockStore()` / `row()` 헬퍼를 그대로 쓴다.

- **단일 월드**: 한 월드의 캐릭터 2명이 각각 3·2종을 완료하면 `5 / 90` 한 줄이 보이고, `개 월드` 표기와 펼침 토글은 없다.
- **복수 월드**: 두 월드면 합계와 분모가 `90 × 2 = 180` 으로 표시되고 `2개 월드` 가 보인다.
- **복수 월드 펼침**: 탭하면 월드별 줄(월드명 + `n / 90`)이 나타나고, 다시 탭하면 접힌다.
- **월드 미상 제외**: `world: null` 인 캐릭터의 처치 수는 합계에 포함되지 않는다.
- **모든 캐릭터가 월드 미상**: 결정석 줄 자체가 렌더되지 않는다.
- **시즌 보스 제외**: `'시즌 보스 메이린'` 완료 행은 월드 합계에 포함되지 않는다.
- **월간 탭**: 분모 없이 `개` 형태로 월간 보스 처치 수만 보이고, `/ 90` 과 월드 표기가 없다.
- **과거 기간**: 결정석 줄이 렌더되지 않는다.
- 분모가 `WEEKLY_CRYSTAL_SALE_LIMIT` 를 따른다(테스트에서 상수를 import 해 기대값에 쓰라 — 리터럴 90을 화면에 박지 않았음을 확인).
- **회귀 가드**: 기간 전체 고가 드롭 뱃지가 여전히 라벨행에 `absolute` 로 있고, 결정석 줄이 그 자리를 차지하지 않는다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 경고 0
npm test        # 전체 통과 — 이 task 시작 시점 베이스라인은 114 파일 / 1312건 전부 통과였다. 실패가 하나라도 남으면 안 된다.
git diff --name-only   # src/app/boss-profit/ 하위만 나와야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 화면은 `app/`, 순수 로직은 `lib/` 라는 디렉토리 규칙을 지켰는가?
   - 신규 색·신규 토큰을 만들지 않고 `primary`·`text`·`text-muted` 만 썼는가([[ADR-046]])?
   - 월드 엠블럼을 새로 구현하지 않고 `lib/world-emblem.ts` 의 `worldEmblemUrl` 을 재사용했는가?
3. 결과에 따라 `phases/boss-profit-crystal-limit/index.json` 의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 처치 수 계산을 새로 구현하지 마라. 이유: [[ADR-054]] 결정 3 — 이전 step의 `countGroupClearedWeeklyBosses(group)` 를 재사용한다. 두 벌이 되면 캐릭터 카드의 `n/12` 와 헤드라인의 `n/90` 이 서로 다른 규칙으로 세어 어긋난다.
- 결정석 줄을 라벨행("총 수익") 우측 흐름 안에 넣지 마라. 이유: 그 자리는 고가 드롭 뱃지가 `absolute` 로 점유 중이며, 흐름에 넣으면 뱃지 유무로 헤드라인이 8px 튀는 회귀가 되살아난다([[ADR-049]]).
- 분모 90을 리터럴로 박지 마라. 이유: `weekly-bosses.json` 의 `weeklyCrystalSaleLimit` 이 단일 진실 공급원이고 게임 패치로 바뀔 수 있는 수치다([[ADR-006]]).
- 월간 보스 처치 수를 90 한도에 합산하지 마라. 이유: 월간 보스(검은마법사) 결정석은 주간 90 한도에 포함되지 않는다(사용자 확정 도메인 규칙, [[ADR-054]] 결정 1).
- 월드 미상 캐릭터를 임의의 월드나 "미분류" 버킷에 넣지 마라. 이유: [[ADR-054]] 결정 6 — 어느 월드 한도에도 귀속시킬 수 없으므로 집계에서 제외하기로 확정했다.
- `store.ts` 에 월드별 집계 상태를 추가하지 마라. 이유: 이 지표는 화면 파생값이며, store에 두면 탭·기간 이동마다 동기화해야 할 상태가 하나 더 생긴다.
- 페이지 sticky 헤더의 높이 계산(`stickyHeaderHeight`)이나 카드 sticky 오프셋 로직에 손대지 마라. 이유: `ResizeObserver` 실측이라 헤드라인이 길어져도 자동 반영된다([[ADR-047]]). 손대면 펼친 카드 헤더 위치가 어긋난다.
- 기존 테스트를 깨뜨리지 마라
