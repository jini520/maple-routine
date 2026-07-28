# 아키텍처 — 이 문서는 feature별로 분리되었습니다

> 문서를 기능 단위로 계층화하며 이 파일의 내용을 아래로 옮겼습니다. 진입점은 [README.md](./README.md).
> (이 스텁은 기존 경로 참조가 계속 해석되도록 남겨둡니다.)

## 새 위치 지도
| 옛 섹션 | 새 위치 |
|---|---|
| 디렉토리 구조·레이어 패턴·상태 관리·네이티브 개요·테스트 전략 | [foundation/architecture.md](./foundation/architecture.md) |
| 시스템 데이터 흐름(cross-cutting) | [foundation/architecture.md](./foundation/architecture.md) + 각 `features/*.md` |
| Nexon Open API 연동 | [foundation/nexon-api.md](./foundation/nexon-api.md) |
| 게임 레퍼런스 데이터 | [foundation/game-data.md](./foundation/game-data.md) |
| 에러 핸들링 및 복원력·엣지 케이스 | [foundation/error-resilience.md](./foundation/error-resilience.md) |
| 테마 시스템 | [features/theme.md](./features/theme.md) |
| 컨텐츠 스케줄러 캐시 병합([[ADR-030]]) | [features/content-scheduler.md](./features/content-scheduler.md) |
| 보스 수익 흐름·SQLite 안정성 | [features/boss-profit.md](./features/boss-profit.md) |
| 파티 관리 흐름 | [features/boss-scheduler.md](./features/boss-scheduler.md) |
| 저장 스키마 상세 | [persistence/](./persistence/README.md) |
