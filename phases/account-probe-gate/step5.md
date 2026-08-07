# Step 5: settings-verifying-ui

설정(계정 변경)의 `verifying` 단계에서 **"캐릭터 목록을 확인하고 있어요..." 문구를 없애고 진행률
바로 바꾼다.** 이 step 은 `AccountFlowStatus` 와 그 테스트만 다룬다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 `/docs/adr/ADR-NNN.md` 로 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-113.md` — **이번 phase 의 결정. 특히 결정 5.** step 0 이 만들었다
- `/docs/adr/ADR-061.md` — **결정 1**(스피너 2종) · **결정 6**(진행률은 얇은 바 하나) ·
  **`~중...` 은 새로고침 옆 한 곳만**
- `/docs/adr/ADR-086.md` — **결정 6**(계정 변경은 캐릭터를 다시 고를 때까지 커밋하지 않는다)
- `/docs/features/settings.md` — 계정 변경 절(step 0 이 갱신함)
- `/src/app/settings/AccountFlowStatus.tsx` (전문)
- `/src/app/onboarding/AccountSelectionList.tsx` — **step 4 가 넣은 대기 렌더링.**
  `verifying` 은 그 마크와 **같은 모양**이어야 한다
- `/src/components/atoms/ProgressBar/ProgressBar.tsx` — `percent` · `aria` 프롭 계약
- `/src/app/settings/__tests__/` 아래 `AccountFlowStatus` 테스트(있으면)
- `/src/features/settings/state.ts` — `SettingsStatus` 상태 머신

## 배경

설정의 계정 변경은 `verifying`(저장된 키로 `character/list` 재조회) → `selectingAccount`(계정 선택
목록) 순으로 간다. step 4 이후 `selectingAccount` 는 **프로브가 settle 할 때까지 진행률 바**를
보여준다. 즉 **두 대기가 연달아 온다.**

`verifying` 이 문구(`캐릭터 목록을 확인하고 있어요...`)이고 다음이 진행률 바이면 사용자는 **두 번의
서로 다른 대기**로 읽는다. [[ADR-113]] 결정 5 — 두 자리를 같은 진행률 바로 통일해 **하나의 연속된
로딩**으로 보이게 한다.

덤으로 [[ADR-061]] 의 "`~중...` 은 새로고침 옆 한 곳만" 규칙에 남아 있던 마지막 위반 하나가
사라진다(`docs/features/onboarding.md` 의 history 항목이 "설정 계정 변경엔 문구가 남아 있으나 별도
단계 통일 예정"으로 적어 둔 그 자리다).

## 작업

### 1. `/src/app/settings/AccountFlowStatus.tsx` — `verifying` 케이스

현재:

```tsx
case 'verifying':
  return (
    <p className="rounded-[14px] bg-surface border border-border p-6 text-sm text-text-muted">
      캐릭터 목록을 확인하고 있어요...
    </p>
  )
```

로 바꿀 것:

- `<Card className="p-6">`(이 파일의 다른 케이스와 같은 골격)** 안에 `ProgressBar` 하나**.
  `percent={0}`, `aria={{ now: 0, max: 100 }}`.
- **문구도, `(n/total)` 숫자도 붙이지 마라.** `verifying` 은 `character/list` 한 번이라 총량이
  없다 — 숫자를 지어내지 마라([[ADR-113]] 결정 5, 그리고 `CLAUDE.md` "모르는 것을 단정하지
  않는다"). 진행률 숫자는 다음 단계에서 총량을 알게 되는 순간 붙는다.
- 이 파일의 다른 케이스들은 `Card` 를 쓰고 `verifying` 만 인라인 `<p>` 에 카드 클래스를 직접 달고
  있다. **`Card` 로 통일하라** — 바뀐 뒤에도 시각적으로 같은 상자여야 한다(`Card` 의 기본 클래스가
  `rounded-[14px] bg-surface border border-border` 와 같은지 반드시 코드로 확인하고, 다르면 같아
  보이도록 맞춰라. 추정하지 마라).

`prefetching` 케이스는 **손대지 마라** — 그 자리는 문구 + 진행률이 이미 [[ADR-016]]·[[ADR-061]]
결정 6 대로다.

### 2. 테스트

- `'캐릭터 목록을 확인하고 있어요'` 문자열을 단언하는 테스트가 **저장소 전체에** 있는지
  `grep -rn` 으로 찾아 전부 갱신하라(`src/` 아래 어디든).
- `verifying` 상태에서 `role="progressbar"` 가 렌더되고 그 문구가 **없다**는 케이스를 추가하라.
- `verifying` → `selectingAccount` 로 넘어가도 진행률 바가 계속 있다(마크가 안 바뀐다)는 케이스를
  추가하면 결정 5 의 "하나의 연속된 로딩"이 회귀 가드로 고정된다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 통과
npm run lint    # 에러 0 (warnings 는 baseline 유지)
# 옛 문구가 제품 코드·테스트 어디에도 남아 있지 않다
! grep -rn '캐릭터 목록을 확인하고 있어요' src/
grep -q 'ProgressBar' src/app/settings/AccountFlowStatus.tsx
# 이 step 이 건드리는 제품 코드는 이 파일 하나뿐이다
git diff --stat -- src/ | grep -c 'AccountFlowStatus'
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **판별력 확인**: `verifying` 케이스를 옛 `<p>` 문구로 되돌리면 새 케이스가 실패하는지 확인하고
   되돌려라. 결과를 summary 에 적어라.
3. `docs/features/onboarding.md` 의 history 항목("설정 계정 변경(`AccountFlowStatus` `verifying`)엔
   문구가 남아 있으나 별도 단계 통일 예정")이 step 0 에서 이미 해소 사실로 갱신됐는지 **확인만**
   하라. 안 됐으면 step 6 에서 처리할 사실로 summary 에 적어라(여기서 문서를 고치지 마라).
4. 아키텍처 체크리스트:
   - 화면은 `app/`, 공용 UI 는 `components/` 분리를 지켰는가?
   - 새 컴포넌트를 만들지 않고 기존 atom(`ProgressBar`·`Card`)을 썼는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가?
5. 결과에 따라 `phases/account-probe-gate/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`verifying` 에 가짜 진행률을 만들지 마라**(타이머로 채우기·"약 50%" 등). 이유: 총량을 모르는
  단계다. 0% 바는 "시작했다"는 사실만 말하고 거짓을 말하지 않는다.
- **`prefetching`·`selectingCharacters`·`error` 케이스를 고치지 마라.** 이유: 이번 결정의 범위가
  아니다. `prefetching` 의 문구 + 진행률은 [[ADR-016]] 이 정한 그대로다.
- **`AccountSelectionList.tsx` 나 `useAccountProbes` 를 고치지 마라.** 이유: step 3·4 가 확정한
  계약이다.
- **문서를 고치지 마라.** 이유: 문서 마감은 step 6 의 몫이고, step 0 이 이미 정책을 써 놨다.
- **새 컴포넌트를 만들지 마라.** 이유: `components/` 는 4계층 디렉터리 구조와 의존 방향이 테스트로
  강제된다. 이 자리는 기존 atom 두 개로 충분하다.
- **기존 테스트를 깨뜨리지 마라.**
