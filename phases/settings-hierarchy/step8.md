# Step 8: publish-notes-guard

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `foundation/release.md` · `features/live-update.md`)
- `/docs/ADR.md` (슬림 인덱스 — **[[ADR-119]]** 결정 1·6 이 계약이다. `/docs/adr/ADR-119.md`.
  배포 파이프라인은 `/docs/adr/ADR-022.md` · `/docs/adr/ADR-024.md`)
- `scripts/publish-live-update.mjs` (**수정 대상** — 전체를 읽어라)
- `src/data/release-notes.ts` (step 2 산출물 — 이 스크립트가 읽을 원천)
- `src/native/live-update.ts` (step 7 — `notes` 선택 필드)
- `package.json` (`version` = `1.0.2`, 스크립트 목록)

## 배경

[[ADR-119]] 결정 6 — **노트 없이는 배포가 나가지 않는다.**

이 스크립트는 이미 `package.json` 의 `version` 을 읽어 `x.y.z` 형식을 검사하고, 아니면
`process.exit(1)` 로 중단한다. **같은 자리**에서 *"그 버전의 노트가 있는가"* 를 함께 검사한다.
누락 방지 장치를 배포 게이트에 두는 이유는, 노트 작성이 수동이라 사람이 잊는 것을 코드가 막아야 하기
때문이다(결정 3 — 릴리스마다 수동 작성).

그리고 결정 1 의 두 번째 갈래 — 매니페스트 `manifest` 객체에 `notes` 를 채운다. 지금
`minNativeVersion` 을 `...(minNativeVersion ? { minNativeVersion } : {})` 로 조건부 전개하는 자리가 있다.

## 작업

### `scripts/publish-live-update.mjs` 수정

1. **노트 조회** — `src/data/release-notes.ts` 에서 `version` 에 해당하는 노트를 찾는다.

   이 스크립트는 순수 Node ESM 이고 TypeScript 를 그대로 import 할 수 없다. **먼저 이 저장소에 이미 있는
   방법을 확인하라** — 다른 스크립트가 `src/` 의 TS 데이터를 어떻게 읽는지 `scripts/` 를 훑어보고,
   선례가 있으면 그 방식을 따라라. 선례가 없다면 가장 단순한 것을 골라라:
   - 파일을 텍스트로 읽어 필요한 최소한만 뽑는 방식(정규식 파싱)은 **취약하니 피하라.**
   - `npx tsx` 같은 새 의존성을 들이지 마라(아래 금지사항).
   - **권장**: 빌드 산출물이 아니라 **`node --experimental-strip-types`** 가 이 저장소의 Node 버전에서
     동작하는지 확인하고, 안 되면 **노트만 JSON 으로 함께 두는 대신** `release-notes.ts` 를 `.ts` 그대로
     두고 스크립트가 `import` 할 수 있게 **Node 가 이해하는 형태로 export 하는 얇은 `.mjs` 를 추가**하는
     쪽을 검토하라. 어느 쪽을 골랐든 **그 이유를 스크립트 주석과 summary 에 남겨라.**

   **어떤 방식이든 원천은 한 벌이어야 한다**([[ADR-119]] 결정 1) — 노트를 스크립트용으로 **복사해 두는 것은
   금지**다. 그러면 이중관리가 생겨 이 ADR 의 전제가 깨진다.

2. **가드** — 버전 형식 검사 바로 다음에:

   - 해당 버전의 노트가 없으면 `console.error` 로 **무엇을 해야 하는지까지** 알리고 `process.exit(1)`.
     문구 예: `` `src/data/release-notes.ts 에 ${version} 노트가 없습니다. 릴리스 노트를 먼저 작성해주세요.` ``
   - 노트의 `items` 가 비어 있어도 같은 취급이다(빈 노트는 노트가 아니다).

3. **매니페스트에 `notes` 채우기** — `manifest` 객체에 노트를 문자열로 넣는다.

   `LiveUpdateManifest.notes` 가 `string` 이므로 `items` 를 사람이 읽는 한 덩어리 문자열로 합친다.
   `requiresStoreUpdate` 인 항목은 그 표식이 문자열에도 남아야 한다(모달이 그 사실을 잃으면 안 된다).
   **합치는 규칙을 주석으로 고정하라** — 이슈 #164 가 이 문자열을 그대로 읽는다.

   `minNativeVersion` 의 조건부 전개와 **같은 자리·같은 방식**으로 넣어라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 새 error 0 (baseline: 0 errors / 17 warnings)
npm test        # 기준선 177 파일 / 2695 테스트 + 이 step 에서 추가한 개수
node --check scripts/publish-live-update.mjs   # 구문 오류 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **테스트를 먼저 쓰고 구현하라(TDD).** 스크립트의 **순수 함수 부분**(노트 조회 · 문자열 합치기 · 가드
   판정)을 테스트 가능한 형태로 분리하고 테스트하라. 최소 이 케이스들:
   - 노트가 있는 버전 → 통과하고, 합쳐진 문자열에 모든 항목의 `text` 가 들어 있다
   - `requiresStoreUpdate` 항목의 표식이 문자열에 남는다
   - 노트가 없는 버전 → 중단 판정
   - `items` 가 빈 노트 → 중단 판정
   - 합쳐진 문자열이 `parseLiveUpdateManifest`(step 7)를 통과하는 매니페스트에 실린다
3. **실제 배포를 실행하지 말고** 스크립트가 **중단하는지**만 확인하라 — 현재 `package.json` 은 `1.0.2` 이고
   `release-notes.ts` 에는 `1.0.3` 만 있으므로, **지금 이 스크립트를 돌리면 가드에 걸려 중단되는 것이
   정상이다.** 그 사실을 summary 에 적어라(다음 릴리스에서 버전을 `1.0.3` 으로 올리면 맞물린다).
4. 아키텍처 체크리스트:
   - 새 npm 의존성을 추가하지 않았는가?
   - 노트 원천이 한 벌인가? (`src/data/release-notes.ts` 외에 노트 내용이 복사된 곳이 없어야 한다 —
     `grep` 으로 확인하라)
5. 결과에 따라 `phases/settings-hierarchy/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - **사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단.**
     특히 TS 데이터를 Node 스크립트에서 읽는 깔끔한 방법이 없어 새 의존성이 필요하다고 판단되면
     **임의로 추가하지 말고 blocked 로 멈춰라.**

## 금지사항

- **새 npm 의존성(`tsx`·`esbuild-register`·`ts-node` 등)을 추가하지 마라.** 이유: 배포 스크립트는 릴리스
  경로의 일부라 의존성이 늘수록 릴리스가 깨질 표면이 넓어진다. 방법이 없으면 **blocked 로 멈춰라.**
- **노트 내용을 스크립트용으로 복사해 두지 마라.** 이유: [[ADR-119]] 결정 1 의 전제가 *"진실 원천 한 벌"* 이다.
  복사본이 생기면 노트를 고칠 때 한쪽만 고쳐진다.
- **`package.json` 의 `version` 을 올리지 마라.** 이유: 버전 범프는 릴리스 chore 다. 이 step 은 게이트만 만든다.
- **실제로 배포하지 마라**(`gh release upload`·`npm run publish:*` 실행 금지). 이유: 이 phase 는 릴리스가
  아니다. 게이트 동작은 순수 함수 테스트와 중단 확인으로 검증한다.
- **`latest.json` 의 기존 필드(`version`·`url`·`checksum`·`size`·`minNativeVersion`) 를 바꾸지 마라.**
  이유: 이미 배포된 앱이 그 모양을 읽는다.
- **베타/프로덕션 채널 분기(`resolveReleaseTag`·`resolveBuildScript`)를 건드리지 마라.** 이유: [[ADR-024]] 가
  정한 구조다.
- 기존 테스트를 깨뜨리지 마라
