// `@maple-routine/core` 진입점 — **배럴이 아니다.**
//
// 각 앱은 `@core/<경로>` alias 로 **깊은 경로를 직접** import 한다([[ADR-128]] 결정 3).
// 여기서 전부 re-export 하면 화면 하나가 core 전체를 끌어와 [[ADR-092]] 번들 분할이 무효가 되고,
// 순환 import 의 허브가 된다.
//
// 이 파일이 존재하는 이유는 `package.json` 의 `main`/`exports["."]` 가 가리킬 실체가 필요해서다.
// 내용은 비워 둔다.
export {}
