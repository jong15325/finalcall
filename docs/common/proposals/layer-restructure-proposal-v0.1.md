# 패키지 레이어 구조 개정안 (v0.3)

- **상태: DECIDED (2026-07-25, 사용자·게이트2) · v0.3 규약 확정 (consultant)** — 채택 = **옵션 C(feature-first + 도메인 내부 controller/service/repository 하위패키지, On-Race 방식 복제)**. 확정 세부: (1) 업무 도메인 feature는 **`com.finalcall.domain` 그룹 아래**로 묶는다 → `com.finalcall.domain.<feature>.<layer>`, (2) 횡단 인프라·공용 커널은 현행 `common`·`infra` 유지(feature 아님·제자리·**`domain` 그룹 밖**, 총괄 기본값·변경 가능), (3) 타이밍 = 재구성 먼저·EPIC-EMAIL-VERIFY hold. 실행 = EPIC-RESTRUCTURE(FC-119~122).
- **v0.3 변경 사유(2026-07-25, 사용자 결정)**: v0.2의 "`domain.` 접두 생략(`com.finalcall.<feature>`)"을 **뒤집어**, 업무 도메인 feature를 `com.finalcall.domain` 그룹 아래로 묶는다(On-Race 원형과 정합). 계층 5분할·feature 루트 규칙은 불변, 각 feature 위에 `domain.` 한 겹만 추가된다. 커널(`common`·`infra`)은 domain 밖 제자리로 불변. ArchUnit 영향은 §10 참조((b) 슬라이스 매칭 패턴만 갱신, (a)(c)는 불변).
- **v0.2 추가분(FC-119)**: §9 도메인별 목표 레이아웃 정밀표, §10 신규 ArchUnit 규칙 스펙(FC-120이 구현), §11 이전 순서 재확인. §0~§8은 결정 이력으로 보존한다(원안 근거·비교). ArchUnit 강제는 옵션 B의 **이름 기반 규칙**을 쓰되 내부 하위패키지명은 `controller/service/repository/entity/dto`(옵션 C)로 확정 — 두 옵션의 결론이 실무에서 합쳐진 형태다.
- (이전 상태: v0.1 DECIDED · v0.1 DRAFT — 사용자 결정 대기)
- 작성: consultant (CLAUDE.md 섹션 8 "구조적 규약 개정" 소환)
- 축: **체계 축**(패키지 규약·의존 강제·문서 체계)만 다룬다. 기능·계약·스케줄(프로젝트 축)은 다루지 않는다.
- 소환 사유: 사용자 지적 — "서비스·에러코드가 (Controller와) 다른 레이어로 분산돼 한 도메인 작업 시 왕복이 잦다."

---

## 0. 요약 (총괄용)

- **권고안: 옵션 B(feature-first, On-Race형) 채택.** 단, On-Race와 달리 **의존 방향을 ArchUnit으로 계속 기계 강제**한다(강제 규칙을 "최상위 레이어 간"에서 "슬라이스 내부 계층 + 슬라이스 간 비순환"으로 교체). finalcall의 차별점인 "기계로 강제되는 의존 규율"을 유지하면서, 사용자가 지적한 왕복·저응집을 제거한다.
- **파급 규모**: 프로덕션 약 **217개 파일**이 패키지 선언·import 변경(이동), 테스트 약 **75개 파일** import 변경, ArchUnit 규칙 파일 **1개** 재작성. 공용 커널(common 17 + infra 19 + domain/common 3)은 대체로 제자리. CLAUDE.md **섹션 1·3·4·5·7** 개정.
- **타이밍 권고**: **EPIC-EMAIL-VERIFY 착수(코드 0줄) 직전인 지금이 최적 시점**. 이동을 뒤로 미룰수록 이동 대상 파일만 늘어난다.

---

## 1. 진단 — 현 구조의 정확한 성격

### 1.1 순수 layer-first가 아니라 "layer-first 안에 feature 분할"

최상위를 기술 계층으로 4분할하고(`api / domain / infra / common`), **각 계층 안에서 다시 도메인으로 하위분할**하는 2단 구조다.

```
com.finalcall
├─ api        (70파일)  ─ 계층: 진입점(Controller) + Request/Response DTO
│   ├─ auth(8) auction(9) bid(5) currency(3) item(11) member(5)
│   └─ notice(6) order(5) purchase(2) shop(9) sample(3) support(2)
├─ domain     (153파일) ─ 계층: Entity · Repository(+Custom/Impl) · Service · ErrorCode · 도메인 VO/Command/Result
│   ├─ auth(3) auction(20) bid(13) currency(11) item(27) member(7)
│   ├─ notice(8) search(12) settlement(24) shop(25) sample(3)
│   └─ common(3)  ← BaseEntity/BaseTimeEntity/BaseCreatedEntity (공용 커널 성격)
├─ infra      (19파일)  ─ config(8) · redis(1) · security(10, JWT필터·게이트웨이필터·RefreshTokenStore)
└─ common     (17파일)  ─ exception(4) · response(3) · logging(4) · security(2) · lock(1) · util(3)
```

즉 "한 도메인"은 **이미 존재하지만 두 계층 패키지로 물리적으로 쪼개져** 있다. `member`를 예로 들면:
- `api/member/` : MemberController + 4개 DTO (5)
- `domain/member/` : User, UserBalance, UserRepository, UserBalanceRepository, MemberService, MemberErrorCode (7)

이 둘은 서로 다른 디렉터리 트리에 산다. 사용자가 말한 "서비스·에러코드 분산"은 정확히 이 지점이다 — **MemberService·MemberErrorCode가 MemberController와 다른 트리**에 있다.

### 1.2 실제 마찰 지점 (구체 사례)

- **왕복**: `member` 기능 하나를 손보려면 `api/member`(컨트롤러·DTO)와 `domain/member`(서비스·엔티티·리포지토리·에러코드) 두 트리를 오간다. `bid`도 `api/bid`(5) ↔ `domain/bid`(13), `item`도 `api/item`(11) ↔ `domain/item`(27).
- **한 컨텍스트가 3개 패키지로 흩어진 사례(settlement)**: 정산 바운디드 컨텍스트의 도메인 로직(SaleOrder·PurchaseService·OrderService·CloseService·FeeCalculator 등 24파일)은 `domain/settlement`에 있는데, 그 API는 `api/order`(5)와 `api/purchase`(2)로 **이름조차 다른 두 패키지에 분산**됐다. 한 컨텍스트를 이해하려면 세 트리를 봐야 한다.
- **응집도**: 한 기능의 "변경 이유가 같은" 클래스들(Controller·Service·Repository·Entity·ErrorCode·DTO)이 물리적으로 흩어져, 변경 시 diff와 리뷰가 여러 디렉터리로 퍼진다. 반대로 **계층별 응집**(모든 Controller가 한곳)은 실제로는 거의 활용되지 않는다 — 한 화면·한 API를 고칠 때 "모든 컨트롤러"를 함께 볼 일은 없다.

### 1.3 강제 규율의 결합

의존 방향 `api → domain → infra → common`을 `LayerDependencyTest`(ArchUnit)가 **최상위 패키지 경계로** 강제한다(`whereLayer("domain").mayOnlyBeAccessedByLayers("api")` 등 + 레이어 순환 금지). 이 규칙은 **"최상위 4패키지가 곧 계층"이라는 전제에 결합**돼 있어, 구조를 바꾸면 이 테스트도 반드시 재설계해야 한다. 이것이 이 개정의 핵심 트레이드오프다(§3의 각 옵션이 ArchUnit을 어떻게 다시 쓰는지 명시).

---

## 2. On-Race 비교

사용자의 이전 프로젝트 On-Race(`D:\Java\ktcloud\backend\On-Race\backend`)는 **feature-first + 멀티모듈**이다.

```
com.kt.onrace.domain.<feature>.{controller, service, repository, entity, dto, listener, config, client}
```

예: `domain/event/{controller, service, repository(+Custom/Impl), entity, dto, listener}` — 한 기능의 모든 계층이 **한 트리 아래** 산다. 멀티모듈(common·gateway·auth·main·queue)로 물리 분리하고, **ArchUnit은 없다**(의존 강제를 Gradle 모듈 경계에 위임).

| 관점 | finalcall (현행, layer-first + feature 하위분할) | On-Race (feature-first + 멀티모듈) |
|---|---|---|
| 패키징 철학 | package-by-layer(1차) → feature(2차) | package-by-feature |
| 한 기능의 응집 | **분산**(api 트리 + domain 트리, 최대 3트리) | **응집**(feature 한 트리에 전 계층) |
| 계층 표현 | 최상위 패키지 = 계층 | feature 내부 하위패키지 = 계층 |
| 의존 강제 방식 | **ArchUnit로 계층 방향 기계 강제**(코드 레벨) | Gradle **모듈 경계**로 강제, 코드 레벨 ArchUnit 없음 |
| 슬라이스 간 격리 | 강제 안 함(같은 계층 내 feature끼리 자유 참조 가능) | 모듈 경계로 물리 격리(main/auth/queue) |
| MSA 추출 용이성 | **낮음** — 한 서비스가 api·domain·infra에 흩어져 추출 시 여러 트리에서 긁어모아야 | **높음** — feature 트리(또는 모듈)를 통째로 들어냄 |
| 인증 모델 | 서비스 내 JWT 자체검증(SecurityContext), X-User-Id 미도입(D-065) | 게이트웨이 인증 위임, X-User-Id 헤더 |
| 단일/멀티모듈 | 단일 모듈(`backend/src`) | 멀티모듈 |

**핵심 시사점 2가지**:
1. finalcall의 **차별점은 "ArchUnit 기계 강제"** 다(On-Race엔 없다). feature-first로 가더라도 이 강제를 버릴 이유는 없다 — 강제 대상(무엇을 막는가)만 바꾸면 된다.
2. finalcall은 **단일 모듈**이라 On-Race식 "모듈 경계로 격리"를 그대로 쓸 수 없다. 격리를 원하면 ArchUnit 슬라이스 규칙(또는 Spring Modulith)으로 대체해야 한다.

---

## 3. 옵션 (최소 3안)

각 안을 업계 표준 패턴에 매핑하고, **ArchUnit(의존 강제) 재설계**를 반드시 명시한다.

### 옵션 A — 현행 유지 (package-by-layer + feature 하위분할)

- **구조**: 변경 없음.
- **업계 매핑**: package-by-layer(전통적 3-tier/레이어드 아키텍처).
- **ArchUnit**: 현행 `LayerDependencyTest` 그대로. 재작업 0.
- **장점**: 이동 비용 0, 리스크 0. 스켈레톤 참조문서·CLAUDE.md와 100% 정합. 계층 경계가 최상위 패키지로 자명.
- **단점**: 사용자가 제기한 왕복·저응집·다트리 분산(§1.2)이 **그대로 남는다**. 도메인이 늘수록(경매 에픽 이후 12개 컨텍스트) 마찰 누적. MSA 추출 시 한 서비스가 여러 계층 트리에 흩어져 불리(D-068 확장 맥락과 상충).
- **리스크**: 없음(현상 유지). 단 "지적된 문제를 방치"하는 선택.

### 옵션 B — 완전 feature-first (On-Race형) **[권고]**

- **구조**: 최상위를 **feature로 분할**, 각 feature 안에 계층 하위패키지.

```
com.finalcall
├─ member   ├─ MemberController, MemberXxxRequest/Response  (구 api/member)
│           └─ User, UserBalance, *Repository, MemberService, MemberErrorCode (구 domain/member)
├─ bid / auction / item / currency / notice / search
├─ settlement  ← 구 domain/settlement + 구 api/order + 구 api/purchase 를 한 트리로 통합
├─ ...
├─ common   ← 현행 유지(exception·response·logging·util·lock — 공용 커널)
└─ global (또는 infra)  ← 현행 infra(config·security 필터·redis) + BaseEntity 3종 = 횡단 관심사
```

  - 한 feature 안의 계층은 **평면 배치**(On-Race처럼 `controller/service/repository/entity/dto` 하위패키지를 쓰거나, 현행처럼 feature 루트에 평면 배치 — 둘 다 가능. 파일 수가 큰 feature(item 27, settlement 24)는 하위패키지 권장).
  - BaseEntity 등 공용 커널과 JWT/게이트웨이 필터 등 횡단 인프라는 feature가 아니므로 `common`/`global`로 남긴다.
- **업계 매핑**: package-by-feature = **Modular Monolith**의 기본형. 각 최상위 feature 패키지를 하나의 "모듈"로 보면 **Spring Modulith**로 자연 승격 가능(§3의 승급 경로). DDD **bounded context** 1:1 매핑.
- **ArchUnit 재설계 (핵심)**: 최상위 계층 규칙을 폐기하고 **두 축**으로 교체.
  1. **슬라이스 간 비순환·격리**: `slices().matching("com.finalcall.(*)..").should().beFreeOfCycles()` (현행 유지). 추가로 feature 간 직접 참조를 **service/공개 타입 경유로만** 허용하고 싶으면 Spring Modulith 또는 ArchUnit 커스텀 규칙으로 "타 feature의 내부 클래스 접근 금지"를 건다(선택).
  2. **슬라이스 내부 계층 방향**: 이름 기반 규칙으로 강제 — `..Controller`는 `..Service`에만, `..Service`는 `..Repository`/Entity에만 의존, Entity/Repository는 Controller/Service를 역참조 금지. (naming-based ArchRule; On-Race엔 없던 강제를 오히려 **추가**로 얻는다.)
  3. **커널 방향**: `common`/`global`은 어떤 feature도 의존하지 않음(현행 common 규칙 이식).
- **장점**: 사용자 지적 **완전 해소**(한 기능=한 트리). settlement 3트리 분산 해소. On-Race와 **레이아웃 일관**(포트폴리오 두 프로젝트 통일). **MSA 추출 최적**(feature 트리를 모듈/서비스로 통째 이동). ArchUnit 강제는 유지하되 대상이 "응집을 돕는 방향"으로 바뀜.
- **단점**: 이동 규모 최대(§6). ArchUnit 규칙 전면 재작성. "계층이 최상위에서 안 보인다"는 인지 비용(단, feature 내부 하위패키지로 완화).
- **리스크**: 대규모 이동(머지 충돌·리뷰 부담·전환 중 ArchUnit 공백). 완화책 §8.

### 옵션 C — 하이브리드 (feature-first + feature 내부 명시적 계층 컬럼)

- **구조**: 최상위 feature 분할 + **각 feature 안에 `api/domain/infra` 하위패키지를 명시**.

```
com.finalcall
├─ member/{api, domain}        ← api=Controller+DTO, domain=Entity·Repo·Service·ErrorCode
├─ bid/{api, domain, infra?}   ← infra는 feature 전용 인프라 있을 때만
├─ settlement/{api, domain}
├─ common   (공용 커널)
└─ global   (횡단 인프라: 보안필터·config)
```

- **업계 매핑**: feature-first에 **hexagonal/ports-adapters(슬라이스별)** 를 겹친 형태. bounded context마다 계층 컬럼을 명시하는 DDD-정석에 가장 근접.
- **ArchUnit 재설계**: feature별 `layeredArchitecture()`를 패키지 프리픽스로 반복 정의(예: `com.finalcall.member.api → com.finalcall.member.domain`), + 슬라이스 간 비순환. 규칙 수가 feature 수만큼 늘거나, `com.finalcall.*.api → com.finalcall.*.domain` 패턴 규칙 1벌로 일반화.
- **장점**: 계층 경계가 feature 안에서도 **명시적**(B의 이름 기반보다 물리적으로 뚜렷). MSA 추출 시 각 feature가 이미 api/domain 컬럼을 갖춰 모듈화가 가장 매�«럽다.
- **단점**: **중첩·의례(ceremony) 최대**. 12개 feature × (api/domain[/infra]) = 빈 `infra` 패키지 남발 가능(대부분 feature는 전용 인프라가 없음). 1인 포트폴리오 규모엔 과설계 소지. 컨설턴트 원칙("규약을 줄이는 방향 우선")과 상충하는 방향.
- **리스크**: B와 동일한 이동 규모 + 추가 중첩으로 초기 정착 비용 ↑.

---

## 4. 권고안 + 근거

**옵션 B(feature-first, On-Race형)를 권고한다.** 단 ArchUnit 기계 강제는 유지·재설계한다.

근거:
1. **문제를 정확히 푼다**: 사용자 지적(서비스·에러코드 분산, 왕복)은 "한 기능=한 트리"로 근본 해소된다. settlement의 3트리 분산도 사라진다.
2. **finalcall 맥락(모놀리식 + 향후 MSA)**: D-068은 게이트웨이 재사용·MSA 확장을 명시한다. **feature-first는 MSA 추출의 전제 조건**이다 — layer-first(A)는 한 서비스가 계층마다 흩어져 추출이 어렵다. B는 feature 트리를 모듈/서비스로 통째 들어낼 수 있고, 나중에 **Spring Modulith → 멀티모듈 → MSA**로 무리 없이 승급한다.
3. **차별점 보존**: finalcall의 강점인 "ArchUnit 기계 강제"를 버리지 않는다. 오히려 슬라이스 내부 계층 규칙을 추가해 On-Race보다 **강한** 강제를 얻는다(On-Race는 ArchUnit 자체가 없다).
4. **포트폴리오 일관**: On-Race와 레이아웃이 통일돼, 두 프로젝트를 함께 제시할 때 설명 비용이 준다.
5. **C 대비 절약**: C의 per-feature `api/domain/infra` 컬럼은 대부분 feature에서 `infra`가 비어 과설계다. B는 같은 이점(응집·추출성)을 더 적은 중첩으로 얻는다 — 컨설턴트 원칙("규약·의례를 줄이는 방향")에 부합. 파일 수가 큰 feature만 내부 하위패키지를 두는 **선택적 계층화**로 유연성 확보.

A는 "지적된 문제 방치", C는 "과설계"라 탈락. B가 균형점이다.

---

## 5. 마이그레이션 계획 (B 채택 시)

**단계적(phased)·feature 단위 점진 이전이 가능**하다(모두 한 번에 옮길 필요 없음). 핵심은 "이동 중에도 빌드·ArchUnit이 항상 초록"을 유지하는 것.

- **Phase 0 (준비, 코드 이동 0)**: 목표 패키지 규약 확정(feature 목록·common/global 경계·내부 하위패키지 여부). CLAUDE.md 초안(§6의 개정 섹션). **ArchUnit을 "신·구 규칙 병존"으로 먼저 확장** — 새 규칙(슬라이스 계층·비순환)을 추가하되 구 규칙도 남겨, 이동이 진행되는 동안 공백이 없게 한다.
- **Phase 1 (커널 고정)**: `common`·`infra(→global)`·`domain/common`(BaseEntity 3종) 위치를 먼저 확정. 이들은 feature가 아니므로 이동 최소.
- **Phase 2 (feature 단위 이전, 반복)**: 의존이 적은 leaf feature부터 한 번에 하나씩. 권장 순서 = `sample`(데모, 저위험) → `notice`(참조구현) → `member` → `currency` → `item` → `auction` → `bid` → `search` → `settlement`(order/purchase 통합) → `shop`. 각 feature 이전 = ①`api/<f>`+`domain/<f>`를 `<f>/`로 이동 ②package 선언·import 일괄 치환 ③해당 feature 테스트 이동 ④`./gradlew :backend:test`로 ArchUnit·슬라이스 초록 확인 → 원자 커밋 1개.
- **Phase 3 (구 규칙 제거)**: 모든 feature 이전 완료 후 `LayerDependencyTest`의 **구 최상위-레이어 규칙을 삭제**하고 새 규칙만 남긴다. 이 시점에 CLAUDE.md 섹션 개정을 함께 확정.
- **import 일괄 변경 전략**: IDE 리팩터(Move Class/Package, import 자동 갱신)가 1순위. 헤드리스/스크립트 보조가 필요하면 feature별로 `com.finalcall.api.<f>`·`com.finalcall.domain.<f>` → `com.finalcall.<f>` 치환. Spotless/Checkstyle이 import 순서를 정리하므로 이동 후 `:backend:spotlessApply` 필수(섹션 7).
- **ArchUnit 교체 시점**: 규칙 **추가는 Phase 0**(공백 방지), 규칙 **삭제는 Phase 3**(전 feature 이전 후). 그 사이 구간은 신·구 규칙 병존으로 항상 강제가 살아 있다.

---

## 6. 파급 범위 (blast radius) 정량화

- **이동 대상 프로덕션 파일 ≈ 217개**:
  - `api/*` 전량 **70개** → 각 feature 트리로.
  - `domain/*` 중 feature 파일 **≈ 147개**(전체 153 − `domain/common` BaseEntity 3 − 이미 커널인 것 제외) → 각 feature 트리로.
  - **제자리(또는 rename만)**: `common` 17, `infra`(→`global`?) 19, `domain/common` 3 = **≈ 39개**.
- **테스트 파일 ≈ 75개**: 대부분 프로덕션 클래스를 import → import 경로 변경. `com.finalcall.domain.<f>.*Test`·`com.finalcall.api.<f>.*Test`는 feature 트리로 함께 이동. `integration`·`support`·`architecture` 패키지는 유지 가능(import만 갱신).
- **ArchUnit**: `LayerDependencyTest.java` **1개** 재작성.
- **CLAUDE.md 개정 섹션(구체)**:
  - **섹션 1**: `LAYERS = api > domain > infra > common` 서술, 핵심 도메인 배치 설명.
  - **섹션 3(공유 변수)**: `LAYERS`, `COMMON_SUBPKGS`, `INFRA_SUBPKGS`, `SAMPLE_FEATURE` — 구조 축 값.
  - **섹션 4(전역 설계 원칙)**: "의존 방향 단방향 `api → domain → infra → common`" → 슬라이스 계층 + 커널 방향으로 갱신. ArchUnit 서술.
  - **섹션 5(도메인 코드 컨벤션)**: Entity/Repository/Service/Controller/DTO의 물리 위치 전제(계층 패키지) → feature 트리 전제로. 네이밍 규칙 자체는 대부분 유지.
  - **섹션 7(코드 스타일)**: 경로 의존 낮음. 스타일 정본 경로는 불변, 필요 시 문구만.
- **개정 필요 docs**:
  - `docs/backend/references/spring-skeleton-prompts.md`: layer-first 스켈레톤 구축 기록. **재작성하지 않고**(과거 실행 기록·"참고 자료") 상단에 "구조는 v0.x 개정으로 feature-first로 대체됨(이 문서는 스켈레톤 당시 기록)" 주석 1줄만 추가.
  - `docs/spec/*-spec.md` 중 패키지 경로를 인용한 절(email-verify-spec 등) — 경로 언급이 있으면 갱신.
  - `docs/board/HANDOVER*` 및 에이전트 정의(architect/reviewer)가 계층 경로를 참조하면 갱신.
  - `api-contract.md`는 HTTP 계약이라 **영향 없음**(패키지 구조와 무관).

---

## 7. 진행 중 작업(EPIC-EMAIL-VERIFY) 영향

- 현황: FC-117(Flyway V17 email 컬럼)·FC-118(User 엔티티 email 필드)이 `todo`, **코드 0줄**. 이메일 에픽은 `member`(User) 확장 + 신규 이메일 인증 로직으로, **member/auth feature를 직접 건드린다.**
- **권고: 레이아웃 확정을 이메일 구현 앞에 둔다.** 근거 — (1) 코드가 0줄인 지금이 이동 최소 시점. (2) 구 레이아웃으로 이메일을 쓰면 곧바로 다시 옮겨야 하는 **이중 작업**. (3) FC-118은 `domain/member/User.java`를 수정하는데, 이 파일은 어차피 이동 대상이라 순서를 뒤집으면 충돌 소지.
- **두 갈래 처리**:
  - **(권장) 재구성 먼저**: 이메일 에픽을 잠시 hold → 재구성 PR 착수 → 완료 후 이메일을 **새 레이아웃에서** 구현. FC-117/118 DoD는 경로만 갱신(예: `domain/member/User.java` → `member/User.java`, 신규 이메일 코드는 `member/`(또는 신규 `email` feature) 트리에 배치). 기능·계약·spec 내용은 불변.
  - **(차선) 이메일 먼저·목표 레이아웃 선반영**: 재구성을 당장 못 하면, 이메일 신규 파일만이라도 **목표 feature 트리에 미리 배치**(임시 규약)해 이중 이동을 줄인다. 단 기존 파일과 규약이 갈려 혼란 소지 → 권장 아님.
- **DoD 변화 요약**: 이메일 티켓의 **내용(무엇을)은 불변**, **파일 경로(어디에)만** 목표 레이아웃 기준으로 갱신. contract_ref·근거인용 유지.

---

## 8. 리스크 · 롤백

- **대규모 이동 위험 & 완화**:
  - *머지 충돌*: 재구성 PR을 다른 기능 작업과 겹치지 않게 **단독·단기간**에 처리. 이메일 에픽 hold가 이 격리를 보장(§7).
  - *리뷰 부담*: 이동은 "package·import만 바뀌고 로직 불변"인 **기계적 diff**임을 리뷰어에게 명시. feature별 원자 커밋(§5 Phase 2)으로 리뷰 단위를 잘게 쪼갬.
  - *ArchUnit 공백기*: 신·구 규칙 **병존 전략**(Phase 0 추가 / Phase 3 삭제)으로 이동 내내 강제 유지 → 공백 없음.
  - *동작 회귀*: 로직 무변경이므로 기존 테스트 스위트(75개)가 회귀 감지 그물. 각 feature 이전 후 `:backend:test` 초록 필수.
- **롤백**: feature 단위 원자 커밋이라 문제 feature만 `git revert`로 되돌림. Phase 3(구 규칙 삭제) 전까지는 언제든 중단해도 빌드가 유지된다(신·구 병존). 최악의 경우 전체 재구성 브랜치를 버리고 master로 복귀(코드 로직은 손대지 않았으므로 손실 0).

---

## 부록 — 결정에 필요한 사용자 확인 항목

1. 방향: A(유지) / **B(feature-first, 권고)** / C(하이브리드) 중 택1.
2. B 채택 시: 횡단 인프라 패키지명을 `infra` 유지 vs `global`로 변경할지.
3. feature 내부를 평면 배치 vs `controller/service/...` 하위패키지(파일 많은 feature만 선택적)로 할지.
4. 타이밍: 이메일 에픽 hold 후 재구성 먼저(권장) vs 이메일 먼저.

---

# v0.2 — 확정 규약 (FC-119, consultant)

아래 §9~§11은 **DECIDED** 규약이다. FC-120(ArchUnit·커널)·FC-121(feature 이전)·FC-122(구 규칙 제거)의 정본 스펙이다.

## 9. 도메인별 목표 레이아웃 정밀표

### 9.1 신 패키지 규약 (전 feature 공통)

- 업무 도메인 feature는 `com.finalcall.domain` 그룹 아래로 묶는다. 패키지 = `com.finalcall.domain.<feature>.<layer>`(구 `api.`/`domain.` 최상위 계층 분할은 폐기, 대신 feature 위에 `domain.` 한 겹). 커널(`common`·`infra`)은 이 `domain` 그룹 밖 제자리(§9.6).
- **내부 하위패키지(계층)**: `controller` · `dto` · `service` · `repository` · `entity`.
  - **빈 하위패키지 금지**: 해당 유형 파일이 1개 이상일 때만 만든다. 파일이 적은 feature는 자연히 하위패키지 수가 줄어든다(예: `sample`은 controller/dto/service만).
  - `*ErrorCode`·`*Properties`(@ConfigurationProperties)·도메인 예외는 **feature 루트**에 둔다(계층 하위패키지 아님, feature당 소수·다계층 참조).
- 파일 수가 큰 feature(`item`·`settlement`·`shop`·`auction`)는 5하위패키지 전부 채택 권장. 작은 feature는 위 "빈 패키지 금지" 규칙에 따라 자동으로 선택적 채택된다.

### 9.2 파일유형 → 하위패키지 분류표 (FC-121 이전 시 정본)

| 파일 유형(패턴) | 신 하위패키지 |
|---|---|
| `*Controller` | `controller` |
| 표현 DTO — API `*Request`/`*Response`/`*View`(응답 뷰), `*CursorResponse` | `dto` |
| `*Service`·`*Writer`·`*Worker`·`*Indexer`·`*Reindexer`·`*Calculator`·`*Recorder`·`*Seeder`, + 도메인 VO/커맨드/결과(`*Command`·`*Result`·`*Context`·`*Snapshot`·`*Slice`·`*Cursor`(도메인측)·`*SearchCondition`·`*Decision`·`*Data`·도메인측 `*View`) | `service` |
| `*Repository`·`*RepositoryCustom`·`*RepositoryImpl` | `repository` |
| `@Entity`/`@Embeddable` + 귀속 enum(`*Status`·`*Type`·`*ResultType`·`*Role`·`*Direction`·`ItemLocation`·`TransferType`) | `entity` |
| `*ErrorCode`·`*Properties`·도메인 예외(`*Exception`) | **feature 루트** |

- 경계 애매한 VO의 최종 배치는 FC-121이 판단하되, **하위패키지명(위 5종)과 "빈 패키지 금지"는 불변**이다.

### 9.3 컨텍스트별 이전표 (구 → 신)

| 컨텍스트 | 구 위치 | 신 위치(feature root) | 채택 하위패키지 | 특기 |
|---|---|---|---|---|
| `sample` | `api/sample`(3) + `domain/sample`(4) | `com.finalcall.domain.sample` | controller·dto·service | repository/entity 없음(데모) |
| `notice` | `api/notice`(6) + `domain/notice`(8) | `com.finalcall.domain.notice` | 5종 전부 | 참조 구현. `NoticeType` enum→entity |
| `member` | `api/member`(5) + `domain/member`(6) | `com.finalcall.domain.member` | controller·dto·service·repository·entity | 엔티티는 `User`·`UserBalance`(도메인명 member, 엔티티명 User 유지) |
| `currency` | `api/currency`(3) + `domain/currency`(11) + `infra/config/ExchangeProperties`(1) | `com.finalcall.domain.currency` | controller·dto·service·repository·entity + 루트(`ExchangeProperties`·`*ErrorCode`) | **`ExchangeProperties`는 feature 전용 config → currency 루트로 이동**(횡단 아님). §9.4 참조 |
| `item` | `api/item`(11) + `domain/item`(27) | `com.finalcall.domain.item` | 5종 전부(강권장) | 최대 규모(38). template·instance·tempstorage 3집합, 하위패키지화로 정리 |
| `auction` | `api/auction`(8) + `domain/auction`(20) | `com.finalcall.domain.auction` | 5종 전부 | VO 다수(`Auction*Context`·`*Result`)→service |
| `bid` | `api/bid`(5) + `domain/bid`(12) | `com.finalcall.domain.bid` | 5종 전부 | `BidIncrementProperties`→루트 |
| `search` | `domain/search`(12) | `com.finalcall.domain.search` | service·entity + 루트(`*Properties`·`*ErrorCode`) | **controller/dto 없음**(타 feature 컨트롤러가 노출). `ListingDocument`→entity |
| `settlement` | `domain/settlement`(23) + `api/order`(5) + `api/purchase`(2) | `com.finalcall.domain.settlement` | 5종 전부(강권장) | **3트리 통합**: order·purchase 컨트롤러/DTO를 `settlement/controller`·`settlement/dto`로. `Fee*`·`ClosingWorkerProperties`→루트 |
| `shop` | `api/shop`(12) + `domain/shop`(23) | `com.finalcall.domain.shop` | 5종 전부(강권장) | `MeShopController`+`ShopController`→controller. `Shop*Properties`→루트 |
| `auth` | `api/auth`(8) + `domain/auth`(3) | `com.finalcall.domain.auth` | controller·dto·service + 루트(`AuthErrorCode`) | **feature part만 이동**. 보안 필터·토큰은 §9.5대로 infra/common 잔류 |

### 9.4 feature 전용 config(@ConfigurationProperties) 처리

- 대부분의 feature 전용 `*Properties`는 이미 도메인과 동거한다(`BidIncrementProperties`·`FeePolicyProperties`·`ClosingWorkerProperties`·`Shop*Properties`·`ListingSearch*Properties`·`SearchReconciliationProperties`는 구 `domain/<f>`에 있음 → 신 `<f>` 루트로 자연 이동).
- **예외 = `ExchangeProperties`**: 현재 `infra/config`에 있으나 currency 전용이다 → `com.finalcall.domain.currency` 루트로 이동한다(횡단 아님). FC-121 currency 이전 단계에 포함.
- **횡단 config는 infra 잔류**: `CacheConfig`·`JpaConfig`·`LoggingConfig`·`RedissonConfig`·`AppProperties`·`JwtProperties`·`GatewayInternalProperties`는 특정 feature 소유가 아니므로 `infra/config` 제자리.

### 9.5 auth 분해 — 무엇이 feature이고 무엇이 횡단인가

한 "auth" 관심사가 4곳에 걸쳐 있다. **비즈니스 로직만 feature로, 요청 파이프라인·커널은 잔류**한다.

- **auth feature로 이동**(`com.finalcall.domain.auth.*`): `AuthController`→controller · `LoginRequest`/`LogoutRequest`/`RefreshRequest`/`SignupRequest`/`LoginResponse`/`RefreshResponse`/`SignupResponse`→dto · `AuthService`·`TokenBundle`→service · `AuthErrorCode`→루트.
- **infra/security 잔류(횡단, 이동 안 함)**: `JwtAuthenticationFilter`·`JwtAuthenticationEntryPoint`·`JwtAccessDeniedHandler`·`HmacTokenProvider`·`SecurityAuditorAware`·`GatewayAccessFilter`·`GatewayErrorCode`·`RefreshTokenStore`. 이유 = 이들은 모든 요청에 걸리는 보안 파이프라인·인프라이지 auth 도메인 로직이 아니다(D-065: 서비스 내 JWT 자체검증).
- **common/security 잔류(커널)**: `TokenClaims`·`TokenProvider`(토큰 추상화 인터페이스·VO).
- 판단 기준: "특정 도메인의 유스케이스인가"(→feature) vs "요청 처리 공통 관심사·프레임워크 어댑터인가"(→infra/common).

### 9.6 feature가 아닌 것 — support·커널

- **`api/support`(`LocalDemoDataService`·`LocalDemoSeeder`, 2)**: 여러 feature(user·item·auction·shop)에 걸쳐 데모 데이터를 시딩하는 dev 유틸이다. 한 feature에 넣으면 슬라이스 비순환(§10-b)을 깬다 → **`com.finalcall.support` 독립 패키지**(feature 아님·`domain` 그룹 밖)로 둔다. v0.3에서 슬라이스 규칙 (b)가 `com.finalcall.domain.(*)..`로 좁혀지므로 support는 슬라이스 대상에서 자연히 제외된다(별도 예외 불필요, §9.6.1·§10-b). local 프로파일 전용이므로 프로덕션 경로 영향 없음.
- **커널 제자리(`domain` 그룹 밖)**: `com.finalcall.common`(exception·response·logging·util·security·lock, 17) · `com.finalcall.infra`(config·redis·security, 19) · `domain/common`(`BaseEntity`·`BaseTimeEntity`·`BaseCreatedEntity`, 3). **`domain/common` BaseEntity 3종의 최종 위치는 `com.finalcall.common.entity`로 확정**(§9.6.1). 어느 feature도 소유하지 않는 공용 커널이므로 `domain` 그룹 밖 `common` 산하가 정합적이다(`com.finalcall.domain.common` 유지는 v0.3에서 부적합 — `domain` 그룹 아래에 두면 "common"이라는 feature처럼 보여 슬라이스 (b)에 오매칭될 소지).

### 9.6.1 FC-120 커널·support 배치 확정 (DECIDED, 2026-07-25)

FC-120은 규칙 위주 티켓이라 **이번 단계에서 .java를 이동하지 않는다**(실제 파일 이전은 FC-121). 아래는 최종 목표 배치의 확정이며, 이동 시점만 FC-121로 넘긴다.

- **`common` → 제자리** `com.finalcall.common`. 신규 규칙 (c) `common_커널_격리`가 관장(common 밖 어떤 `com.finalcall`도 의존 금지).
- **`infra` → 제자리** `com.finalcall.infra`. 신규 규칙 (c) `infra_커널_격리`가 관장(infra·common 외 의존 금지). §9.4의 횡단 config 잔류 원칙 유지.
- **`domain/common` BaseEntity 3종 → 최종 목표 `com.finalcall.common.entity`**(커널 흡수로 확정). 이유: v0.3에서 업무 feature는 `com.finalcall.domain.<feature>` 그룹 아래로 묶이므로, 커널인 BaseEntity를 `com.finalcall.domain.common`에 두면 "common"이라는 feature처럼 보여 슬라이스 (b)(`com.finalcall.domain.(*)..`)에 오매칭된다. 어느 feature도 소유하지 않는 공용 커널이므로 `domain` 그룹 밖 `common` 산하가 정합적이고, 이 위치면 규칙 (c) `common_커널_격리`에 자동 포섭된다(§10-c). **실제 이동은 FC-121**(BaseEntity를 상속하는 전 엔티티의 import 갱신 동반이라 대량 이전과 함께 처리). Phase 0~1 동안은 구 위치(`com.finalcall.domain.common`)에 두고 구 규칙이 관장한다.
- **`support` → `com.finalcall.support` 독립 패키지**(feature 아님·`domain` 그룹 밖, FC-121 이동). **슬라이스 비순환 규칙 (b) 예외 처리는 불필요**로 확정: v0.3에서 (b)가 `com.finalcall.domain.(*)..`로 좁혀지므로 `com.finalcall.support`(domain 그룹 밖)는 애초에 슬라이스 대상이 아니다. 설령 매칭됐더라도 support는 여러 feature(user·item·auction·shop)의 서비스를 의존하는 leaf일 뿐이고 어떤 feature도 support를 역참조하지 않아 순환을 만들지 않는다(§10-b가 잡는 것은 상호 순환뿐). 규칙 (a)도 무영향 — `com.finalcall.support`는 `..controller..`/`..service..` 등 계층 세그먼트와 겹치지 않아 미매칭이다. 따라서 `ignoreDependency`/`namingSlices` 예외를 두지 않는다. (현행 `api/support` 위치도 규칙 (a)에 미매칭이라 Phase 0에서 무영향.)

## 10. 신규 ArchUnit 규칙 스펙 (FC-120 구현)

FC-120은 아래 3규칙을 **신설**하고, 기존 `LayerDependencyTest`의 구 최상위-레이어 규칙과 **병존**시킨다(구 규칙 삭제는 FC-122). 병존 요건: 신·구 규칙 모두 빈 레이어/빈 결과를 허용(`withOptionalLayers(true)`·`allowEmptyShould(true)`)해야 이전 진행 중(일부만 이동된 상태)에도 항상 초록이다.

### (a) 슬라이스 내부 계층방향 — 이름 기반

`..controller..`는 `..service..`·`..dto..`만, `..service..`는 `..repository..`·`..entity..`·`..dto..`만 의존. entity/repository는 controller/service 역참조 금지. 전 feature에 한 벌로 적용(패턴이 모든 feature를 동시 매칭).

- **v0.3 영향 = 불변**: 계층 레이어를 `com.finalcall..controller..` 등 `..`(임의 세그먼트) 와일드카드로 정의하므로, feature가 `com.finalcall.domain.<feature>.controller.*`로 한 겹 깊어져도 그대로 매칭된다. 코드 수정 불필요.

```java
@ArchTest
static final ArchRule 슬라이스_내부_계층방향 = Architectures.layeredArchitecture()
    .consideringOnlyDependenciesInLayers()
    .withOptionalLayers(true)                       // 이전 중 빈 레이어 허용(병존)
    .layer("Controller").definedBy("com.finalcall..controller..")
    .layer("Dto").definedBy("com.finalcall..dto..")
    .layer("Service").definedBy("com.finalcall..service..")
    .layer("Repository").definedBy("com.finalcall..repository..")
    .layer("Entity").definedBy("com.finalcall..entity..")
    .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
    .whereLayer("Dto").mayOnlyBeAccessedByLayers("Controller", "Service")
    .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller")
    .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service")
    .whereLayer("Entity").mayOnlyBeAccessedByLayers("Controller", "Dto", "Service", "Repository");
```

- 역참조 금지는 자동 포함된다: Repository가 Controller를 참조하면 "Controller가 Repository에 의해 접근됨"이 되어 `Controller.mayNotBeAccessedByAnyLayer()` 위반으로 잡힌다.
- 이 규칙은 feature 간(예: `member.controller`→`item.service`)을 **막지 않는다**(둘 다 전역 Controller/Service 레이어). feature 간 경계는 (b) 비순환이 담당한다.
- `..controller..` 등 패턴은 `common`/`infra`의 어떤 패키지와도 겹치지 않으므로 커널에 무영향.

### (b) 슬라이스 비순환

```java
@ArchTest
static final ArchRule 슬라이스_비순환 = slices()
    .matching("com.finalcall.domain.(*)..")
    .should().beFreeOfCycles();
```

- **v0.3 변경 = 매칭 패턴을 `com.finalcall.(*)..` → `com.finalcall.domain.(*)..`로 좁힌다**. domain 그룹 도입으로 feature가 `com.finalcall.domain.<feature>` 아래로 묶였으므로, `(*)`가 잡아야 할 슬라이스 키는 `com.finalcall` 다음 세그먼트가 아니라 **`com.finalcall.domain` 다음 세그먼트(=feature명)**다. 이 패턴이면 `com.finalcall.domain.<feature>`가 곧 feature 슬라이스가 되어 **feature 간 순환**을 자동으로 잡는다(구 `com.finalcall.(*)..`를 그대로 두면 `domain`이라는 단일 슬라이스로 뭉뚱그려져 feature 간 순환을 못 잡는다).
- 커널(`common`·`infra`)·`support`는 `domain` 그룹 밖이라 이 패턴에 애초에 매칭되지 않는다 → `namingSlices`/`ignoreDependency` 예외 불필요(§9.6.1).

### (c) 커널 방향 — common·infra는 어떤 feature도 의존 안 함

feature 목록을 열거하지 않고 "커널은 커널 밖 `com.finalcall`을 의존하지 않는다"로 표현한다(신규 feature가 늘어도 규칙 불변).

```java
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAnyPackage;

@ArchTest
static final ArchRule common_커널_격리 = noClasses()
    .that().resideInAPackage("com.finalcall.common..")
    .should().dependOnClassesThat(
        resideInAPackage("com.finalcall..")
            .and(resideInAPackage("com.finalcall.common..").negate()))
    .allowEmptyShould(true);

@ArchTest
static final ArchRule infra_커널_격리 = noClasses()
    .that().resideInAPackage("com.finalcall.infra..")
    .should().dependOnClassesThat(
        resideInAPackage("com.finalcall..")
            .and(resideInAnyPackage("com.finalcall.infra..", "com.finalcall.common..").negate()))
    .allowEmptyShould(true);
```

- `common`은 `com.finalcall` 중 common 외 어떤 것도 의존 금지(infra·전 feature 차단). `infra`는 infra·common 외 차단(전 feature 차단, common 의존은 허용). 이는 구 규칙 1·2(common·infra가 상위계층 미의존)의 feature-first 재표현이며, feature명을 하드코딩하지 않는다.
- **v0.3 영향 = 불변**: 커널 `common`·`infra`는 `domain` 그룹 밖 제자리이므로 `com.finalcall.common..`·`com.finalcall.infra..` 패턴이 그대로 유효하다. feature가 `com.finalcall.domain.<feature>`로 묶여도 여전히 "커널 밖 `com.finalcall`"(= `com.finalcall.common..` 부정)에 포섭돼 차단된다. 코드 수정 불필요.
- `domain/common`(BaseEntity 3종)의 최종 위치가 `com.finalcall.common.*`이면 이 규칙에 자동 포섭된다(§9.6).

### (d) 구 규칙 병존·제거 (참고)

- **Phase 0(FC-120)**: (a)(c)를 신설, (b)는 기존 재사용. 구 `레이어_의존_방향_규율`·`common_은_상위계층을_의존하지_않는다`·`infra_는_상위계층을_의존하지_않는다`·`domain_은_api를_의존하지_않는다`는 **그대로 둔다**. 아직 파일이 `api/`·`domain/`에 있으므로 구 규칙이 유효하고, 이동된 파일은 신 규칙이 강제 → 공백 없음.
- **Phase 3(FC-122)**: 전 feature 이전 완료 후 구 4규칙 삭제. `api`/`domain` 레이어 정의가 빈 상태가 되므로 신 규칙만 남긴다.

## 11. 이전 순서 재확인 (§5 Phase 2)

의존 적은 leaf부터 한 번에 하나씩, 각 feature = 원자 커밋 1개, 매 이전 후 `./gradlew :backend:test` 초록 + `:backend:spotlessApply`.

```
sample → notice → member → currency → item → auction → bid → search → settlement(order/purchase 통합) → shop
```

- **auth**: 위 10단계에 없다. auth의 feature part(§9.5)는 소규모이고 `member`·토큰 인프라에 의존하므로 **`member` 직후(순서상 currency 앞)에 삽입**하거나 member와 같은 커밋 묶음으로 처리한다(FC-121 판단). 보안 필터는 이동하지 않으므로 auth 이전은 저위험이다.
- **support**: feature 이전과 무관(§9.6). 슬라이스 예외 처리(FC-120)만 하면 이전 대상 아님.
- 각 단계 상세 절차·import 일괄치환·롤백은 §5·§8 그대로.
