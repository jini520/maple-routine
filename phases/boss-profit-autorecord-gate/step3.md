# Step 3: record-only-rows

**테스트를 먼저 쓰고(TDD, CLAUDE.md CRITICAL) 통과하는 구현을 하라.**

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `features/boss-profit.md` 를 골라 읽어라)
- `/docs/ADR.md` (슬림 인덱스 — `ADR-111`·`ADR-067`·`ADR-087`·`ADR-097` 만 `/docs/adr/ADR-NNN.md` 로 열어라. **ADR 전체를 컨텍스트에 올리지 마라**)
- `/docs/adr/ADR-111.md` (**이번 작업의 설계 결정 원본 — 특히 결정 F**)
- `/docs/adr/ADR-067.md` (결정 4 — "현재 기간의 행은 API/캐시가 원천, 과거 기간의 행은 기록이 원천"이라는 비대칭과 축약 응답 실측 경로)
- `src/features/boss-profit/store.ts` (**이번 step 의 주 write 대상**. 직전 step 이 고친 캐시 우선 표시 단계를 먼저 정독하라)
- `src/features/boss-profit/rows.ts` (`appendRecordOnlyRows` 의 시그니처와 그 위 주석 — 특히 프로필을 모르면 행을 만들지 않고 건너뛴다는 규약)
- `src/features/boss-profit/auto-record.ts` (`autoRecordRows` — 호출 순서를 정할 때 필요)
- `src/features/boss-profit/__tests__/store.test.ts` (직전 step 이 추가한 `ADR-111` 테스트들 — **깨뜨리지 마라**)

## 배경 — 같은 증상의 두 번째 경로

동기화 완료 분기는 자동 기록 루프 뒤에 `appendRecordOnlyRows` 로 **"기록은 있는데 응답에 행이 없는" 조합을 행으로 되살린다**([[ADR-067]] 결정 4). 실측된 경로는 미접속 캐릭터의 **축약 응답**이다 — 월간 보스를 처치한 뒤 1주 이상 접속하지 않으면 `bossMonthly` 가 `reg=false·comp=false` 로만 남아 행이 만들어지지 않는다(재현: 6.65억 기록 보유 상태에서 "이번 달 총 수익 0메소").

**캐시 우선 표시 단계에는 그 복원이 없다.** [[ADR-097]] 이후 건너뛴 진입은 캐시 단계가 곧 최종 화면이므로, 그런 조합이 총 수익에서 통째로 빠진다 — 이슈 #160 과 같은 증상(총 수익 미달)의 별개 경로다.

동기화 분기가 하는 일과 캐시 분기가 빠뜨린 것을 나란히 보면 이렇다.

| | 동기화 분기 | 캐시 분기 (현재) |
|---|---|---|
| 조회할 기간 키 | 행에서 파생한 키 **∪ 현재 주 키 ∪ 현재 달 키** | 캐시 행에서 파생한 키만 |
| 캐릭터 프로필 맵 | `syncSchedules` 결과 전체(`results`)에서 | 캐시 **행**에서 |
| 기록만 있는 조합 복원 | `appendRecordOnlyRows` | **없음** |

## 작업

`src/features/boss-profit/store.ts` 의 `refresh` 안, **캐시 우선 표시 단계**만 고친다.

### 1. 조회할 기간 키를 넓힌다

캐시 단계의 `cachedPeriodKeys` 를 동기화 분기와 같은 합집합으로 바꾼다 — 캐시 행에서 파생한 키에 **현재 주 키와 현재 달 키를 항상 포함**한다(`getCurrentBossProfitPeriod('weekly', now).periodKey` · `getCurrentBossProfitPeriod('monthly', now).periodKey`).

이유: 행에서 파생한 키만 쓰면 **행이 없는 기간의 기록을 조회조차 하지 않아** 복원할 재료가 애초에 없다. 동기화 분기가 같은 이유로 이미 이렇게 하고 있다.

그리고 기록 조회를 `cachedRows.length > 0` 로 막던 게이트를 **제거한다.** 이유: 캐시 행이 0인 진입(축약 응답으로 전부 사라진 경우)이 정확히 이 결정이 겨누는 시나리오인데, 그 게이트가 그 진입에서 조회를 막는다. 조회를 실제로 수행했으므로 폴백 규약도 직전 step 대로 `null`(실패) 이 그대로 유효하다.

### 2. 캐릭터 프로필 맵을 캐시 **엔트리**에서 만든다

현재 캐시 단계의 프로필 맵은 캐시 **행**(`cachedRows`)에서 만들어진다. 그러면 **축약 응답으로 행이 0인 캐릭터는 프로필이 없어** `appendRecordOnlyRows` 가 그 캐릭터를 통째로 건너뛴다(그 함수는 프로필을 모르면 행을 만들 수 없어 `continue` 한다) — 정확히 이 결정이 고치려는 시나리오가 프로필 부재로 다시 막힌다.

캐시 엔트리를 캐릭터별로 읽는 자리(`getCachedSchedulerState(ocid)` 를 부르는 `Promise.all`)에서 **행과 무관하게** 프로필을 함께 만들어 내보내라. 재료는 이미 그 자리에 다 있다:

- `characterName`: 캐시 엔트리의 `state.characterName`
- `imageUrl` · `world`: 그 위에서 이미 만든 `imageUrlByOcid` · `worldByOcid` (`getSortedCharacterInfo` 결과)

캐시 엔트리 자체가 없는 ocid(`null`)는 프로필도 만들 수 없다 — 그 경우는 지금처럼 건너뛴다.

### 3. 자동 기록 뒤에 복원을 붙인다

동기화 분기와 **같은 순서**를 지켜라.

```
cachedMergedRows  →  autoRecordRows(...)  →  appendRecordOnlyRows(...)  →  sortRowsByOcidOrder(...)
```

- **복원은 `autoRecordRows` 뒤에 온다.** 이유: 복원된 행은 기록에서 만들어져 `partySize` 가 이미 채워져 있으므로 자동 기록 대상이 아니고, 앞에 두면 자동 기록 루프가 그 행들을 헛돈다. 동기화 분기가 이미 이 순서다.
- **복원은 `skipSync` 여부와 무관하게 캐시 단계 일반에 적용한다**([[ADR-111]] 결정 F). 이유: 두 경로가 서로 다른 화면을 그리면 그것이 다음 결함이 된다. 자동 기록만 `skipSync` 에 걸린다.
- **정렬은 마지막에 한 번만** 한다(`sortRowsByOcidOrder`). 복원된 행이 정렬 밖에 남으면 캐릭터 아코디언 순서가 흔들린다([[ADR-036]]).
- 정렬된 최종 행을 캐시 단계의 소비처에 전부 흘려라 — `latestSyncSnapshot`, `cachedWeeklySubtotals`, `loadDropsByRowKey`, `periodState` 판정, `set({ rows: filterRowsForTab(...) })`.
- `previousPeriodTotalMeso` 를 읽을지 판정하는 조건이 캐시 **행 개수**를 보고 있다면, 복원 결과를 반영한 최종 행 개수로 판정하도록 맞춰라([[ADR-087]] 증감 칩이 0 으로 굳지 않게). `skipSync` 인 진입은 지금처럼 항상 읽는다.

### 4. 테스트 추가 (`src/features/boss-profit/__tests__/store.test.ts`)

최소 아래를 고정하라.

1. **캐시에 행이 없고 기록만 있는 조합이 캐시 단계에서 행으로 복원돼 총 수익에 들어간다.** 캐시 엔트리의 `bossContents` 를 비우고(축약 응답 재현) `getBossProfitRecords` 가 그 기간 기록을 돌려주게 한 뒤, 스토어 `rows` 에 그 조합이 나타나고 `payoutMeso` 가 기록값 그대로인지 확인하라.
2. **캐시 행이 0인 캐릭터도 복원 대상이 된다** (프로필을 행이 아니라 캐시 엔트리에서 만든 것의 회귀 가드). 그 캐릭터의 `characterName` 이 복원된 행에 실려 있는지 확인하라.
3. **복원된 행은 자동 기록되지 않는다** — `upsertBossProfitRecord` 가 그 조합으로 호출되지 않는다(이미 기록이 있으므로).
4. **건너뛰지 않는 진입(`skipSync === false`)의 캐시 단계에서도 복원이 일어난다** ([[ADR-111]] 결정 F — 두 경로가 같은 화면을 그린다).
5. **복원 후에도 캐릭터 아코디언 순서가 `sortRowsByOcidOrder` 규약을 따른다.**

직전 step 이 추가한 `ADR-111` 자동 기록 테스트와 `describe('화면 진입 재조회 게이트 (ADR-097)')` 의 게이트 테스트는 **전부 그대로 통과해야 한다.**

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전부 통과
npm run lint    # lint clean
```

추가 확인:

```bash
# 캐시 단계도 복원을 부른다 (동기화 분기와 합쳐 2회 이상 등장)
test "$(grep -c 'appendRecordOnlyRows' src/features/boss-profit/store.ts)" -ge 2 && echo "restored in both branches"
# 직전 step 의 게이트·자동 기록 테스트가 그대로 있다
grep -q "ADR-111" src/features/boss-profit/__tests__/store.test.ts && echo "ok"
grep -q "화면 진입 재조회 게이트 (ADR-097)" src/features/boss-profit/__tests__/store.test.ts && echo "gate tests intact"
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/foundation/architecture.md` 디렉토리 구조를 따르는가?
   - CLAUDE.md CRITICAL: `features/*` 가 로컬 저장소·네이티브 API 에 **직접** 접근하지 않고 `storage/` 어댑터를 거치는가?
   - 건너뛴 진입의 `set()` 이 여전히 **1회**인가([[ADR-097]] 결정 5 정정 3)?
   - 건너뛴 진입의 `syncSchedules` 호출 수가 여전히 **0** 인가?
3. 결과에 따라 `phases/boss-profit-autorecord-gate/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 바뀐 자리와 추가한 테스트 수를 한 줄로
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- **`appendRecordOnlyRows` · `mergeRecordsIntoRows` 의 구현을 고치지 마라.** 이유: 동기화 분기가 같은 함수를 쓰므로 여기서 손대면 이번 이슈와 무관한 경로까지 함께 바뀐다. 이 step 은 **호출부만** 고친다.
- **복원을 `skipSync` 인 진입에만 걸지 마라.** 이유: 건너뛴 진입과 건너뛰지 않은 진입의 캐시 우선 표시가 다른 화면을 그리게 되고, 그 불일치가 다음 결함이 된다.
- **`skipSync` 판정식과 `if (skipSync) return` 을 고치지 마라.** 이유: 네트워크 재조회 정책([[ADR-097]] 결정 1~4)은 이번 작업에서 하나도 바뀌지 않는다.
- **자동 기록 대상에 복원된 행을 포함시키지 마라.** 이유: 복원 행은 기록에서 나온 것이라 `partySize` 가 이미 있고, 다시 기록하면 사용자가 저장한 값을 덮어쓸 위험만 생긴다.
- **`content-scheduler/store.ts` · `boss-scheduler/store.ts` 를 고치지 마라.** 이유: 두 스토어에는 기록 개념 자체가 없다(게이트 뒤가 표시용 `set` 뿐).
- **`src/data/` 의 게임 레퍼런스 수치를 추정해 고치지 마라.** 이유: CLAUDE.md CRITICAL — 반드시 사용자 확인을 거쳐야 한다.
- 기존 테스트를 깨뜨리지 마라
