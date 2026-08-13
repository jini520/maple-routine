# Step 7: boss-profit-screen

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/boss-profit.md` (전문을 정독하라)**
- **`/docs/migration/parity-inventory.md` §2.5** — 이 화면이 «최고 위험 구역» 으로 지목된 곳
- **`/docs/ADR.md` 에서 아래 32개를 전부 열어라** — 이 step 은 그것이 작업의 절반이다
- **`packages/app-capacitor/src/app/boss-profit/BossProfitScreen.tsx` (정독하라)**
- `packages/app-capacitor/src/app/boss-profit/__tests__/BossProfitScreen.dom-snapshot.test.tsx.snap`
  (**725줄 — 이 저장소에서 «예전과 같은가»에 기계적으로 답하던 가장 큰 장치**)
- **이전 step 산출물**: step 6 의 하위 9개 · 셸 · 에셋 · `src/components/**` ·
  step 4·5 가 정한 화면 관례

## 배경 — 이 저장소에서 가장 밀도 높은 파일이다

**ADR 32개**:

> 032, 045, 046, 047, 049, 054, 059, 060, 061, 063, 067, 068, 071, 072, 073, 076, 077, 080, 082,
> 083, 085, 087, 088, 094, 099, 100, 101, 102, 112, 120, 123, 124

`parity-inventory.md` 가 이 파일에 대해 적어 둔 지시가 있다:

> **다른 화면과 같은 취급을 하지 말 것** — 단독으로 계획을 세우고, 재작성 전에 32개 ADR을 먼저 읽고
> **동작 명세를 따로 뽑아 두는 것**을 권한다.

## 작업

### 1. **코드를 쓰기 전에 동작 명세를 뽑아라**

32개를 읽고, **각각이 이 화면에서 무엇을 요구하는지 한 줄로** 적은 목록을 먼저 만들어라.
그 목록을 파일(예: 화면 옆 `BossProfitScreen.contract.md`)이나 컴포넌트 머리 주석으로 남겨라 —
**이 step 의 산출물 중 다음 사람에게 가장 쓸모 있는 것이 그 목록이다.**

목록 없이 바로 코드를 쓰면 반드시 몇 개를 놓친다. 놓친 것은 **화면에 안 보이므로** 아무도 모른다.

### 2. 필요하면 이 step 을 쪼개라

32개가 한 커밋에 들어가면 실패 시 원인 분리가 안 된다. 축을 나눠 여러 커밋으로 가도 된다
(예: 레이아웃·집계 → 캐릭터 그룹 → 드랍/연출 → 헤드라인·칩). **쪼갠 경우 그 사실을 summary 에 적어라.**

### 3. DOM 스냅샷 725줄을 **명세로 읽어라**

이식할 수 없다(DOM 트리다). 하지만 그 안에 **웹이 실제로 그리는 구조와 문구가 전부 들어 있다** —
「어떤 요소가 어떤 순서로 나오는가」를 읽어내는 데 쓸 수 있는 가장 정확한 자료다.

읽고 나서, RN 트리 스냅샷을 **새 기준선**으로 남겨라(3단계 관례). 그 스냅샷이 답하는 것은
*"앞으로 안 바뀌는가"* 뿐이다 — **«예전과 같은가»는 사람이 두 앱을 나란히 놓고 답한다.**

### 4. 놓치기 쉬운 축 넷 — 특히 확인하라

- **[[ADR-124]] 미입력 ≠ 0원** — step 6 이 표시 층에서 지켰다. 이 화면의 **합계·정렬·빈 상태**
  에서도 같은지 보라. 합계에 `null` 을 0으로 넣으면 사용자 수익이 조용히 틀어진다.
- **[[ADR-069]] 월드 리프** · **[[ADR-102]]** · **[[ADR-080]]**·**[[ADR-082]]** — [[ADR-128]] 이
  *"화면에 안 보이는 엣지 케이스"* 로 지목한 부류다.
- **[[ADR-100]]** — `boss-profit-context` 와 이 화면이 나눠 진다. step 6 산출물을 보라.
- **[[ADR-088]] 테마 배경** — `ThemeHeaderBackdrop`(template)과 step 1 의 에셋이 여기서 만난다.
  실제로 그려지는지 확인하라.

### 5. 성능은 **측정 후에** 손대라

`FlashList` 전환 등은 3단계가 *"어느 화면이 무거운지는 화면이 붙어야 안다"* 며 미뤄 뒀다.
이 화면이 그 후보다. 다만 **먼저 만들고, 느리면 그때 측정하고 바꿔라.** 미리 최적화하면 근거 없는
복잡도만 남는다. 측정한다면 [[ADR-103]] 의 선례를 따라 **무엇을 어떻게 쟀는지 적어라.**

### 6. 웹 테스트는 명세다 — 이식하지 마라

## Acceptance Criteria

```bash
npm test           # vitest 증감 0 + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-bps-check
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - **32개 ADR 의 동작 명세 목록을 먼저 만들었는가? 그 목록이 저장소에 남아 있는가?**
   - 32개를 하나씩 확인했는가? 확인 결과가 summary 에 있는가?
   - **[[ADR-124]] 가 합계·정렬·빈 상태에서도 지켜지는가?**
   - RN 트리 스냅샷 기준선을 남겼는가?
   - 근거 없는 선제 최적화를 하지 않았는가?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-screens/index.json` 의 step 7 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "ADR 32개 확인 결과·명세 목록 위치·쪼갰다면 그 사실·성능 판단·육안 대조 목록(이 화면은 특히 길게)"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **32개를 읽기 전에 코드를 쓰지 마라.** 이유: 대부분이 화면에 안 보이는 판단이라, 놓치면 아무도
  모른 채 배포된다. 이 파일이 «최고 위험 구역» 인 이유가 그것이다.
- **`null` 을 `0` 으로 뭉개지 마라.** ([[ADR-124]])
- **미리 최적화하지 마라**(`FlashList` 전면 도입 등). 먼저 만들고, 느리면 재고, 그 다음에 바꿔라.
- **게임 레퍼런스 수치를 추정해 하드코딩하지 마라.** ([[ADR-006]]) 값이 없으면 **blocked 로 멈춰라.**
- **DOM 스냅샷을 RN 으로 «변환» 하려 하지 마라.** 명세로 읽는 것과 이식은 다르다.
- **"예전과 같아 보인다"고 summary 에 쓰지 마라.** 스냅샷 초록은 그 뜻이 아니다.
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
