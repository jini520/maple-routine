# Step 2: onboarding-redesign

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — [[ADR-007]] "온보딩 흐름: API 키 발급 안내는... openapi.nexon.com 링크 제공 + 간단한 샘플 이미지 첨부 + 설명 문구로 안내한다"는 확정 사항. **지금 있는 `ApiKeyForm`은 이 중 "샘플 이미지" 부분이 빠져 있다 — 이번 step에서 추가한다.**
- `src/app/onboarding/ApiKeyForm.tsx`, `src/app/onboarding/AccountSelectionList.tsx` — 지금 이 두 컴포넌트를 수정한다. 정확한 현재 props/구조를 먼저 읽어라.
- `src/app/onboarding/__tests__/ApiKeyForm.test.tsx`, `src/app/onboarding/__tests__/AccountSelectionList.test.tsx` — 기존 테스트. 이번 변경에 맞게 갱신해야 한다.

## 배경

사용자가 제공한 실제 와이어프레임을 검토한 결과, 두 화면 모두 지금 구현과 차이가 있었다(그대로 옮김).

**01 온보딩 · API 키 입력**: 제목 → (부제 텍스트) → **샘플 이미지 자리표시자**(점선 박스, "API 키를 어디서/어떻게 발급받는지 보여주는 스크린샷" 용도 — 실제 스크린샷 에셋은 없으니 점선 테두리 박스에 "샘플 이미지" 같은 안내 텍스트만 넣은 플레이스홀더로 대체) → `openapi.nexon.com` 링크 + 설명 문구 → 입력 필드 → 제출 버튼. 지금 구현엔 샘플 이미지 자리가 아예 없다.

**02 온보딩 · 계정 선택**: 각 계정이 원형 아바타 플레이스홀더 + 2줄 텍스트(1줄: "닉네임 · 직업 Lv.레벨", 2줄: "월드 · 캐릭터 N명")로 된 카드다. 그리고 **탭하면 바로 선택·확정되는 게 아니라, 먼저 카드를 탭해 하이라이트(선택 상태 표시)한 뒤 하단의 "계속하기" 버튼을 눌러야 확정**되는 2단계 흐름이다. 지금 구현은 카드(버튼) 하나를 누르면 그 즉시 `onSelect`가 호출돼 확정돼버린다 — 오탭으로 바로 계정이 확정되는 걸 막기 위해 이번 step에서 "선택 → 계속하기 확인" 2단계로 바꾼다.

**중요**: 와이어프레임은 여러 폰 목업을 한 페이지에 넣으려고 폰트를 9~13px로 축소해서 그렸다. 실제 앱에서는 그 크기를 베끼지 말고 평소 쓰던 크기(`text-sm` 등, 지금 두 컴포넌트가 이미 쓰고 있는 크기)를 유지하고, **구조**(요소 순서, 카드 레이아웃, 2단계 확인 흐름)만 맞춰라.

## 작업

### 1. `ApiKeyForm.tsx`

- 입력 필드 위(설명 문구보다 앞)에 샘플 이미지 자리표시자를 추가하라: 점선 테두리 박스(`border-2 border-dashed border-[#F0DFD1] rounded-[10px]`) 안에 "API 키 발급 화면 예시" 같은 안내 텍스트(`text-[#B7A490]`), 적당한 높이(예: `h-32`)를 줘라. 실제 이미지 파일은 없으니 `<img>`가 아니라 텍스트 플레이스홀더로 만들어라.
- 나머지 로직(제출 핸들러, 검증, 에러 표시)은 그대로 유지한다.

### 2. `AccountSelectionList.tsx`

- props 시그니처는 그대로 유지해도 되고(`onSelect`는 여전히 최종 확정 시에만 호출), 컴포넌트 내부에 "현재 하이라이트된 accountId"를 위한 로컬 상태(`useState<string | null>`)를 추가하라.
- 각 계정 카드를 클릭하면 `onSelect`를 바로 호출하지 말고, 로컬 상태만 그 accountId로 갱신해 하이라이트 스타일(강조 보더 + 옅은 배경, 예: `border-[#FFC9A8] bg-[#FFE9DB]`)을 적용하라.
- 카드 구조를 2줄로 바꿔라: 원형 아바타 플레이스홀더(장식용 빈 원, 예: `w-9 h-9 rounded-full bg-[#FFF3EA] border border-[#F0DFD1]`) + 텍스트 영역(1줄: `${대표캐릭터.name} · ${대표캐릭터.jobClass} Lv.${대표캐릭터.level}`, 2줄: `${대표캐릭터.world} · 캐릭터 ${account.characters.length}명`).
- 하단에 "계속하기" 버튼을 추가하라. 하이라이트된 계정이 없으면 비활성화(`disabled`)하고, 있으면 클릭 시 그 accountId로 `props.onSelect`를 호출한다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 테스트를 먼저 갱신한 뒤(TDD) 구현을 맞춰라.
   - `ApiKeyForm.test.tsx`: 샘플 이미지 자리표시자 텍스트가 렌더링되는지 확인하는 케이스 추가. 기존 제출/검증/에러 테스트는 그대로 통과해야 한다.
   - `AccountSelectionList.test.tsx`: 카드를 클릭해도 `onSelect`가 즉시 호출되지 않는다는 것, 카드 클릭 후 "계속하기"를 클릭해야 그 accountId로 `onSelect`가 호출된다는 것, "계속하기"가 초기엔 비활성화 상태라는 것, 2줄 텍스트(이름·직업·레벨 / 월드·캐릭터 수)가 렌더링된다는 것을 검증하라.
3. 결과에 따라 `phases/wireframe-redesign/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 실제 스크린샷 이미지 파일을 새로 만들거나 요구하지 마라. 이유: 그런 에셋이 없으니 텍스트 플레이스홀더로 대체한다.
- `AccountSelectionList`의 `onSelect` prop 시그니처(`(accountId: string) => void`)를 바꾸지 마라. 이유: 상위(`OnboardingScreen`)와 스토어(`selectAccount`)는 그대로 두고 이 컴포넌트 내부 흐름만 2단계로 바꾼다.
- 와이어프레임의 축소된 폰트 크기를 그대로 쓰지 마라.
- 기존 테스트를 깨뜨리지 마라(단, 이번 변경에 맞게 고쳐야 하는 테스트는 함께 갱신).
