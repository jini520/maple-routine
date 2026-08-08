# Step 3: sync-toast-rewire

이 step 은 **동기화 401 을 무효화 진입점으로 위임**한다. 스케줄러 3화면의 `설정 열기` 액션이 사라지고,
그 자리에 자동 이동이 들어간다. 피커의 문구·prop 정리는 step 4, 설정 모달은 step 5 다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-115.md` — **step 0 이 만든 이 phase 의 결정**. 이 step 의 계약은 **결정 1**(토스트에
  액션을 두지 않는다) · **결정 2**(상태를 뒤집으면 App 가드가 라우터로 보낸다) · **결정 7**(401 감지
  지점 전부가 진입점 하나를 부른다, `설정 열기` 제거)이다
- `/docs/adr/ADR-063.md` — 동기화 실패를 인라인에서 토스트로 옮긴 결정(이 훅이 존재하는 이유)
- `/docs/adr/ADR-062.md` — **결정 3**. 이 phase 의 [[ADR-115]] 결정 7 이 그 목적지를 폐기한다
- `/docs/foundation/error-resilience.md` — **원칙 3**(step 0 이 갱신했다)
- `/src/features/schedule-sync/use-sync-error-toast.ts` (전문)
- `/src/features/schedule-sync/__tests__/use-sync-error-toast.test.tsx` (전문)
- `/src/features/schedule-sync/format.ts` (`formatScheduleSyncError` — **고치지 않는다**, 아래 참조)
- `/src/features/schedule-sync/errors.ts` (`ScheduleSyncError`)
- `/src/app/content-scheduler/ContentScreen.tsx` (**88~91행** 전역 · **167~170행** 캐릭터별 ·
  **118~132행** 로스터 조회 catch)
- `/src/app/boss-scheduler/BossScreen.tsx` (**141~144행** · **229~232행** · **179~186행** 로스터 catch)
- `/src/app/boss-profit/BossProfitScreen.tsx` (**418~421행** — 이 화면에는 로스터 조회가 없다)
- **step 1 이 만든 것**: `features/onboarding/store.ts#invalidateApiKey()` — **멱등 가드가 안에 있다**
  (`status !== 'completed'` 면 no-op)

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `src/features/onboarding/use-api-key-invalidation.ts` 신설

```ts
/**
 * 스케줄 동기화·로스터 조회가 401/403 으로 실패하면 키 무효화 경로로 넘긴다([[ADR-115]] 결정 7).
 * 이동·토스트·저장소 삭제는 전부 invalidateApiKey() 안에 있고, 중복 호출은 그 안의 멱등 가드가 막는다.
 */
export function useApiKeyInvalidation(error: ScheduleSyncError | null): void
```

- `error?.kind === 'invalidApiKey'` 일 때만 `void useOnboardingStore.getState().invalidateApiKey()` 를
  부른다. effect dep 은 `error` 하나다(스토어가 실패마다 새 객체를 set 하므로 그 값 자체가 가드 키로
  쓰인다 — `use-sync-error-toast.ts` 상단 주석의 같은 근거).
- **여기에 자체 중복 가드(ref)를 만들지 마라.** 멱등은 `invalidateApiKey()` 안의
  `status !== 'completed'` 가드가 이미 보장한다([[ADR-115]] 결정 6). 가드를 두 겹으로 두면 어느 쪽이
  진짜인지 알 수 없어진다.
- **왜 `features/onboarding/` 에 두는가**: 이 훅이 다루는 것은 동기화가 아니라 **온보딩 상태**다.
  `ScheduleSyncError` 는 **타입만** import 한다(`import type`).
- 순환 import 를 만들지 않는지 확인하라 — `features/onboarding/store.ts` 는 `prefetch.ts` 를 거쳐
  `features/schedule-sync/character-basic-fetch` 등을 쓰지만 `use-sync-error-toast` 는 쓰지 않는다.
  `npm run build` 가 통과하는지로 확인한다.

### 2. `use-sync-error-toast.ts` — 401 분기를 위임

- 훅 맨 위에서 `useApiKeyInvalidation(error)` 를 부른다.
- **`invalidApiKey` 토스트 분기(49~57행)를 제거한다.** 그 종류는 이제 이 훅이 아무 토스트도 띄우지
  않는다 — 문구는 `invalidateApiKey()` 가 띄우고([[ADR-115]] 결정 1), 액션은 **없다**(이동이 이미
  일어나 누를 것이 없다).
- **`actions` 파라미터에서 `onOpenSettings` 를 제거한다** → `{ onRetry: () => void }` 만 남는다.
- 상단 주석의 **"왜 스토어가 아니라 화면(훅)에서 띄우는가"(15~17행)** 를 갱신하라 — 그 근거
  ("invalidApiKey 의 액션이 설정 화면으로 보내는 것이라 라우터가 필요하다")는 **이제 사실이 아니다**.
  새 사실을 적어라: 이동은 온보딩 상태를 뒤집는 것으로 일어나고 `App.tsx` 가드가 라우터로 보내므로
  ([[ADR-115]] 결정 2) 이 훅도 스토어도 라우터를 모른다. 훅이 남는 이유는 **나머지 종류의 재시도
  액션이 화면의 `refresh` 를 필요로 하기 때문**이다.
- `Settings` 아이콘 import 가 고아가 되면 지워라.
- **`formatScheduleSyncError` 의 `invalidApiKey` case 를 지우지 마라.** 이유: `switch` 의
  `assertNever` 소진 가드가 깨지고, `format.test.ts`·`to-schedule-sync-error.test.ts` 가 6종 전부를
  단언한다. 이 훅에서 도달하지 않게 될 뿐이다.

### 3. 3화면 배선

- `ContentScreen.tsx` **90행**·**169행**, `BossScreen.tsx` **143행**·**231행**,
  `BossProfitScreen.tsx` **420행** — `useScheduleSyncErrorToast` 호출에서 `onOpenSettings` 줄을 지운다.
- `ContentScreen.tsx`·`BossScreen.tsx` 에 **로스터 조회 실패용 배선**을 추가한다: 로스터 catch 가
  담는 `rosterError` state 를 `useApiKeyInvalidation(rosterError)` 에 넘긴다. 피커 로스터가 401 을
  맞았을 때도 같은 경로를 타야 한다([[ADR-115]] 결정 7). `BossProfitScreen` 에는 로스터 조회가 없으니
  **추가하지 마라**.
- **`CharacterTrackingPicker` 의 `onOpenSettings` prop 은 이 step 에서 그대로 둔다**(ContentScreen:283 ·
  BossScreen:361). 그 prop 을 없애려면 먼저 `format.ts` 가 `openSettings` 를 반환하지 않아야 하고,
  그것이 step 4 다.
- `navigateToScreen` 은 세 화면 모두 다른 곳에서 계속 쓰이므로 **선언을 지우지 마라**(고아가 아니다).

### 4. 테스트

**`src/features/schedule-sync/__tests__/use-sync-error-toast.test.tsx`**:

- `invalidApiKey` 케이스를 **뒤집어라** — 이 훅은 그 종류에서 **`showError` 를 부르지 않고**,
  대신 `invalidateApiKey` 가 1회 불린다. `useOnboardingStore` 를 모킹하되, `getState().invalidateApiKey`
  를 spy 로 잡는 형태가 가장 단순하다.
- **회귀 가드**: `rateLimited`·`characterUnavailable`(액션 없음)·`network`(다시 시도) 케이스는 지금
  그대로 통과해야 한다 — 이 phase 가 바꾸는 것이 **401 뿐**임이 이 테스트로 증명된다.
- 같은 `invalidApiKey` 에러 객체로 재렌더될 때 `invalidateApiKey` 가 다시 불리지 않는지도 확인하라.

**`src/app/content-scheduler/__tests__/ContentScreen.test.tsx`** ·
**`src/app/boss-scheduler/__tests__/BossScreen.test.tsx`**:

- `설정 열기` 를 단언하는 기존 케이스를 찾아 **새 동작으로 고쳐라** — 토스트에 `설정 열기` 버튼이
  없고, 401 이면 `invalidateApiKey` 가 불린다.
- 로스터 조회가 401 로 실패했을 때 `invalidateApiKey` 가 불리는 케이스를 최소 1건 추가하라.
- `ContentCharacterStep.test.tsx` 의 `설정 열기` 는 **건드리지 마라** — 온보딩 자리(`place='onboarding'`)는
  애초에 그 액션을 받지 않으며, 그 파일의 문자열은 다른 맥락이다. 확인만 하고 넘어가라.

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 없음(순환 import 확인 포함)
npm test                                         # 전부 통과
npm run lint                                     # errors 0 (warnings 17 은 baseline)
# 동기화 토스트 경로에서 설정 열기가 사라졌다
grep -c 'onOpenSettings' src/features/schedule-sync/use-sync-error-toast.ts     # 0
grep -c '설정 열기' src/features/schedule-sync/use-sync-error-toast.ts          # 0
# 피커 prop 은 아직 남아 있다(step 4 몫)
grep -c 'onOpenSettings' src/app/content-scheduler/ContentScreen.tsx            # 1
grep -c 'onOpenSettings' src/app/boss-scheduler/BossScreen.tsx                  # 1
grep -c 'onOpenSettings' src/app/boss-profit/BossProfitScreen.tsx               # 0
test -f src/features/onboarding/use-api-key-invalidation.ts
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. **판별력을 확인하라**: `useApiKeyInvalidation` 의 `kind` 검사를 무력화해(모든 종류에서 호출)
   `rateLimited`·`network` 회귀 케이스가 실제로 깨지는지 본다 — 깨지지 않으면 그 회귀 가드가
   아무것도 담보하지 않는 것이다. 확인 후 되돌려라. 결과를 summary 에 적어라.
3. 아키텍처 체크리스트:
   - 새 훅이 `ScheduleSyncError` 를 **타입으로만** import 하는가?
   - 훅·스토어 어디에서도 `window.location` 을 쓰지 않는가? ([[ADR-050]])
   - 중복 가드를 두 겹으로 만들지 않았는가? (멱등은 `invalidateApiKey()` 안에만)
   - `features/` 코드가 `storage/`·`native/` 를 우회하지 않는가? (CLAUDE.md CRITICAL)
4. 결과에 따라 `phases/api-key-reentry/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (새 훅의 경로·시그니처와 배선한
     자리 목록을 담아라 — step 4·5 가 이어받는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/features/schedule-sync/format.ts` 를 건드리지 마라.** 이유: 피커 문구·액션은 step 4 다.
  여기서 함께 고치면 "토스트 경로만 바꿨을 때 무엇이 깨지는가"를 볼 수 없다.
- **`CharacterTrackingPicker` 와 그 `onOpenSettings` prop 을 건드리지 마라.** 이유: `format.ts` 가 아직
  `openSettings` 를 반환하므로 지금 지우면 갈 곳 없는 액션이 생긴다(step 4 가 순서대로 없앤다).
- **`features/settings/` 를 건드리지 마라.** 이유: step 5 몫이다.
- **`ContentCharacterStep`(온보딩)에 `useApiKeyInvalidation` 을 배선하지 마라.** 이유: 그 화면은 온보딩
  중이라 status 가 `completed` 가 아니고, 가드에 걸려 어차피 no-op 이다. 배선하면 "온보딩 중 401 도
  무효화 경로를 탄다"는 잘못된 신호가 코드에 남는다 — 그 실패는 폼 자체의 에러 처리다.
- **토스트에 액션 버튼을 붙이지 마라.** 이유: 이동이 이미 일어나 누를 것이 없다([[ADR-115]] 결정 1).
- **`formatScheduleSyncError` 의 `invalidApiKey` case 를 지우지 마라.** 이유: `assertNever` 소진 가드가
  깨지고 기존 테스트 2파일이 6종 전부를 단언한다.
- 기존 테스트를 깨뜨리지 마라.
