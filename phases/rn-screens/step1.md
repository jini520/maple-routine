# Step 1: asset-codegen

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/migration/README.md` «3-4단계 결과»(에셋 벽)**
- `/docs/ADR.md` 에서 **[[ADR-128]] · [[ADR-088]] · [[ADR-038]] · [[ADR-125]]** 만 열어라
- **core 의 `import.meta.glob` 모듈 8개 — 전부 정독하라**:
  - `packages/core/src/lib/boss-icons.ts` · `item-icons.ts` · `world-emblem.ts` ·
    `theme-backgrounds.ts` · `drop-effect-frames.ts` · `daily-quest-icons.ts` ·
    `daily-quest-backgrounds.ts`
  - `packages/core/src/data/feature-guides/index.ts`
- **`packages/app-rn/core-shims.js`** (지금 다섯을 `null` 로 치환하는 표)
- `packages/app-rn/src/lib/rn-item-icons.ts` · `rn-drop-effect-frames.ts` (기존 대체 구현)
- `packages/core/src/data/__tests__/feature-guides.test.ts`
- `packages/app-rn/src/__tests__/core-shims.test.ts` (glob 모듈 **8개 목록을 고정하는 테스트**)

## 배경 — 이 step 이 없애는 것은 파일이 아니라 **분기**다

core 는 에셋 목록을 `import.meta.glob` 으로 만든다. Vite 전용이라 Metro 에 짝이 없고, 그래서
3단계는 **앱 수준 치환표**(`core-shims.js`)로 다섯을 `null` 로 돌려놨다. 컴포넌트는 원본이 정의한
폴백 경로를 타서(보스 초상 `?` 원 · 아이템 아이콘 회색 원 · 월드 엠블럼 생략) **깨지지는 않지만
그림이 없다.**

4단계 화면들은 그 그림이 **실제로 보여야 하는 자리**다. `feature-guides` 는 설정 화면이,
`daily-quest-*` 는 컨텐츠 스케줄러가, `theme-backgrounds` 는 테마가 쓴다.

**사용자 결정(2026-08-12): 빌드타임 코드젠으로 간다.**

> 글롭을 스크립트가 훑어 목록 파일을 생성하고, **웹과 RN 이 그 파일을 함께 쓴다.**
> `import.meta.glob` 이 저장소에서 사라져 core 가 번들러 중립이 된다.
> 포트를 늘리지 않으므로 [[ADR-128]] 결정 4(어댑터 시그니처 동결)를 건드리지 않는다.

**기각된 둘과 그 이유를 ADR 에 적어라**(아래 4): 에셋 포트 신설(core 인터페이스가 늘어난다) ·
app-rn 전용 맵(목록이 두 벌이 되어 한쪽만 추가하면 조용히 어긋난다 — 이 저장소가 테마 토큰·라우트
표에서 이미 거부해 온 형태다).

## 작업

### 1. 생성 스크립트

`scripts/` 에 둔다(`theme-gen.ts` 와 같은 자리 — `npm run theme:gen` 이 선례다). `package.json` 에
스크립트를 추가하라.

**플랫폼별로 값이 다르다.** 웹은 URL 문자열, RN 은 `require()` 결과다. **키는 같아야 한다** —
같은 키에 플랫폼별 값이 붙는 구조로 만들어라. 어떻게 가를지(파일 분리 · 플랫폼 확장자 `.native.ts` ·
조건부 export)는 재량이되, **고른 이유를 적어라.**

### 2. 생성물은 커밋한다

빌드 시점 생성이 아니라 **소스로 커밋**한다. 이유: RN 빌드 파이프라인이 저장소 밖(EAS·gradle)에서도
돌고, 생성 단계가 빠진 환경에서 조용히 빈 목록이 되는 것이 이 전환에서 가장 비싼 실패다.

생성 파일에 **"손으로 고치지 마라 · 생성 방법" 주석 머리**를 반드시 넣어라.

### 3. 목록이 낡는 것을 테스트가 잡게 하라

커밋한 생성물은 **반드시 낡는다.** 에셋을 추가하고 스크립트를 안 돌리면 목록에 안 들어간다.
그래서 **생성물이 현재 에셋 디렉터리와 일치하는지 검사하는 테스트**를 써라(디렉터리를 읽어 키
집합을 비교). 이 테스트가 이 결정의 대가를 갚는 유일한 장치다.

### 4. ADR 을 써라 — **번호는 `ADR-129`**

`docs/adr/ADR-129.md` 를 만들고 `docs/ADR.md` 인덱스에 한 줄 더하라.

> **번호 주의**: `ADR-127` 은 `main` 의 결정(캐릭터 0명 메이플 ID)이고 `ADR-128` 이 RN 마이그레이션
> 이다. 다음 빈 번호는 **129** 다. 쓰기 전에 `ls docs/adr/` 로 실제로 비어 있는지 확인하라.

담을 것: 결정(빌드타임 코드젠) · 기각 둘과 근거 · 생성물을 커밋하는 이유 · 낡음을 막는 장치 ·
트레이드오프.

### 5. shim 표를 걷어내라

치환이 필요 없어진 항목은 `core-shims.js` 에서 **빼라.** 빼고 나서 `core-shims.test.ts` 가
고정하던 「glob 모듈 8개」 목록도 함께 맞춰라 — `import.meta.glob` 사용처가 0이 되면 그 테스트는
**목적이 바뀐다**(감시 대상이 사라진다). 지울지, "0이어야 한다"로 뒤집을지 정하고 적어라.

### 6. 웹이 안 깨지는지가 이 step 의 진짜 게이트다

`app-capacitor` 는 **배포 중인 앱**이다. 코드젠이 웹 쪽 동작을 바꾸면 안 된다.

- `npm run build` 산출물이 이전과 같은지 확인하라(에셋 URL·해시).
- vitest 3046개가 **증감 0** 이어야 한다. 늘어난다면 그건 이 step 이 더한 테스트뿐이다.

**core 를 고치는 것이 이 step 에서는 허용된다** — glob 을 걷어내는 것이 목적이기 때문이다.
다만 **함수 시그니처는 그대로 두어라**([[ADR-128]] 결정 4). 바뀌는 것은 목록을 만드는 방법이지
목록을 묻는 방법이 아니다.

## Acceptance Criteria

```bash
npm test           # vitest 199파일/3046개(+이 step 이 더한 것) + jest 전부 통과
npm run build      # app-capacitor 정상 — 산출물 확인
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-asset-check
```

`import.meta.glob` 이 사라졌는지:

```bash
grep -rn "import.meta.glob" packages/core/src packages/app-capacitor/src | grep -v __tests__
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 8개 모듈이 전부 처리됐는가?
   - 생성물이 커밋됐고 "손으로 고치지 마라" 머리가 있는가?
   - **목록이 낡는 것을 잡는 테스트가 있는가?**
   - `ADR-129` 를 썼고 인덱스에 한 줄 넣었는가? 기각 둘의 근거가 있는가?
   - 웹 빌드 산출물이 이전과 같은가?
   - core 의 **함수 시그니처**가 그대로인가?
3. `phases/rn-screens/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성 방식·플랫폼별 값 가르는 법·낡음 방지 장치·shim 표 정리 결과·ADR-129"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **에셋 목록을 두 벌로 만들지 마라.** 이유: 한쪽만 추가하면 조용히 어긋난다. 이 저장소는 테마
  토큰·라우트 표에서 같은 형태를 이미 거부했다.
- **core 의 함수 시그니처를 바꾸지 마라.** 이유: [[ADR-128]] 결정 4. 바꾸는 것은 목록을 **만드는**
  방법이지 **묻는** 방법이 아니다.
- **생성물을 gitignore 하지 마라.** 이유: 저장소 밖 빌드에서 생성 단계가 빠지면 조용히 빈 목록이 된다.
- **`require.context` 를 쓰지 마라.** 이유: Metro 엔 있어도 **jest 에 없다**(실측) — 이 저장소가
  이미 거부한 *"앱은 도는데 테스트만 죽는"* 형태다.
- **에셋 파일 자체를 새로 만들거나 고르지 마라.** 이유: 그림은 이미 저장소에 있다. 이 step 은
  **찾는 방법**을 고치는 것이지 무엇을 쓸지 정하는 것이 아니다.
- 기존 테스트를 깨뜨리지 마라.
