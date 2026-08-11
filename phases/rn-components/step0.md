# Step 0: nativewind-setup

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` — 원칙 · **3단계 절**(스타일링 결정) · «잃는 안전망»
- `/docs/foundation/design-system.md` (색·시맨틱 토큰·타이포)
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-094]]** 만 열어라. 전체를 올리지 말 것
- `/CLAUDE.md`
- `packages/app-capacitor/src/index.css` (**토큰 선언 51개가 여기 있다**)
- `packages/app-capacitor/vite.config.ts` (Tailwind 플러그인 설정)
- `packages/app-rn/` 전체 구조 · `jest.config.js` · `metro.config.js` · `babel.config.js`(있다면)
- `packages/app-rn/src/native/adapters/not-implemented.ts` (지금 던지고 있는 포트들)

## 배경

`components/` 34개를 옮길 스타일 기반을 만든다. **컴포넌트는 한 개도 옮기지 않는다.**

**NativeWind 로 간다**(사용자 결정, 2026-08-11). `packages/app-capacitor/src/components` 33파일에
`className` 이 **163곳** 있어 그대로 옮기는 편이 압도적으로 싸다.

대가는 알고 간다 — 임의 CSS·pseudo 셀렉터·`@keyframes` 를 못 쓴다. `@keyframes` 8종은 어차피
Reanimated 재구현 대상이라(step 7) 새로 잃는 것이 아니다.

## 작업

### 1. NativeWind 도입

`packages/app-rn` 에 NativeWind(현재 안정 버전)와 그 peer 의존성을 넣는다.

- `babel.config.js` — 이전 task 의 step 8 이 **`babel.config.js` 를 일부러 없앴다**(`@expo/metro-config`
  가 `babel-preset-expo` 를 기본 적용). NativeWind 가 babel 프리셋을 요구하면 여기서 다시 만들어야
  하는데, **만들면 그 이유를 파일 주석에 적어라** — 없애 뒀던 것을 되살리는 것이므로 근거가 필요하다
- `metro.config.js` — NativeWind 래퍼를 씌우되, **이전 task 가 넣은 모노레포 설정(`watchFolders`,
  `resolver.nodeModulesPaths`)을 잃지 마라.** 잃으면 `@core/*` 가 안 풀린다
- `global.css`(또는 동등물)와 `nativewind-env.d.ts` 타입 선언

### 2. Tailwind 설정을 **두 앱이 공유**하게 하라

지금 웹 쪽 토큰은 `packages/app-capacitor/src/index.css` 의 `@theme` 에 있다. RN 쪽에 같은 값을
**손으로 베끼지 마라** — 베끼는 순간 두 벌이 되고, 한쪽만 바뀌어도 아무도 모른다.

공유 방법은 재량이되(예: 저장소 루트나 `packages/core` 에 `tailwind.config` 공통 파일을 두고 양쪽이
참조), **값의 진실이 한 곳에 있어야 한다.** 고른 방법과 근거를 summary 에 적어라.

> 색 토큰 자체는 **테마마다 달라진다** — 그것은 step 1(theme-system)의 일이다. 이 step 이 공유하는
> 것은 **테마와 무관한 축**(간격·타이포·폰트·radius·breakpoint 등)이다. 둘을 섞지 마라.

### 3. jest 에서 NativeWind 가 동작하게 하라

`jest-expo` 프리셋 위에 NativeWind 의 jest 설정을 얹는다. `className` 이 붙은 컴포넌트를 렌더해도
죽지 않아야 한다.

**배선 검증 테스트 하나**를 둬라 — `className` 을 쓴 최소 컴포넌트를 렌더해 `toJSON()` 스냅샷을
찍는 것으로 충분하다. 이것이 step 3~6 에서 쓸 **스냅샷 방식의 첫 사례**가 된다.

### 4. RN 트리 스냅샷 방식을 확립하라

`migration/README.md` «잃는 안전망» 이 정한 것 — RN 렌더 트리 스냅샷을 **새 기준선**으로 잡는다.
step 3~6 이 이 방식을 그대로 따르므로 **여기서 형태를 정해두면 뒤가 일관된다.**

- `@testing-library/react-native` 의 `toJSON()` 스냅샷
- 파일 배치·명명 관례를 정하고 summary 에 적어라

**이 스냅샷이 "예전과 같은가"에 답하지 않는다는 것을 주석에 적어라.** 그것은 사람 눈의 몫이고
(단계 4), 여기 스냅샷이 답하는 것은 *"앞으로 안 바뀌는가"* 뿐이다. 적어두지 않으면 다음 사람이
초록색을 보고 패리티가 검증됐다고 읽는다.

## Acceptance Criteria

```bash
npm install
npm test           # vitest 199파일/3044개 + jest 전부 통과 (vitest 증감 0)
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-nw-check
```

모노레포 해석이 안 깨졌는지 — `expo export` 가 `Unable to resolve module @core/...` 없이 끝나야 한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `metro.config.js` 의 `watchFolders`·`nodeModulesPaths` 가 살아 있는가?
   - Tailwind 토큰 값이 **두 곳에 베껴져** 있지 않은가?
   - `babel.config.js` 를 되살렸다면 그 이유가 주석에 있는가?
   - `packages/core` 를 수정했는가? 공유 설정 목적이면 정당하다 — **그 경우 app-capacitor 빌드가
     여전히 통과하는지 반드시 확인하라**
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `phases/rn-components/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "NativeWind 버전·babel/metro 처리·토큰 공유 방식과 근거·스냅샷 관례"`
   - 실패 → `"error"` + `error_message` / 개입 필요 → `"blocked"` + `blocked_reason`

## 금지사항

- **`components/` 를 한 개도 옮기지 마라.** 이유: 이 step 은 기반만 만든다. 이동은 step 3 부터이고,
  섞이면 실패 원인이 "설정"인지 "이식"인지 갈리지 않는다.
- **토큰 값을 RN 쪽에 손으로 베끼지 마라.** 이유: 두 벌이 되면 한쪽만 바뀌어도 아무도 모른다.
  이 저장소가 `theme-registry` 로 이미 해결해 둔 문제를 스타일 층에서 되살리는 셈이다.
- **모노레포 metro 설정을 덮어쓰지 마라.** 이유: `watchFolders`·`nodeModulesPaths` 가 없으면
  `@core/*` 해석이 죽고, 그 증상이 NativeWind 문제로 보인다.
- **테마별 색을 이 step 에서 다루지 마라.** step 1 의 일이다.
- **`packages/app-capacitor` 의 스타일을 바꾸지 마라.** 이유: 그 앱은 계속 배포된다.
- 기존 테스트를 깨뜨리지 마라.
