# FC-331 / KAN-375 리뷰

## 판정

**PASSED — Done 가능.** Critical 0건, Major 0건, Minor 1건이다.

## Minor

### 1. 통제 부하 환경 밖의 BaseUrl을 지정해 X-Forwarded-For를 주입하는 오용을 스크립트가 자체 차단하지 않는다

- 위치: `scripts/chat/prepare-chat-load-fixtures.ps1:5,32-56,66-70,82-86`
- 재현/오용 시나리오: 작업자가 `-BaseUrl`에 localhost가 아닌 공유 dev 또는 운영 gateway 주소를 실수로 지정하면 최대 20,000개 계정을 만들면서 사설 대역의 사용자별 `X-Forwarded-For`를 전송한다. 대상 gateway가 직접 노출돼 있고 `trusted-proxy-count=1`로 잘못 운영된다면 client가 제공한 단일 XFF가 rate-limit key로 신뢰되어 IP 제한 측정 또는 방어를 우회할 수 있다.
- 기대: 이 스크립트는 문서화된 통제 부하 topology에서만 실행하고, 운영 대상 실행은 별도 명시적 opt-in 또는 외부 실행 절차로 금지한다. 실제 운영 gateway는 신뢰 프록시 hop과 직접 접근 차단을 일치시켜 client 주입 XFF를 신뢰하지 않아야 한다.
- 실제: 스크립트는 임의 BaseUrl을 허용하며 환경 안전장치가 없다. 다만 현재 승인된 topology는 직접 gateway에 `trusted-proxy-count=1`을 적용해 의도적으로 단일 XFF를 측정 입력으로 쓰는 통제 환경이고, 이 위험은 그 전제 안에서는 발현하지 않으므로 비차단 Minor로 판정한다.

## 보안·QA 확인

- `New-RequestHeaders`는 호출마다 새 hashtable을 만들고 공통 `$headers`의 값을 복사한다. room 요청의 Authorization이 공통 객체나 다음 signup/login 요청으로 역류하지 않는다.
- `X-Gateway-Token`은 기존 공통 헤더에서 모든 요청별 헤더로 복사되어 유지된다. Authorization은 room 생성 요청에만 해당 사용자의 bearer token으로 추가된다.
- signup과 login은 같은 사용자의 통제 IP를 공유하고, room 생성도 생성 주체의 같은 IP를 사용한다.
- `ConvertTo-ClientIp`는 현재 허용 상한 20,000에서 `10.0.0.1`부터 중복 없는 RFC1918 주소를 생성한다. 외부 실제 사용자 IP를 사칭하거나 제3자 트래픽으로 오인할 주소를 만들지 않는다.
- 현재 topology의 `trusted-proxy-count=1` resolver는 단일 XFF 목록의 우측 한 항목을 선택하므로 생성된 사용자별 IP가 rate-limit key가 된다. 모든 요청이 동일 peer IP로 묶이던 기존 측정 왜곡을 제거한다.
- 헤더 값이나 토큰을 로그에 출력하지 않는다. fixture에는 기존 설계대로 access token과 client IP가 기록되지만 GatewayToken과 Password는 기록하지 않는다.
- 출력 파일은 기존 파일을 덮어쓰지 않으며, 이번 변경에서 시크릿 출력·헤더 공유·인가 주체 변경·무관 리팩터는 발견하지 못했다.

## 부록 C 적용 결과

- Retry/부수효과: 스크립트 자체 자동 retry가 없어 signup/room 중복 부수효과를 새로 만들지 않는다.
- JWT: 사용자별 login 응답 token을 해당 사용자의 room 생성에만 사용한다.
- IDOR: counterpart는 nickname으로 지정하지만 room 생성 주체는 Authorization token으로 결정되며 헤더 조립이 이를 바꾸지 않는다.
- 분산락·트랜잭션·금전 CAS는 본 변경 범위에 해당하지 않는다.
