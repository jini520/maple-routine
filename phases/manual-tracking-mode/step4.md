# Step 4: onboarding-tracking-mode-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-035 결정 1, 13, 16
- `/src/features/onboarding/state.ts` — `OnboardingStatus`/`OnboardingEvent`/`onboardingReducer` 전체(수정 대상)
- `/src/features/onboarding/store.ts` — `useOnboardingStore`(수정 대상), 특히 `runPrefetch`/`finalizeVerifiedAccounts`가 `PREFETCH_FINISHED`를 디스패치하는 지점
- `/src/app/onboarding/OnboardingScreen.tsx` — 상태별 화면 분기(수정 대상)
- `/src/app/onboarding/ApiKeyForm.tsx`, `/src/app/onboarding/AccountSelectionList.tsx` — **이미 카드 박스 없이 페이지 레이아웃으로 전환된(ADR-035 결정 16, 구현 완료) 최신 코드** — 이번에 만들 화면도 정확히 같은 레이아웃 관례(`w-full space-y-4` 루트, 옵션 버튼 클래스, CTA 버튼 클래스)를 그대로 따라야 한다
- **이전 step에서 만들어진 `/src/features/tracking-mode/store.ts`**(`useTrackingModeStore`, `setMode`) — 정확한 시그니처

## 작업

ADR-035 결정 13의 신규 3단계("자동/수동 선택")를 구현한다. 화면 스펙은 아래 와이어프레임을 그대로 따른다(전달받은 스펙):

> https://claude.ai/code/artifact/5a82ea43-c0cf-495d-ac4e-86e29fa72694

**주의**: 이 와이어프레임 HTML에는 폰 프레임(`.phone`), 상태바(`.status-bar`), 페이지 라벨, 하단 "스펙 노트" 패널 등 **문서화용 장식 요소**가 포함돼 있다 — 이런 것들은 구현 대상이 아니다. 실제로 구현해야 하는 것은 `.card` 안의 콘텐츠(제목·부제·옵션 2개·CTA 버튼)뿐이며, 그마저도 색상 값(`--primary` 등 CSS 변수)은 이 프로젝트의 기존 Tailwind 토큰(`bg-primary`, `text-text` 등)으로 치환해야 한다 — 와이어프레임의 하드코딩된 hex 값을 그대로 옮기지 마라.

### 1. 카피 (와이어프레임에서 그대로 가져올 것 — 자리표시용 초안이 아니라 이 값 그대로 구현)

- 제목: `진행 상황을 어떻게 관리할까요?`
- 부제: `나중에 설정에서 언제든 바꿀 수 있어요.`
- 옵션 1(자동, 기본 선택, "추천" 배지): 제목 `자동 · 게임 등록을 그대로 따라가기` / 본문 `게임 내 스케줄러에 등록한 콘텐츠와 완료 여부가 그대로 반영돼요. 등록하지 않은 콘텐츠는 표시되지 않아요.`
- 옵션 2(수동): 제목 `수동 · 내가 직접 관리하기` / 본문 `게임 등록 여부와 상관없이 원하는 콘텐츠만 골라 체크리스트로 관리해요. 지금 등록된 항목으로 목록을 시작하고, 이후엔 자유롭게 추가·삭제할 수 있어요.`
- CTA 버튼: `계속하기`

### 2. `src/app/onboarding/TrackingModeStep.tsx` 신규

```tsx
export interface TrackingModeStepProps {
  onSubmit: (mode: TrackingMode) => void
}

export function TrackingModeStep(props: TrackingModeStepProps): React.JSX.Element
```

- 내부 `useState<TrackingMode>('auto')`로 현재 선택을 관리한다(기본값 `'auto'` — ADR-035 결정 2와 일치).
- 옵션 버튼 2개는 `AccountSelectionList.tsx`의 계정 버튼과 **동일한 클래스 패턴**을 재사용한다: 선택 시 `border-primary bg-primary/15`, 미선택 시 `border-border hover:bg-primary/15`(`aria-pressed`로 선택 상태 노출). 와이어프레임의 별도 라디오 원(`.option-radio`) 마크업은 구현하지 마라 — `docs/persistence` 밖의 이 프로젝트 기존 선택 카드 패턴(`ThemeSelector`/`AccountSelectionList`)은 라디오 원 없이 테두리·배경만으로 선택 상태를 표현하므로, 이 화면도 새 스타일을 만들지 않고 그 관례를 따른다.
- "추천" 배지는 자동 옵션의 제목 옆에 작은 pill로 표시한다 — 기존 배지 스타일(`rounded-full bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1`, `docs/UI_GUIDE.md` "탭 토글" 카운트 배지와 동일 계열)을 재사용한다.
- CTA 버튼은 `AccountSelectionList.tsx`의 "계속하기" 버튼과 **정확히 동일한 클래스**를 쓴다: `w-full rounded-full bg-primary text-bg font-semibold hover:bg-primary-hover px-5 py-2.5 disabled:opacity-50`. 두 옵션 다 항상 선택 가능 상태라 비활성 조건은 없다(와이어프레임 스펙 노트 그대로 — 기본값이 이미 있으므로 계정 선택 화면과 달리 "선택 전엔 비활성"이 아니다).
- 루트는 `w-full space-y-4`(카드 박스 없음 — ADR-035 결정 16과 동일한 페이지 레이아웃).

### 3. `features/onboarding/state.ts` 수정

- `OnboardingStatus`에 `'selectingTrackingMode'`를 추가한다.
- `OnboardingEvent`에 `{ type: 'PREFETCH_FINISHED' }` 처리를 바꾼다: 기존에는 `'completed'`로 바로 전이했는데, 이제 `'selectingTrackingMode'`로 전이한다.
- 새 이벤트 `{ type: 'SELECT_TRACKING_MODE'; mode: TrackingMode }`를 추가하고, 리듀서는 이 이벤트를 받으면 **당장은** `status: 'completed'`로 전이한다(다음 step인 `onboarding-content-character-step`이 이 전이 대상을 `'selectingContentCharacters'`로 바꾼다 — 이 step은 그 전 단계까지만 완성한다).

### 4. `features/onboarding/store.ts` 수정

- `runPrefetch` 내부에서 `PREFETCH_FINISHED`를 디스패치하는 부분은 그대로 둔다(리듀서가 이미 `selectingTrackingMode`로 보내주므로 store 쪽 변경 불필요할 수 있다 — 실제로 필요한지 확인 후 최소로 수정).
- `selectTrackingMode(mode: TrackingMode): Promise<void>` 메서드를 스토어에 추가한다. 내부에서 `useTrackingModeStore.getState().setMode(mode)`를 호출(이 Promise가 resolve될 때까지 — 즉 ADR-035 결정 14(a)의 시드가 필요하면 그것까지 끝날 때까지 — 기다린 뒤) `onboardingReducer`에 `SELECT_TRACKING_MODE` 이벤트를 디스패치한다.
- **온보딩 이 시점에는 아직 `trackedCharacters:content`/`:boss`가 비어 있으므로**(다음 step에서야 캐릭터를 고른다) 트리거 (a)는 대상 없이 통과한다 — 이 함수 자체가 오래 걸리지는 않지만, 그래도 `selectTrackingMode`가 반환하는 Promise를 기다리는 동안 화면에 로딩 상태를 보여줄 수 있도록 스토어 메서드 자체는 비동기로 유지한다.

### 5. `app/onboarding/OnboardingScreen.tsx` 수정

`'selectingTrackingMode'` 케이스를 추가해 `TrackingModeStep`을 렌더링하고, `onSubmit`에 `selectTrackingMode`를 연결한다. 다른 스텝들과 동일하게 `<div className="flex justify-center px-4 pt-8 pb-4">` 래퍼를 쓴다.

### 테스트 (TDD)

- `features/onboarding/__tests__/state.test.ts`(있다면 확장, 없으면 신규): `PREFETCH_FINISHED` → `selectingTrackingMode` 전이, `SELECT_TRACKING_MODE` → `completed` 전이(이 step 기준) 검증.
- `features/onboarding/__tests__/store.test.ts`: `selectTrackingMode`가 `useTrackingModeStore.setMode`를 호출하고 그 뒤에 리듀서 상태가 전이되는지(모킹).
- `app/onboarding/__tests__/TrackingModeStep.test.tsx` 신규: 기본 선택이 "자동"인지, 옵션 클릭 시 `aria-pressed`가 바뀌는지, CTA 클릭 시 현재 선택된 모드로 `onSubmit`이 호출되는지 검증.
- `app/onboarding/__tests__/OnboardingScreen.test.tsx`(있다면): `selectingTrackingMode` 상태에서 `TrackingModeStep`이 렌더링되는지 추가 검증.

테스트를 먼저 작성하고 실패를 확인한 뒤 구현으로 통과시켜라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 카피가 와이어프레임 문구와 정확히 일치하는가(의역·축약 없이)?
   - 옵션 카드·CTA 버튼이 새 스타일을 만들지 않고 `AccountSelectionList.tsx`/`ThemeSelector.tsx`의 기존 클래스를 재사용했는가(`docs/UI_GUIDE.md` "AI 슬롭 안티패턴" — 불필요한 신규 스타일 금지)?
   - 온보딩 화면 전체가 여전히 카드 박스 없는 페이지 레이아웃을 유지하는가(ADR-035 결정 16)?
3. 결과에 따라 `phases/manual-tracking-mode/index.json`의 `step: 4`를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 와이어프레임의 폰 프레임/상태바/페이지 라벨/스펙 노트 패널 마크업을 실제 컴포넌트로 옮기지 마라. 이유: 그건 와이어프레임 문서 자체의 프레젠테이션 장치이지 화면 스펙이 아니다.
- 와이어프레임의 하드코딩된 hex 색상(`--primary: #F58B0F` 등)을 인라인 스타일이나 새 CSS 변수로 옮기지 마라. 이유: 이 프로젝트는 이미 `bg-primary`/`text-text` 같은 테마 토큰 클래스 체계가 있다(`docs/ARCHITECTURE.md` "테마 시스템") — 별도 색상 체계를 만들면 테마 전환(레테/렌/머쉬맘/혼테일)에서 이 화면만 깨진다.
- 라디오 원(`.option-radio`) 같은 새 선택 인디케이터 마크업을 만들지 마라. 이유: 기존 선택 카드 패턴(테두리+배경 색만으로 표현)과 다른 시각 언어를 하나 더 늘리면 `docs/UI_GUIDE.md`의 일관성 원칙에 어긋난다.
- `SELECT_TRACKING_MODE` 이벤트의 리듀서 전이 대상을 `'selectingContentCharacters'`로 미리 만들지 마라(그 상태 자체가 아직 존재하지 않는다) — 다음 step이 이 전이를 수정한다. 이 step에서는 `'completed'`로 전이해 빌드가 깨지지 않게만 해둔다.
- 기존 테스트를 깨뜨리지 마라.
