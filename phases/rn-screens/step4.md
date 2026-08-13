# Step 4: content-scheduler

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/content-scheduler.md`**
- **`/docs/migration/parity-inventory.md` §2.3**
- `/docs/ADR.md` 에서 아래 표의 ADR 만 열어라
- `packages/app-capacitor/src/app/content-scheduler/**` (**옮길 원본 5개, 1,401줄**)
- `packages/app-capacitor/src/app/content-scheduler/__tests__/**` (5개 — **명세로 읽어라**)
- **이전 step 산출물**: 셸 · 에셋 코드젠(`daily-quest-icons`·`daily-quest-backgrounds`가 여기 쓰인다) ·
  `src/navigation/**` · `src/components/**`

## 배경

| 파일 | ADR 계약 |
|---|---|
| `ContentScreen` | 015, 016, 017, 035, 047, 053, 060, 061, 062, 063, 072, 073, 077, 083, 096, 098, 099, 101, 115, 116, 120 |
| `ContentManageScreen` | 035, 055, 057, 060, 061, 065, 096, 098, 099, 120 |
| `DailyContentCards` | 018, 020, 094 |
| `WeeklyContentCards` | 021, 094 |
| `content-badges.tsx` | 094 |

**`ContentScreen` 이 ADR 21개다.** 이 step 에서 단독으로 계획을 세우고 시작하라.

## 작업

### 1. 여기가 **당겨서 새로고침이 실제로 붙는 첫 화면**이다

[[ADR-073]]·[[ADR-074]] 의 표식은 3단계에서 molecule 로 왔고, 그때 *"`RefreshControl` 과 겹치는
물건이라 화면 배선에서 하나를 골라야 한다"* 고 갈래를 적어 뒀다. **여기서 고른다.**

- `RefreshControl` 로 충분하면 **커스텀 표식을 억지로 쓰지 마라**(플랫폼 기본 동작이 사용자 기대에 맞다).
- 커스텀을 쓴다면 [[ADR-073]] 결정 6·7(높이·목록 오프셋이 한 함수)과 [[ADR-074]] 의 임계 동작을
  지켜라.
- **고른 이유를 적어라.** 다음 두 화면(`BossScreen`·`BossProfitScreen`)이 같은 선택을 물려받는다.

### 2. [[ADR-098]]·[[ADR-099]]·[[ADR-112]]·[[ADR-123]] — 헤더와 스크롤

`ScreenScroll`·`PageHeader` template 이 3단계에 있다. **여기서 다시 만들지 마라.**
헤더 스페이서 동기화([[ADR-112]]·[[ADR-123]])가 실제 화면에서 맞는지 확인하는 것이 이 step 의 일이다.

### 3. [[ADR-016]]·[[ADR-017]] — 캐시가 먼저 오고 실패가 무음이 된다

캐시 stub 이 먼저 방출돼 실패가 조용해지는 자리다. `StaleBanner`(molecule)가 그 표면이고,
**문구·라벨·액션은 전부 호출부가 넘긴다**([[ADR-114]] 결정 2·3, [[ADR-094]] 결정 2). 이 화면이
그 호출부다.

### 4. [[ADR-101]] · [[ADR-072]] — 주기 경계

일일/주간 초기화 경계다. **시각 계산은 core 에 있다.** 화면에서 다시 계산하지 마라.

### 5. `DailyContentCards`·`WeeklyContentCards` — 에셋이 여기 쓰인다

step 1 의 코드젠으로 `daily-quest-icons`·`daily-quest-backgrounds` 가 살아났다. **실제로
그려지는지 확인**하고, 안 되면 무엇이 남았는지 적어라.

### 6. 웹 테스트 5개는 명세다 — 이식하지 마라

## Acceptance Criteria

```bash
npm test           # vitest 증감 0 + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-content-check
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 5개가 전부 있는가? **`ContentScreen` 의 ADR 21개를 하나씩 확인했는가?**
   - 당겨서 새로고침 갈래를 정하고 **이유를 적었는가**?
   - template(`ScreenScroll`·`PageHeader`)을 다시 만들지 않았는가?
   - 주기 경계 계산을 화면에서 다시 하지 않았는가?
   - `packages/core`·`packages/app-capacitor` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-screens/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 5개·ContentScreen ADR 21개 확인 결과·PTR 갈래와 근거·에셋 표시 여부·육안 대조 목록"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`ContentScreen` 을 다른 파일과 같은 속도로 처리하지 마라.** 이유: ADR 21개가 서로 다른 축이다.
- **template 을 다시 만들지 마라.** 3단계에 있다.
- **주기 경계·시각 계산을 화면에서 다시 하지 마라.** core 에 있고 테스트가 지킨다.
- **문구를 다듬지 마라.**
- **`packages/core`·`packages/app-capacitor` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
