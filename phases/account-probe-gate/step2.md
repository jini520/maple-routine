# Step 2: callsite-migration

이미 `character/basic` 결과를 캐시에 쓰고 있던 **세 호출부**를 step 1 의 TTL 가드 헬퍼로 갈아 끼운다.
계정 선택 프로브(`use-account-probes.ts`)는 **건드리지 마라** — step 3 의 몫이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 `/docs/adr/ADR-NNN.md` 로 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-113.md` — **이번 phase 의 결정. 특히 결정 1.** step 0 이 만들었다
- `/docs/adr/ADR-016.md` — 예열 + 캐시 우선 표시(SWR)
- `/docs/adr/ADR-086.md` — **결정 5**(자격 판정을 예열·로스터가 공유) · **결정 9**(캐시 인덱스 계정별 분리)
- `/docs/adr/ADR-097.md` — **결정 7**(동기화 편승 `character/basic` 갱신). 그 결정의 "별도 TTL 은 두지 않는다"가 [[ADR-113]] 결정 1 로 정정된 상태다
- `/src/features/schedule-sync/character-basic-fetch.ts` — **step 1 이 만든 헬퍼.** 시그니처와 예외 전파 규칙을 정확히 읽어라
- `/src/features/schedule-sync/__tests__/character-basic-fetch.test.ts` — step 1 이 만든 테스트
- `/src/features/onboarding/prefetch.ts` (전문)
- `/src/features/schedule-sync/character-roster.ts` (전문 — 특히 94~254행)
- `/src/features/schedule-sync/schedule-sync.ts` (200~232행 `refreshCharacterBasics`)
- 각 파일의 기존 테스트: `/src/features/onboarding/__tests__/prefetch.test.ts` ·
  `/src/features/schedule-sync/__tests__/` 아래 로스터·동기화 테스트

## 작업

세 호출부 모두 지금 **`fetchCharacterBasic` 호출 + `setCachedCharacterBasic` 쓰기**를 인라인으로
하고 있다. 그 두 줄을 `fetchCharacterBasicCached(apiKey, accountId, ocid, now)` 한 줄로 바꾼다
(캐시 쓰기는 헬퍼 안으로 들어간다).

### 1. `/src/features/onboarding/prefetch.ts`

- `fetchCharacterBasic` + `setCachedCharacterBasic` → `fetchCharacterBasicCached`.
- `now` 는 이미 함수 상단에 `const now = new Date()` 로 있다. 그것을 넘겨라(새로 만들지 마라).
- **`profile.accessFlag` 를 `resolveCharacterEligibility` 에 넘기는 흐름은 그대로 유지하라**
  ([[ADR-086]] 결정 5). 캐시에서 온 profile 도 `accessFlag` 를 갖고 있으므로 동작이 같다.
- 개별 실패 시 `emit({ completed: 1, total: -1 })` 후 `return` 하는 분기를 그대로 유지하라.

### 2. `/src/features/schedule-sync/character-roster.ts`

- `getCharacterPickerRoster` 안 live 루프(현재 187~191행)의 fetch + 캐시 쓰기를 헬퍼로 교체.
- `now`·`apiKey`·`accountId` 는 이미 그 스코프에 있다.
- **`catch` 블록을 손대지 마라** — `NexonAuthError`/`NexonRateLimitError` 전역 실패 분기,
  `characterUnavailable` 에서 `markScheduleProbeUnavailable` 을 부르는 분기, 그 외 개별 실패에서
  기존 캐시를 유지하는 분기가 전부 그대로여야 한다.
- **stub 단계(현재 114~144행)와 그 사이의 캐시 재조회 루프(154~176행)는 손대지 마라** — 그것들은
  네트워크를 타지 않는 `getCachedCharacterBasic` 직접 읽기이고 [[ADR-053]] 결정 2·[[ADR-017]]
  결정 6 의 산물이다.
- `resolveCharacterEligibility(apiKey, character.ocid, profile.accessFlag, now)` 호출은 그대로.

### 3. `/src/features/schedule-sync/schedule-sync.ts` — `refreshCharacterBasics`

- fetch + 캐시 쓰기를 헬퍼로 교체.
- 이 함수에는 `now` 가 없다. **함수 시작 시점에 `const now = new Date()` 를 한 번 만들고** 모든
  캐릭터가 그것을 공유하게 하라(캐릭터마다 새로 만들지 마라 — 라운드 안에서 기준 시각이 흔들린다).
- **`try/catch` 로 실패를 삼키는 best-effort 성격을 그대로 유지하라.** 이 함수는 절대 throw 하지
  않는다(파일 주석에 이유가 적혀 있다 — 여기서 던지면 스케줄 조회는 성공했는데도 그 캐릭터가
  `isStale: true` 가 된다).
- 그 함수 위 주석의 **"별도 TTL 은 두지 않는다 — 이 함수가 불리는 조건([[ADR-097]] 결정 1~4)이
  그대로 정책이다"** 문장을 정정하라: 이제 [[ADR-113]] 결정 1 의 공유 TTL 가드를 통과하며,
  [[ADR-097]] 의 호출 조건은 그대로 서고 가드가 하나 더 앞에 붙는다는 사실을 적어라.

### 4. 테스트

- 세 파일의 **기존 테스트가 깨지면**, 계약이 실제로 바뀐 것인지 목킹만 낡은 것인지 판별하라.
  - 목킹 문제(예: `fetchCharacterBasic` 을 목킹하던 테스트가 이제 캐시 조회도 태운다)면 목킹을 고쳐라.
  - **계약이 바뀐 것이라면 테스트를 고치기 전에 그것이 의도한 변화인지 확인하라.** 이 step 에서
    의도한 유일한 동작 변화는 "5분 안에 이미 캐시된 ocid 는 네트워크를 타지 않는다"뿐이다.
    그 외 관측 가능한 변화가 있으면 구현이 잘못된 것이다.
- 각 경로에 **"TTL 안이면 네트워크를 타지 않는다"** 회귀 가드 케이스를 1개씩 추가하라
  (예열·피커·동기화 편승 각 1건).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 통과
npm run lint    # 에러 0 (warnings 는 baseline 유지)
# 이 세 파일에는 더 이상 가드 없는 원형 호출이 없어야 한다
! grep -n 'fetchCharacterBasic(' src/features/onboarding/prefetch.ts
! grep -n 'fetchCharacterBasic(' src/features/schedule-sync/character-roster.ts
! grep -n 'fetchCharacterBasic(' src/features/schedule-sync/schedule-sync.ts
# 프로브는 아직 안 건드린 상태여야 한다 (step 3 의 몫)
grep -q 'fetchCharacterBasic(' src/features/onboarding/use-account-probes.ts
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **판별력 확인**: 새로 추가한 "TTL 안이면 네트워크를 타지 않는다" 케이스 3건이, 헬퍼를 원형
   `fetchCharacterBasic` 으로 되돌리면 실제로 실패하는지 확인하고 되돌려라. 결과를 summary 에 적어라.
3. 아키텍처 체크리스트:
   - `features/` 코드가 `storage/`·`native/` 어댑터를 거치는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가?
   - `src/data/` 게임 레퍼런스 수치를 임의로 건드리지 않았는가?
4. 결과에 따라 `phases/account-probe-gate/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`use-account-probes.ts` 를 고치지 마라.** 이유: 프로브는 캐시 쓰기 신설 + 반환 타입 확장이
  함께 걸려 있어 범위가 다르다. step 3 이 한다.
- **UI 파일(`src/app/**`, `src/components/**`)을 고치지 마라.** 이유: 이 step 은 네트워크 경로만
  다룬다. 화면은 step 4·5 의 몫이다.
- **자격 스윕(`resolveCharacterEligibility`) 호출 위치·인자를 바꾸지 마라.** 이유: [[ADR-086]]
  결정 5 가 예열과 로스터가 판정을 공유하도록 짜 놓은 자리다. TTL 가드는 `basic` 만 접는다.
- **`character-roster.ts` 의 stub 단계·SWR 방출 순서를 바꾸지 마라.** 이유: [[ADR-053]] 결정 2 가
  "콜드 스타트에서는 중간 방출을 억제한다"를 그 구조로 고정했다. 이 step 의 변경은 네트워크 호출
  한 줄뿐이어야 한다.
- **기존 테스트를 "깨져서" 지우지 마라.** 이유: 깨진 테스트는 계약 변화의 신호다. 위 "4. 테스트"
  절차대로 판별하고, 삭제가 정답이면 그 이유를 summary 에 남겨라.
