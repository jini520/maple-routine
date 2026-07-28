# 프로젝트: 메이플 루틴 (Maple Routine)

## 기술 스택
- Vite + React SPA ([[ADR-002]]), Capacitor로 Android/iOS 하이브리드 앱 패키징 ([[ADR-001]])
- TypeScript
- Tailwind CSS

## 아키텍처 규칙
- CRITICAL: `features/*` 코드에서 로컬 저장소·네이티브 API(알림, 사냥 타이머 상시 알림 등)에 직접 접근하지 말 것. 반드시 `storage/`·`native/` 어댑터 레이어를 거칠 것 ([[ADR-003]], [[ADR-005]])
- CRITICAL: 게임 레퍼런스 수치 데이터(보스 목록·결정 가격·드랍 테이블, `src/data/`)는 AI가 임의로 추정해 하드코딩하지 말 것. 반드시 사용자(도메인 전문가) 확인을 거쳐 반영할 것 ([[ADR-006]])
- 화면은 `app/`, 기능별 상태·로직은 `features/`, 공용 UI는 `components/`, 타입은 `types/`, 범용 유틸은 `lib/`에 분리

## 문서
- 설계 문서는 기능 단위로 계층화됨 — `docs/README.md`가 인덱스(기능→문서→소스 파일). 작업 전 여기서 read/write 대상 문서를 판단할 것
- `docs/features/*`(기능별 정책) · `docs/foundation/*`(공통 토대: architecture·nexon-api·error-resilience·design-system·game-data·product)
- ADR: `docs/ADR.md`는 슬림 인덱스 — 전문은 `docs/adr/ADR-NNN.md` 개별 파일. 필요한 ADR만 열고 **ADR 전체를 컨텍스트에 로드하지 말 것**. 새 결정은 `docs/adr/`에 파일 추가 + 인덱스에 한 줄
- 정책을 바꿀 땐 옛 내용을 지우지 말고 각 문서 하단 "폐기된 정책 (history)" 섹션으로 이동
- `docs/features/*`를 읽고 작업할 때 '열린 질문' 항목이 이미 구현됐는지 확인하고, 완료됐으면 열린 질문에서 제거·정리할 것
- ADR도 '설계, 구현 전'으로 남는 경우가 많음 — 구현 완료 시 `docs/adr/`와 `docs/ADR.md` 인덱스 상태를 '구현 완료'로 명시할 것

## 개발 프로세스
- CRITICAL: 작업 전 관련 문서를 먼저 작성/갱신하고(docs-first), 작업 완료 후 문서를 다시 점검해 완료된 항목을 반영(체크)할 것
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
