# Step 2: world-plumbing

이 task는 GitHub 이슈 **#52**(캐릭터별 주간 보스 진행률 `n/12`)와 **#53**(월드별 주간 결정석 판매 한도 `n/90`)을 함께 구현한다.

이 step은 **`src/features/boss-profit/store.ts` 한 모듈만** 다룬다. #53은 처치 수를 월드별로 합산해야 하는데 지금은 월드 정보가 행까지 내려오지 않는다 — 그 배관 하나만 뚫는 step이다. 화면(`src/app/boss-profit/`)은 이 step에서 건드리지 않는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — TDD: 테스트를 먼저 쓰고 통과시키는 구현을 쓴다. 그리고 `features/*` 는 `storage/` 어댑터를 거친다는 CRITICAL 규칙)
- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 관련 ADR만 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/adr/ADR-054.md` (**이 task의 정책 원장. step 0에서 작성됨 — 반드시 먼저 읽어라**. 특히 결정 5·6)
- `/docs/features/boss-profit.md` (이 화면의 정책 전문)
- `/src/features/boss-profit/store.ts` (이번 step의 유일한 수정 대상. 전체를 읽어라 — 행이 만들어지는 경로가 셋이다)
- `/src/features/boss-profit/__tests__/store.test.ts` (기존 테스트 — 여기에 테스트를 추가한다)
- `/src/types/character.ts` (`CharacterBasicProfile.world` — **옵셔널**이다)
- `/src/storage/character-basic-cache.ts` (`getCachedCharacterBasic` 이 무엇을 돌려주는지)
- `/src/lib/world-emblem.ts` (`worldEmblemUrl` — step 4에서 쓸 것이므로 월드명이 어떤 형태의 문자열인지 확인하라)

## 작업

`BossProfitRow` 에 `world` 를 싣는다. **`imageUrl` 이 이미 정확히 이 경로로 행까지 실려 오고 있으므로 그 선례를 그대로 따른다** — 새 저장소·새 조회·새 구조를 만들지 마라.

### 1. 타입에 `world` 추가

```ts
// BossProfitRow
world: string | null  // character/basic의 world_name(character-basic-cache 경유). 이전 캐시엔 없을 수 있어 null 가능

// SortedCharacterInfo (모듈 내부 타입)
world: string | null

// CharacterProfileInfo (모듈 내부 타입)
world: string | null
```

`CharacterProfileInfo` 에도 넣는 이유는 타입 일관성이다 — 이 타입은 `latestSyncSnapshot.characterProfiles` 와 과거 기간 경로가 공유하는 "캐릭터 프로필 한 덩어리"이고, 한쪽만 `world` 를 갖게 두면 다음에 만지는 사람이 어느 쪽이 진짜인지 헷갈린다.

### 2. 조회 지점 — `getSortedCharacterInfo`

이 함수는 이미 `getCachedCharacterBasic(ocid)` 를 호출해 `cached?.profile.imageUrl` 을 꺼내고 있다. **같은 `profile` 객체에 `world` 가 있으므로 추가 조회 없이 같은 자리에서 함께 꺼내라.** 조회 비용은 늘지 않는다.

정렬 규칙(레벨 내림차순, 동레벨은 이름순)은 **절대 바꾸지 마라** — `world` 는 정렬에 참여하지 않는다.

`cached?.profile.world` 는 `string | undefined` 다. 행에는 `string | null` 로 정규화해서 실어라(`?? null`) — `BossProfitRow.imageUrl` 이 이미 같은 규약이고, 화면에서 `undefined`/`null` 두 가지 부재 표현을 구분할 이유가 없다.

### 3. 행을 만드는 세 경로 전부에 배관

`store.ts` 에서 `BossProfitRow` 가 만들어지는 경로는 셋이며 **전부** 채워야 한다:

1. **캐시 우선 표시 경로** — `refresh()` 안에서 `getCachedSchedulerState(ocid)` 로 만든 행. 이미 `imageUrlByOcid` 맵을 만들어 쓰고 있으니 `worldByOcid` 맵을 같은 자리에서 같은 방식으로 만들어 넘겨라.
2. **실시간 동기화 경로** — `refresh()` 안에서 `syncSchedules(ocids)` 결과로 만든 행. 위와 동일.
3. **과거 기간 경로** — `buildRowsFromRecords()`. 여기도 이미 `getCachedCharacterBasic` 를 호출해 `profileCache` 를 만들고 있으므로 그 캐시 엔트리에 `world` 를 함께 담아 `buildRowFromRecord` 로 넘겨라.

그리고 `refresh()` 가 만드는 두 개의 `characterProfiles` 맵(캐시 단계의 것과 실시간 동기화 단계의 것) 모두 `world` 를 채워라 — `CharacterProfileInfo` 에 필드를 추가했으므로 타입이 강제한다.

`buildBossProfitRow` / `buildRowFromRecord` 의 시그니처는 재량껏 정하라(위치 인자를 하나 더 받아도 되고, 캐릭터 정보를 객체 하나로 묶어도 된다). 다만 **호출부를 빠뜨리지 않도록 타입으로 강제되게** 하라 — 옵셔널 파라미터로 만들어 조용히 `undefined` 가 들어가는 형태는 피하라.

### 4. 손대지 말아야 할 것

- `mergeRecordsIntoRows` 는 `{ ...row, priceMeso, partySize, payoutMeso }` 로 행을 스프레드하므로 `world` 가 자동 보존된다. **여기에 `world` 를 추가로 병합하지 마라** — 기록(`boss_profit_records`)에는 월드가 없고, 있다면 그것이 진실도 아니다(월드는 캐릭터 속성이지 수익 기록 속성이 아니다).
- `sortRowsByOcidOrder` 의 정렬 키에 `world` 를 넣지 마라. 이유: 보스 표시 순서는 [[ADR-036]]이 확정한 규약(ocid 순위 → 보스 정규 순서 → 난이도 → 보스명)이고, 여기에 월드를 끼우면 그 확정된 순서가 바뀐다.
- SQLite 스키마(`src/storage/boss-profit/`, `src/storage/sqlite/db.ts`)를 바꾸지 마라. `world` 는 저장하지 않는다.

## 테스트 (먼저 작성할 것 — TDD)

`src/features/boss-profit/__tests__/store.test.ts` 에 추가하라. 기존 테스트의 목(mock) 구성 방식을 그대로 따라라.

- **캐시 우선 표시 경로**: `getCachedCharacterBasic` 이 `world` 를 가진 프로필을 돌려줄 때, `refresh()` 후 `rows[].world` 가 그 값으로 채워진다.
- **실시간 동기화 경로**: `syncSchedules` 결과로 만들어진 행도 `world` 를 갖는다.
- **월드를 모르는 캐릭터**: `profile.world` 가 `undefined` 인 캐시(구버전 캐시)면 `rows[].world` 가 `null` 이다. `undefined` 가 아니라 `null` 이어야 한다.
- **과거 기간 경로**: `buildRowsFromRecords` 로 만들어지는 과거 기간 행도 `world` 를 갖는다(기간 이동 후 `rows[].world` 확인).
- **회귀 가드**: 캐릭터 정렬 순서(레벨 내림차순 → 이름순)가 `world` 추가 전과 동일하다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 경고 0
npm test        # 전체 통과 — 이 task 시작 시점 베이스라인은 114 파일 / 1312건 전부 통과였다. 실패가 하나라도 남으면 안 된다.
git diff --name-only   # src/features/boss-profit/ 하위와 그 테스트만 나와야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/*` 가 `storage/` 어댑터를 거쳐서만 데이터에 접근하는가(CLAUDE.md CRITICAL — `getCachedCharacterBasic` 은 `storage/character-basic-cache` 의 어댑터다. 네이티브·로컬 저장소에 직접 접근하지 않았는가)?
   - `docs/foundation/architecture.md` 의 레이어 규칙을 지켰는가?
   - ADR 기술 스택을 벗어나지 않았는가?
3. 결과에 따라 `phases/boss-profit-crystal-limit/index.json` 의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`(다음 step이 쓸 `BossProfitRow.world` 의 타입과 부재 표현을 반드시 포함하라)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/app/` 아래 파일을 수정하지 마라. 이유: 화면은 step 3·4의 범위다. 이 step은 스토어 모듈 하나만 다룬다.
- 처치 수를 세는 필드(`clearedCount` 등)를 `BossProfitState` 나 `BossProfitRow` 에 추가하지 마라. 이유: [[ADR-054]] 결정 3 — 처치 수는 화면에서 `rows` 로 파생하며 store에 필드를 신설하지 않는다. 과거 기간 백필 경로에는 `bossContents` 자체가 없어 store 필드를 만들어도 정확히 셀 수 없다.
- `world` 를 SQLite 에 저장하지 마라. 이유: 월드는 수익 기록의 속성이 아니라 캐릭터 속성이고, `character-basic-cache` 가 이미 단일 진실 공급원이다. 두 곳에 두면 갈라진다.
- `getCachedCharacterBasic` 을 새로 한 번 더 호출하지 마라. 이유: `getSortedCharacterInfo` 와 `buildRowsFromRecords` 가 **이미** 호출하고 있다. 같은 자리에서 `world` 를 함께 꺼내면 조회 비용이 늘지 않는다.
- 캐릭터 정렬 규칙과 보스 정렬 규칙([[ADR-036]])을 바꾸지 마라. 이유: 세 데이터 경로(캐시·라이브·과거기록)가 같은 순서를 내도록 고정해둔 것이라, 한 곳만 바뀌면 로드 시점에 따라 순서가 흔들리는 회귀가 되살아난다.
- 기존 테스트를 깨뜨리지 마라
