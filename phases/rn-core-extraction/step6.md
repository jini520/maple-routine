# Step 6: core-features

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스 — `features/*.md` 중 관련된 것을 골라 읽어라)
- `/docs/migration/README.md` (원칙)
- `/docs/migration/parity-inventory.md` §4
- `/docs/ADR.md` 에서 **[[ADR-128]] · [[ADR-003]] · [[ADR-005]] · [[ADR-120]] · [[ADR-104]]** 만 열어라
- `/docs/features/theme.md` (`features/theme/store.ts` 를 만지므로)
- **이전 step 산출물**: `packages/core/src/storage/` · `src/storage/adapters/` · `src/native/ports.ts` ·
  `src/native/adapters/` · `@core/*` alias

## 배경

`src/features/` 14개 모듈 41개 파일 중 **39개는 DOM·Capacitor 참조가 0** 이다([[ADR-003]]·[[ADR-005]]
의 어댑터 규칙이 지켜진 결과). 그대로 `packages/core/src/features/` 로 옮긴다.

**갈리는 것 셋:**

| 대상 | 처리 |
|---|---|
| 39개 순수 파일 | `packages/core` 로 이동 |
| `features/theme/store.ts` · `features/onboarding/store.ts` | **DOM 참조 있음** — 아래 §2 |
| `features/screen-stack/` | **옮기지 마라.** [[ADR-120]] 화면 스택 상태로, RN 에서 삭제될 코드다 |

## 작업

### 1. 순수 39개를 `git mv` 로 옮겨라

대상을 손으로 세지 말고 아래로 확정하라:

```bash
for f in $(find src/features -name '*.ts' -o -name '*.tsx' | grep -v __tests__ | grep -v screen-stack); do
  grep -qE "document\.|window\.|getBoundingClientRect|ResizeObserver|matchMedia|@capacitor" "$f" || echo "$f"
done
```

각 모듈의 `__tests__/` 도 함께 옮긴다.

### 2. DOM 참조 2개 처리

**`features/theme/store.ts`** — `matchMedia` 로 시스템 다크모드를 읽는다([[ADR-104]]).
step 4 에서 만든 네이티브 포트 메커니즘에 `ColorSchemePort` 를 **추가**하고 그것을 경유하게 한 뒤
core 로 옮겨라.

```ts
export interface ColorSchemePort {
  get(): 'light' | 'dark'
  subscribe(listener: (scheme: 'light' | 'dark') => void): () => void
}
```

Capacitor 구현은 `matchMedia('(prefers-color-scheme: dark)')` 를 쓴다(지금 코드 그대로). RN 구현은
나중에 `Appearance` API 를 쓸 자리다 — **이 step 에서 RN 구현을 만들지 마라.**

**`features/onboarding/store.ts`** — 먼저 **읽고** 어떤 DOM API 를 왜 쓰는지 파악하라. 그 결과에 따라:

- 포트로 감쌀 수 있으면 감싸고 core 로 옮긴다
- 화면 렌더링에 밀착돼 있어 포트가 어색하면 **옮기지 말고 `src/features/onboarding/` 에 남긴 뒤
  그 이유를 summary 에 적어라.** 억지로 추상화하지 마라

### 3. import 경로 갱신

`src/` 에 남는 것들(`app/`, `components/`, `App.tsx`, `main.tsx`)이 features 를 참조하던 경로를
`@core/features/*` 로 바꿔라.

### 4. `screen-stack` 은 그대로 둔다

`features/screen-stack/store.ts` 와 그 테스트는 `src/features/screen-stack/` 에 남는다.
step 7 에서 `packages/app-capacitor` 로 간다.

## Acceptance Criteria

```bash
npm run build      # 컴파일 에러 없음
npm test           # 199파일 / 3044개 전부 통과 (이 step 이전과 동일한 수)
npm run lint       # 통과
npm run dev        # 브라우저에서 부팅되는지 (Ctrl-C 로 종료. 부팅 중 크래시하면 실패)
```

core 오염 검사 — **전부 비어야 한다**:

```bash
grep -rn "@capacitor" packages/core/src
grep -rE "document\.|window\.|matchMedia|ResizeObserver" packages/core/src
grep -rn "screen-stack" packages/core/src
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `packages/core` 에 Capacitor/DOM 참조가 없는가?
   - `features/screen-stack/` 이 `src/` 에 남아 있는가?
   - CLAUDE.md CRITICAL 규칙(`features/*` 가 저장소·네이티브에 **직접** 접근 금지)이 이동 후에도
     지켜지는가? — core 안의 features 는 `@core/storage` 와 포트만 봐야 한다
3. 결과에 따라 `phases/rn-core-extraction/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 features 모듈 수 · ColorSchemePort 추가 여부 · onboarding/store 처리 결과"`
   - 실패 → `"status": "error"`, `"error_message"` / 개입 필요 → `"status": "blocked"`, `"blocked_reason"`

## 금지사항

- **`features/screen-stack/` 을 `packages/core` 로 옮기지 마라.** 이유: [[ADR-120]] 의 화면 전환
  machinery 로 RN 에서 **삭제**될 코드다. 곧 지울 것을 공유 패키지에 심으면 두 앱이 함께 물게 된다.
- **`onboarding/store.ts` 를 억지로 추상화해서 옮기지 마라.** 이유: 화면에 밀착된 상태를 무리하게
  포트로 감싸면 인터페이스가 화면 구현을 따라가고, RN 에서 그 인터페이스가 그대로 부채가 된다.
  남기는 것이 정답일 수 있다.
- **`ColorSchemePort` 의 RN 구현(`Appearance`)을 만들지 마라.** 이유: 이 task 는 core 추출까지다.
  RN 어댑터는 다음 task 대상이다.
- **features 파일의 로직을 바꾸지 마라. import 경로와 포트 경유만 고쳐라.**
- **`mv` 나 복사+삭제를 쓰지 마라. `git mv` 를 써라.**
- 기존 테스트를 깨뜨리지 마라.
