# Step 4: picker-copy

이 step 은 **캐릭터 피커의 401 문구·액션**을 새 경로에 맞추고, 그 결과 고아가 되는 `openSettings`
배선을 걷어낸다. step 3 이 토스트 경로에서 `설정 열기` 를 없앴고, 여기서 **마지막 `설정 열기`** 가
사라진다. 설정 모달은 step 5 다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-115.md` — **step 0 이 만든 이 phase 의 결정**. 이 step 의 계약은 **결정 7**(감지 지점
  전부가 진입점 하나를 부르고 `설정 열기` 액션은 전부 제거된다 — [[ADR-062]] 결정 3 의 목적지 폐기)이다
- `/docs/adr/ADR-062.md` — **결정 3**(원인별 문구·액션) · **결정 5**(어미 규칙 `~습니다`/`~주세요`)
- `/docs/adr/ADR-114.md` — **결정 2·3**(429·영구 실패에 액션을 주지 않는 규칙, 스탈 배너 원인별 분기)
- `/docs/foundation/error-resilience.md` — **원칙 3**(step 0 이 갱신했다)
- `/src/features/schedule-sync/format.ts` (전문 — `formatRosterError` 58~106행 ·
  `formatStaleRosterError` 127~157행 · `RosterErrorPlace` 44행)
- `/src/features/schedule-sync/__tests__/format.test.ts` (전문)
- `/src/components/organisms/CharacterTrackingPicker/CharacterTrackingPicker.tsx`
  (**42~44행** `onOpenSettings` prop · **68~79행** 스탈 배너 매핑 · **110~127행** `ErrorState` 매핑)
- `/src/components/organisms/CharacterTrackingPicker/__tests__/CharacterTrackingPicker.test.tsx`
- `/src/app/onboarding/ContentCharacterStep.tsx` (**48~62행**·**85~95행** — 같은 포맷터를 쓰는
  온보딩 자리. 설정 모달의 계정 변경도 이 컴포넌트를 재사용한다)
- `/src/app/content-scheduler/ContentScreen.tsx` **283행** · `/src/app/boss-scheduler/BossScreen.tsx` **361행**
- **step 3 이 만든 것**: `features/onboarding/use-api-key-invalidation.ts` — 두 화면의 `rosterError` 가
  이미 이 훅을 타므로, **피커에서 401 이 나면 화면이 곧 키 입력으로 이동한다**

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `format.ts#formatRosterError` — `place='picker'` 의 401

```
title:        'API 키가 유효하지 않습니다'            ← 그대로
description:  '설정에서 키를 다시 등록해주세요'  →  '키 입력 화면으로 이동합니다'
action:       { openSettings, '설정 열기' }      →  없음
```

- 문구를 바꾸는 이유는 **지금 문구가 거짓이기 때문**이다 — 설정에는 키를 다시 등록할 자리가 없다
  (2026-07-25 제거). 새 문구는 실제로 일어나는 일을 말한다([[ADR-115]] 결정 1·7).
- 액션을 없애는 이유는 **누를 것이 없기 때문**이다 — step 3 의 배선으로 이 자리에 도달하는 401 은
  곧바로 이동을 일으킨다. 이 `ErrorState` 는 이동 직전의 한 프레임이자 안전망이다.
- `place='onboarding'` 의 401 은 **그대로 둬라**(제목 + `'API 키를 다시 확인해주세요'` + 재시도).
  이유: 온보딩 중에는 무효화 경로가 성립하지 않는다(status 가 `completed` 가 아니다) — 그 실패는
  **폼 자체의 에러**이고 재시도가 실제 처방이다([[ADR-115]] 결정 6).
- 어미 규칙([[ADR-062]] 결정 5)을 지켜라.

### 2. `format.ts#formatStaleRosterError` — `place` 파라미터가 고아가 된다

- `place='picker'` 의 401 에서 `{ kind: 'openSettings', label: '설정 열기' }` 를 **제거**한다.
  `message`(`'API 키가 유효하지 않아 목록을 갱신하지 못했습니다'`)는 **그대로**다.
- 그러면 이 함수의 6종 전부가 두 자리에서 같아져 **`place` 를 아무 데서도 쓰지 않게 된다.**
  **파라미터를 지워라** — 시그니처는 `formatStaleRosterError(error: ScheduleSyncError)` 가 된다.
  (안 지우면 `@typescript-eslint/no-unused-vars` 가 에러를 낸다. 우리 변경이 만든 고아이므로 우리가
  치운다 — CLAUDE.md "surgical changes".)
- 함수 위 주석의 "왜 `formatRosterError` 를 재사용하지 않는가" 두 근거 중 **2번(액션 규칙이 다르다)**
  이 바뀐다. 이제 배너에는 401 액션이 없고 `ErrorState` 는 온보딩에서만 재시도를 유지한다. 근거를
  현재 사실로 고쳐 써라 — 지우지 말고 갱신하라.
- **`RosterErrorPlace` 타입은 지우지 마라** — `formatRosterError` 가 계속 쓴다(온보딩 401 은 재시도가
  있고 피커는 없다).

### 3. `openSettings` 액션 종류 제거

`RosterErrorCopy.action` 과 `StaleRosterErrorCopy.action` 의 `kind` 에서 **`'openSettings'` 를 제거**해
`kind: 'retry'` 만 남긴다. 이제 어떤 포맷터도 `openSettings` 를 반환하지 않는다.

- **`kind` 필드 자체는 남겨라.** 이유: 호출부 3곳이 이미 그 값으로 분기하고 있어 필드를 없애면
  `StaleBanner`·`ErrorState` 호출부와 테스트까지 연쇄로 고쳐야 한다 — 이 phase 가 바꾸는 것은
  **401 의 목적지**이지 액션 표현 방식이 아니다. 단일 멤버 유니온이 되는 것은 감수한다.
- `CharacterTrackingPicker.tsx` 의 매핑 두 곳(스탈 배너 **76행** · `ErrorState` **122행**)에서
  `kind === 'openSettings' ? props.onOpenSettings : props.onRetry` 를 **`props.onRetry`** 로 단순화한다.
- **`onOpenSettings` prop 을 제거**한다(`CharacterTrackingPickerProps` **42~44행** + 주석).
- 호출부 2곳에서 그 prop 을 지운다 — `ContentScreen.tsx:283` · `BossScreen.tsx:361`.
  `navigateToScreen` 은 두 화면 모두 다른 곳에서 계속 쓰이므로 **선언을 지우지 마라**.
- `ContentCharacterStep.tsx` 의 방어적 `kind === 'retry'` 확인(**57~60행**)과 그 주석은 유지하되,
  주석이 말하는 근거("포맷터가 openSettings 를 반환하면 …")가 이제 타입 수준에서 불가능해졌음을
  반영해 갱신하라. `formatStaleRosterError` 호출에서 `'onboarding'` 인자를 지우는 것도 잊지 마라.

### 4. 테스트

**`format.test.ts`**:

- `formatStaleRosterError` 의 `describe` 를 새 시그니처(인자 1개)에 맞춰 고친다 — place 파라미터라이즈를
  걷어낸다.
- **401 케이스를 뒤집어라**: `formatStaleRosterError({kind:'invalidApiKey'}).action` 이 `undefined` 이고
  `message` 는 기존 문자열 그대로다.
- `formatRosterError({kind:'invalidApiKey'}, 'picker')` — `description` 이
  **`'키 입력 화면으로 이동합니다'`** 이고 `action` 이 `undefined` 임을 **문자열 그대로** 단언한다.
- **회귀 가드**: `formatRosterError({kind:'invalidApiKey'}, 'onboarding')` 은 재시도 액션과 기존 문구를
  **그대로** 유지한다(이 phase 가 온보딩 자리를 건드리지 않았음의 증명).
- 어미 규칙(`/(습니다|아닙니다|주세요)$/`)과 `network` 계열 문구(`'목록이 최신이 아닙니다'`) 회귀
  단언은 그대로 서야 한다.
- **`openSettings` 문자열이 프로덕션 코드에서 0건**임을 확인하는 것은 아래 AC 가 맡는다.

**`CharacterTrackingPicker.test.tsx`**: `onOpenSettings` 를 넘기던 테스트 픽스처를 정리하고,
401 일 때 `ErrorState`·스탈 배너에 **버튼이 없다**는 케이스를 넣어라. 기존 `network` 재시도 케이스는
그대로 통과해야 한다.

**`ContentScreen.test.tsx`·`BossScreen.test.tsx`**: prop 제거로 깨지는 곳만 최소로 고쳐라.

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 없음
npm test                                         # 전부 통과
npm run lint                                     # errors 0 (warnings 17 은 baseline)
# openSettings 는 제품 코드에서 완전히 사라진다
grep -rn 'openSettings' src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | wc -l   # 0
grep -rn '설정 열기' src/features src/components src/app --include='*.ts' --include='*.tsx' | grep -v __tests__ | wc -l   # 0
# 거짓 안내가 사라졌다
grep -rc '설정에서 키를 다시 등록해주세요' src/features/schedule-sync/format.ts   # 0
# 온보딩 자리는 그대로다
grep -c 'API 키를 다시 확인해주세요' src/features/schedule-sync/format.ts        # 1
```

> `src/features/toast/store.ts`·`ErrorBoundary` 등에도 `설정 열기` 문자열이 있을 수 있다. 위 grep 이
> 0 이 아니면 **그 자리가 이 phase 의 대상인지 먼저 확인하라** — 토스트 스토어의 기본 액션이나
> 에러 바운더리의 문구는 이 phase 와 무관하니 건드리지 말고, 그 경우 AC 를 그 자리 제외로 좁혀
> 실행하고 무엇을 왜 제외했는지 summary 에 적어라.

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. **판별력을 확인하라**: `formatRosterError` 의 picker 401 을 옛 반환값(설정 열기 액션 포함)으로
   되돌려보고 새 테스트가 실제로 실패하는지, 그리고 **온보딩 회귀 케이스는 통과하는지** 본다.
   확인 후 되돌려라. 결과를 summary 에 적어라.
3. 아키텍처 체크리스트:
   - `npx vitest run src/components/__tests__/layer-dependencies.test.ts` 가 통과하는가?
     (organism 이 상위 계층·feature 를 잘못 import 하지 않았는지)
   - 어미 규칙([[ADR-062]] 결정 5)을 지켰는가?
   - `assertNever` 소진 가드가 두 `switch` 에 그대로 있는가?
4. 결과에 따라 `phases/api-key-reentry/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (바뀐 시그니처
     `formatStaleRosterError(error)` 와 제거된 prop 을 담아라)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`place='onboarding'` 의 401 문구·액션을 바꾸지 마라.** 이유: 온보딩 중에는 무효화 경로가 성립하지
  않아 재시도가 실제 처방이다([[ADR-115]] 결정 6). 그 자리를 함께 바꾸면 이 phase 가 무엇을 바꿨는지
  diff 로 구분할 수 없다.
- **`action.kind` 필드를 통째로 없애지 마라.** 이유: 호출부 3곳과 `StaleBanner`·`ErrorState` 계약까지
  연쇄로 번진다. 이 phase 의 범위는 401 의 목적지다.
- **`RosterErrorPlace` 타입을 지우지 마라.** 이유: `formatRosterError` 가 계속 쓴다.
- **`network`·`rateLimited`·`characterUnavailable` 의 문구를 "개선"하지 마라.** 이유: 화면 하드코딩·
  기존 테스트와 한 글자도 달라지면 안 되고, 이 phase 가 바꾸는 것은 **401 뿐**임이 diff 로 증명돼야 한다.
- **`features/settings/` 를 건드리지 마라.** 이유: step 5 몫이다.
- **`navigateToScreen` 선언을 지우지 마라.** 이유: 두 화면 모두 다른 이동에 계속 쓴다(고아가 아니다).
- 기존 테스트를 깨뜨리지 마라.
