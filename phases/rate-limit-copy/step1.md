# Step 1: roster-error-copy

이 step 은 **`src/features/schedule-sync/format.ts` 한 파일과 그 테스트**만 바꾼다. 컴포넌트·화면은
step 2~4 몫이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-114.md` — **step 0 이 만든 이 phase 의 결정**. 결정 1(A안 문구) · 결정 2(429 액션
  없음) · 결정 3(스탈 배너 원인별 분기)이 이 step 의 계약이다
- `/docs/adr/ADR-062.md` — **결정 3**(원인별 문구·액션 표) · **결정 5**(어미 규칙 `~습니다`/`~주세요`)
- `/docs/foundation/error-resilience.md` — **원칙 3** 및 "문구 어미" 표
- `/src/features/schedule-sync/format.ts` (전문 — 이 step 이 고칠 파일)
- `/src/features/schedule-sync/errors.ts` (`ScheduleSyncError` 6종)
- `/src/features/schedule-sync/__tests__/format.test.ts` (전문)
- `/src/features/schedule-sync/use-sync-error-toast.ts` (**63행** — `rateLimited` 는 이미 액션 없이 띄운다)
- `/src/features/schedule-sync/__tests__/use-sync-error-toast.test.tsx` (**74행** — 429 문구 기대값)

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `formatScheduleSyncError` 의 `rateLimited` 문구 (14~15행)

```
'잠시 후 다시 시도해주세요'  →  '호출 한도를 초과했습니다'
```

이 함수의 반환값은 **토스트 본문**으로 쓰인다(`use-sync-error-toast.ts:47`). `Toast.tsx:88` 의
본문이 `truncate` 라 한 줄이 상한이므로 **처방("서비스 단계 키인지 확인해주세요")을 붙이지 마라**
([[ADR-114]] 결정 4). 원인만 말한다.

### 2. `formatRosterError` 의 `rateLimited` (70~77행)

```ts
case 'rateLimited':
  return {
    title: '호출 한도를 초과했습니다',
    description: '입력하신 API 키가 서비스 단계 키인지 확인해주세요',
    // action 없음
  }
```

- **`action` 을 주지 마라**([[ADR-114]] 결정 2). 지금 있는 `RETRY` 를 뗀다.
- 기존 주석("즉시 누르면 또 429지만 버튼을 잠그지 않는다 — 사용자 결정 2026-07-30")은 **폐기된
  결정**이다. 지우고 새 근거로 바꿔라: 일 1,000건 소진이면 다음 날까지 안 풀리고, 새 문구의 처방이
  재시도가 아니라 **키 단계 확인**이라 버튼이 문구와 어긋난다([[ADR-114]] 결정 2).
- `RETRY` 상수(54행)는 다른 case 들이 계속 쓰므로 **지우지 마라**.

### 3. `formatStaleRosterError(error, place)` 신설

스탈 배너 전용 포맷터. `formatRosterError` 바로 아래에 둔다.

```ts
export interface StaleRosterErrorCopy {
  /** 배너 한 줄에 들어가는 문구. 제목·설명으로 쪼개지 않는다 — 배너는 한 줄이다. */
  message: string
  /** 재시도가 실제로 통하는 실패에만 준다([[ADR-114]] 결정 3). */
  action?: { kind: 'retry' | 'openSettings'; label: string }
}

export function formatStaleRosterError(
  error: ScheduleSyncError,
  place: RosterErrorPlace,
): StaleRosterErrorCopy
```

문구·액션 표 ([[ADR-114]] 결정 3 — **이 표에서 벗어나지 마라**):

| `error.kind` | `message` | picker `action` | onboarding `action` |
|---|---|---|---|
| `invalidApiKey` | `API 키가 유효하지 않아 목록을 갱신하지 못했습니다` | `openSettings` / `설정 열기` | 없음 |
| `rateLimited` | `호출 한도를 초과했습니다 — 서비스 단계 키인지 확인해주세요` | 없음 | 없음 |
| `characterUnavailable` | `이 계정의 캐릭터를 조회할 수 없습니다` | 없음 | 없음 |
| `periodOutOfRange`·`notCollected`·`network` | `목록이 최신이 아닙니다` | `retry` / `다시 시도` | `retry` / `다시 시도` |

핵심 규칙 — **반드시 지켜라**:

- **`network` 계열의 문구는 현행 그대로다.** 지금 화면에 하드코딩된 `"목록이 최신이 아닙니다"` 와
  **한 글자도 다르면 안 된다** — 기존 테스트 3건(`CharacterTrackingPicker.test.tsx:436`·`:678`,
  `BossScreen.test.tsx:1261`)이 그 문자열을 단언하고, 그 케이스들은 `kind: 'network'` 다.
- **`switch` 에 `assertNever` 소진 가드를 둬라.** 이 파일 6~8행의 기존 헬퍼를 재사용한다. 이유:
  tsconfig 에 `noImplicitReturns` 가 없어 case 를 빠뜨려도 타입 오류가 안 난다(파일 상단 주석의 사고).
- **`RosterErrorPlace` 타입을 새로 만들지 마라** — 42행의 기존 타입을 재사용한다.
- **어미 규칙**([[ADR-062]] 결정 5): 전부 `~습니다` 또는 `~주세요` 로 끝난다.

왜 `formatRosterError` 를 재사용하지 않고 새 함수인가 — 배너는 **한 줄**이고 `ErrorState` 는
제목+설명 두 줄이라 담을 수 있는 양이 다르다. 그리고 **액션 규칙 자체가 다르다**: 배너는 목록이
남아 있어 액션이 없어도 막다른 길이 아니지만, `ErrorState` 는 자리 전체가 실패라 온보딩 401 에서
액션을 빼면 화면에 아무 길도 없다([[ADR-114]] 결정 3). 이 이유를 함수 위 주석으로 남겨라.

### 4. 테스트

`/src/features/schedule-sync/__tests__/format.test.ts` 를 고친다:

- **8행** — `[{ kind: 'rateLimited' }, '잠시 후 다시 시도해주세요']` → `'호출 한도를 초과했습니다'`
- **48~52행** `'%s의 나머지 원인은 액션이 있다'` — 배열에서 `'rateLimited'` 를 빼라. 이 케이스는
  이제 액션이 없다
- **80~83행** `'%s의 rateLimited·network는 재시도를 준다'` — **이름과 내용을 뒤집어라**:
  `network` 만 재시도이고 `rateLimited` 는 `action` 이 `undefined` 임을 단언한다([[ADR-114]] 결정 2)
- **85~89행** `'rateLimited와 network는 제목이 다르다'` — 그대로 통과해야 한다(확인만)
- `formatRosterError` 의 429 문구를 **문자열 그대로** 단언하는 케이스를 새로 추가하라 —
  `title === '호출 한도를 초과했습니다'`, `description === '입력하신 API 키가 서비스 단계 키인지 확인해주세요'`

`formatStaleRosterError` 의 새 `describe` 를 추가하고 최소 아래를 담아라:

1. 6종 × 2 place 전부 `message.length > 0` 이고 어미 규칙(`/(습니다|주세요)$/`)을 따른다
2. `network`·`periodOutOfRange`·`notCollected` 는 두 place 모두 `'목록이 최신이 아닙니다'` +
   `{ kind: 'retry', label: '다시 시도' }`
3. `rateLimited` 는 두 place 모두 `action` 이 `undefined` 이고 message 에 `'서비스 단계'` 가 들어간다
4. `invalidApiKey` 는 picker 에서 `{ kind: 'openSettings', label: '설정 열기' }`, onboarding 에서는
   `action` 이 `undefined`
5. `characterUnavailable` 은 두 place 모두 `action` 이 `undefined`
6. **회귀 가드**: `network` 의 message 가 `'목록이 최신이 아닙니다'` 와 **정확히** 같다(화면
   하드코딩과 한 글자도 달라지지 않았음을 이 단언이 잡는다)

`/src/features/schedule-sync/__tests__/use-sync-error-toast.test.tsx` **74행**의 기대값도
`'호출 한도를 초과했습니다'` 로 고쳐라. 그 케이스의 이름·의도(`rateLimited는 액션 없이 문구만 띄운다`)는
유지한다.

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 없음
npm test                                         # 전부 통과 (baseline 2,548개 / 172파일)
npm run lint                                     # errors 0 (warnings 17 은 baseline)
# 이 step 이 만지는 파일은 3개뿐이다
git status --porcelain -- src/ | wc -l           # 3 이어야 한다
grep -c '잠시 후 다시 시도해주세요' src/features/schedule-sync/format.ts   # 0
grep -q 'formatStaleRosterError' src/features/schedule-sync/format.ts      # 신설 확인
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. **판별력을 확인하라**: `formatStaleRosterError` 의 `rateLimited` case 를 `network` 와 같은
   반환값으로 바꿔보고(즉 분기를 무력화), 새 테스트가 실제로 실패하는지 본다. 실패하지 않으면
   테스트가 아무것도 담보하지 않는 것이다. 확인 후 반드시 되돌려라. 결과를 summary 에 적어라.
3. 아키텍처 체크리스트:
   - `features/` 코드가 로컬 저장소·네이티브 API 에 직접 접근하지 않는가? (이 step 은 순수 함수만
     다루므로 해당 없음이어야 한다)
   - `assertNever` 소진 가드가 새 `switch` 에도 있는가?
   - 어미 규칙([[ADR-062]] 결정 5)을 지켰는가?
4. 결과에 따라 `phases/rate-limit-copy/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/components/` · `src/app/` 을 건드리지 마라.** 이유: 배너 컴포넌트는 step 2, 호출부 배선은
  step 3·4 다. 여기서 함께 고치면 "포맷터만 바꿨을 때 무엇이 깨지는가"를 볼 수 없다.
- **`features/onboarding/format.ts` · `app/settings/error-message.ts` 를 건드리지 마라.**
  이유: step 5 몫이다.
- **`network` 계열의 배너 문구를 "개선"하지 마라.** 이유: 화면에 하드코딩된 문자열과 정확히 같아야
  기존 테스트 3건이 그대로 서고, 이 phase 가 바꾸는 것은 **429·401 뿐**임이 diff 로 증명된다.
- **`RETRY` 상수를 지우지 마라.** 이유: `invalidApiKey`(온보딩)·`network` 계열이 계속 쓴다.
- **`ScheduleSyncError` 에 새 kind 를 추가하지 마라.** 이유: 이 이슈는 문구 문제이고, 429 는 이미
  `rateLimited` 로 도달한다. 키 단계를 판정하지 않기로 한 것이 [[ADR-114]] 결정 1 이다.
- 기존 테스트를 깨뜨리지 마라.
