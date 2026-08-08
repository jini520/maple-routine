# Step 7: manifest-notes

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `features/live-update.md`)
- `/docs/ADR.md` (슬림 인덱스 — **[[ADR-119]]** 결정 5 가 계약이다. `/docs/adr/ADR-119.md`.
  매니페스트의 배경은 `/docs/adr/ADR-022.md` · `/docs/adr/ADR-026.md` · `/docs/adr/ADR-027.md`)
- `src/native/live-update.ts` (**수정 대상** — `LiveUpdateManifest` 와 `parseLiveUpdateManifest`)
- `src/native/__tests__/` 의 live-update 테스트
- `src/data/release-notes.ts` (step 2 산출물 — 이 step 에서는 **읽지 않는다**. 아래 금지사항 참고)

## 배경

[[ADR-119]] 결정 1 — 릴리스 노트는 두 갈래로 나간다. 한쪽(개발노트 화면)은 step 5 가 끝냈고, 다른 한쪽은
배포 스크립트가 `latest.json` 의 `notes` 로 파생시켜 **업데이트 모달**(이슈 #164)이 읽는 경로다.
이 step 은 그 필드를 **타입과 파서에 여는 것**까지만 한다.

**핵심은 선택 필드라는 것이다.** 이미 배포된 매니페스트(`live-update-latest` / `live-update-beta` 고정 태그의
`latest.json`)에는 이 필드가 없다. 필수 검사에 넣으면 **지금 앱을 쓰고 있는 사용자가 업데이트를 못 받는다** —
`parseLiveUpdateManifest` 가 `null` 을 돌리면 조용히 중단하기 때문이다. `minNativeVersion` 이 이미 같은
방식으로 선택 필드다.

## 작업

### `src/native/live-update.ts` 수정

1. `LiveUpdateManifest` 인터페이스에 선택 필드 추가:

```ts
notes?: string   // 이 버전의 변경 내역(ADR-119). 원천은 src/data/release-notes.ts, 배포 스크립트가 파생시킨다.
```

`minNativeVersion` 바로 아래에 두고, **왜 선택 필드인지**(옛 매니페스트 호환 — 필수로 만들면 이미 배포된
`latest.json` 이 파싱에 실패해 기존 사용자가 업데이트를 못 받는다)를 주석으로 남겨라.

2. `parseLiveUpdateManifest` — `notes` 가 **문자열일 때만** 결과에 실어 주고, 없거나 문자열이 아니면
   **그 필드 없이** 통과시킨다. `version`·`url`·`checksum`·`size` 의 **필수 검사에 넣지 마라.**

   `minNativeVersion` 을 지금 어떻게 다루고 있는지 먼저 읽고 **같은 방식**으로 처리하라. 그 함수가 이미
   선택 필드를 다루는 자리를 갖고 있다면 그 자리를 그대로 쓴다(새 분기를 만들지 말 것).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 새 error 0 (baseline: 0 errors / 17 warnings)
npm test        # 기준선 177 파일 / 2695 테스트 + 이 step 에서 추가한 개수
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **테스트를 먼저 쓰고 구현하라(TDD).** 최소 이 케이스들:
   - **`notes` 가 없는 매니페스트가 그대로 통과한다** (이 step 의 핵심 — 옛 매니페스트 호환 회귀 방지)
   - `notes` 가 문자열이면 결과에 실린다
   - `notes` 가 문자열이 아니면(숫자·객체·`null`) **매니페스트 전체를 버리지 않고** 그 필드만 빠진 채 통과한다
   - 문자열로 들어온 JSON(GitHub CDN 이 `application/octet-stream` 으로 내려주는 실제 경로)에서도 같다
   - 기존 필수 필드 검사·`minNativeVersion` 동작은 그대로다
3. **판별력을 확인하라** — `notes` 를 필수 검사에 넣었을 때 **"없어도 통과한다" 케이스만** 실패하는지
   실행으로 확인하고 되돌려라. 그 결과를 summary 에 적어라. (이게 이 step 에서 가장 위험한 회귀다.)
4. 아키텍처 체크리스트:
   - `native/` 에서 `features/`·`app/` 를 import 하지 않는가? (레이어 방향)
   - CLAUDE.md CRITICAL — `features/*` 가 네이티브 API 를 직접 부르지 않는 구조가 유지되는가?
5. 결과에 따라 `phases/settings-hierarchy/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`notes` 를 필수 필드로 만들지 마라.** 이유: 이미 배포된 `latest.json` 에는 그 필드가 없다. 필수로 만들면
  `parseLiveUpdateManifest` 가 `null` 을 돌려 **지금 앱을 쓰는 사용자가 업데이트를 영영 못 받는다.**
  ([[ADR-119]] 결정 5)
- **`src/native/live-update.ts` 에서 `src/data/release-notes.ts` 를 import 하지 마라.** 이유: 매니페스트는
  **원격에서 온 값**을 파싱하는 자리다. 앱 번들 안의 노트는 개발노트 화면이 쓰는 다른 갈래이고, 여기서 둘을
  묶으면 "받은 값"과 "가진 값"이 섞인다.
- **업데이트 모달(`UpdatePromptModal`)에 `notes` 를 표시하지 마라.** 이유: 그건 이슈 **#164** 의 몫이고
  이 phase 의 범위가 아니다. 이 step 은 필드를 **열어 두기만** 한다.
- **`check()`·다운로드·적용 흐름을 건드리지 마라.** 이유: [[ADR-027]]·[[ADR-117]] 이 그 경로를 정해 두었고,
  특히 적용 순서는 이슈 #175 로 최근에 고친 자리다.
- 기존 테스트를 깨뜨리지 마라
