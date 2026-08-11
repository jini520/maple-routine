# Step 2: navigation

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- **`/docs/migration/parity-inventory.md` §1** (라우트 → 스크린 매핑표 · 보존해야 할 라우팅 동작)
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-120]] · [[ADR-090]] · [[ADR-099]] · [[ADR-125]]** 만 열어라
  — **[[ADR-120]] 은 전문을 정독하라. 이 step 의 게이트가 그 문서다**
- `packages/app-capacitor/src/App.tsx` (573줄 — 라우팅·탭바·스택 오버레이·시스템 뒤로가기·광고 인터셉터)
- `packages/core/src/features/screen-stack/store.ts` · `packages/app-capacitor/src/lib/stack-transition.ts`
  (**버릴 구현이지만 어떤 동작을 만들었는지 읽어야 한다**)
- `packages/core/src/features/ads/tab-switch-ad.ts` (탭 전환 광고 게이트)
- `packages/app-rn/src/boot.ts` · `packages/app-rn/src/native/adapters/not-implemented.ts`
- **이전 step 산출물**: NativeWind 설정 · `ThemeProvider`

## 배경 — 이 단계 최대 위험 구역

[[ADR-120]] 이 손으로 만든 화면 스택(~1,100줄 + Java 328줄)을 react-navigation 으로 바꾼다.

**버리는 것은 *구현*이지 *결정*이 아니다.** `migration/README.md` 가 못박아 둔 문장이다:

> react-navigation 기본값이 [[ADR-120]] 이 정한 동작과 다르면 **기본값이 아니라 [[ADR-120]] 을 따른다.**

반드시 재현해야 할 동작(원문을 읽고 목록을 직접 확정하라):

- 스택이 열리면 **탭바가 아래 화면과 함께 밀려 나가고 함께 어두워진다**
- 제스처 진행률에 따라 **아래 화면이 시차를 두고 따라온다**
- **3버튼 뒤로가기와 제스처가 같은 결과로 수렴**한다(진행률은 제스처에서만 온다)
- 탭 최상위에서의 뒤로가기는 **앱을 종료하지 않고 백그라운드로** 보낸다([[ADR-120]] 결정 18)

## 작업

### 1. 화면은 만들지 않는다 — 자리표시자로 골격만

`app/` 화면 재작성은 **단계 4**다. 이 step 은 내비게이션 구조만 세운다. 각 스크린은 이름을 찍는
자리표시자로 두어라.

`parity-inventory.md` §1 의 매핑표를 그대로 구현하라 — 탭 4개(content · boss · profit · settings)와
그 위에 얹히는 push 스크린들, 그리고 온보딩 분기.

### 2. 보존해야 할 라우팅 동작 셋

`parity-inventory.md` §1 «보존해야 할 라우팅 동작» 에 적힌 것이다.

1. **온보딩 미완료면 모든 탭이 온보딩으로 `replace`** (완료면 그 반대)
2. **탭 이동의 책임은 링크가 아니라 인터셉터에 있다** — 전면광고 게이트([[ADR-090]])가 거기 걸려
   있다. RN 에서는 탭 `listeners` 로 옮긴다. `features/ads/tab-switch-ad.ts` 를 **고치지 말고**
   그대로 부르는 자리를 만들어라
3. `/settings/guide/:guideId` 와 `/settings/release-notes/:guideId` 가 **같은 화면**을 그린다([[ADR-125]])

### 3. `BackGesturePort` 를 해소하라

지금 `not-implemented.ts` 가 던지고 있다. react-navigation 네이티브 스택이 시스템 뒤로가기를
소유하므로, RN 에서는 그 포트를 **구현할 대상이 아니라 없앨 대상**일 수 있다.

읽고 판단하라 — 다만 [[ADR-120]] 결정 18(**종료가 아니라 백그라운드로**)은 react-navigation 기본값이
아니다. 그 동작을 어디서 어떻게 유지할지 정하고 근거를 summary 에 적어라.

포트를 계속 던지게 두기로 했다면 **그 이유를 메시지에 적어라**(예: "네이티브 스택이 소유한다").

### 4. `screen-stack` 과 전환 machinery 는 옮기지 마라

`features/screen-stack/`·`lib/stack-transition.ts` 등은 `app-capacitor` 에 남는다. **RN 쪽에 그
구현을 옮기거나 흉내 내지 마라** — 네이티브 스택이 OS 수준에서 하는 일이다.

### 5. 테스트

- 온보딩 분기가 양방향으로 도는가
- 탭 전환 시 광고 인터셉터가 **불리는가**(실제 광고가 아니라 호출 여부)
- 같은 상세 화면을 두 경로가 가리키는가([[ADR-125]])
- 네비게이션 트리 스냅샷(step 0 의 관례를 따를 것)

## Acceptance Criteria

```bash
npm test           # vitest 199파일/3044개(증감 0) + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-nav-check
```

**Android 빌드**(네이티브 스택·제스처 핸들러가 네이티브 의존성을 끌어온다):

```bash
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

**iOS**: best-effort. 막히면 `blocked` + 사유.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `parity-inventory.md` §1 의 **17개 경로가 전부** 대응되는가?
   - 광고 인터셉터가 탭 이동 경로에 걸려 있는가? `tab-switch-ad.ts` 를 **수정하지 않았는가**?
   - [[ADR-120]] 결정 18(백그라운드로 보내기)의 처리를 정하고 적었는가?
   - `packages/core` 를 수정했는가? **했다면 잘못된 것이다**
   - `screen-stack` 구현을 RN 으로 옮기지 않았는가?
3. `phases/rn-components/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "내비게이션 구조·ADR-120 동작별 재현 방식과 미해결분·BackGesturePort 처리·광고 인터셉터 위치"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

**[[ADR-120]] 동작이 재현됐다고 쓰지 마라 — 실기기에서 눈으로 본 것이 아니면.** 탭바 동반 이동·시차·
3버튼 수렴은 코드로 확인되는 종류가 아니다. **무엇을 구현했고 무엇이 육안 확인 대기인지 나눠서 적어라.**

## 금지사항

- **화면을 만들지 마라. 자리표시자만 두어라.** 이유: `app/` 재작성은 단계 4이고, 각 화면은
  `parity-inventory.md` 의 ADR 계약 체크리스트를 소진하며 진행해야 한다. 여기서 손대면 그 규율이 무너진다.
- **`features/ads/tab-switch-ad.ts` 를 수정하지 마라.** 이유: [[ADR-090]] 의 게이트(30분 간격·부팅 후
  60초·시계 되돌림 방어)가 순수 함수로 검증돼 있다. 부르는 자리만 만들어라.
- **`packages/core` 를 수정하지 마라.**
- **`screen-stack`·`stack-transition` 을 RN 으로 옮기거나 흉내 내지 마라.** 이유: 네이티브 스택이
  OS 수준에서 하는 일이고, 옮기면 그 둘이 싸운다.
- **react-navigation 기본값이 [[ADR-120]] 과 다를 때 기본값을 택하지 마라.** 다르면 **[[ADR-120]] 을
  따르고**, 못 따르겠으면 **그 사실을 summary 에 적어라.** 조용히 기본값으로 두면 아무도 모른다.
- 기존 테스트를 깨뜨리지 마라.
