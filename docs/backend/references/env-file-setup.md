# IntelliJ EnvFile 로 `.env` 환경변수 주입 (백엔드 로컬 실행)

로컬에서 환경변수를 `.env` 한 파일로 관리하고 IntelliJ 실행 구성에 주입하는 방법이다.
빌드 의존성·코드 변경은 없다 — Spring 이 이미 `${ENV:기본값}` 로 env 를 읽고, EnvFile 플러그인이
`.env` 를 실행 시점의 OS 환경변수로 넣어줄 뿐이다. (배경·설계 근거: FC-141 검토 문서, FC-142)

## 1. EnvFile 플러그인 설치
- IntelliJ IDEA > Settings > Plugins > Marketplace 에서 **"EnvFile"** 검색 후 설치 → IDE 재시작.

## 2. `.env` 준비
```
cp backend/.env.example backend/.env
```
- `.env` 는 `.gitignore` 로 커밋이 차단된다(시크릿 포함). `.env.example`(더미 카탈로그)만 추적된다.
- 위치: 백엔드 env 는 `backend/.env`(프론트 `frontend/.env` 와 대칭). Spring 은 `.env` 를 직접 읽지 않고 EnvFile 이 주입하므로 위치는 규약이다.
- 로컬은 모든 키에 yml 기본값이 있어, 아무 값도 안 채워도 앱은 그대로 뜬다.
  실제로 값을 바꿔야 할 때만 `.env` 에서 해당 줄을 수정한다.

## 3. 실행 구성에 `.env` 연결
1. Run/Debug Configurations > (백엔드 Spring Boot 실행 구성) 선택.
2. **EnvFile** 탭 > **Enable EnvFile** 체크 > `+` 로 `backend/.env` 추가.
3. **Active profiles = `local`** 로 둔다(미지정 시에도 `spring.profiles.default: local` 로 동작).
4. 실행.

## 4. 이메일 실발송(선택)
로컬 기본은 발송 스킵(코드만 로그 출력)이라 크리덴셜 없이 인증 흐름을 테스트할 수 있다.
실제 SMTP 발송이 필요할 때만 `.env` 에 아래 3종을 채운다.
```
MAIL_SENDER_ENABLED=true
MAIL_USERNAME=<네이버 계정>
MAIL_PASSWORD=<네이버 앱 비밀번호>   # 2단계 인증 사용 시 앱 비밀번호 발급
```
- ★ 이 값들은 시크릿이다. 절대 커밋하지 않는다(`.env` 는 gitignore 됨).

## 5. 주의
- **dev/prod 는 다르다**: `DB_*`·`REDIS_*`·`JWT_SECRET`·`GATEWAY_INTERNAL_SECRET`·`APP_NAME`·
  `APP_DESCRIPTION`·`MAIL_USERNAME`·`MAIL_PASSWORD` 는 기본값이 없어(fail-fast) 값 누락 시 부팅이
  실패한다. 운영은 `.env` 파일이 아니라 컨테이너/오케스트레이터의 OS 환경변수로 주입한다.
- **목록/중첩 정책 테이블은 env 대상이 아니다**: `bid.increment.tiers`·`fee.policy.tiers`·
  `resilience4j.*` 는 env 로 표현하기 부적합해 `application.yml` 에서 관리한다(변경도 거기서).
- 전체 키 카탈로그와 그룹별 설명은 `backend/.env.example` 을 참조한다.
