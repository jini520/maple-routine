# Step 4: native-ports

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` — 원칙 1(어댑터 시그니처 고정)
- `/docs/migration/parity-inventory.md` §5 (`native/` 파일별 ADR 계약 표)
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-003]] · [[ADR-005]] · [[ADR-090]] · [[ADR-120]]** 만 열어라
- `/docs/features/ads.md` · `/docs/features/live-update.md` · `/docs/features/hunting-timer.md`
- **작업 대상 전 파일**: `src/native/**` (11개 소스 + 9개 테스트) · `src/lib/use-system-back.ts`
- **이전 step 산출물**: `src/storage/ports.ts` 의 포트 정의·주입 방식 — **같은 패턴을 따르라**

step 3 이 storage 에서 쓴 포트/주입 패턴을 먼저 읽고, 그것과 **일관된 방식**으로 작성하라.
서로 다른 두 방식이 한 저장소에 있으면 이후 step 들이 어느 쪽을 따를지 매번 판단해야 한다.

## 배경

`src/native/` 는 전부 Capacitor 플러그인을 직접 import 한다. `packages/core` 로 갈
`features/` 가 이 어댑터들을 참조하므로(6개 지점), **인터페이스는 core 로 가고 구현은 각 앱에 남아야
한다.**

`features/` → `native/` 참조 지점(정확히 6개):

| 참조하는 파일 | 참조 대상 |
|---|---|
| `features/ads/tab-switch-ad.ts` | `native/ads` |
| `features/settings/cache-data.ts` | `native/splash-screen` |
| `features/theme/store.ts` | `native/status-bar` · `native/system-bars` |
| `features/live-update/store.ts` | `native/live-update` · `native/splash-screen` |

**이 step 에서도 파일을 옮기지 않는다. 의존 방향만 뒤집는다.**

## 작업

### 절대 어겨서는 안 되는 규칙 — 외부 시그니처 불변

step 3 과 동일하다. `src/native/*.ts` 가 export 하는 함수의 이름·인자·반환 타입을 바꾸지 마라.

### 1. 포트 인터페이스를 정의하라

`src/native/ports.ts` 에 어댑터별 포트를 둔다. 대상 11개:

| 파일 | 비고 |
|---|---|
| `ads.ts` | [[ADR-090]] 게이트가 `features/ads/policy.ts` 에 있고 그쪽은 순수 함수다. 포트는 SDK 호출만 |
| `live-update.ts` | **주의**: OTA 프로토콜 재설계는 이 task 범위 밖([[ADR-127]] 결정 7). 지금은 현재 동작 그대로 포트화만 하라 |
| `splash-screen.ts` · `status-bar.ts` · `system-bars.ts` · `keyboard.ts` | |
| `notifications.ts` | |
| `hunting-timer/hunting-timer.ts` · `hunting-timer/hunting-timer.web.ts` | 웹 폴백이 있는 구조를 유지하라 |
| `back-gesture.ts` | [[ADR-120]]. RN 에서 삭제 대상이지만 **지금은 Capacitor 앱이 쓰므로 포트화한다** |

`src/lib/use-system-back.ts` 도 이 step 에서 처리한다 — Capacitor 를 직접 import 하므로 포트를
경유하게 고쳐라. 단, **`packages/core` 로 옮기지는 마라**(step 2 에서 남긴 8개 중 하나이고 RN 에서
삭제될 코드다).

### 2. 웹/네이티브 분기를 포트 뒤로 넣어라

지금 어댑터들은 `Capacitor.getPlatform()` 으로 웹이면 no-op 한다(`native/ads.ts` 주석 참고 —
"웹에서는 전부 no-op 이다. 가드가 없으면 개발 서버가 부팅 중 죽는다").

**이 분기는 어댑터 구현 쪽에 남겨라.** 포트 인터페이스가 플랫폼을 알면 안 된다. core 로 갈 코드는
"포트를 부르면 알아서 된다"만 알아야 한다.

### 3. Capacitor 구현을 분리하고 주입하라

`src/native/adapters/` 로 빼고, 앱 부팅 지점에서 storage 포트와 **같은 자리**에 주입하라.

주입 순서에 주의: `features/live-update/store.ts` 가 `native/splash-screen` 을 쓰고 부팅 흐름에
관여한다([[ADR-117]]). 포트 주입이 그보다 **먼저** 일어나야 한다.

### 4. `features/` 6개 지점은 그대로 두어라

시그니처를 유지했다면 `features/` 는 수정할 필요가 없다. 만약 수정이 필요하다면 시그니처를 바꾼
것이므로 **되돌려라.**

## Acceptance Criteria

```bash
npm run build      # tsc -b && vite build — 컴파일 에러 없음
npm test           # vitest run — 199파일 / 3044개 전부 통과 (이 step 이전과 동일한 수)
npm run lint       # ESLint 통과
```

의존 역전 확인 — **`adapters/` 밖에서는 비어야 한다**:

```bash
grep -rn "@capacitor" src/native --include='*.ts' | grep -v __tests__ | grep -v "native/adapters/"
grep -rn "@capacitor" src/lib --include='*.ts' | grep -v __tests__
```

`features/` 가 안 바뀌었는지 확인:

```bash
git diff --stat src/features    # 비어 있거나 거의 비어 있어야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/native/*.ts` 의 export 시그니처가 **하나도** 바뀌지 않았는가?
   - 포트 인터페이스가 플랫폼(`Capacitor.getPlatform()` 등)을 아는가? **안다면 잘못된 것이다.**
   - `npm run dev` 로 브라우저에서 앱이 부팅되는가? (웹 no-op 가드가 살아 있는지 — 죽으면 가드를
     어댑터 쪽으로 못 옮긴 것이다)
   - CLAUDE.md CRITICAL 규칙(`features/*` 가 네이티브 API 에 직접 접근 금지)을 위반하지 않았는가?
3. 결과에 따라 `phases/rn-core-extraction/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "정의한 네이티브 포트 목록과 주입 지점"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/native/*.ts` 가 export 하는 함수의 시그니처를 바꾸지 마라.** 이유: [[ADR-127]] 결정 4.
  `features/` 6개 지점이 이것에 의존한다.
- **`native/live-update.ts` 의 OTA 동작을 바꾸지 마라. 포트화만 하라.** 이유: @capgo → expo-updates
  프로토콜 재설계는 별도 ADR 대상이고([[ADR-127]] 결정 7), 여기서 손대면 **현재 배포 중인 앱의
  업데이트 경로가 깨진다.**
- **`native/ads.ts` 의 광고 단위 ID 와 `shouldUseTestAds` 로직을 바꾸지 마라.** 이유: 실 ID 로 자기
  광고를 누르면 무효 트래픽으로 AdMob 계정이 정지될 수 있고 되돌리기가 매우 어렵다. 개발 빌드가
  테스트 ID 를 쓰게 하는 그 판정이 유일한 방어선이다.
- **웹 no-op 가드를 제거하지 마라.** 이유: 가드가 없으면 `npm run dev` 가 부팅 중 죽는다
  (`native/ads.ts` 주석 참고).
- **포트 인터페이스가 플랫폼을 알게 만들지 마라.** 이유: 그러면 core 가 플랫폼을 아는 것이고,
  이 task 전체의 목적이 무너진다.
- **파일을 `packages/core` 로 옮기지 마라.** `native/` 구현은 **끝까지 앱 쪽에 남는다** —
  step 7 에서 `packages/app-capacitor` 로 간다.
- 기존 테스트를 깨뜨리지 마라.
