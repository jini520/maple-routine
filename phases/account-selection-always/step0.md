# Step 0: docs-policy

이 phase는 **이슈 #60 — "메이플 ID 계정이 1개여도 계정 선택 페이지 표시 (자동 확정 제거)"** 를 구현한다. 이 step은 CLAUDE.md의 docs-first CRITICAL 규칙에 따라 **문서만** 갱신한다. 코드는 step 1~3에서 바꾼다.

## 배경 (이 step이 필요한 이유)

현재 앱은 메이플 ID(계정)가 **정확히 1개면 선택 화면을 건너뛰고 자동 확정**한 뒤 곧바로 예열(prefetching)로 넘어간다. [[ADR-016]]에 명시된 의도적 동작이고, 온보딩과 설정(계정 변경) 두 경로에 각각 복제돼 있다.

이걸 없애려는 이유: 자동 확정은 클릭 한 번을 아끼지만, **사용자가 "어떤 메이플 ID로 연동됐는지"를 한 번도 보지 못하고 지나간다.** 나중에 부계정 생성 등으로 계정이 늘면 설정에서 계정 변경 화면을 그때 처음 보게 되는데, 그전까지 자신이 무엇에 연결돼 있었는지 확인할 기회가 아예 없었다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — 이 작업의 대상은 `features/onboarding.md`·`features/settings.md`)
- `/docs/ADR.md` (슬림 인덱스 — 새 ADR 한 줄을 여기 추가한다. **ADR 전문을 통째로 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-016.md` — 자동 확정이 명시된 결정. 결정 1의 "계정이 확정되면(단일 계정 자동 확정 또는 다중 계정 중 선택)" 문장이 이번에 정정 대상이다.
- `/docs/features/onboarding.md` — "정책 > 계정 선택" 문장과 "UI > 계정(메이플 ID) 선택 목록", 하단 "폐기된 정책 (history)" 섹션 구조를 확인하라.
- `/docs/features/settings.md` — "정책 > 계정(메이플 ID) 변경" 항목.
- 아래는 **읽기만** 하라(이 step에서 수정 금지). 무엇이 바뀔지 알아야 문서를 정확히 쓸 수 있다:
  - `/src/features/onboarding/state.ts` (`API_KEY_VERIFIED` 리듀서 `:78-96`)
  - `/src/features/onboarding/store.ts` (`finalizeVerifiedAccounts` `:53-77`, `selectAccount` `:132-153`)
  - `/src/features/settings/state.ts` (`ACCOUNTS_VERIFIED` `:49-64`)
  - `/src/features/settings/store.ts` (`finalizeAccounts` `:44-51`, `selectAccount` `:99-116`)
  - `/src/app/onboarding/AccountSelectionList.tsx` (온보딩·설정이 공유하는 선택 UI. 항목을 눌러 하이라이트 → "계속하기"로 확정하는 2단계 구조)

이 phase의 첫 step이라 이전 step 산출물은 없다.

## 작업

### 1. `docs/adr/ADR-051.md` 신규 작성

기존 ADR 파일과 동일한 형식을 따른다(`docs/adr/ADR-050.md` 참고 — 첫 줄이 `### ADR-NNN: 제목 (상태)`, 이어서 `**배경**` / `**결정**` / `**이유**` / `**트레이드오프**`).

- 제목: `### ADR-051: 메이플 ID 계정 선택 — 단일 계정 자동 확정 폐기, 항상 선택 화면 경유 (설계, 구현 전)`
- **결정**은 아래 3가지를 담아라:
  1. **온보딩·설정 두 경로 모두 계정 수와 무관하게 항상 `selectingAccount` 상태를 거친다.** `API_KEY_VERIFIED`(온보딩)·`ACCOUNTS_VERIFIED`(설정) 리듀서의 `accounts.length === 1` 분기를 제거한다.
  2. **`selectedAccountId` 저장은 오직 사용자가 "계속하기"를 눌렀을 때의 `selectAccount` 경로 하나로 일원화한다.** 리듀서에 이벤트를 보내기 **전에** 미리 저장하던 선제 호출을 제거한다. 이 선제 저장은 [[ADR-008]]의 "자동으로 다음 단계로 전이할 때도 `selectedAccountId`가 먼저 저장돼야 한다"는 요구에서 나온 것인데, 자동 전이 자체가 없어지므로 전제가 사라진다 — 남겨두면 사용자가 고르기도 전에 저장되는 앞선 부수효과가 된다.
  3. **계정이 정확히 1개일 때는 그 항목을 초기 하이라이트로 지정한다.** 화면을 보여주는 것이 목적이지 탭 수를 늘리는 게 목적이 아니므로, 항목 선택 탭 1회는 아껴주고 "계속하기"라는 확정 행위만 남긴다.
- **이유**: 위 "배경" 문단의 논지를 쓰되, "예열([[ADR-016]] 결정 1)은 그대로 유지되고 바뀌는 건 예열이 시작되는 시점(자동 확정 직후 → 사용자 확정 직후)뿐"임을 명시하라.
- **트레이드오프**: 계정이 1개인 대다수 사용자에게 온보딩 단계가 화면 하나만큼 늘어난다(하이라이트 자동 지정으로 실제 조작은 "계속하기" 탭 1회).

### 2. `docs/ADR.md` 인덱스에 한 줄 추가

기존 표 형식(`| [ADR-NNN](./adr/ADR-NNN.md) | 제목 · 상태 |`)에 맞춰 ADR-050 다음 줄에 ADR-051을 추가한다.

### 3. `docs/adr/ADR-016.md`에 정정 문단 추가

**본문의 기존 문장은 절대 지우거나 고쳐 쓰지 마라.** 문서 하단(기존 "정정 —" 문단들과 같은 위치)에 새 문단을 추가한다:

- 형식은 그 문서에 이미 있는 정정 문단들과 동일하게 `**정정(2026-07-29) — 단일 계정 자동 확정 폐기 ([[ADR-051]])**: ~~취소선 친 옛 내용~~ → 새 정책` 으로 쓴다.
- 담을 내용: 결정 1의 "계정이 확정되면(**단일 계정 자동 확정** 또는 다중 계정 중 선택)"에서 자동 확정 경로가 사라지고, 계정 수와 무관하게 사용자가 선택 화면에서 확정한 뒤 예열이 시작된다는 것. **예열 파이프라인 자체(결정 1의 나머지·결정 2~5)는 아무것도 바뀌지 않는다**는 점을 분명히 적어라.

### 4. `docs/features/onboarding.md` 갱신

- "정책 > 계정 선택" 항목의 `account_list 가 2개 이상이면 "어느 메이플 ID를 쓸지" 선택 화면` 부분을 **계정 수와 무관하게 항상 선택 화면을 보여준다**로 고치고 `([[ADR-051]])`를 단다.
- "UI > 계정(메이플 ID) 선택 목록 — `AccountSelectionList`" 절에 **계정이 1개면 그 항목을 초기 하이라이트로 지정한다**는 한 줄을 추가한다.
- 하단 "폐기된 정책 (history)"에 한 줄 추가: `- ~~계정이 정확히 1개면 선택 화면 없이 자동 확정~~ → 계정 수와 무관하게 항상 선택 화면 경유([[ADR-051]], 2026-07-29).`

### 5. `docs/features/settings.md` 갱신

"정책 > 계정(메이플 ID) 변경" 항목에 **계정이 1개여도 선택 UI를 보여준다([[ADR-051]])** 는 것을 한 구절 추가한다. 온보딩과 설정 두 경로가 같은 규칙을 공유한다는 점이 드러나야 한다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음(코드 무변경이므로 그대로 통과해야 한다)
npm test        # 전체 테스트 통과(코드 무변경이므로 그대로 통과해야 한다)
npm run lint    # 경고 0

# 문서 반영 확인 — 아래 4개 커맨드가 모두 결과를 내야 한다
test -f docs/adr/ADR-051.md && echo "ADR-051 OK"
grep -q "ADR-051" docs/ADR.md && echo "index OK"
grep -q "ADR-051" docs/adr/ADR-016.md && echo "ADR-016 정정 OK"
grep -q "ADR-051" docs/features/onboarding.md && grep -q "ADR-051" docs/features/settings.md && echo "features OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ADR 전문은 `docs/adr/ADR-051.md`에, 인덱스에는 한 줄만 들어갔는가?
   - ADR-016 본문의 옛 내용을 **삭제하지 않고** 정정 문단으로 남겼는가?
   - `docs/features/onboarding.md`의 옛 정책을 지우지 않고 "폐기된 정책 (history)"로 옮겼는가?
   - `src/` 아래 파일을 하나도 수정하지 않았는가? (`git status`로 확인)
3. 결과에 따라 `phases/account-selection-always/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 **ADR-051의 결정 1·2·3을 한 줄로 압축해** 적어라(다음 step들이 이 요약만 보고 구현 규칙을 알 수 있어야 한다).
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/` 아래 어떤 파일도 수정하지 마라. 이유: CLAUDE.md의 docs-first CRITICAL 규칙에 따라 이 step은 문서 확정 전용이고, 구현은 step 1~3에서 TDD로 진행한다.
- `docs/adr/ADR-016.md` 본문의 기존 결정·이유·트레이드오프 문장을 고쳐 쓰거나 삭제하지 마라. 이유: CLAUDE.md — "정책을 바꿀 땐 옛 내용을 지우지 말고" 정정/history로 남기는 것이 이 저장소의 규칙이다. 옛 결정이 왜 그랬는지 추적할 수 없게 된다.
- 새 ADR을 `docs/ADR.md` 본문에 통째로 쓰지 마라. 이유: `ADR.md`는 슬림 인덱스이고 전문은 `docs/adr/ADR-NNN.md` 개별 파일에 둔다.
- `docs/features/onboarding.md`의 "열린 질문" 항목(캐릭터 관리 피커 개선 잔여)을 지우지 마라. 이유: 이번 작업과 무관한 별개 항목이다.
- 기존 테스트를 깨뜨리지 마라.
