# Step 0: docs-policy

이 task는 GitHub 이슈 **#52**(보스 수익 — 캐릭터별 주간 보스 진행률 `n/12` 표시)와 **#53**(보스 수익 — 월드별 주간 결정석 판매 한도 `n/90` 표시)을 함께 구현한다. 두 이슈는 **같은 파생 로직**(그룹 하나 → 주간 보스 처치 수)을 공유하므로 한 task로 묶었다.

이 step은 **문서 전용**이다. `src/` 는 한 줄도 건드리지 않는다(프로젝트 규칙: docs-first).

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — docs-first, TDD, ADR-006 게임 데이터 규칙)
- `/docs/README.md` (문서 인덱스 — 이 작업의 대상 문서를 확인하라)
- `/docs/ADR.md` (슬림 인덱스 — 관련 ADR만 `/docs/adr/ADR-NNN.md` 로 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/features/boss-profit.md` (이 화면의 현재 정책 전문 — 이번 변경의 주 대상)
- `/docs/foundation/game-data.md` (`src/data/*.json` 정책 — `weekly-bosses.json` 항목)
- `/docs/adr/ADR-046.md` (총 수익 헤드라인 설계 — 이번에 여기에 줄을 추가한다)
- `/docs/adr/ADR-049.md` (헤드라인 라벨행 뱃지를 `absolute` 로 뺀 이유 — 이번 배치 결정의 근거)
- `/src/app/boss-profit/BossProfitScreen.tsx` (특히 `buildCharacterGroups`, `collectGroupValuableDrops`, `collectAllValuableDrops`, 총 수익 헤드라인 JSX)
- `/src/features/boss-profit/store.ts` (`BossProfitRow` 인터페이스, `filterRowsForTab`, `buildRowsFromRecords`)
- `/src/lib/boss-matching.ts` (`REFERENCE_ENTRIES` 의 `isSeasonBoss` 태깅, `WEEKLY_BOSS_CLEAR_LIMIT`, `getBossReferenceOrder`)
- `/src/data/weekly-bosses.json` (`weeklyBossSelectionLimit`, 상단 `note`)

## 작업

### 1. `docs/adr/ADR-054.md` 신설

ADR-051·052·053은 이미 다른 task가 선점했다. **반드시 ADR-054를 쓴다.**

제목: `ADR-054: 보스 수익 — 주간 보스 처치 수 표시(캐릭터별 n/12 · 월드별 결정석 판매 한도 n/90)`

기존 ADR 파일들(`docs/adr/ADR-049.md` 등)의 서식(배경 → 결정 N → 트레이드오프/결과 → 상태)을 그대로 따르되, 아래 결정을 **전부** 담아라. 값은 전부 사용자(도메인 전문가)가 2026-07-29에 확정한 것이며, AI가 추정한 수치는 하나도 없다([[ADR-006]]).

- **결정 1 — 주당 결정석 판매 한도 90은 "월드당" 이다.** 계정 전체가 아니라 월드마다 각각 90개다. 한 메이플 ID의 캐릭터가 여러 월드에 흩어져 있으면 월드별로 따로 센다. 주간 보스만 포함하고(월간 보스 = 검은마법사의 결정석은 90에 포함되지 않는다), 시즌 보스(메이린)는 제외하며, 안 판 결정석은 다음 주로 **이월되지 않는다**(매주 초기화).
- **결정 2 — 캐릭터당 한도 12와 월드당 한도 90은 별개 지표다.** `weeklyBossSelectionLimit: 12` = 캐릭터당 주간 보스 등록/처치 한도, 신설할 `weeklyCrystalSaleLimit: 90` = 월드당 주간 결정석 판매 한도. 이름이 비슷해 혼동하기 쉬우므로 `weekly-bosses.json` 에서 나란히 두고 상단 `note` 에 차이를 명시하며, `boss-matching.ts` 에서도 `WEEKLY_BOSS_CLEAR_LIMIT` 옆에 `WEEKLY_CRYSTAL_SALE_LIMIT` 을 나란히 export 한다.
- **결정 3 — 처치 수는 store 필드를 신설하지 않고 화면에서 `rows` 로 파생한다.** `BossProfitRow` 는 이미 `isComplete`·`cycle`·`boss` 를 갖고 있고, 주간 탭 `rows` 는 `filterRowsForTab` 이 `cycle === 'weekly'` + 현재 기간만 남긴다. 따라서 `distinct(bossRows.filter(r => r.isComplete && !isSeasonBossName(r.boss)).map(r => r.boss)).length` 가 그 캐릭터의 주간 처치 수다. 이 값의 의미는 보스 스케줄러가 쓰는 `countClearedWeeklyBosses`(등록 여부 무관·실제 처치·난이도 중복은 1)와 일치한다. **#52와 #53은 이 함수 하나를 공유한다** — 계산을 두 벌 만들지 않는다.
- **결정 4 — 표시 범위는 주간 탭 · 현재 기간 한정.** 이유는 두 가지다. ① 월간 탭 `rows` 에는 `cycle === 'monthly'` 만 담겨 주간 처치 수를 파생할 수 없고, 애초에 주간 한도는 월간 탭에서 의미가 없다(보스 스케줄러도 주간 탭에서만 배지를 렌더한다). ② 과거 기간 `rows` 는 DB 기록에서 오는데 **가격 미확정 보스(벨로나)는 애초에 기록되지 않아**(백필·자동 기록 모두 `priceMeso === null` 이면 건너뜀) 실제보다 적게 나온다. 이는 store에 카운트 필드를 신설해도 해결되지 않는다 — 과거 기간 백필 경로에는 `bossContents` 자체가 없기 때문이다. 게다가 결정석은 이월 없이 매주 초기화되므로 현재 기간만 보여주는 것이 의미상으로도 정확하다.
- **결정 5 — 월드 정보는 `imageUrl` 과 동일한 경로로 행까지 배관한다.** `getSortedCharacterInfo` 가 이미 `getCachedCharacterBasic(ocid)` 를 호출해 `imageUrl` 을 꺼내고 있고 같은 `profile` 에 `world` 가 있으므로 **추가 조회 비용 없이** 함께 꺼낸다. 새 저장소·새 API 호출을 만들지 않는다.
- **결정 6 — 월드를 모르는 캐릭터는 집계에서 제외한다.** `CharacterBasicProfile.world` 는 옵셔널이다("이전 캐시엔 없을 수 있어 옵셔널"). 어느 월드 한도에도 넣을 수 없으므로 "미분류" 줄을 만들지 않고 조용히 뺀다. 트레이드오프로 그 캐릭터의 처치 수만큼 월드 합계가 실제보다 적게 나오지만, 캐릭터 카드의 `n/12` 배지는 월드와 무관하게 그대로 표시되므로 개별 진행률 정보는 잃지 않는다.
- **결정 7 — 월드가 하나면 한 줄, 여러 개면 한 줄 + 탭 시 펼침.** 헤더는 `ResizeObserver` 로 실측돼 펼친 카드 sticky 오프셋에 쓰이므로 높이 변화 자체는 자동 반영되지만, 월드 수만큼 줄이 늘면 헤더가 목록 영역을 잠식한다. 그래서 접힘 상태는 항상 한 줄로 고정한다 — 단일 월드는 `34 / 90`(월드 수 표기·펼침 토글 없음), 복수 월드는 `46 / 180` + `2개 월드` + chevron, 탭하면 월드별(엠블럼 + 월드명 + `n / 90`) 줄이 펼쳐진다. 복수 월드의 분모는 `90 × 월드 수` 다.
- **결정 8 — 월간 탭은 한도 없이 결정석 개수만 표시한다.** 90은 주간 전용 한도이고 월간 보스 결정석은 거기 포함되지 않으므로(결정 1), 월간 탭에는 분모 없이 월간 결정석 아이콘 + 처치 수만 둔다(`3개`). 월드별 분해도 하지 않는다 — 분모가 없으면 월드 단위로 나눌 이유가 없다.
- **결정 9 — 배치는 총 수익 헤드라인의 금액행 아래 새 줄.** 라벨행 우측은 기간 전체 고가 드롭 뱃지가 이미 `absolute` 로 점유하고 있고, 그 뱃지를 흐름 밖에 둔 이유가 있다([[ADR-049]] — 뱃지 유무로 라벨행이 16↔24px로 튄다). 같은 자리에 흐름으로 끼워 넣으면 그 회귀를 되살린다.
- **결정 10 — 결정석 아이콘은 `item-icons.json` 에 등록하지 않는다.** `src/data/__tests__/item-icons.test.ts` 가 "매핑된 아이템명은 모두 `item-drop-table.json` 에 실재한다"를 강제하는데, 결정석은 드랍 테이블 항목이 아니라 UI 표시 전용 아이콘이다. 따라서 솔 에르다 단위 분해 아이콘과 동일하게 `getItemIconUrlByFile(fileName)` 로 파일명 직접 조회한다.

트레이드오프/한계 섹션에 아래를 명시하라:
- **앱이 추적하지 않는 캐릭터의 처치는 셀 수 없다.** 90은 월드 단위 한도인데 앱은 사용자가 고른 추적 캐릭터만 동기화한다([[ADR-042]]). 같은 월드의 추적 밖 캐릭터로 보스를 잡으면 실제 소진량보다 적게 표시된다. 이번 범위에서는 UI에 별도 주석 문구를 넣지 않는다(헤드라인을 더 늘리지 않기 위함) — 필요해지면 후속 결정으로 다룬다.
- 한 월드에 추적 캐릭터가 8명을 넘으면 월드 한도(90)가 캐릭터 한도(12×8=96)보다 먼저 걸린다. 이 표시가 필요한 이유가 그 지점이다.

상태는 **`(설계, 구현 전)`** 으로 적는다. step 5(docs-finalize)에서 `(구현 완료)` 로 바꾼다.

### 2. `docs/ADR.md` 인덱스에 한 줄 추가

기존 표의 마지막 행(ADR-053) 다음에 ADR-054 한 줄을 append 한다. 표 형식과 문체를 그대로 따르고, 상태는 `(설계, 구현 전, 이슈 #52·#53)` 로 적는다.

### 3. `docs/features/boss-profit.md` 갱신

- 상단 인덱스 헤더의 **관련 ADR** 목록에 `[[ADR-054]]` 를 추가한다.
- `## UI` 섹션의 `### 총 수익 헤드라인 (sticky 헤더 최하단) — [[ADR-046]]` 항목 아래에, 금액행 다음 줄로 들어가는 **결정석 판매 현황 줄**의 레시피를 기존 문서와 같은 코드블록 스타일로 기술하라. 캐릭터 카드 헤더의 `n/12` 배지는 `### 아코디언 (캐릭터별 드롭다운)` 의 **헤더** 항목에 한 줄 추가한다(배지 스타일은 보스 스케줄러 것을 그대로 재사용한다는 점 명시 — 신규 스타일 금지가 이 프로젝트 관례다).
- 표시 범위(주간 탭 · 현재 기간 한정)와 그 이유를 `## 정책` 또는 위 UI 항목에 명시하라.
- **아래 레시피를 그대로 문서에 옮겨라.** 이후 step 3·4가 이 문서를 읽고 구현하므로, 여기서 확정한 클래스가 곧 구현이다. 새 색·새 토큰을 만들지 마라(`primary`·`text-muted`·`text` 만 쓴다):

```
캐릭터 카드 헤더 배지 (#52) — 주간 탭 · 현재 기간에만
배지: rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary
      (보스 스케줄러 BossScreen.tsx의 주간 처치 수 배지와 동일 — 신규 스타일 금지)
  안쪽: 결정석 아이콘 img h-4 w-4 flex-none object-contain + "8/12"
위치: 캐릭터명(flex-1)과 금액 사이 = 금액 왼쪽
높이: 24px — 아바타(h-8 = 32px)가 헤더 높이를 정하므로 배지를 넣어도 헤더 높이는 불변이어야 한다
```

```
총 수익 헤드라인 결정석 줄 (#53) — 금액행 다음, 헤어라인(mt-3 h-px bg-border) 위
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
- 문서 하단 `## 열린 질문` 을 점검해, 이번 변경으로 해소되는 항목이 있으면 정리하라.

### 4. `docs/foundation/game-data.md` 갱신

`## 게임 데이터 파일` 의 **`weekly-bosses.json`** 항목에 `weeklyCrystalSaleLimit`(90) 설명을 추가한다. `weeklyBossSelectionLimit`(12)과의 차이(캐릭터당 vs 월드당, 월간 보스 제외, 이월 없음)를 반드시 한 문장으로 구분해 적어라 — 이름이 비슷해 혼동하기 쉽다는 것이 이 문서화의 목적이다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음(이 step은 src/ 무변경이므로 그대로 통과해야 한다)
npm test        # 테스트 통과(이 step은 src/ 무변경이므로 그대로 통과해야 한다)
git diff --name-only            # docs/ 하위 파일만 나와야 한다
grep -rn "ADR-054" docs/         # ADR.md 인덱스·ADR-054.md·boss-profit.md 에서 잡혀야 한다
grep -n "weeklyCrystalSaleLimit" docs/foundation/game-data.md docs/adr/ADR-054.md
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/README.md` 가 정한 문서 계층(features / foundation / adr)을 지켰는가?
   - ADR 전문은 `docs/adr/ADR-054.md` 에 있고 `docs/ADR.md` 에는 한 줄만 추가했는가?
   - CLAUDE.md CRITICAL 규칙(게임 수치는 사용자 확정값만 — 여기서는 90, 12만 사용)을 위반하지 않았는가?
3. 결과에 따라 `phases/boss-profit-crystal-limit/index.json` 의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/` 아래 어떤 파일도 수정하지 마라. 이유: 이 프로젝트는 docs-first 이며, 이 step의 산출물은 이후 step들이 참조할 "합의된 정책"이다. 코드가 먼저 들어가면 정책이 코드를 사후 정당화하게 된다.
- ADR-051·052·053 번호를 재사용하지 마라. 이유: 이미 다른 task가 그 번호로 파일을 만들어 두었다(`docs/adr/ADR-051.md`~`ADR-053.md` 실재).
- `docs/ADR.md` 에 ADR 전문을 쓰지 마라. 이유: 그 파일은 슬림 인덱스이고, 전문은 `docs/adr/ADR-NNN.md` 개별 파일에 둔다(CLAUDE.md 규칙).
- 기존 정책 문장을 삭제하지 마라. 이유: 정책을 바꿀 땐 지우지 말고 각 문서 하단 "폐기된 정책 (history)" 섹션으로 옮기는 것이 이 저장소의 규칙이다. 다만 이번 변경은 기존 정책을 폐기하지 않는 **순수 추가**이므로 history 로 내릴 항목이 없을 가능성이 높다.
- 90·12 이외의 게임 수치를 새로 만들어 넣지 마라. 이유: [[ADR-006]] — AI가 게임 수치를 추정해 하드코딩하는 것을 금지한다. 사용자가 확정한 값은 이 두 개뿐이다.
- 기존 테스트를 깨뜨리지 마라
