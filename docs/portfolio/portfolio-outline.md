# FinalCall 독립 포트폴리오 아웃라인(12페이지)

> OnRace 상세본 뒤에 그대로 붙이는 원고가 아니라 FinalCall 독립본 설계안이다. 제출용 통합본에서는 각 프로젝트
> 5~7페이지만 추려 사용한다.

| p | 슬라이드 | 핵심 메시지 | 증거·시각자료 후보 |
|---:|---|---|---|
| 1 | 표지 | AI 에이전트 오케스트레이션으로 완성한 고동시성 게임 아이템 경매 플랫폼 | 서비스 대표 화면+`architect→backend/frontend→reviewer` 한 줄 |
| 2 | 문제·범위 | 회원부터 경매·입찰·정산·검색·배송까지 실제 도메인을 연결했다 | 도메인 지도, 완료/phase-2 경계 |
| 3 | 시스템 구조 | 모놀리스+SCG, MySQL 정본, Redis 보조, ES 파생 모델 | C4 수준 컴포넌트 다이어그램 |
| 4 | AI 개발 조직 | Claude Code와 Codex가 공통 파일 보드로 교대 가능한 체계를 만들었다 | 역할표, board/spec/review 흐름 |
| 5 | 사람의 통제 | 계약·스키마·성능·인가·디자인·Done은 사람이 승인했다 | 게이트 타임라인, AI/사용자 책임표 |
| 6 | 핵심 난제: 입찰 | 경매별 직렬화와 사용자별 금전 CAS를 서로 다른 경쟁축에 배치했다 | 두 축 락 다이어그램, I1~I10 |
| 7 | Redis 락을 기각한 이유 | 익숙한 분산락보다 실패 모델이 명확한 DB 락+CAS를 선택했다 | 대안 비교표: lease/장애전파/정합성 |
| 8 | 마감·정산 | SOLD/UNSOLD, hold capture, seller credit, fee ledger를 한 번만 전이했다 | 상태 머신+총량보존 식 |
| 9 | 리뷰가 바꾼 코드 | green 테스트 뒤에도 reviewer가 즉시구매 교차락 major를 발견했다 | before/after 락 순서, 279→수정→281 |
| 10 | 검색·CDC | MySQL 정본과 ES 파생 모델을 CDC·화해·alias 재색인으로 운영했다 | binlog→Kafka→ES 흐름, 5,040건 실측 |
| 11 | 라이브 장애 해결 | CDN, ES 버전, 동적매핑/fielddata를 실제 기동에서 찾아 수정했다 | 장애 3단 타임라인, health/검색 캡처 후보 |
| 12 | 성과·회고 | AI의 속도와 사람의 책임을 분리해 재현 가능한 개발 체계를 만들었다 | 대표 커밋·리뷰·테스트 표, 링크/QR |

## 슬라이드 작성 규율

- 한 페이지는 “문제 → 판단 → 결과” 하나만 말한다. 도구 이름 나열보다 결정 근거와 실패 검증을 앞세운다.
- 테스트 수치는 완료 시점과 범위를 함께 적는다. 69는 입찰 선정 테스트, 255는 FC-082 당시 전체 백엔드다.
- 5,040건·24건은 로컬 seed 실측으로 표시하고 운영 성능처럼 표현하지 않는다.
- item delivery phase-2, 운영 클러스터, 관리자 재색인 API 등 미구현/분리 범위를 완료로 쓰지 않는다.

## OnRace와 중복 제거

- OnRace는 Redis 대기열·재고 선점·부하 테스트·처리량 개선을 대표 서사로 유지한다.
- FinalCall에서는 일반적인 Spring/JWT/Redis 소개를 1페이지 구조도 안으로 압축한다.
- FinalCall의 고유 서사는 AI 개발 조직, DB 동시성·금전 불변식, reviewer 재작업, ES CDC 라이브 장애다.
- 두 프로젝트를 합친 제출본은 공통 프로필·기술스택을 한 번만 두고, 상세 PDF/저장소 링크로 깊이를 분리한다.

## 원천 문서

- [ai-development-journey.md](ai-development-journey.md)
- [auction-bid-settlement.md](auction-bid-settlement.md)
- [search-cdc.md](search-cdc.md)
- [item-delivery.md](item-delivery.md)
- [orchestration.md](orchestration.md)
