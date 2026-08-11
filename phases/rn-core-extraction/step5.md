# Step 5: core-storage

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` (원칙)
- `/docs/migration/parity-inventory.md` §5 (`storage/` 파일별 ADR 계약 표)
- `/docs/persistence/README.md`
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-003]]** 만 열어라
- **이전 step 산출물**: `src/storage/ports.ts`(포트 정의·주입) · `src/storage/adapters/`(Capacitor 구현) ·
  포트를 경유하도록 고쳐진 `src/storage/*.ts` 14개 · `@core/*` alias

step 3 이 포트를 어떻게 정의하고 어디서 주입하는지 먼저 읽어라.

## 배경

step 3 에서 의존을 뒤집었으므로 이제 `src/storage/` 의 **로직 파일들이 Capacitor 를 모른다.**
이 step 에서 그것들을 `packages/core/src/storage/` 로 옮긴다.

**갈리는 지점이 하나 있다:**

| 대상 | 어디로 | 이유 |
|---|---|---|
| `storage/*.ts` 로직 21개 + `ports.ts`(인터페이스) | **`packages/core`** | 플랫폼 독립. 두 앱이 공유 |
| `storage/adapters/*` (Capacitor 구현) | **`src/` 에 남긴다** | 구현은 앱의 것. step 7 에서 `app-capacitor` 로 간다 |

`ports.ts` 가 core 로 가는 것이 요점이다 — core 안의 storage 로직이 그 인터페이스를 참조하고,
각 앱이 자기 구현을 주입한다.

## 작업

### 1. `git mv` 로 옮겨라

- `src/storage/*.ts` (하위 `sqlite/` 포함) → `packages/core/src/storage/`
- `src/storage/ports.ts` → `packages/core/src/storage/ports.ts`
- `src/storage/__tests__/` → `packages/core/src/storage/__tests__/`
- **`src/storage/adapters/` 는 옮기지 마라.** `src/` 에 남는다

### 2. import 경로 갱신

- core 안: 상대 경로 유지(같은 패키지 내부)
- `src/` 에 남는 것들(`adapters/`, `features/`, `app/`, `components/`)이 storage 를 참조하던 경로 →
  `@core/storage/*`
- **주입 지점**(앱 부팅)이 `@core/storage/ports` 의 `setPreferencesPort`/`setSqlitePort` 를 부르고
  `src/storage/adapters/` 의 구현을 넘기는 형태가 된다

### 3. core 오염 검사

`packages/core/src/storage/` 안에 `@capacitor` 나 `adapters/` 참조가 남으면 안 된다. 남았다면
step 3 의 역전이 불완전한 것이니 **그 파일을 옮기지 말고 남긴 뒤 summary 에 적어라.**

## Acceptance Criteria

```bash
npm run build      # 컴파일 에러 없음
npm test           # 199파일 / 3044개 전부 통과 (이 step 이전과 동일한 수)
npm run lint       # 통과
```

core 오염 검사 — **전부 비어야 한다**:

```bash
grep -rn "@capacitor" packages/core/src
grep -rn "adapters/" packages/core/src/storage
grep -rE "document\.|window\.|matchMedia" packages/core/src/storage
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `packages/core` 에 Capacitor/DOM 참조가 없는가?
   - `src/storage/adapters/` 가 `src/` 에 남아 있는가?
   - 앱 부팅 시 포트 주입이 storage 첫 사용보다 먼저 일어나는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/rn-core-extraction/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "옮긴 파일 수와 core/앱에 갈린 경계"`
   - 실패 → `"status": "error"`, `"error_message"` / 개입 필요 → `"status": "blocked"`, `"blocked_reason"`

## 금지사항

- **`src/storage/adapters/` 를 `packages/core` 로 옮기지 마라.** 이유: Capacitor 구현이고, core 가
  그것을 물면 RN 앱이 `packages/core` 를 설치할 수 없게 된다.
- **파일 내용을 리팩터링하지 마라. import 경로만 고쳐라.**
- **`mv` 나 복사+삭제를 쓰지 마라. `git mv` 를 써라.**
- **export 시그니처를 바꾸지 마라.** 이유: [[ADR-127]] 결정 4.
- 기존 테스트를 깨뜨리지 마라.
