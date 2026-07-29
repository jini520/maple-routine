# Step 1: crystal-reference-data

이 task는 GitHub 이슈 **#52**(캐릭터별 주간 보스 진행률 `n/12`)와 **#53**(월드별 주간 결정석 판매 한도 `n/90`)을 함께 구현한다. 이 step은 그 두 화면 작업이 딛고 설 **레퍼런스 데이터 레이어**(이미지 에셋 파일명 · `src/data/weekly-bosses.json` · `src/lib/boss-matching.ts`)만 만든다. 화면(`src/app/`)·스토어(`src/features/`)는 이 step에서 건드리지 않는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — 특히 TDD: 테스트를 먼저 쓰고 통과시키는 구현을 쓴다. 그리고 [[ADR-006]] 게임 수치 규칙)
- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 관련 ADR만 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/adr/ADR-054.md` (**이 task의 정책 원장. step 0에서 작성됨 — 반드시 먼저 읽어라**)
- `/docs/foundation/game-data.md` (`weekly-bosses.json` 항목 — step 0에서 갱신됨)
- `/src/data/weekly-bosses.json` (상단 `note`, `weeklyBossSelectionLimit`)
- `/src/lib/boss-matching.ts` (`REFERENCE_ENTRIES` 의 `isSeasonBoss` 태깅, `WEEKLY_BOSS_CLEAR_LIMIT`, `getBossReferenceOrder`, `countClearedWeeklyBosses`)
- `/src/lib/item-icons.ts` (`getItemIconUrl`, `getItemIconUrlByFile`, `import.meta.glob` 로 파일명 → URL 맵을 만드는 방식, NFC 정규화)
- `/src/data/__tests__/item-icons.test.ts` (아이콘 매핑 정합성 테스트 — 왜 결정석을 `item-icons.json` 에 넣으면 안 되는지 확인하라)
- `/src/data/__tests__/data-consistency.test.ts` (게임 데이터 파일 간 정합성 테스트 — 새 필드가 여기에 걸리지 않는지 확인하라)

## 작업

### 1. 결정석 아이콘 파일명 영문화

`src/assets/items/` 에 사용자가 넣어둔 한글 파일명 에셋 2개가 있다. 영문 파일명으로 바꿔라:

| 현재 | 변경 후 |
|---|---|
| `src/assets/items/강렬한힘의결정석_주간.webp` | `src/assets/items/intense_power_crystal_weekly.webp` |
| `src/assets/items/강렬한힘의결정석_월간.webp` | `src/assets/items/intense_power_crystal_monthly.webp` |

**이 두 파일은 아직 git에 추적되지 않은 상태(untracked)다.** 따라서 `git mv` 는 `not under version control` 로 실패한다 — 평범한 `mv` 로 이름을 바꾸고 `git add` 하라. 보존할 히스토리가 없으므로 rename 기록도 필요 없다. 먼저 `git ls-files src/assets/items/ | grep 결정석` 로 추적 여부를 확인하고, 만약 추적 중이라면 그때는 `git mv` 를 써라.

주의: macOS는 한글 파일명을 NFD로 저장한다. 셸에서 파일명 매칭이 안 되면 와일드카드(`src/assets/items/*주간*.webp`)를 쓰거나 `ls` 결과를 그대로 인용하라.

**이 두 파일을 `src/data/item-icons.json` 에 등록하지 마라.** 이유: `src/data/__tests__/item-icons.test.ts` 가 "매핑된 아이템명은 모두 `item-drop-table.json` 에 실재한다"를 강제하는데, 결정석은 드랍 테이블 항목이 아니라 UI 표시 전용 아이콘이다. 등록하면 그 테스트가 깨진다. 조회는 `src/lib/item-icons.ts` 의 기존 `getItemIconUrlByFile(fileName)`(파일명 직접 조회 — 솔 에르다 단위 분해 아이콘이 이미 쓰는 경로)를 재사용한다. `getItemIconUrlByFile` 은 이미 export 돼 있으므로 **`item-icons.ts` 는 수정할 필요가 없다** — 파일이 `import.meta.glob('../assets/items/*.{png,webp}')` 범위에 있으므로 이름만 바꾸면 자동으로 잡힌다.

### 2. `src/data/weekly-bosses.json` 에 판매 한도 추가

`weeklyBossSelectionLimit: 12` **바로 옆에** 새 최상위 필드를 추가한다:

```json
"weeklyCrystalSaleLimit": 90
```

값 90은 사용자(도메인 전문가)가 2026-07-29에 확정한 값이다. 다른 수치를 추정해 넣지 마라([[ADR-006]]).

상단 `note` 에 **두 수치의 차이**를 한 문장으로 덧붙여라 — 이름이 비슷해 혼동하기 쉬운 것이 이 문서화의 이유다:

- `weeklyBossSelectionLimit: 12` = **캐릭터당** 주간 보스 등록/처치 한도
- `weeklyCrystalSaleLimit: 90` = **월드당** 주당 결정석 판매 한도(주간 보스만 포함 — 월간 보스인 검은마법사 결정석은 제외, 시즌 보스 제외, 이월 없이 매주 초기화)

기존 `note` 문장을 지우지 말고 뒤에 이어 붙여라.

### 3. `src/lib/boss-matching.ts` 에 상수·헬퍼 export 추가

두 가지를 추가한다.

**(a) 판매 한도 상수** — 기존 `WEEKLY_BOSS_CLEAR_LIMIT` **바로 옆에** 나란히 둔다. 두 상수가 붙어 있어야 혼용을 막는다:

```ts
export const WEEKLY_CRYSTAL_SALE_LIMIT: number = weeklyBossesData.weeklyCrystalSaleLimit
```

**(b) 보스명으로 시즌 보스 여부를 조회하는 헬퍼:**

```ts
export function isSeasonBossName(bossName: string): boolean
```

- 내부 `REFERENCE_ENTRIES` 는 이미 `eventWeekly`(현재 "시즌 보스 메이린")를 `isSeasonBoss: true` 로 태깅해 갖고 있다. 그 태깅을 **보스 표시명으로 조회**하는 형태다.
- 구현은 `BOSS_REFERENCE_ORDER`(모듈 로드 시 `REFERENCE_ENTRIES` 를 한 번 순회해 만드는 Map)와 같은 패턴으로, 모듈 스코프에 시즌 보스 이름 Set 을 한 번만 만들어 조회하라. 매 호출마다 `REFERENCE_ENTRIES.find` 를 도는 구현은 피하라 — 이 함수는 화면에서 행 단위로 반복 호출된다.
- 매칭은 **정확 일치**로 충분하다. 이유: 이 함수의 입력은 `BossProfitRow.boss` 이고, 그 값은 `matchedBossName`(= `REFERENCE_ENTRIES` 의 `boss` 표기 그대로) 아니면 매칭에 실패한 API 원문명이다. 후자는 애초에 참조표에 없으므로 시즌 보스가 아니다. `getBossReferenceOrder` 도 같은 전제로 정확 일치를 쓴다.
- 참조표에 없는 이름이 들어오면 `false` 를 반환한다.

### 4. 테스트 (먼저 작성할 것 — TDD)

새 파일 `src/lib/__tests__/boss-matching.test.ts` 가 이미 있으면 거기에, 없으면 새로 만들어 아래를 검증하라. **구현보다 테스트를 먼저 쓰고, 실패를 확인한 뒤 구현하라.**

- `WEEKLY_CRYSTAL_SALE_LIMIT` 가 `90` 이다.
- `WEEKLY_BOSS_CLEAR_LIMIT`(12)과 `WEEKLY_CRYSTAL_SALE_LIMIT`(90)이 서로 다른 값이다 — 두 상수를 혼용해 같은 곳을 가리키게 되는 회귀를 막는 가드다.
- `isSeasonBossName('시즌 보스 메이린')` 이 `true` 다.
- `isSeasonBossName('자쿰')`·`isSeasonBossName('검은마법사')` 가 `false` 다(각각 `weekly`·`monthly` 소속).
- 참조표에 없는 이름(예: `'존재하지 않는 보스'`)에 대해 `false` 다.

추가로 `src/data/__tests__/` 의 데이터 정합성 테스트에 아래를 넣어라(기존 `data-consistency.test.ts` 안에 두는 것이 자연스럽다):

- `weekly-bosses.json` 에 `weeklyCrystalSaleLimit` 이 존재하고 양의 정수다.
- `weeklyCrystalSaleLimit` 이 `weeklyBossSelectionLimit` 보다 크다 — 두 값을 서로 바꿔 적는 실수를 잡는 가드다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 경고 0
npm test        # 전체 통과 — 이 task 시작 시점 베이스라인은 114 파일 / 1312건 전부 통과였다. 실패가 하나라도 남으면 안 된다.
ls src/assets/items/ | grep -i crystal       # intense_power_crystal_weekly.webp, intense_power_crystal_monthly.webp 두 개가 나와야 한다
ls src/assets/items/ | grep 결정석            # 아무것도 나오지 않아야 한다
git status --porcelain src/assets/items/     # 한글 파일명이 남아 있지 않고 영문 두 파일이 스테이징돼야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/foundation/architecture.md` 의 디렉토리 구조를 따르는가(데이터는 `src/data/`, 순수 로직은 `src/lib/`)?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? — 특히 게임 수치(90)는 사용자 확정값이며 AI가 추정한 값이 아니다.
3. 결과에 따라 `phases/boss-profit-crystal-limit/index.json` 의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`(다음 step이 쓸 export 이름과 아이콘 파일명을 반드시 포함하라)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/app/` · `src/features/` 아래 파일을 수정하지 마라. 이유: 화면과 스토어는 step 2~4의 범위다. 이 step은 레퍼런스 데이터 레이어만 다룬다.
- 결정석 아이콘을 `src/data/item-icons.json` 에 등록하지 마라. 이유: `src/data/__tests__/item-icons.test.ts` 가 매핑된 아이템명이 `item-drop-table.json` 에 실재할 것을 강제하는데, 결정석은 드랍 테이블 항목이 아니라 UI 표시 전용 아이콘이라 그 테스트가 깨진다.
- 한글 파일명을 그대로 두고 코드에서 참조하지 마라. 이유: macOS는 한글 파일명을 NFD로 저장해 `import.meta.glob` 결과 키와 조회 문자열의 정규화가 어긋날 수 있고(그래서 `item-icons.ts` 가 양쪽을 NFC로 정규화한다), 사용자가 영문화를 명시적으로 요구했다.
- 90·12 이외의 게임 수치를 새로 추가하지 마라. 이유: [[ADR-006]] — AI가 게임 수치를 추정해 하드코딩하는 것을 금지한다.
- `countClearedWeeklyBosses`·`selectBossProfitBosses`·`getBossReferenceOrder` 등 기존 export 의 시그니처나 동작을 바꾸지 마라. 이유: 보스 스케줄러(`src/app/boss-scheduler/`)와 보스 수익 스토어가 이미 그 계약에 의존한다. 이번 작업은 **순수 추가**다.
- 기존 테스트를 깨뜨리지 마라
