# Step 2: stale-banner-action

이 step 은 **`src/components/molecules/ErrorState/StaleBanner.tsx` 한 컴포넌트와 그 테스트**만
바꾼다. 호출부 배선은 step 3·4 몫이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-114.md` — **결정 3**(스탈 배너 원인별 분기, 배너는 `ScheduleSyncError` 를 받지 않고
  호출부가 문구·액션을 뽑아 넘긴다)
- `/docs/adr/ADR-062.md` — **결정 4**(스탈 배너를 만든 결정)
- `/docs/foundation/design-system.md` — "실패 상태" 절의 **스탈 배너** 항목(클래스 스펙이 여기 있다)
- `/src/components/molecules/ErrorState/StaleBanner.tsx` (전문 — 이 step 이 고칠 파일)
- `/src/components/molecules/ErrorState/ErrorState.tsx` (전문 — **액션 옵셔널 처리의 선례**다.
  `ErrorStateProps.action?` 과 51행의 조건부 렌더를 그대로 따라라)
- `/src/components/molecules/ErrorState/__tests__/ErrorState.test.tsx` (**58~80행** `StaleBanner` describe)
- `/src/components/__tests__/layer-dependencies.test.ts` (계층 의존 방향 강제 — molecule 이 위쪽
  계층을 import 하면 실패한다)

## 이전 step 산출물

step 1 이 `/src/features/schedule-sync/format.ts` 에 `formatStaleRosterError(error, place)` 를
신설했고 `StaleRosterErrorCopy { message, action? }` 를 반환한다. **이 step 은 그 함수를 import
하지 않는다** — 배너는 문구·액션만 받는 dumb 컴포넌트로 남는다([[ADR-114]] 결정 3의 기각안:
"`StaleBanner` 가 `ScheduleSyncError` 를 직접 받기 — molecule 이 feature 어휘를 알게 된다").

## 작업

TDD 다 — **테스트를 먼저 고치고**, 그다음 구현이 통과하게 만들어라.

### 1. props 를 바꾼다

```ts
export interface StaleBannerProps {
  message: string
  /**
   * 재시도가 실제로 통하는 실패에만 준다([[ADR-114]] 결정 2·3) — 429·401 에는 액션이 없다.
   * 배너는 목록이 남아 있는 자리라 액션이 없어도 막다른 길이 아니다.
   */
  action?: { label: string; onClick: () => void }
}
```

- 옛 `onRetry: () => void` 를 **없앤다**(옵셔널로 남기지 마라 — 두 경로가 생기면 호출부가 어느 쪽을
  써야 하는지 흐려진다).
- 버튼 라벨은 **하드코딩된 `'다시 시도'` 가 아니라 `action.label`** 이다. 피커의 401 은
  `'설정 열기'` 를 받는다.
- `action` 이 `undefined` 면 **버튼을 아예 렌더하지 마라**(`ErrorState.tsx:51` 과 같은 형태).

### 2. 마크업·스타일은 그대로 둔다

`data-testid="stale-banner"` · `role="alert"` · 컨테이너 클래스
(`mb-3 flex items-center gap-2 rounded-[10px] bg-error-tint px-3 py-2.5`) · `AlertTriangle` 아이콘 ·
문구 `span` 클래스 · 버튼 클래스를 **한 글자도 바꾸지 마라**. 이 step 이 바꾸는 것은 **버튼의
유무와 라벨의 출처**뿐이다.

### 3. 주석을 갱신한다

파일 상단 주석은 "목록을 가리지 않아야 하므로 한 줄로 둔다"까지는 유효하다. 여기에 **원인별로
문구가 갈리고 액션이 없을 수 있다**는 것과 그 근거([[ADR-114]] 결정 3)를 더해라. 포맷은
`features/schedule-sync/format.ts` 의 `formatStaleRosterError` 가 하고 이 컴포넌트는 결과만 받는다는
것도 적어라 — 다음 사람이 여기에 `switch` 를 만들지 않도록.

### 4. 테스트

`/src/components/molecules/ErrorState/__tests__/ErrorState.test.tsx` 의 `StaleBanner` describe
(58~80행)를 새 시그니처로 고치고, 최소 아래를 담아라:

1. `message` 와 `action.label` 버튼을 렌더한다 (라벨이 `'다시 시도'` 가 아닌 경우도 한 건 —
   `'설정 열기'` 로 렌더되는지)
2. 버튼을 누르면 `action.onClick` 이 호출된다
3. **`action` 이 없으면 버튼을 만들지 않는다** (`screen.queryByRole('button')` 이 `null`) —
   이것이 이 step 의 핵심 계약이다
4. `role=alert` 를 갖는다 (기존 케이스 유지)

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 — StaleBanner 호출부 2곳이 아직 옛
                                                 # 시그니처라 **여기서 실패하는 것이 정상이다**(아래 참고)
npx vitest run src/components/molecules/ErrorState   # 이 컴포넌트 테스트는 전부 통과
npm run lint                                     # errors 0
git status --porcelain -- src/ | wc -l           # 2 이어야 한다 (컴포넌트 + 그 테스트)
```

**`npm run build` 가 이 step 에서 실패하는 것에 대해**: `onRetry` 를 없애면
`CharacterTrackingPicker.tsx:59` 와 `ContentCharacterStep.tsx:46` 이 타입 에러를 낸다. 그 두 곳은
step 3·4 가 고친다.

**따라서 이 step 은 두 호출부의 `<StaleBanner .../>` 한 줄씩만 컴파일이 통과하도록 최소 수정해도
된다** — `message` 는 지금 값(`"목록이 최신이 아닙니다"`)을 그대로 두고 `onRetry={...}` 를
`action={{ label: '다시 시도', onClick: props.onRetry }}` 로 바꾸는 **기계적 치환**까지만. 원인별
분기(`formatStaleRosterError` 호출)는 **절대 여기서 하지 마라** — step 3·4 몫이다. 이 최소 치환을
했다면 AC 의 `git status` 기대값은 4다(컴포넌트 + 테스트 + 호출부 2곳). **어느 쪽을 택했는지
summary 에 반드시 적어라.**

## 검증 절차

1. 위 AC 커맨드를 실행한다. `npm run build` 와 `npm test` 가 최종적으로 통과해야 한다(위 최소 치환
   포함).
2. **판별력을 확인하라**: `action` 조건부 렌더를 지워 항상 버튼이 나오게 바꾸면 새 테스트 3번이
   실패하는지 본다. 확인 후 되돌리고 결과를 summary 에 적어라.
3. 아키텍처 체크리스트:
   - `npx vitest run src/components/__tests__/layer-dependencies.test.ts` 통과 — molecule 이
     organism·template 이나 `features/` 를 import 하지 않는가?
   - `design-system.md` 의 스탈 배너 클래스 스펙과 마크업이 일치하는가?
4. 결과에 따라 `phases/rate-limit-copy/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`StaleBanner` 안에서 `ScheduleSyncError` 를 import 하거나 `switch` 를 만들지 마라.** 이유:
  molecule 이 feature 어휘를 알게 되고, 계층 규칙([[ADR-094]] 결정 2)이 무너진다. 포맷은 step 1 의
  함수가 한다.
- **호출부에서 `formatStaleRosterError` 를 호출하지 마라.** 이유: step 3·4 가 각자의 자리에서
  한다. 여기서 하면 "배너 시그니처 변경만으로 무엇이 깨지는가"가 diff 에서 사라진다.
- **마크업·클래스를 바꾸지 마라.** 이유: 이 이슈는 문구 문제이지 디자인 변경이 아니다.
- **`onRetry` 를 옵셔널로 남겨 두 경로를 만들지 마라.** 이유: 호출부가 어느 쪽을 써야 하는지
  흐려지고, 액션 없는 배너를 만드는 방법이 둘이 된다.
- 기존 테스트를 깨뜨리지 마라.
