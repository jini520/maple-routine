# Step 4: selection-wait-ui

`AccountSelectionList` 가 **프로브가 settle 하기 전에는 목록을 그리지 않고 진행률만 보여주도록**
바꾼다. 이 step 은 이 컴포넌트와 그 테스트만 다룬다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 `/docs/adr/ADR-NNN.md` 로 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-113.md` — **이번 phase 의 결정. 특히 결정 3·4·5.** step 0 이 만들었다
- `/docs/adr/ADR-061.md` — **결정 1**(스피너 2종 규칙) · **결정 6**(진행률은 얇은 바 하나).
  [[ADR-113]] 결정 5 가 결정 1 에 두 번째 예외를 만든 자리다
- `/docs/adr/ADR-086.md` — **결정 8**(조회 불가 계정 선택 차단)
- `/docs/adr/ADR-051.md` — **결정 3**(계정이 1개면 초기 하이라이트)
- `/docs/features/onboarding.md` — "계정 선택 프로브" 절(step 0 이 갱신함)
- `/docs/foundation/design-system.md` — 로딩·진행률 표현 절
- `/src/features/onboarding/use-account-probes.ts` — **step 3 이 확장한 반환 타입**
  (`{ probes, isSettled, progress }`)
- `/src/app/onboarding/AccountSelectionList.tsx` (전문)
- `/src/app/onboarding/__tests__/AccountSelectionList.test.tsx` (전문)
- `/src/components/atoms/ProgressBar/ProgressBar.tsx` — `percent` · `aria` 프롭 계약
- `/src/app/onboarding/OnboardingScreen.tsx` — `prefetching` 케이스(50~68행)가 쓰는
  `ProgressBar` 사용 형태. **그 골격을 참고하되 설명 문구는 붙이지 않는다**

## 배경

[[ADR-113]] 결정 3 — 지금은 `useAccountProbes` 의 초기값이 `{}` 라 목록이 **프로브 결과를 기다리지
않고 즉시** 그려진다. 그래서 사용자는 이런 순서를 본다:

1. 고를 수 있어 보이는 카드가 뜬다(잠정 대표 = `character/list` 기준).
2. 잠시 뒤 "이 계정의 캐릭터를 조회할 수 없습니다" 경고가 튀어나오며 그 카드가 비활성이 된다.
3. 대표 캐릭터의 이름·레벨·초상화도 그 사이에 한 번 바뀐다.

"모르는 것을 단정하지 않는다"는 원칙으로 만든 규칙이었지만, 실제로는 **고를 수 없는 카드를 고를 수
있는 것처럼 먼저 보여주고 나서 뺏는** 결과가 됐다. 이번 결정은 같은 원칙을 **"모르는 동안은
보여주지도 않는다"** 로 적용한다.

## 작업

### 1. `/src/app/onboarding/AccountSelectionList.tsx`

`const { probes, isSettled, progress } = useAccountProbes(props.accounts)` 로 받고,
**`isSettled === false` 이면 목록·안내 문구·"계속하기" 대신 진행률만 그린다.**

- 바깥 래퍼(`<div className="w-full space-y-4">`)는 **유지하라** — 설정 모달(`AccountFlowStatus`)이
  이 컴포넌트를 자기 카드 안에 넣으므로 바깥 상자를 잃으면 배경 없이 뜬다.
- 대기 내용은 **진행률 숫자 `(completed/total)` + `ProgressBar`** 두 요소다.
  **설명 문구를 붙이지 마라** ([[ADR-113]] 결정 5 — 원 요청이 "문구 없이"였고, 직후에 오는
  `verifying` 단계와 마크가 일치해야 하나의 연속된 로딩으로 읽힌다).
- `percent` 는 `total > 0` 일 때만 `Math.round(completed / total * 100)`, 아니면 `0`
  (`OnboardingScreen.tsx` `prefetching` 케이스와 같은 계산 — 0 나누기를 만들지 마라).
- `aria` 는 `{ now: percent, max: 100 }` 로 넘겨라(같은 관례).
- **"사용할 메이플 ID를 선택해주세요." 문구와 "계속하기" 버튼도 대기 중에는 그리지 마라.**
  이유: 고를 것이 없는데 고르라고 하는 화면이 된다.
- `isSettled === true` 이후의 렌더는 **지금과 완전히 동일해야 한다.** 카드 마크업·초상화 크롭 상수·
  경고 문구·`disabled` 조건·[[ADR-051]] 결정 3 초기 하이라이트를 **한 글자도 바꾸지 마라.**

**주석 정정**: 51~53행("프로브가 끝나기 전에는 `character/list` 기준으로 잠깐 보여주고 결과가 오면
교체된다")과 57~59행("프로브가 도착하기 전에는 고를 수 있다")은 이제 사실이 아니다. 목록이 그려지는
시점에는 이미 프로브 결과가 있다는 사실과 [[ADR-113]] 결정 3 참조로 바꿔라.

`pickRepresentativeCharacter` 폴백(`probe?.representative ?? pickRepresentativeCharacter(...)`)은
**남겨라** — 프로브가 실패한 계정은 `probes[accountId]` 가 없을 수 있고([[ADR-113]] 결정 7,
"모르는 실패를 영구로 단정하지 않는다"), 그때 카드가 빈 채로 남으면 안 된다. 다만 주석은 "잠정
표시"가 아니라 "프로브 실패 시 폴백"으로 정정하라.

### 2. `/src/app/onboarding/__tests__/AccountSelectionList.test.tsx` (TDD — 먼저 뒤집어라)

**뒤집어야 하는 계약 2건:**

- `:274` `'프로브가 끝나기 전에는 경고를 띄우지 않는다 — 모르는 상태를 단정하지 않는다'`
- `:318` `'프로브가 도착하기 전에는 고를 수 있다 — 모르는 것을 단정하지 않는다'`

두 케이스 모두 `mockedUseAccountProbes.mockReturnValue({})` 로 **프로브 미도착 상태의 목록 렌더**를
단언한다. 이제 그 상태에서는 목록 자체가 없다. 두 케이스를 아래로 **대체**하라(이름도 새 계약을
말하도록 바꿔라):

- `isSettled: false` 이면 계정 카드도 "계속하기"도 "사용할 메이플 ID를 선택해주세요."도 렌더되지
  않는다.
- `isSettled: false` 이면 `role="progressbar"` 와 `(completed/total)` 표기가 렌더된다.
- `isSettled: true` 로 바뀌면 목록과 "계속하기"가 나타난다.

**`:329` `'프로브가 고른 대표 캐릭터로 표기를 교체한다'`** — "교체"라는 말이 더 이상 맞지 않는다
(잠정 표시가 없으므로 교체가 아니다). 이름을 사실에 맞게 고치고 단언은 유지하라.

**나머지 케이스**는 `isSettled: true` 를 주고 **단언을 그대로 두어라.** 목 반환값의 형태만 맞추면
된다(step 3 이 이미 형태를 맞춰 놨을 것이다).

**추가 케이스**: 진행률이 `progress` 를 그대로 반영한다(예: `{ completed: 12, total: 40 }` →
`aria-valuenow` 가 30).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 통과
npm run lint    # 에러 0 (warnings 는 baseline 유지)
grep -q 'isSettled' src/app/onboarding/AccountSelectionList.tsx
grep -q 'ProgressBar' src/app/onboarding/AccountSelectionList.tsx
# 옛 계약을 말하는 테스트 이름이 남아 있지 않다
! grep -q '프로브가 도착하기 전에는 고를 수 있다' src/app/onboarding/__tests__/AccountSelectionList.test.tsx
! grep -q '프로브가 끝나기 전에는 경고를 띄우지 않는다' src/app/onboarding/__tests__/AccountSelectionList.test.tsx
# 이 step 이 건드리는 제품 코드는 이 파일 하나뿐이다
git diff --stat -- src/ | grep -c 'AccountSelectionList'
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **판별력 확인**: `isSettled` 게이트를 지우고(항상 목록을 그림) 새 케이스가 실제로 실패하는지
   확인한 뒤 되돌려라. 결과를 summary 에 적어라.
3. `OnboardingScreen` 의 `selectingAccount` 와 `error` 두 케이스가 **같은 컴포넌트를 같은 위치에서**
   렌더하는지 확인하라(현재 그렇다). 그래야 계정 선택 실패로 `error` 로 갔다가 돌아올 때 프로브가
   다시 돌지 않는다. **`OnboardingScreen.tsx` 를 수정할 필요는 없다** — 확인만 하고, 만약 프로브가
   재실행되는 구조라면 그 사실을 summary 에 적어라(고치지는 마라).
4. 아키텍처 체크리스트:
   - 화면은 `app/`, 상태·로직은 `features/`, 공용 UI 는 `components/` 분리를 지켰는가?
   - `components/` 의 4계층(atoms/molecules/organisms/templates) 의존 방향을 어겼는가?
     (이 step 은 기존 atom `ProgressBar` 를 쓸 뿐이므로 새 컴포넌트를 만들지 마라)
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가?
5. 결과에 따라 `phases/account-probe-gate/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **설명 문구를 붙이지 마라**("계정을 확인하고 있어요" 등). 이유: [[ADR-113]] 결정 5 가 "문구 없이
  진행률 바"로 확정했고, 직후 `verifying` 단계와 마크가 달라지면 두 번의 대기로 읽힌다.
- **스피너(`MapleSweepSpinner`)를 쓰지 마라.** 이유: 이 자리는 총량을 시작 시점에 아는 대기라
  [[ADR-113]] 결정 5 가 진행률 바로 정했다. 불확정 스피너는 아는 것을 안 보여주는 것이다.
- **`AccountFlowStatus.tsx` 를 고치지 마라.** 이유: 설정 `verifying` 단계는 step 5 의 몫이다.
- **`useAccountProbes` 를 고치지 마라.** 이유: step 3 이 확정한 계약이다. 여기서 필요한 값이
  없다면 그것은 step 3 의 결함이므로 summary 에 적고 이 step 에서 훅을 바꾸지 마라.
- **`isSettled: true` 이후의 마크업을 "개선"하지 마라.** 이유: `CLAUDE.md` — 모든 변경 라인은
  요청에 직결돼야 한다. 카드 스타일·크롭 상수·경고 문구는 이번 결정과 무관하다.
- **기존 테스트의 단언을 필요 없이 고치지 마라.** 위에 지정한 3건(2건 대체 + 1건 이름 정정) 외에는
  목 반환값 형태만 맞춘다.
