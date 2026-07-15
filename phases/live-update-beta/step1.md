# Step 1: live-update-channel

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-022 전체 (Live Update 도입 배경)와 ADR-024 전체 (버전 형식 버그·베타 채널 결정, 특히 결정 2·3)
- `/CLAUDE.md`의 "개발 프로세스" — 이 프로젝트는 TDD(테스트 먼저 작성 후 구현)를 CRITICAL 규칙으로 강제한다
- `src/native/live-update.ts` (이번 step에서 확장할 파일)
- `src/native/__tests__/live-update.test.ts` (기존 테스트 스타일 — `describe`/`it` 구조, mock 패턴을 그대로 따른다)
- `src/main.tsx` (이번 step에서 한 줄 수정할 파일)

## 작업

**반드시 테스트를 먼저 작성한 뒤 구현하라 (TDD).**

### 1. `src/native/live-update.ts`에 베타 매니페스트 URL 상수와 채널 선택 함수를 추가하라

```ts
export const LIVE_UPDATE_MANIFEST_URL_BETA =
  'https://github.com/jini520/maple-routine/releases/download/live-update-beta/latest.json'

export function resolveLiveUpdateManifestUrl(channel: string | undefined): string
```

- `resolveLiveUpdateManifestUrl`은 `channel === 'beta'`일 때만 `LIVE_UPDATE_MANIFEST_URL_BETA`를 반환하고, 그 외(`undefined`, `'beta'`가 아닌 다른 문자열 포함)에는 기존 `LIVE_UPDATE_MANIFEST_URL`(프로덕션)을 반환한다.
- 기존 `LIVE_UPDATE_MANIFEST_URL` 상수 값과 `isNewerVersion`/`checkForLiveUpdate`/`notifyLiveUpdateReady`의 동작은 그대로 유지한다.

### 2. `src/native/__tests__/live-update.test.ts`에 `resolveLiveUpdateManifestUrl`용 `describe` 블록을 추가하라

최소한 아래 세 가지를 검증하는 케이스를 포함하라:
- `channel`이 `'beta'`면 `LIVE_UPDATE_MANIFEST_URL_BETA`를 반환한다
- `channel`이 `undefined`면 `LIVE_UPDATE_MANIFEST_URL`을 반환한다
- `channel`이 `'beta'`가 아닌 다른 문자열(예: `'production'`)이면 `LIVE_UPDATE_MANIFEST_URL`을 반환한다

### 3. `src/main.tsx`를 수정해 빌드 시점 환경 변수로 채널을 고른다

현재:
```ts
import { LIVE_UPDATE_MANIFEST_URL, checkForLiveUpdate, notifyLiveUpdateReady } from './native/live-update'
...
void checkForLiveUpdate(LIVE_UPDATE_MANIFEST_URL)
```

변경 후:
```ts
import { checkForLiveUpdate, notifyLiveUpdateReady, resolveLiveUpdateManifestUrl } from './native/live-update'
...
void checkForLiveUpdate(resolveLiveUpdateManifestUrl(import.meta.env.VITE_LIVE_UPDATE_CHANNEL))
```

- `import.meta.env.VITE_LIVE_UPDATE_CHANNEL`은 Vite가 빌드 시점에 값을 코드에 그대로 치환하는 환경 변수다(`VITE_` 접두사 규칙, Vite 내장 기능 — 별도 타입 선언 파일을 만들 필요 없다. `tsconfig.app.json`에 이미 `"types": ["vite/client"]`가 있어 `ImportMetaEnv`가 기본적으로 임의의 문자열 키를 허용한다).
- `main.tsx`에서 더 이상 `LIVE_UPDATE_MANIFEST_URL`을 직접 import하지 않는다 — `resolveLiveUpdateManifestUrl` 안에서만 참조된다.
- `main.tsx`에는 이 값을 저장하거나 런타임에 바꿀 수 있는 코드를 추가하지 마라 — 채널은 빌드 시점에만 고정된다(ADR-024 결정 2, 런타임 토글 미채택).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `native/live-update.ts` 어댑터 레이어 원칙을 벗어나지 않았는가(`features/*`·`app/*`가 이 파일을 거치지 않고 `@capgo/capacitor-updater`를 직접 import하지 않는가)?
   - `checkForLiveUpdate`/`isNewerVersion`/`notifyLiveUpdateReady`의 기존 동작·시그니처를 바꾸지 않았는가?
   - CLAUDE.md CRITICAL 규칙(TDD)을 위반하지 않았는가 — 테스트를 구현보다 먼저 작성했는가?
3. 결과에 따라 `phases/live-update-beta/index.json`의 `step: 1`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `isNewerVersion`/`checkForLiveUpdate`/`notifyLiveUpdateReady`의 내부 로직은 건드리지 마라. 이유: 이번 스코프는 매니페스트 URL 선택 로직 추가이지 업데이트 오케스트레이션 변경이 아니다.
- 베타 채널 여부를 `storage/`나 `Preferences`에 저장하는 코드를 추가하지 마라. 이유: ADR-024가 런타임 토글을 명시적으로 채택하지 않기로 결정했다 — 채널은 오직 빌드 시점 환경 변수로만 정해진다.
- 기존 테스트를 깨뜨리지 마라.
