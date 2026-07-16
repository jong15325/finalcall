# features/

도메인별 응집 계층 (프론트 CLAUDE.md [3] feature 기반 구조). 스켈레톤 단계에서는 **비워 둔다** —
도메인 지식을 스켈레톤에 넣지 않는다(skeleton-plan [1]). 각 도메인은 자기 단계에서 아래 구조로 채운다.

```
features/<도메인>/
├── api/          # 계약 엔드포인트 1:1 함수 + TanStack Query 훅 (lib/api/client 사용)
├── components/   # 도메인 전용 컴포넌트
└── hooks/        # 도메인 전용 훅
```

## 도메인 9종 (screen-spec [1], 계약 리소스 축)

| 도메인 | 주요 라우트 | 계약 절 |
|---|---|---|
| auth | `/login` · `/signup` | [2] |
| member | `/me/profile` | [2.5] |
| auction | `/auctions` · `/auctions/:auctionPublicId` | [3.1] |
| bid | (경매 상세 중첩) | [3.1] |
| shop | `/shops` · `/shops/:shopPublicId` | [3.2] |
| item | `/items/:itemInstancePublicId` · `/market-prices` | [4.1] |
| inventory | `/me/inventory` · `/me/temp-storage` | [4.2] |
| order | `/me/orders` · `/me/orders/:orderPublicId` | [4.3] |
| wallet | `/me/wallet` · `/me/wallet/charge/confirm` | [4.4] |
| admin | `/admin/auctions/:auctionPublicId` | [4.5] |

주: screen-spec [1] 은 feature 를 9개(auth·auction·bid·shop·item·inventory·order·wallet·admin)로 열거하고
member(마이페이지)를 auth 계열과 함께 둔다. 위 표는 계약 [2.5] 회원 리소스를 member 로 분리 표기했다 —
라우트·엔드포인트 매핑 편의이며, feature 폴더 구성(auth 하위 vs 별도)은 auth/member 착수 시 확정한다.
