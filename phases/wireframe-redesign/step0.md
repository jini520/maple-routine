# Step 0: character-chip-tabs

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/UI_GUIDE.md` — 색상 토큰(특히 Primary의 Subtle/Border/텍스트-잉크 값)과 라운딩 스케일
- `src/components/BossPortrait/BossPortrait.tsx` — 기존 공용 컴포넌트가 어느 디렉토리 컨벤션(`components/{ComponentName}/{ComponentName}.tsx`)을 따르는지 참고

## 배경

사용자가 제공한 실제 와이어프레임(저장된 위치는 이 세션에만 있어 이 step에서는 접근 불가 — 아래 서술로 필요한 정보를 전부 옮겨적었다)을 검토한 결과, 일간/주간 스케줄러 화면은 캐릭터가 여러 명일 때 전부 한 화면에 나열하는 게 아니라 **캐릭터별 칩(chip) 탭으로 전환**해서 한 번에 한 캐릭터만 보여주는 구조였다. 이번 step은 그 칩 탭 UI를 재사용 가능한 컴포넌트로 만든다 — 다음 step들(`daily-screen-redesign`, `weekly-screen-redesign`)이 이 컴포넌트를 그대로 가져다 쓴다.

**와이어프레임의 칩 탭 시각 패턴** (그대로 옮김):
- 가로로 나열된 알약(pill) 모양 버튼들, 버튼 사이 간격은 좁게(예: `gap-1.5`)
- 비활성 칩: 얇은 보더(`border-[#F0DFD1]`), 흐린 텍스트색(`text-[#B7A490]`)
- 활성 칩: 강조 보더(`border-[#FFC9A8]`), 옅은 강조 배경(`bg-[#FFE9DB]`), 강조 텍스트색(`text-[#C2410C]`)
- 패딩은 작게(가로로 긴 알약), 폰트는 본문보다 한 단계 작게

**중요**: 와이어프레임은 여러 폰 목업을 한 페이지에 미리보기용으로 나란히 넣으려고 폰트 크기를 9~13px로 극단적으로 축소해서 그렸다. 이 컴포넌트는 실제 앱에 들어가므로 그 축소 비율을 그대로 베끼지 말고, 일반적인 모바일 앱에서 읽기 편한 크기(`text-xs`~`text-sm` 정도)로 만들어라 — 비활성/활성 색상 대비와 알약 모양·좁은 간격이라는 **구조**만 그대로 가져오면 된다.

## 작업

`src/components/CharacterChipTabs/CharacterChipTabs.tsx`:

```ts
export interface CharacterChipTabsProps {
  characters: Array<{ ocid: string; characterName: string }>
  selectedOcid: string
  onSelect: (ocid: string) => void
}
export function CharacterChipTabs(props: CharacterChipTabsProps): React.JSX.Element
```
- `characters`를 가로로 나열된 칩 버튼으로 렌더링한다. 각 버튼의 `onClick`은 `onSelect(character.ocid)`를 호출한다.
- `character.ocid === selectedOcid`인 칩에만 활성 스타일(위 "활성 칩" 색상)을 적용하고, 나머지는 비활성 스타일을 적용한다.
- 캐릭터가 1명뿐이어도 그대로 칩 1개를 렌더링해라(캐릭터가 늘어날 걸 대비해 조건 분기를 넣지 마라 — 항상 같은 구조).

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `src/components/CharacterChipTabs/__tests__/CharacterChipTabs.test.tsx`(`// @vitest-environment jsdom`)에 테스트를 먼저 작성한 뒤(TDD) 구현하라.
   - 캐릭터 수만큼 칩이 렌더링된다.
   - `selectedOcid`와 일치하는 캐릭터의 칩에만 활성 스타일 클래스(또는 `aria-pressed`/`aria-selected` 등 접근성 속성 — 재량)가 적용된다.
   - 칩 클릭 시 그 캐릭터의 `ocid`로 `onSelect`가 호출된다.
3. 결과에 따라 `phases/wireframe-redesign/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 스타일 규칙을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 와이어프레임의 축소된 폰트 크기(9~13px)를 그대로 쓰지 마라. 이유: 여러 목업을 한 페이지에 미리보기용으로 넣으려고 축소한 것이지 실제 앱 크기가 아니다.
- `app/`이나 다른 feature 코드를 만들지 마라. 이유: 이번 step은 재사용 컴포넌트 하나만 다룬다.
- 기존 테스트를 깨뜨리지 마라.
