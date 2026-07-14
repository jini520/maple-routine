# Step 2: publish-script-beta

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-024 전체 (특히 결정 3·4 — 릴리스 태그 이원화, 배포 스크립트 확장)
- `/CLAUDE.md`의 "개발 프로세스" — TDD(테스트 먼저 작성 후 구현)가 CRITICAL 규칙이다
- `scripts/publish-live-update.mjs` (이번 step에서 확장할 파일)
- `src/native/live-update.ts`의 `LIVE_UPDATE_MANIFEST_URL_BETA` 상수 값 (Step 1에서 추가됨 — 이 스크립트가 업로드하는 릴리스 태그 `live-update-beta`와 반드시 일치해야 한다)

## 작업

`scripts/publish-live-update.mjs`는 지금 `node scripts/publish-live-update.mjs <x.y.z>` 형태로만 실행되고, 항상 고정 릴리스 태그 `live-update-latest`에 업로드한다. 여기에 `--beta` 플래그를 추가해 `live-update-beta` 태그에 업로드할 수 있게 한다.

**반드시 테스트를 먼저 작성한 뒤 구현하라 (TDD).**

### 1. 순수 함수 두 개를 이 파일 상단(부작용이 있는 코드보다 먼저)에 추가하고 `export`하라

```js
export function resolveReleaseTag(isBeta) {
  return isBeta ? 'live-update-beta' : 'live-update-latest'
}

export function parseArgs(argv) {
  // argv는 process.argv.slice(2)로 넘어오는 배열이라고 가정한다.
  // { version: string | undefined, isBeta: boolean } 형태를 반환한다.
  // '--beta'는 어느 위치에 있어도 플래그로 인식하고, 나머지 인자 중 첫 번째를 version으로 삼는다.
}
```

기존 상단의 `const REPO = 'jini520/maple-routine'`은 그대로 두고, `const RELEASE_TAG = 'live-update-latest'` 하드코딩은 제거한 뒤 실행 로직에서 `resolveReleaseTag(isBeta)`로 계산해 쓰도록 바꿔라.

### 2. 기존 인자 검증/실행 로직을 `parseArgs`/`resolveReleaseTag`를 쓰도록 바꿔라

- 사용법 에러 메시지를 `사용법: node scripts/publish-live-update.mjs <x.y.z> [--beta]`로 갱신하라.
- `version`이 없거나 `/^\d+\.\d+\.\d+$/`에 맞지 않으면 기존과 동일하게 에러 출력 후 `process.exit(1)`한다.
- 그 외 빌드(`npm run build`) → `dist/` 압축 → 체크섬 계산 → `latest.json` 생성 → `gh release view`/`gh release create`/`gh release upload` 흐름과 로그 메시지는 **그대로 재사용**한다 — 오직 어떤 `RELEASE_TAG`를 쓰는지만 바뀐다.

### 3. 이 파일이 테스트에서 부작용 없이 import 가능하도록 실행 진입점을 감싸라

지금은 파일 최상단부터 끝까지가 즉시 실행되는 스크립트라, 테스트 파일이 `resolveReleaseTag`/`parseArgs`를 가져오려고 `import`만 해도 빌드·`gh` 호출까지 전부 실행돼버린다. Node ESM 표준 관례로 "직접 실행됐을 때만 본문을 실행"하도록 감싸라:

```js
import { fileURLToPath } from 'node:url'

// ... resolveReleaseTag, parseArgs, 그 외 export 대상 함수/상수 선언 ...

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 기존의 인자 검증부터 마지막 업로드까지, 부작용이 있는 본문 전체를 이 블록 안으로 옮긴다.
}
```

이 가드 안으로 옮기는 코드의 동작 자체는 바꾸지 않는다 — 실행 위치만 옮긴다.

### 4. `scripts/__tests__/publish-live-update.test.mjs`를 새로 작성하라

- `resolveReleaseTag`/`parseArgs`만 테스트한다. `gh`/`npm run build`를 실제로 실행하는 코드 경로는 이 step의 테스트 대상이 아니다(부작용이 있어 단위 테스트로 검증하지 않는다 — 실제 배포는 수동 검증 대상으로 남긴다).
- 최소 케이스:
  - `resolveReleaseTag(true)`는 `'live-update-beta'`를 반환한다
  - `resolveReleaseTag(false)`는 `'live-update-latest'`를 반환한다
  - `parseArgs(['1.2.3'])`는 `{ version: '1.2.3', isBeta: false }`를 반환한다
  - `parseArgs(['1.2.3', '--beta'])`와 `parseArgs(['--beta', '1.2.3'])` 둘 다 `{ version: '1.2.3', isBeta: true }`를 반환한다(플래그 위치 무관)
  - `parseArgs([])`는 `version: undefined`를 반환한다

## Acceptance Criteria

```bash
npm test   # 신규 테스트 포함 전체 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `scripts/publish-live-update.mjs`의 빌드/압축/체크섬/업로드 로직이 그대로 재사용됐는가(중복 재작성하지 않았는가)?
   - `src/`(앱 번들) 코드는 건드리지 않았는가 — 이 step은 배포 스크립트 레이어만 다룬다.
   - CLAUDE.md CRITICAL 규칙(TDD)을 위반하지 않았는가?
3. `--beta` 플래그 없이 `resolveReleaseTag`/`parseArgs`를 호출했을 때 기존과 동일하게 `live-update-latest`로 계산되는지(플래그 기본값이 바뀌지 않았는지) 특히 확인한다 — 실수로 기본 배포 대상이 베타로 바뀌면 안 된다.
4. 결과에 따라 `phases/live-update-beta/index.json`의 `step: 2`를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `gh release`/빌드/압축/체크섬 로직 자체의 동작을 바꾸지 마라 — 재배치만 한다.
- `package.json`의 `"publish-live-update"` npm script 정의는 건드리지 마라(`node scripts/publish-live-update.mjs` 그대로 유지, `--beta`는 사용자가 실행 시 직접 덧붙인다).
- 이 step에서 Play Console·앱 스토어 관련 작업은 하지 마라(코드 밖 수동 작업, 범위 밖).
- 기존 테스트를 깨뜨리지 마라.
