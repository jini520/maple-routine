# Step 2: onboarding-flow

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/adr/ADR-143.md` 결정 1·8·9 전문**
- **`/docs/features/onboarding.md`** — 특히 「단계는 앱마다 다르다」·「단계 재개」·「키 재입력 경로」
- `/docs/ADR.md` 에서 **[[ADR-086]] 결정 1·2 · [[ADR-115]] 결정 4·5 · [[ADR-116]] 결정 2 ·
  [[ADR-051]] · [[ADR-035]] 결정 13** 만 열어라
- 코드: `packages/core/src/features/onboarding/resume.ts` ·
  `packages/core/src/features/onboarding/store.ts` ·
  `packages/core/src/features/onboarding/state.ts` · `packages/app-rn/src/boot.ts` · 각 `__tests__/`
- **step 0·1 산출물**: `storage/character-selection.ts` · `schedule-sync` 의 다계정 해석

## 배경

RN 온보딩은 **세 단계**(API 키 → 스케줄 관리 방법 → 캐릭터 선택)가 되고 계정 선택·예열이 사라진다.
그런데 온보딩 스토어는 **두 앱이 공유하는 core** 이고 무효 키·한도 초과 알림 사슬
([[ADR-115]]·[[ADR-116]])까지 그 안에 있어 사본을 만들 수 없다. 그래서 **앱이 주입하는 값 하나**만 둔다.

## 작업

### 1. 계정 범위 플래그 — 갈리는 자리는 여기 하나뿐이다

`packages/core/src/features/onboarding/flow.ts` (신규):

```ts
export type OnboardingAccountScope = 'single' | 'all'
export function setOnboardingAccountScope(scope: OnboardingAccountScope): void
export function getOnboardingAccountScope(): OnboardingAccountScope   // 기본값 'single'
```

- **기본값이 `'single'` 이어야 한다** — Capacitor 는 아무것도 주입하지 않고 지금 동작 그대로여야 한다.
- `packages/app-rn/src/boot.ts` 가 부팅 초기에 `setOnboardingAccountScope('all')` 을 부른다.
  **저장소 포트 주입과 같은 자리·같은 시점**에 둬라(그 파일의 기존 배선을 읽고 관례를 따를 것).
- 파일 머리에 **한시적이라는 사실**을 적어라: Capacitor 가 걷히면 이 플래그를 지우고 `'all'` 만 남긴다.

### 2. 재개 파생에서 한 행이 빠진다

`resume.ts` 의 `deriveResumeTarget()`:

| 저장 상태 | `'single'` | `'all'` |
|---|---|---|
| `apiKey` 없음 | `awaitingApiKey` | 같다 |
| `selectedAccountId` 없음 | `selectingAccount` | **이 행이 없다** |
| `trackingMode` 미선택 | `selectingTrackingMode` | 같다 |
| `trackedCharacters` 가 `null`/`[]` | `selectingContentCharacters` | 같다 |
| 그 외 | `completed` | 같다 |

- **리듀서·상태 이름을 바꾸지 마라.** `selectingAccount`·`prefetching` 은 RN 에서 **도달할 수 없는
  상태**가 될 뿐이다.
- `ResumeTarget` 타입의 `selectedAccountId` 가 `'all'` 에서는 없을 수 있다 — 타입을 넓히되
  **`'single'` 경로의 타입 안전성을 잃지 마라**(그쪽은 여전히 문자열이 보장된다).
- [[ADR-086]] 결정 2 의 마이그레이션(`trackingMode` 키가 없고 추적 목록이 있으면 `'auto'` 1회 기록)은
  두 범위 모두에서 그대로 돈다.

### 3. 키 재입력 가드가 «추적 ocid 대조» 가 된다 ([[ADR-143]] 결정 9)

`store.ts` 의 `submitApiKey` 안에서, 지금은 «저장된 `selectedAccountId` 가 방금 받은 `character/list`
응답에 있는가» 를 본다. `'all'` 에서는:

- 저장된 `trackedCharacters` 중 **하나라도** 응답의 어느 계정에 있으면 → 재개한다.
- **하나도 없으면** → 재개하지 않고 캐릭터 선택 단계로 보낸다.
- **추가 호출 없이** 이미 손에 있는 응답으로만 판정한다.
- `'single'` 경로의 판정은 **한 글자도 바뀌지 않아야 한다.**

### 4. 테스트 먼저

- `'all'`: `selectedAccountId` 가 없어도 `selectingAccount` 로 가지 않는다 · 나머지 세 행 그대로
- `'single'`: 지금 표 그대로(**Capacitor 회귀 가드**)
- 키 재입력: ocid 하나라도 겹치면 재개 · 하나도 없으면 캐릭터 선택 · 호출 수 증가 없음
- 부팅: `app-rn` 이 실제로 `'all'` 을 주입한다(`boot.ts` 테스트 또는 `boot-order` 계열 테스트에 추가)

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 플래그를 읽는 자리가 **재개 파생과 키 재입력 가드 둘뿐**인가? 다른 곳에서 읽기 시작했다면
     설계가 새는 것이다
   - 리듀서·`OnboardingStatus` 이름을 바꾸지 않았는가
   - 기본값이 `'single'` 인가
3. `phases/character-multi-account/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "flow.ts 시그니처·주입 자리·재개 표의 갈림·키 재입력 가드 판정 규칙"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **플래그를 두 개 이상 만들지 마라.** 이유: [[ADR-143]] 결정 8 이 «갈리는 자리는 한 곳» 을 조건으로
  이 설계를 허락했다. 정렬·표시 같은 다른 축을 이 플래그에 얹지도 마라(step 9 가 다른 방법으로 푼다).
- **온보딩 화면(`app-rn/src/app/onboarding/`)을 수정하지 마라.** 이유: step 8 의 몫이고, 지금 고치면
  «도달할 수 없는 상태» 와 새 화면이 한 커밋에 섞여 실패 원인이 흐려진다.
- **`prefetchAccountData` 를 지우지 마라.** 이유: Capacitor 가 계속 쓴다.
- 기존 테스트를 깨뜨리지 마라.
