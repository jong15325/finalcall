# FinalCall 작업 보드

파일 티켓이 **canonical 진실원**이다. Jira(KAN)는 사용자 전용 읽기 미러다.
상세 규약은 CLAUDE.md 섹션 11(티켓)·섹션 12(Jira 미러). 이 문서는 운영 요약이다.

## 구조
```
docs/board/
├── epics/     EPIC-<도메인>.md        (예: EPIC-MEMBER)
├── tickets/   FC-<번호>.md            (예: FC-014)
└── reviews/   FC-<번호>-review.md     (reviewer 판정을 메인세션이 기록)
```

## 명명 규약
- 티켓: `FC-NNN` (전역 증가, 3자리)
- 에픽: `EPIC-<도메인>` (대문자 도메인)
- 리뷰: `FC-NNN-review.md`
- `jira_key`: 모든 에픽·task에 미러 시 부여된 KAN-N (최초 1회 기록 후 불변)
- Jira task summary: 파일의 `id`와 `title`을 조합한 `FC-NNN · <title>`

## 티켓 스키마 (YAML 프론트매터)
id · type(task|epic) · epic · derived_from(직접 부모 티켓, 최초면 null) ·
jira_key · title · state(todo|doing|review|blocked|done) ·
owner(architect|backend-impl|frontend-impl|reviewer|main) ·
depends_on · blocks · gate(gate2|gate3|design|null) ·
review_status(pending|passed|changes-requested) · contract_ref · artifacts

본문: 목표 / DoD / 근거인용 / 검증 (+ 파생 티켓이면 "파생 경위" 한 줄)

## 에픽 스키마
type: epic · children: [FC-...] · state는 하위 롤업(손으로 관리 안 함):
전부 todo→todo · 하나라도 doing→doing · 전부 review 이상→review ·
전부 done + 사용자 승인→done

## 상태 머신 (전이 주체 = 메인세션. 에이전트는 산출물만 반환)
```
todo ─위임→ doing ─구현 완료→ review ─reviewer 통과→ done*
review ─critical/major→ doing(재작업)
doing/review ─선행 미충족·게이트2 대기→ blocked ─해소→ 직전
* done = 게이트3(에픽 완료 시 사용자 승인). review_status=passed 필수 선행
```

## reviewer 통과 표현
`review_status` 필드로 티켓에 명시. 게이트3 훅이 참조해 미통과 done/원격반영을 막는다.
리뷰 상세는 reviewer가 반환 → 메인세션이 `reviews/FC-NNN-review.md`에 기록.
