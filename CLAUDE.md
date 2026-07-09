# 프로젝트: 메이플 루틴 (Maple Routine)

## 기술 스택
- Vite + React SPA ([[ADR-002]]), Capacitor로 Android/iOS 하이브리드 앱 패키징 ([[ADR-001]])
- TypeScript
- Tailwind CSS

## 아키텍처 규칙
- CRITICAL: `features/*` 코드에서 로컬 저장소·네이티브 API(알림, 사냥 타이머 상시 알림 등)에 직접 접근하지 말 것. 반드시 `storage/`·`native/` 어댑터 레이어를 거칠 것 ([[ADR-003]], [[ADR-005]])
- CRITICAL: 게임 레퍼런스 수치 데이터(보스 목록·결정 가격·드랍 테이블, `src/data/`)는 AI가 임의로 추정해 하드코딩하지 말 것. 반드시 사용자(도메인 전문가) 확인을 거쳐 반영할 것 ([[ADR-006]])
- 화면은 `app/`, 기능별 상태·로직은 `features/`, 공용 UI는 `components/`, 타입은 `types/`, 범용 유틸은 `lib/`에 분리

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
