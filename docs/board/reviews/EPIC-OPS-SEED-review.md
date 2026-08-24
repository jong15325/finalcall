# EPIC-OPS-SEED 통합 리뷰

## 판정
- Critical 0 / Major 0 / Minor 0 — reviewer 통과.

## 검증
- MySQL 8 Testcontainers: dry-run → apply → 불변식 → 재실행 no-op → 외부참조 cleanup 거부 → cleanup → EMPTY 성공.
- 회계 원장·인벤토리 위치·배송 nullable·ACTIVE 최고입찰 고의 훼손 시 검증 실패 확인.
- Spotless, Checkstyle, 시드 테스트와 backend build 성공.
- 배포 DB dry-run `EMPTY`, 단발 apply 성공, 후속 status `COMPLETE`.
- 공개 경매·마켓·health API와 `fc_ops_01` 로그인 HTTP 200 확인.
- v2 전환: 유효 백업 확보 → v1 closing 파생 정산 엄격 검증·cleanup → v2 dry-run/apply 완료.
- v2 상태 `COMPLETE`, `test01` 로그인과 공개 API HTTP 200 확인.
- ACTIVE 마켓 40건이 40개 type_code와 1:1이며 스킬×Gold Force 9개 교차분포가 모두 존재.
- ACTIVE 실시간 경매 32건 확인.

## 게이트3
- 리뷰는 통과했으나 Done 전이와 커밋은 사용자 승인 대기.
