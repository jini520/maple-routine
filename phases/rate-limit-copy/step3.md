# Step 3: picker-banner-wiring

이 step 은 **`src/components/organisms/CharacterTrackingPicker/CharacterTrackingPicker.tsx` 와 그
테스트**만 바꾼다. 온보딩 스텝(`ContentCharacterStep.tsx`)은 step 4 몫이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-114.md` — **결정 2·3**(429 액션 없음 · 배너 원인별 분기 표)
- `/docs/adr/ADR-062.md` — **결정 3·4**(원인별 문구·액션 · 스탈 배너)
- `/docs/features/content-scheduler.md` — "캐릭터 관리 피커 — 후보 목록 로딩" 절(step 0 이 갱신했다)
- `/src/features/schedule-sync/format.ts` — step 1 이 신설한 **`formatStaleRosterError(error, place)`**
  와 그 반환 타입 `StaleRosterErrorCopy { message, action? }`
- `/src/components/molecules/ErrorState/StaleBanner.tsx` — step 2 가 바꾼 시그니처
  (`{ message, action?: { label, onClick } }`)
- `/src/components/organisms/CharacterTrackingPicker/CharacterTrackingPicker.tsx` (전문 —
  특히 **54~113행 `PickerBody`**)
- `/src/components/organisms/CharacterTrackingPicker/__tests__/CharacterTrackingPicker.test.tsx`
  (**436행 부근**·**665~680행** — 스탈 배너 케이스 3건)

## 이전 step 산출물

- step 1: `formatStaleRosterError(error, place)` — `place` 는 기존 `RosterErrorPlace`(`'picker' | 'onboarding'`).
  반환은 `{ message: string; action?: { kind: 'retry' | 'openSettings'; label: string } }`.
- step 2: `StaleBanner` 가 `message` + 옵셔널 `action: { label, onClick }` 을 받는다. `action` 이
  없으면 버튼을 렌더하지 않는다.

step 2 가 이 파일의 `<StaleBanner .../>` 한 줄을 컴파일만 통과하도록 기계적으로 치환해 뒀을 수
있다(`action={{ label: '다시 시도', onClick: props.onRetry }}`). **그 자리를 이 step 이 진짜 분기로
바꾼다.**

## 작업

TDD 다 — **테스트를 먼저 쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. 59행의 하드코딩을 분기로 바꾼다

지금:

```tsx
{props.loadError !== null && <StaleBanner message="목록이 최신이 아닙니다" onRetry={props.onRetry} />}
```

바꿀 형태(시그니처 수준 — 내부 표현은 재량):

```tsx
{props.loadError !== null && (() => {
  const copy = formatStaleRosterError(props.loadError, 'picker')
  return (
    <StaleBanner
      message={copy.message}
      action={ /* copy.action 을 label + onClick 으로 옮긴다 */ }
    />
  )
})()}
```

**액션 매핑 규칙** — 88~106행의 `ErrorState` 분기가 이미 같은 매핑을 하고 있다. 그 형태를 따라라:

- `copy.action === undefined` → `action` 은 `undefined` (버튼 없음)
- `copy.action.kind === 'openSettings'` → `onClick: props.onOpenSettings`
- `copy.action.kind === 'retry'` → `onClick: props.onRetry`
- `label` 은 항상 `copy.action.label`

`formatRosterError` 는 이미 이 파일이 import 하고 있다(3행). 같은 모듈에서
`formatStaleRosterError` 를 함께 가져와라.

### 2. 주석을 갱신한다

51~53행의 `ADR-062 결정 4` 주석과 58행의 "스탈 배너는 스크롤포트 밖이다" 주석은 유효하니 남긴다.
거기에 **원인별로 문구·액션이 갈린다**는 것과, **429·401 에는 버튼이 없다**는 것, 그리고 그 근거
([[ADR-114]] 결정 3 — 배너는 목록이 남아 있어 액션이 없어도 막다른 길이 아니다)를 한 문단으로
더해라.

### 3. 테스트

`/src/components/organisms/CharacterTrackingPicker/__tests__/CharacterTrackingPicker.test.tsx`:

**기존 3건은 손대지 마라** — `loadError={{ kind: 'network' }}` 를 쓰고 `'목록이 최신이 아닙니다'` 를
단언하는 케이스들이다(436행·665~680행). step 1 의 표대로면 그대로 통과해야 한다. **통과하지 않으면
step 1 의 `network` 문구가 어긋난 것이니 그쪽을 의심하라**(이 테스트를 고쳐 맞추지 마라).

새로 추가할 케이스(같은 describe 안, 기존 픽스처 `entries`·`loaded` 재사용):

1. **429 배너** — `loadError={{ kind: 'rateLimited' }}` 이면
   `'호출 한도를 초과했습니다 — 서비스 단계 키인지 확인해주세요'` 가 보이고, **스탈 배너 안에
   버튼이 없다**. 그리드는 그대로 남아 있다(항목 버튼이 여전히 있다).
   - 주의: 모달에는 "닫기"·"저장" 버튼이 항상 있으므로 `queryByRole('button')` 전역 단언은 쓸 수
     없다. `screen.getByTestId('stale-banner')` 를 잡아 그 **안에서** 버튼을 찾아라
     (`within(banner).queryByRole('button')`).
2. **401 배너** — `loadError={{ kind: 'invalidApiKey' }}` 이면 배너에 `'설정 열기'` 버튼이 있고,
   누르면 `onOpenSettings` 가 호출된다(`onRetry` 는 호출되지 않는다). `'다시 시도'` 버튼은 배너
   안에 없다.
3. **조회 불가 배너** — `loadError={{ kind: 'characterUnavailable' }}` 이면 배너 안에 버튼이 없다.

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 없음
npm test                                         # 전부 통과
npm run lint                                     # errors 0
git status --porcelain -- src/ | wc -l           # 2 이어야 한다 (컴포넌트 + 그 테스트)
grep -c '목록이 최신이 아닙니다' src/components/organisms/CharacterTrackingPicker/CharacterTrackingPicker.tsx  # 0 — 하드코딩이 사라졌다
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. **판별력을 확인하라**: `formatStaleRosterError(...)` 호출을 옛 하드코딩
   (`message="목록이 최신이 아닙니다"` + 항상 재시도)으로 되돌리면 새 케이스 3건이 **정확히 그 3건만**
   실패하고 기존 케이스는 전부 통과하는지 본다. 확인 후 되돌리고 결과를 summary 에 적어라.
3. 아키텍처 체크리스트:
   - `npx vitest run src/components/__tests__/layer-dependencies.test.ts` 통과
   - organism 이 `features/` 를 import 하는 것은 기존 관례다(3~4행에 이미 있다) — 새 위반을 만들지
     않았는가?
   - CLAUDE.md CRITICAL: `features/*` 가 아닌 이 파일에서 저장소·네이티브 API 직접 접근이 없는가?
4. 결과에 따라 `phases/rate-limit-copy/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`ContentCharacterStep.tsx` 를 건드리지 마라.** 이유: step 4 몫이다. 두 자리를 한 step 에서
  고치면 온보딩 쪽(액션 매핑이 다르다 — `openSettings` 가 없다)의 실수가 피커 테스트에 가려진다.
- **`ErrorState` 분기(88~106행)를 바꾸지 마라.** 이유: 목록이 **없을 때**의 문구·액션은 step 1 이
  `formatRosterError` 에서 이미 정했고, 온보딩 401 이 재시도를 유지하는 것은 의도다
  ([[ADR-114]] 결정 3).
- **`loadError` prop 의 타입을 바꾸지 마라.** 이유: `ScheduleSyncError | null` 이 이미 원인을
  전달한다([[ADR-062]] 결정 2).
- **기존 `network` 케이스 3건의 기대 문자열을 고치지 마라.** 이유: 그 문구가 바뀌지 않는 것이 이
  phase 의 범위 증명이다. 실패한다면 step 1 을 의심하라.
- **모달 레이아웃·높이 상수(`PICKER_BODY_MIN_H`)를 건드리지 마라.** 이유: [[ADR-107]] 결정이고 이
  이슈와 무관하다.
- 기존 테스트를 깨뜨리지 마라.
