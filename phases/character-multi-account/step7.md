# Step 7: reorder-drag

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/adr/ADR-144.md` 결정 5 전문** · **`/docs/adr/ADR-143.md` 결정 3**
- `/docs/ADR.md` 에서 **[[ADR-131]] · [[ADR-099]] · [[ADR-130]]** 만
- 코드: **step 6 이 만든 캐릭터 관리 화면 전체** · step 4 의 `CharacterRow`/`DragHandle` ·
  `packages/app-rn/src/components/templates/ScreenScroll/` · `packages/app-rn/package.json`
  (**reanimated·gesture-handler 가 이미 있는지 먼저 확인하라**)

## 작업

위 층 «선택된 캐릭터» 목록에 **끌어서 순서 바꾸기**를 붙인다. 이 step 은 **그 상호작용 하나만** 한다.

### 규칙 (설계 의도 — 벗어나지 마라)

- **핸들에서만 끌기가 시작된다.** 행 아무 데서나 끌리면 페이지 세로 스크롤과 다툰다.
  아래 층 카드는 «누르면 이동» 이라 그쪽에는 핸들도 끌기도 **없다.**
- **놓은 자리가 곧 배열 순서**다. 저장은 step 6 의 저장 경로를 그대로 쓴다(순서만 바뀌어도 저장이
  활성이다).
- **끄는 동안 화면 가장자리에서 자동 스크롤**이 필요하다 — 리스트가 화면보다 길면 목록 끝으로 못
  옮긴다. [[ADR-131]] 때문에 페이지 전체가 스크롤되므로, **스크롤 주체가 화면의 `ScrollView`** 라는
  것을 전제로 풀어라.
- **접근성 대체 경로를 함께 둔다** — 끌기는 스크린리더로 조작할 수 없다. 행의 접근성 액션으로
  「위로 옮기기」/「아래로 옮기기」를 주고, **끌기와 같은 결과**를 내게 하라(순서 계산 함수를 하나만
  두고 둘이 그것을 부른다).

### 구현 선택

- 이미 있는 의존성으로 풀 수 있으면 **새 패키지를 추가하지 마라.** 추가가 불가피하면 그 이유와
  대안 검토를 summary 에 적어라(이 저장소는 의존성 추가를 ADR 급으로 다룬다).
- 순서 계산은 **순수 함수**로 떼어 내고 테스트를 그 함수에 걸어라 — 제스처는 jest 로 검증이 어렵다.

```ts
export function moveOcid(ocids: string[], from: number, to: number): string[]
```

### 테스트 먼저

- `moveOcid`: 위로·아래로·경계(첫/끝) · 같은 자리면 **같은 배열 내용**
- 접근성 액션 둘이 `moveOcid` 와 같은 결과를 낸다
- 아래 층 행에는 핸들·끌기·순서 액션이 **없다**
- 순서만 바뀌어도 저장 버튼이 활성이 된다(step 6 의 판정과 이어지는지)

## Acceptance Criteria

```bash
npm test
npm run lint
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-cma-drag
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 순서 계산이 제스처 코드와 **분리**되어 테스트되는가
   - 접근성 액션이 있는가
   - 새 의존성을 추가했다면 그 근거가 summary 에 있는가
   - `packages/core`·`packages/app-capacitor` 를 수정하지 않았는가
3. `phases/character-multi-account/index.json` 의 step 7 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "끌기 구현 방식(라이브러리/자체)·자동 스크롤 처리·moveOcid 위치·접근성 액션 이름"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **행 전체를 끌기 시작점으로 만들지 마라.** 이유: 페이지 스크롤과 다퉈 목록이 스크롤되지 않는다.
- **아래 층(후보)에 끌기를 붙이지 마라.** 이유: 그쪽 순서는 사용자 것이 아니라 레벨 내림차순이다.
- **고정 영역을 만들어 자동 스크롤 문제를 피하지 마라.** 이유: [[ADR-131]] 이 «고정 영역 없음» 을
  정했다. 자동 스크롤로 풀어라.
- **정렬을 «저장 시점에» 다시 계산하지 마라**(레벨 순으로 되돌리는 등). 이유: 사용자가 정한 순서를
  앱이 헤집는 것이다.
- 기존 테스트를 깨뜨리지 마라.
