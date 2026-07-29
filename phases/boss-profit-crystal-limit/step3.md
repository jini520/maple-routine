# Step 3: character-clear-badge

이 step은 GitHub 이슈 **#52**(보스 수익 — 추적 중인 전체 캐릭터의 주간 보스 진행률을 캐릭터 카드마다 `8/12` 형태로 표시)를 구현한다.

수정 대상은 **`src/app/boss-profit/BossProfitScreen.tsx` 한 파일과 그 테스트**뿐이다. 스토어(`src/features/boss-profit/store.ts`)는 이 step에서 건드리지 않는다 — 처치 수는 store 필드가 아니라 화면에서 `rows` 로 파생한다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — TDD: 테스트를 먼저 쓰고 통과시키는 구현을 쓴다)
- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 관련 ADR만 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/adr/ADR-054.md` (**이 task의 정책 원장 — 반드시 먼저 읽어라**. 특히 결정 3·4)
- `/docs/features/boss-profit.md` (이 화면의 정책 전문. **"캐릭터 카드 헤더 배지" 레시피가 여기에 확정돼 있다 — 그대로 구현하라**)
- `/src/app/boss-profit/BossProfitScreen.tsx` (이번 step의 유일한 수정 대상. 전체를 읽어라)
- `/src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` (기존 테스트 — 목 구성 방식과 `row()` 헬퍼를 그대로 따라 여기에 추가한다)
- `/src/features/boss-profit/store.ts` (`BossProfitRow` 인터페이스 — `isComplete`·`cycle`·`boss`·`world` 필드 확인)
- `/src/lib/boss-matching.ts` (`WEEKLY_BOSS_CLEAR_LIMIT`, `isSeasonBossName`, `countClearedWeeklyBosses`)
- `/src/lib/item-icons.ts` (`getItemIconUrlByFile`)
- `/src/app/boss-scheduler/BossScreen.tsx` (주간 처치 수 배지 — **이 스타일을 그대로 재사용한다**. 검색: `weeklyBossClearCount`)

## 작업

### 1. 파생 함수 — 그룹 하나 → 주간 보스 처치 수

`BossProfitScreen.tsx` 안에서, 이미 있는 `collectGroupValuableDrops` / `collectAllValuableDrops` **바로 옆에** 나란히 둔다(같은 "그룹에서 파생" 패턴이다):

```ts
function countGroupClearedWeeklyBosses(group: CharacterGroup): number
```

규칙:

- `group.bossRows` 중 `row.cycle === 'weekly'` **이면서** `row.isComplete === true` **이면서** `!isSeasonBossName(row.boss)` 인 행만 센다.
- **같은 보스명은 1로만 센다**(보스명 distinct). 이유: 같은 보스를 여러 난이도로 완료해도 게임 규칙상 1개로 세며, `countClearedWeeklyBosses`(보스 스케줄러가 쓰는 함수)도 `content_name` 그룹당 1로 센다. 두 지표가 어긋나면 같은 화면에서 다른 숫자가 보인다.
- `cycle === 'weekly'` 필터를 함수 **안에** 두어라. 호출부(주간 탭)에서는 `rows` 가 이미 주간만 담고 있어 사실상 no-op 이지만, 이 함수는 step 4(#53)가 그대로 재사용하므로 자기방어적이어야 한다.

**이 함수는 step 4에서 월드별 합산에 그대로 재사용된다. 계산을 두 벌 만들지 마라.** 따라서 시그니처를 "그룹 하나를 받아 처치 수를 돌려주는" 형태로 유지하라.

### 2. 캐릭터 카드 헤더 배지

`CharacterAccordion` 의 헤더 버튼(`<button ref={headerRef}>`) 안, **캐릭터명(`flex-1`)과 금액 사이**(= 금액 왼쪽)에 배지를 넣는다.

`docs/features/boss-profit.md` 에 확정된 레시피(재게시):

```
배지: rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary
      (보스 스케줄러 BossScreen.tsx의 주간 처치 수 배지와 동일 — 신규 스타일 금지)
  안쪽: 결정석 아이콘 img h-4 w-4 flex-none object-contain + "8/12"
위치: 캐릭터명(flex-1)과 금액 사이 = 금액 왼쪽
높이: 24px — 아바타(h-8 = 32px)가 헤더 높이를 정하므로 배지를 넣어도 헤더 높이는 불변이어야 한다
```

- 아이콘 URL은 `getItemIconUrlByFile('intense_power_crystal_weekly.webp')` 로 조회한다. **`null` 이면 아이콘만 생략하고 숫자는 그대로 보여준다**(이 프로젝트의 아이콘 폴백 관례).
- 분모는 `WEEKLY_BOSS_CLEAR_LIMIT`(= `weekly-bosses.json` 의 `weeklyBossSelectionLimit`, 현재 12)을 쓴다. **숫자 12를 리터럴로 박지 마라.**
- 아이콘 `<img>` 는 `alt=""`(장식) 로 두고, 배지 전체에 스크린리더용 레이블을 준다(예: `aria-label="주간 보스 처치 8 / 12"`). 이유: `"8/12"` 만으로는 무엇의 진행률인지 읽히지 않는다.
- 배지가 아바타(32px)보다 커지지 않게 하라. 이유: 헤더 높이가 커지면 `ResizeObserver` 실측값이 바뀌어 sticky 헤더 오프셋·고가 드롭 배지 레일·하단 페이드 위치([[ADR-047]], [[ADR-049]])가 전부 따라 움직인다.

### 3. 표시 조건 — 주간 탭 · 현재 기간에만

- `props.tab === 'weekly'` 이고 **현재 기간**일 때만 배지를 렌더한다.
- `BossProfitScreen` 은 이미 `isLatestPeriod(tab, periodKey, now)` 로 `isCurrentPeriod` 를 계산해 갖고 있다. 그 값을 `CharacterAccordion` 에 prop 으로 내려라. **`isLatestPeriod` 를 아코디언 안에서 다시 계산하지 마라** — 같은 판정이 두 곳에 생기면 갈라진다.
- 조건을 벗어나면 배지 자체를 렌더하지 않는다(빈 배지·`0/12` 를 남기지 마라).

이 제한의 이유(주석으로 남겨라): 월간 탭 `rows` 에는 `cycle === 'monthly'` 만 담겨 주간 처치 수를 파생할 수 없고, 과거 기간 `rows` 는 가격 미확정 보스가 DB에 기록되지 않아 실제보다 적게 나온다.

## 테스트 (먼저 작성할 것 — TDD)

`src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` 에 추가하라. 기존 `mockStore()` / `row()` 헬퍼를 그대로 쓴다(`row()` 헬퍼에 `world` 필드가 필요하면 함께 갱신하라).

- 주간 탭·현재 기간에서 완료 보스 3종을 가진 캐릭터 카드에 `3/12` 가 보인다.
- **시즌 보스 제외**: 완료 행에 `'시즌 보스 메이린'` 이 섞여 있어도 카운트에 포함되지 않는다.
- **미완료 제외**: `isComplete: false` 행은 카운트에 포함되지 않는다.
- **난이도 중복은 1**: 같은 보스명의 서로 다른 난이도 완료 행 2개는 1로 센다.
- **월간 탭에서는 배지가 없다.**
- **과거 기간에서는 배지가 없다**(현재 기간이 아닌 `periodKey` 로 목을 구성).
- 분모가 `WEEKLY_BOSS_CLEAR_LIMIT` 를 따른다(리터럴 12를 화면에 박지 않았음을 확인 — 테스트에서 상수를 import 해 기대값에 쓰라).

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
   - `features/*` 에서 저장소·네이티브 API에 직접 접근하지 않았는가(CLAUDE.md CRITICAL)?
   - 신규 색·신규 배지 스타일을 만들지 않고 기존 것을 재사용했는가?
3. 결과에 따라 `phases/boss-profit-crystal-limit/index.json` 의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`(step 4가 재사용할 파생 함수 이름과 시그니처를 반드시 포함하라)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/features/boss-profit/store.ts` 에 처치 수 필드를 추가하지 마라. 이유: [[ADR-054]] 결정 3 — 처치 수는 `rows` 에서 파생한다. 과거 기간 백필 경로에는 `bossContents` 자체가 없어 store 필드를 만들어도 정확히 셀 수 없다.
- 새 배지 스타일을 만들지 마라. 이유: 보스 스케줄러가 쓰는 `rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary` 를 그대로 재사용하는 것이 이 프로젝트 관례이며, 같은 지표가 두 화면에서 다르게 보이면 안 된다.
- 분모 12를 리터럴로 박지 마라. 이유: `weekly-bosses.json` 의 `weeklyBossSelectionLimit` 이 단일 진실 공급원이고, 게임 패치로 바뀔 수 있는 수치다([[ADR-006]]).
- 카드 헤더의 높이를 바꾸지 마라(배지는 24px, 아바타 32px 유지). 이유: 헤더 높이는 `ResizeObserver` 로 실측돼 sticky 오프셋·고가 드롭 배지 레일·하단 페이드 위치에 쓰인다([[ADR-047]], [[ADR-049]]) — 높이가 바뀌면 그 셋이 모두 어긋난다.
- 헤더 버튼의 루트 엘리먼트 타입(`button`)이나 `isExpanded` 분기 구조를 바꾸지 마라. 이유: 루트 타입을 바꾸면 React가 트리를 리마운트해 헤더 포커스가 날아간다(파일 안 주석에 기록된 실사용 접근성 문제).
- 총 수익 헤드라인 영역을 건드리지 마라. 이유: 그것은 step 4(#53)의 범위다.
- 기존 테스트를 깨뜨리지 마라
