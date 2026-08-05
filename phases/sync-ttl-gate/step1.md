# Step 1: sync-run-flag

이 task 는 **페이지 이동 API 호출 정책**을 바꾼다([[ADR-097]], 이슈 #139). 화면 진입 자동 재조회에 10분 TTL 을 걸되, **앱을 재시작한 뒤 첫 동기화는 TTL 을 무시하고 반드시 한 번 조회한다**([[ADR-097]] 결정 3).

이 step 은 그 "이번 실행에서 이미 동기화했는가"를 기억하는 **모듈 하나**와, 그것을 표시하는 **호출 지점 2곳**을 만든다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — **TDD: 테스트 먼저**)
- `/docs/README.md` (문서 인덱스)
- `/docs/adr/ADR-097.md` (결정 원장 — 특히 **결정 3**과 "상수와 자리" 절)
- `/src/features/schedule-sync/schedule-sync.ts` (`syncSchedules` — 표시 지점 ①)
- `/src/features/onboarding/prefetch.ts` (`prefetchAccountData` — 표시 지점 ②)
- `/src/lib/sync-freshness.ts` (step 0 산출물 — `SYNC_TTL_MS` · `isSyncFresh`. 이 step 은 그 판정의 **두 번째 조건**을 만든다)

## 작업

### 1. `src/features/schedule-sync/sync-run-state.ts` 신설

```ts
export function markSyncAttemptedThisRun(): void
export function hasSyncAttemptedThisRun(): boolean
export function resetSyncRunStateForTests(): void
```

**모듈 수준 변수 하나**로 구현한다(프로세스 수명 = JS 컨텍스트 수명).

핵심 규칙:

- **저장소(`storage/`·Preferences)에 절대 쓰지 마라.** 이유: "앱을 재시작하면 한 번은 다시 받는다"는 정책이 **정확히 이 플래그가 사라지는 것으로** 성립한다. 영속화하면 그 정책이 죽는다.
- **"성공"이 아니라 "시도"를 기록한다.** 이유: 성공만 기록하면 네트워크가 죽은 동안 탭을 옮길 때마다 실패 호출이 반복된다. 실패했더라도 데이터가 10분 밖이면 `isSyncFresh` 가 `false` 라 다음 진입이 어차피 재시도하므로 복구 경로는 닫히지 않는다.
- `resetSyncRunStateForTests()` 는 **테스트 전용**이다. 파일 주석에 그렇게 적고, 프로덕션 코드에서 부르지 마라.

### 2. 표시 지점 ① — `syncSchedules`

`src/features/schedule-sync/schedule-sync.ts` 의 `syncSchedules` 에서, **`ocids.length === 0` 조기 반환 바로 다음**에 `markSyncAttemptedThisRun()` 을 부른다. 그 지점부터 실제 네트워크가 나가기 때문이다.

`syncSchedules` 는 화면 진입 재조회 말고도 추적 목록 저장(`saveTrackedOcids` 의 added 조회)·수동 모드 시드에서도 불린다. **그 경로도 표시 대상이다** — 실제로 동기화가 일어났다는 사실은 같고, 캐릭터별 신선도는 `isSyncFresh` 가 따로 본다.

### 3. 표시 지점 ② — 온보딩 예열

`src/features/onboarding/prefetch.ts` 의 `prefetchAccountData` 에서, **`characters.length === 0` 조기 반환 다음**에 같은 함수를 부른다.

이유: 예열은 계정 전체 캐릭터의 `character/basic` + `scheduler/character-state` 를 방금 받아 캐시에 쓴다. 그것을 이번 실행의 동기화로 치지 않으면 **온보딩 직후 첫 화면 진입이 방금 받은 것을 그대로 다시 받는다.**

### 4. 테스트

- `src/features/schedule-sync/__tests__/sync-run-state.test.ts` (신설): 초기 상태 `false` → `mark` 후 `true` → `resetSyncRunStateForTests()` 후 `false`.
- `src/features/schedule-sync/__tests__/schedule-sync.test.ts` (기존 파일에 추가): `syncSchedules([])` 는 표시하지 않고, `syncSchedules([ocid])` 는 표시한다.
- `src/features/onboarding/__tests__/prefetch.test.ts` (기존 파일에 추가): `prefetchAccountData` 가 표시한다.

각 테스트는 서로 오염되지 않도록 `beforeEach` 에서 `resetSyncRunStateForTests()` 를 부른다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (신규 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/foundation/architecture.md` 의 레이어 규칙 — 이 모듈은 `features/schedule-sync` 안에 있고 저장소·네이티브를 건드리지 않는다.
   - CLAUDE.md CRITICAL 규칙(로컬 저장소 직접 접근 금지)을 위반하지 않았는가?
3. 결과에 따라 `phases/sync-ttl-gate/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(모듈 경로·함수명·표시 지점 2곳)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **플래그를 영속화하지 마라**(Preferences·localStorage·파일 무엇이든). 이유: 위 1번 규칙 — 앱 재시작 강제 조회가 성립하지 않는다.
- **스토어에 게이트를 붙이지 마라.** 이유: 그것은 step 2~4 의 일이다. 이 step 은 플래그와 표시 지점까지만이다.
- **`syncOneCharacter` 안에서 표시하지 마라.** 이유: 캐릭터마다 불려 의미가 흐려지고, 프리플라이트 실패로 나머지가 폴백만 하는 경우와 구분이 안 된다.
- 기존 테스트를 깨뜨리지 마라.
