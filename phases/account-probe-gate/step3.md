# Step 3: probe-cache-progress

계정 선택 프로브 훅을 고친다 — ① TTL 가드 헬퍼를 써서 **결과를 캐시에 쓴다** ② **settle 여부와
진행률**을 함께 돌려준다. 화면 쪽 대기 렌더링은 **step 4 의 몫이다**(여기서는 컴파일이 되도록
호출부를 최소로만 손댄다).

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 `/docs/adr/ADR-NNN.md` 로 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-113.md` — **이번 phase 의 결정. 특히 결정 2·3·4·6·7.** step 0 이 만들었다
- `/docs/adr/ADR-068.md` — **결정 4**(전수 프로브를 만든 결정, "캐시에 쓰지 않는다"의 출처 — 결정 2 가 이를 폐기했다)
- `/docs/adr/ADR-086.md` — **결정 8**(조회 불가 계정 선택 차단) · **결정 9**(캐시 인덱스 계정별 분리 — 결정 2 를 가능케 한 구조 변화)
- `/docs/features/onboarding.md` — "계정 선택 프로브" 절(step 0 이 갱신함)
- `/src/features/schedule-sync/character-basic-fetch.ts` — **step 1 이 만든 헬퍼**
- `/src/features/onboarding/use-account-probes.ts` (전문 — 주석 포함)
- `/src/features/onboarding/__tests__/use-account-probes.test.ts` (전문)
- `/src/features/onboarding/representative-character.ts` — `pickRepresentativeCharacter`
- `/src/features/schedule-sync/schedule-sync.ts` 의 `toScheduleSyncError` 사용부 및
  `/src/features/schedule-sync/errors.ts` — `characterUnavailable` 판별
- `/src/storage/api-key.ts` — `getAuthConfig`
- `/src/app/onboarding/AccountSelectionList.tsx` — 이 훅의 호출부(42행)
- `/src/app/onboarding/__tests__/AccountSelectionList.test.tsx` — 훅을 목킹하는 방식

## 배경

### 왜 캐시에 쓰는가 ([[ADR-113]] 결정 2)

`use-account-probes.ts` 상단 주석은 "결과를 `character-basic-cache` 에 쓰지 않는다 — 고르지 않은
계정의 캐릭터까지 캐시에 들어가면 피커의 stub 단계가 다른 계정 캐릭터를 보여준다"고 적고 있다.

**그 근거는 이미 무효다.** 그 주석은 [[ADR-068]] 결정 4(2026-07-31) 시점 것이고 그때는 캐시
인덱스가 전역이었다. [[ADR-086]] 결정 9(2026-08-03)가 인덱스를 계정별로 쪼갰다 —
`characterBasicCacheIndexKey(accountId)`, 그리고 stub 단계는
`getAllCachedCharacterBasicOcids(accountId)` 로 **해당 계정 것만** 읽는다. 누출은 구조적으로
불가능해졌는데 프로브 쪽 동작과 주석만 남았다.

### 왜 settle 이 성공이 아닌가 ([[ADR-113]] 결정 4)

현재 `load()` 는 `getAuthConfig()` 가 `null` 이면 **`setProbes` 를 한 번도 부르지 않고 조기
return** 한다. 지금은 목록이 이미 떠 있어 티가 안 나지만, step 4 가 "settle 전에는 목록을 그리지
않는다"로 바꾸면 이 경로에서 화면이 **영원히 로딩**이 된다. 완료 판정은 반드시 settle 기준이어야
한다.

## 작업

### 1. `/src/features/onboarding/use-account-probes.ts`

**반환 타입을 확장한다:**

```ts
export interface AccountProbesState {
  probes: Record<string, AccountProbe>
  /** 전수 프로브가 **settle** 했는가 — "성공"이 아니다([[ADR-113]] 결정 4). */
  isSettled: boolean
  /** completed = settle 한 캐릭터 수, total = 전 계정 캐릭터 수의 합. */
  progress: { completed: number; total: number }
}

export function useAccountProbes(accounts: MapleAccount[]): AccountProbesState
```

`AccountProbe` 인터페이스 자체는 그대로 둔다(필드 3개).

**동작 규칙 — 설계 의도에서 벗어나면 안 되는 것:**

- **`fetchCharacterBasic` 대신 `fetchCharacterBasicCached(authConfig.apiKey, account.accountId,
  character.ocid, now)` 를 쓴다.** `accountId` 는 반드시 **그 캐릭터가 속한 계정의 것**이어야 한다
  — 전 계정을 훑으므로 여기서 틀리면 다른 계정 인덱스가 오염된다([[ADR-086]] 결정 9 가 막은 바로
  그 문제가 되살아난다).
- `now` 는 `load()` 시작 시점에 `const now = new Date()` 로 **한 번** 만들어 전 계정이 공유한다.
- **`isSettled` 는 settle 기준이다.** 아래 모두 `true` 로 끝나야 한다:
  - `getAuthConfig()` 가 `null` 이라 조기 return 하는 경로 ← **가장 중요하다. 무한 로딩의 원인**
  - `accounts` 가 빈 배열이라 아무것도 안 도는 경로
  - 개별 캐릭터 fetch 가 실패한 경우(003·네트워크 무관)
  - 즉 `load()` 가 **어떤 경로로든 끝나면** `true` 다. `finally` 로 처리하는 것이 가장 안전하다.
- **`cancelled` 이후에는 어떤 state 도 쓰지 마라.** 언마운트 후 `setState` 경고를 만들지 않는다.
- **`accounts` 참조가 바뀌면 상태를 초기화한다** — effect 재실행 시 `probes` 를 `{}` 로,
  `isSettled` 를 `false` 로, `completed` 를 `0` 으로 되돌려라. 아니면 이전 계정 목록의 프로브
  결과가 새 목록에 얹힌다.
- **`total` 은 state 가 아니라 `accounts` 에서 매 렌더 파생하라**
  (`accounts.reduce((sum, a) => sum + a.characters.length, 0)`). 이유: 첫 렌더부터 총량이 정확해야
  step 4 의 진행률이 0/0 으로 시작하지 않는다.
- **`completed` 는 캐릭터 단위로 증가한다** — 계정 단위가 아니다. `fetch` 가 성공이든 실패든
  settle 한 순간 +1. 함수형 `setState`(`(prev) => prev + 1`)를 써라(동시 갱신이 유실되지 않게).
- **자격 스윕(`resolveCharacterEligibility`)을 여기서 부르지 마라** ([[ADR-113]] 결정 6). 이유:
  `scheduler/character-state` 는 선택 계정만 부르는데 이걸 당기면 **안 고를 계정 몫이 새 호출로
  추가**되어 이슈 #158(429)을 악화시킨다. 그리고 003 판별에 스윕은 필요 없다.
- **실패 처리 규칙은 그대로 유지하라** ([[ADR-113]] 결정 7): 400 `OPENAPI00003`
  (`toScheduleSyncError(error).kind === 'characterUnavailable'`)만 `unavailableOcids` 에 넣고,
  그 외 실패는 후보 자격을 유지하며 초상화만 비운다.
- `representative`·`portraitUrl`·`allUnavailable` 계산 로직은 그대로 둔다.

**주석을 정정하라** — 33~37행의 "결과를 character-basic-cache에 쓰지 않는다" 문단을, 이제 쓴다는
사실과 그 근거([[ADR-086]] 결정 9 로 인덱스가 계정별이 되어 누출이 불가능, [[ADR-113]] 결정 2)로
바꿔라. 옛 이유를 **왜 더 이상 유효하지 않은지**까지 남겨라(이 저장소의 주석 관례다).

### 2. 호출부 컴파일 수습 (최소 변경)

`/src/app/onboarding/AccountSelectionList.tsx` 42행:

```ts
const probes = useAccountProbes(props.accounts)
```
→
```ts
const { probes } = useAccountProbes(props.accounts)
```

**이 파일에서 허용되는 변경은 이 한 줄뿐이다.** 대기 렌더링·테스트 뒤집기는 step 4 가 한다.

`/src/app/onboarding/__tests__/AccountSelectionList.test.tsx` 의 `mockedUseAccountProbes
.mockReturnValue({...})` 들은 이제 `{ probes, isSettled, progress }` 형태를 돌려줘야 한다.
**기계적으로 감싸기만 하라** — 기존 `{...}` 를 `probes` 로 넣고 `isSettled: true`,
`progress: { completed: N, total: N }` 를 붙인다. **단언(assertion)은 한 줄도 바꾸지 마라.**

### 3. `/src/features/onboarding/__tests__/use-account-probes.test.ts` (TDD — 먼저 작성)

기존 케이스를 새 반환 타입에 맞게 갱신하고, 아래를 **추가**하라:

- 프로브 결과가 `setCachedCharacterBasic` 을 통해 **그 캐릭터가 속한 계정의 `accountId`** 로
  캐시에 들어간다(계정이 2개인 픽스처로 각각 확인).
- **`getAuthConfig()` 가 `null` 이면 `isSettled` 가 `true` 가 된다** ← 무한 로딩 회귀 가드.
  네트워크 호출은 0회여야 한다.
- `accounts` 가 빈 배열이면 `isSettled: true`, `progress: { completed: 0, total: 0 }`.
- `progress.total` 이 전 계정 캐릭터 수의 합이다.
- 개별 fetch 실패도 `completed` 를 증가시키고, 전부 실패해도 `isSettled` 가 `true` 가 된다.
- 이미 TTL 안에 캐시된 ocid 는 네트워크를 타지 않는다(헬퍼 통과 확인).
- `accounts` 가 바뀌면 `isSettled` 가 다시 `false` 로 돌아간다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 통과
npm run lint    # 에러 0 (warnings 는 baseline 유지)
! grep -n 'fetchCharacterBasic(' src/features/onboarding/use-account-probes.ts   # 원형 호출 0건
grep -q 'isSettled' src/features/onboarding/use-account-probes.ts
# AccountSelectionList 는 아직 대기 UI 가 없어야 한다 (step 4 의 몫)
! grep -q 'ProgressBar' src/app/onboarding/AccountSelectionList.tsx
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **판별력 확인**: `load()` 의 `finally` 를 지우고 성공 경로에서만 `isSettled = true` 로 바꾸면
   "`getAuthConfig()` 가 `null` 이면 `isSettled` 가 `true`" 케이스가 실패하는지 확인하고 되돌려라.
   실패하지 않으면 그 테스트는 무한 로딩을 막지 못한다. 결과를 summary 에 적어라.
3. 아키텍처 체크리스트:
   - `features/` 코드가 `storage/`·`native/` 어댑터를 거치는가(`@capacitor/preferences` 직접 접근 0건)?
   - 훅이 `features/` 에, 화면이 `app/` 에 있는 분리를 지켰는가?
   - `CLAUDE.md` CRITICAL 규칙(TDD·어댑터 레이어)을 지켰는가?
4. 결과에 따라 `phases/account-probe-gate/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`AccountSelectionList.tsx` 에 대기 렌더링을 넣지 마라.** 이유: step 4 가 그 화면의 마크업·
  테스트 뒤집기를 함께 다룬다. 여기서 미리 넣으면 두 step 의 diff 가 섞여 회귀 추적이 끊긴다.
  이 파일에서 허용되는 변경은 구조 분해 한 줄뿐이다.
- **`AccountSelectionList.test.tsx` 의 단언을 바꾸지 마라.** 이유: 뒤집어야 할 계약
  (`프로브가 끝나기 전에는 경고를 띄우지 않는다` 등)은 step 4 가 TDD 로 먼저 뒤집는다. 여기서는
  목 반환값의 **형태만** 맞춘다.
- **`resolveCharacterEligibility` 나 `scheduler/character-state` 를 프로브에 넣지 마라.**
  이유: [[ADR-113]] 결정 6 — 안 고를 계정 몫이 새 호출로 추가되어 이슈 #158 을 악화시킨다.
- **`markScheduleProbeUnavailable` 을 프로브에서 부르지 마라.** 이유: [[ADR-113]] 이 명시적으로
  범위 밖으로 남긴 항목이다(피커의 live 루프가 여전히 전원에게 `basic` 을 부르므로 호출 절감이 없다).
- **`AccountProbe` 인터페이스의 필드를 바꾸지 마라.** 이유: 화면과 테스트가 그 세 필드에 걸려 있고,
  이번 결정이 바꾸는 것은 "언제 보여주는가"이지 "무엇을 보여주는가"가 아니다.
- **기존 테스트를 깨뜨리지 마라.**
