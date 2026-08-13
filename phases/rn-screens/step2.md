# Step 2: onboarding

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/onboarding.md`**
- **`/docs/migration/parity-inventory.md` §2.2**
- `/docs/ADR.md` 에서 아래 표의 ADR 만 열어라
- `packages/app-capacitor/src/app/onboarding/**` (**옮길 원본 5개, 775줄**)
- `packages/app-capacitor/src/app/onboarding/__tests__/**` (**명세로 읽어라 — 이식하지 마라**)
- **이전 step 산출물**: `packages/app-rn/App.tsx`(셸) · `src/navigation/**` ·
  `src/components/**` · 에셋 코드젠 결과

## 배경 — 앱을 처음 여는 사람이 보는 화면이다

| 파일 | ADR 계약 |
|---|---|
| `OnboardingScreen` | 016, 035, 061, 083, 086 |
| `ApiKeyForm` | 003, 007, 061, 086, 110 |
| `AccountSelectionList` | 015, 051, 061, 063, 068, 083, 086, 113, 114, 116 |
| `ContentCharacterStep` | 016, 035, 053, 060, 061, 062, 067, 086, 107, 114, 115, 116 |
| `TrackingModeStep` | 035, 060 |

내비게이션은 이미 있다 — 3단계가 온보딩 분기를 **화면 목록을 갈아 끼우는 방식**으로 세웠다
(미완료면 스택에 온보딩 하나뿐, 완료되면 탭으로 통째로 바뀐다). 이 step 은 그 자리에 실제 화면을 넣는다.

## 작업

### 1. **`AccountSelectionList` 는 최근에 크래시가 났던 자리다 — 반드시 읽어라**

`main` 의 [[ADR-127]]([[ADR-128]] 아님 — 번호가 갈린 사정은 `docs/adr/ADR-128.md` 머리에 있다)이
고친 결함이다: 캐릭터가 0명인 메이플 ID 가 목록에 올라오면 대표 캐릭터를 못 세워 **렌더 중에
던졌고**, 키가 이미 저장된 뒤라 재시작해도 같은 단계로 돌아와 **앱 안에 탈출구가 없었다**
(갤럭시 S21 테스터 보고, 2026-08-12).

- **수정은 `packages/core/src/nexon/character/normalize.ts` 에 이미 있다**(사슬의 가장 위 고리를
  끊었다) — RN 화면은 그것을 그대로 물려받는다. **다시 막지 마라**: 렌더 폴백이나 프로브 판정에서
  또 거르면 "캐릭터 0명 계정"을 아는 코드가 세 곳으로 흩어진다(그 ADR 이 명시적으로 기각한 형태).
- 다만 **그 화면이 빈 배열을 받으면 어떻게 되는지**는 확인하라 — 계정이 전부 걸러져 목록이 비는
  경우가 실제로 가능하다([[ADR-116]] 결정 3 · [[ADR-051]]).

### 2. `ApiKeyForm` — [[ADR-003]]·[[ADR-007]]·[[ADR-110]]

키 입력·검증·저장이다. **키는 `storage/` 어댑터를 거친다**(CLAUDE.md CRITICAL). 웹의 입력 요소가
RN 에서 `TextInput` 으로 바뀌며 갈리는 것(자동완성·보안 입력·키보드 타입·붙여넣기)을 확인하고 적어라.

### 3. [[ADR-086]] 이 다섯 파일 중 넷에 걸려 있다

계정 전환 이력·플로우 상태다. **한 곳만 보고 판단하지 마라** — 화면 사이를 오가는 상태라
`ApiKeyForm` → `AccountSelectionList` → `ContentCharacterStep` 이 같은 결정을 나눠 진다.
[[ADR-086]] 결정 1(목록을 그리기 전에 키를 저장한다)은 위 1의 크래시가 **탈출구 없는** 이유이기도
하다 — 그 성질이 RN 에서도 그대로인지 확인하라.

### 4. 상태는 core 에 있다 — 다시 만들지 마라

`packages/core/src/features/onboarding/store.ts` 가 그대로 산다. 화면은 그것을 **부르기만** 한다.
[[ADR-128]] 결정 4·5 가 지키는 것이 이 성질이다.

### 5. 웹 테스트는 명세다

`onboarding/__tests__/` 5개 파일을 **읽어서 기대 동작을 뽑되**, RN 테스트는 새로 써라.
jsdom·DOM 기준이라 그대로는 의미가 없다.

### 6. 육안 대조 목록을 남겨라

**이 단계부터 화면이 생겨 «예전과 같아 보이는가» 를 물을 수 있다** — 다만 그건 사람이 두 앱을
나란히 놓고 하는 일이다(`migration/README.md` «잃는 안전망»). 네가 할 일은 **무엇을 봐야 하는지
목록을 남기는 것**이다. 특히 첫 실행 경로는 되돌리기 어려우니(키가 저장된다) 확인 순서까지 적어라.

## Acceptance Criteria

```bash
npm test           # vitest 증감 0(app-capacitor 무수정) + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-onboarding-check
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 5개가 전부 있는가? 각 행의 ADR 을 **전부 읽고** 확인했는가?
   - **캐릭터 0명 계정을 화면에서 또 거르지 않았는가?** (core 가 이미 한다)
   - core 의 온보딩 스토어를 다시 만들지 않았는가?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-screens/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 5개·ADR 확인 결과·TextInput 으로 갈린 것·육안 대조 목록"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **캐릭터 0명 계정을 화면 층에서 다시 거르지 마라.** 이유: core 가 사슬의 가장 위에서 이미 끊었다.
  세 곳으로 흩어뜨리는 것을 그 ADR 이 명시적으로 기각했다.
- **core 의 온보딩 스토어를 다시 만들거나 고치지 마라.**
- **웹 테스트를 그대로 옮기지 마라.** 읽어서 명세를 뽑고 RN 테스트를 새로 써라.
- **문구를 다듬지 마라.** 이유: 이 저장소는 에러·안내 문구를 전수 조사해 정리한 이력이 있다.
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
