# Step 5: remaining-429-copy

이 step 은 **온보딩·설정의 429 문구 2곳**과 **설정 계정 카드의 액션 하나**를 바꾼다. 스케줄러
동기화 토스트 문구(`features/schedule-sync/format.ts`)는 step 1 이 이미 끝냈다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-114.md` — **결정 1**(A안 문구 표) · **결정 2**(429 에는 액션 없음) ·
  **결정 4**(토스트는 원인만, 인라인은 처방까지)
- `/docs/features/settings.md` — 계정 변경 절(step 0 이 429 정책을 적어 뒀다)
- `/src/features/schedule-sync/format.ts` — **step 1 이 확정한 문구**. 같은 뜻의 문구가 두 벌이 되지
  않도록 대조하라
- `/src/features/onboarding/format.ts` (전문) · `/src/features/onboarding/state.ts`(`OnboardingError`)
- `/src/app/settings/error-message.ts` (전문) · `/src/features/settings/state.ts`(`SettingsError`)
- `/src/app/settings/AccountFlowStatus.tsx` (**99~115행 `error` 케이스**)
- `/src/features/onboarding/__tests__/format.test.ts` (**9~11행**)
- `/src/features/onboarding/__tests__/store.test.ts` (**316행** — 토스트 문구 기대값)
- `/src/app/settings/__tests__/AccountFlowStatus.test.tsx` (**172~192행** — error 케이스)
- `/src/components/organisms/Toast/Toast.tsx` (**88행** — 본문이 `truncate` 다)

## 이전 step 산출물

step 1 이 확정한 문구:

- `formatScheduleSyncError({ kind: 'rateLimited' })` → `'호출 한도를 초과했습니다'` (토스트용, 한 줄)
- `formatRosterError({ kind: 'rateLimited' }, …)` → 제목 `'호출 한도를 초과했습니다'` /
  설명 `'입력하신 API 키가 서비스 단계 키인지 확인해주세요'`, **액션 없음**
- `formatStaleRosterError({ kind: 'rateLimited' }, …)` →
  `'호출 한도를 초과했습니다 — 서비스 단계 키인지 확인해주세요'`, **액션 없음**

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `/src/features/onboarding/format.ts` (9~10행)

```
'잠시 후 다시 시도해주세요'  →  '호출 한도를 초과했습니다'
```

이 함수의 반환값은 **전부 토스트 본문**으로 쓰인다(`features/onboarding/store.ts:69`·`:147`·`:158`·`:175`).
`Toast.tsx:88` 이 `truncate` 라 한 줄이 상한이므로 **처방을 붙이지 마라**([[ADR-114]] 결정 4).

### 2. `/src/app/settings/error-message.ts` (7~8행)

```
'잠시 후 다시 시도해주세요'
  →  '호출 한도를 초과했습니다. 입력하신 API 키가 서비스 단계 키인지 확인해주세요'
```

여기는 **인라인**이다(`AccountFlowStatus.tsx:102` 의 `<p className="text-sm text-error-ink">` — 카드
안에서 줄바꿈된다). 그래서 토스트와 달리 **처방까지 담는다**([[ADR-114]] 결정 4).

두 함수의 문구가 갈리는 이유를 **각 파일에 한 줄 주석으로** 남겨라 — 다음 사람이 "같은 429인데
문구가 다르네"를 버그로 오해하고 통일하지 않도록.

### 3. `/src/app/settings/AccountFlowStatus.tsx` — 429 에는 "다시 시도"를 주지 않는다

`error` 케이스(99~115행)가 **원인과 무관하게** `다시 시도` 버튼을 단다. 429 일 때만 버튼을 빼라.

```tsx
case 'error':
  return (
    <Card className="p-6 space-y-2">
      <p className="text-sm text-error-ink">…</p>
      {props.error?.kind !== 'rateLimited' && (
        <Button variant="primary" onClick={props.onRetry} className="text-sm">다시 시도</Button>
      )}
    </Card>
  )
```

- **`invalidApiKey`·`network`·`storageWriteFailed` 의 버튼은 그대로 둬라.** 이 step 이 바꾸는 것은
  429 하나다.
- `props.error` 가 `null` 인 경우(문구가 `'오류가 발생했습니다'` 로 떨어지는 폴백)에는 버튼을
  **유지한다** — 원인을 모르는 실패는 재시도 가능이 폴백 원칙이다.
- 이 변경의 근거를 주석으로 남겨라([[ADR-114]] 결정 2 · `error-resilience.md` 원칙 3).

### 4. 테스트

- `/src/features/onboarding/__tests__/format.test.ts` **10행** 기대값 →
  `'호출 한도를 초과했습니다'`
- `/src/features/onboarding/__tests__/store.test.ts` **316행** 기대값 → 같은 문구
- `/src/app/settings/__tests__/AccountFlowStatus.test.tsx` — 기존 172행 케이스(`다시 시도` 버튼)는
  **429 가 아닌 원인으로 유지**되는지 확인하고(필요하면 `error` 픽스처를 `invalidApiKey` 등으로
  명시), 아래 2건을 새로 추가하라:
  1. `error: { kind: 'rateLimited' }` 면 문구가
     `'호출 한도를 초과했습니다. 입력하신 API 키가 서비스 단계 키인지 확인해주세요'` 이고
     **`다시 시도` 버튼이 없다**
  2. `error: { kind: 'network' }` 면 `다시 시도` 버튼이 **있다**(회귀 가드 — 429 만 갈렸음을 단언)
- `formatSettingsError` 를 직접 단언하는 테스트 파일은 없다. **새로 만들지 마라** —
  `AccountFlowStatus` 테스트가 화면까지 통과해 검증하므로 중복이다.

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 없음
npm test                                         # 전부 통과
npm run lint                                     # errors 0
# 저장소 전체에서 옛 429 문구가 사라졌다
grep -rn '잠시 후 다시 시도해주세요' src/ | wc -l          # 0
# 새 문구가 자리마다 정확히 하나씩
grep -c '호출 한도를 초과했습니다' src/features/onboarding/format.ts      # 1
grep -c '호출 한도를 초과했습니다' src/app/settings/error-message.ts      # 1
git status --porcelain -- src/ | wc -l           # 6 이어야 한다 (제품 3 + 테스트 3)
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. **판별력을 확인하라**: `AccountFlowStatus` 의 `rateLimited` 조건을 지워 버튼이 항상 나오게 하면
   새 케이스 1 만 실패하고 케이스 2 와 기존 error 케이스는 통과하는지 본다. 확인 후 되돌리고
   결과를 summary 에 적어라.
3. **문구 대조**: `grep -rn '호출 한도를 초과했습니다' src/ | grep -v __tests__` 로 자리 4곳
   (`schedule-sync/format.ts` 2회 — 토스트·`ErrorState` 제목, `onboarding/format.ts`,
   `settings/error-message.ts`)을 확인하고, 각 자리의 길이가 그 자리 제약과 맞는지
   ([[ADR-114]] 결정 4) 눈으로 검증하라. 결과를 summary 에 적어라.
4. 아키텍처 체크리스트:
   - CLAUDE.md CRITICAL: `features/` 코드가 저장소·네이티브 API 에 직접 접근하지 않는가?
   - `features/onboarding/format.ts` 가 `app/` 을 import 하지 않는가?(파일 상단 주석의 이유 —
     features → app 은 레이어가 거꾸로다)
5. 결과에 따라 `phases/rate-limit-copy/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`features/schedule-sync/format.ts` 를 다시 건드리지 마라.** 이유: step 1 이 끝냈다. 문구가
  어긋나 보이면 고치기 전에 [[ADR-114]] 결정 1 의 표와 대조하라.
- **온보딩 토스트에 처방을 붙이지 마라.** 이유: `Toast.tsx:88` 이 `truncate` 라 잘린다
  ([[ADR-114]] 결정 4). "자리마다 담을 수 있는 만큼"이 결정이다.
- **`Toast` 컴포넌트를 고치지 마라(`truncate` → `line-clamp-2` 금지).** 이유: [[ADR-114]] 가
  명시적으로 기각한 안이다 — 429 하나 때문에 전 토스트의 레이아웃 규칙이 바뀐다.
- **`invalidApiKey`·`network`·`storageWriteFailed` 의 문구나 액션을 바꾸지 마라.** 이유: 이 이슈의
  범위는 429 문구와 그 액션이다.
- **`SettingsError`·`OnboardingError` 에 새 kind 를 추가하지 마라.** 이유: 키 단계를 판정하지 않기로
  한 것이 [[ADR-114]] 결정 1 이다.
- 기존 테스트를 깨뜨리지 마라.
