# EPIC-BOARD 백엔드 통합 리뷰 (FC-197~201)

- 리뷰어: reviewer 서브에이전트 (읽기전용)
- 일자: 2026-08-06
- 대상: FC-197(레지스트리·V22)·FC-198(게시글)·FC-199(댓글)·FC-200(이미지)·FC-201(공지흡수) working tree
- 계약 정본: board-domain-spec v1.0 · api-contract v1.23 §6 · erd v1.8 §4.5

## 판정: **PASS** (critical/major 0 · minor 5, 전부 비차단)

## 인가 모델 = 안전(SAFE)
- 주체 권위(I-1): 작성자·업로더·수정삭제 주체 전부 SecurityContext. 바디·경로에 작성자 식별자 없음(IDOR 설계 차단).
- 소유 검증(I-2): 수정·삭제 `isOwnedBy(subject) || admin`. author NULL(시스템 글)은 어떤 주체도 소유자 아님.
- 쓰기정책(I-3): ADMIN_ONLY 작성·수정삭제 비관리자 전면 403(BOARD_002). 작성자라도 비관리자 수정 차단.
- 댓글: allow_comments=false 우회 불가(BOARD_003).
- 이미지 바인딩: 업로더==주체·고아만·재귀속 금지. 타인/타 글/미존재 400 거부. 본문 URL 미저장·`/raw` 부재.
- 이미지 보안: 비공개 버킷·presigned GET(TTL 1h)·매직바이트 sniff(선언 타입 불신)·5MB 상한·storage_key 미노출.
- 동시성: view_count·comment_count 원자 UPDATE(RMW 회피)·언더플로 가드·bind 외부빈 TX 합류.

## MINOR 발견 (비차단)
- **M-1** ErrorCode 클래스명 `PostImageErrorCode` vs spec §10 `BoardImageErrorCode` 상충. 외부 계약 무손상(IMAGE_001/002·422 정확). 컨트롤러·DTO는 `BoardImage*` 접두라 정합상 **리네임 권고**(또는 spec 1줄 개정). → 총괄 소규모 정리 패스에서 처리 예정.
- **M-2** `PostImageService.bind` 고아 바인딩 행잠금 부재 — 동일 업로더 self-race 이론적 이중바인딩. 타인 피해 없음·낮은 우선순위.
- **M-3** 댓글 작성이 board `is_active` 미검증(계약이 요구 안 함 — 비위반). 운영 직관 관찰용.
- **M-4** `editable`가 ADMIN_ONLY 정책 미반영(실현 불가 — 비관리자가 ADMIN_ONLY 글 작성자가 되는 상태 생성 불가). 무해.
- **M-5** V23 이관 public_id `MIGRATEDNOTICE...`가 ULID 문자셋 아님(opaque 조회키라 무해·결정론적·유일).

## GatewayAccessIntegrationTest 실패 판정 = **선재 환경 결함(FC-200 회귀 아님)**
근거: (1) raw AWS SDK v2(io.awspring 아님)라 S3/MinIO health contributor 미등록, (2) 커스텀 HealthIndicator 0건, (3) MinIO는 ApplicationRunner로 예외 흡수·health 무영향(+ IntegrationTest base ensure-bucket=false), (4) EPIC-SEARCH는 ES health 기여자라 명시 비활성했으나 FC-200은 끌 기여자 자체가 없음, (5) 헤드리스 Docker 미기동 시 db/redis DOWN→비200은 전 통합테스트 공통. → 에픽 재작업 사유 아님, 환경 별도 처리.

## 계약 정합
- V22 4테이블·인덱스5·FK·nullable·시드3 정합. V23 이관(활성만·author NULL·URGENT→pinned·시각보존·롤백안전·DROP 유예) 정확. notice 제거 완결(컴파일 참조 0). 컨벤션(ErrorCode 중앙화·record DTO·ApiResponse·soft delete 필터) 준수.
