# FC-175 확인 리뷰 — 세션 전환 수정 minor 하드닝

- **대상**: FC-175(FC-174 리뷰 minor M1·M2 하드닝)
- **리뷰어**: reviewer(읽기 전용)
- **일자**: 2026-08-03
- **판정**: **PASS** (critical 0 / major 0 / minor 1) → `review_status: passed`

## 초점별 근거
1. **M2 refresh 세대 가드 동치·정확성** — PASS. `isStaleRefresh` = `refreshEpoch !== startedEpoch || getRefreshToken() !== startedRefreshToken`(세대 OR 라인리지).
   - 성공 경로(`if(isStaleRefresh) return`): FC-174 라인리지 단독 조건의 **상위집합** → epoch 변경 케이스 추가 폐기, 신원 안전 **강화**. `applyRotatedTokens` 실행 조건 = "epoch AND 라인리지 모두 동일" = 정당한 회전. stale rotate가 새 세션 토큰을 덮는 경로 없음.
   - 실패 경로(`if(!isStaleRefresh) resetSession()`): de Morgan = `(epoch 동일) AND (라인리지 동일)`일 때만 리셋 → FC-174(`=== startedRefreshToken`)보다 **더 좁게** 리셋해 새 세션을 잘못 죽이지 않음.
   - T2(라인리지 변경)·T2b(epoch만 증가, 라인리지 동일) 둘 다 stale rotate 폐기 실검증. T2b는 라인리지 단독 가드로 못 잡는 경로를 검증(가드 제거 시 실패).
2. **M1 순수 배선** — PASS. `MePage`가 `resetSessionState()`(store clear + invalidateRefresh, 캐시 미터치) + 컨텍스트 `queryClient.clear()` → 캐시 clear 정확히 1회. 프로덕션 컨텍스트==싱글턴 동일 인스턴스라 기존 `resetSession()`과 동일 효과, 이중/누락 없음. AuthProvider 배선과 일치.
3. **테스트 실질성** — PASS. MePage.test는 MePage가 직접 조회 안 하는 키(memos/orders/inventory) 프라임 → 재조회 오탐 없이 축출 검증(싱글턴 썼다면 실패). 직접 실행 26/26 pass, tsc·eslint 클린.
4. **과설계·컨벤션** — PASS. epoch+라인리지 이중 가드=관심사 분리(세션 리셋 vs 계정 전환), `isStaleRefresh` 추출=양 경로 중복 제거. 전 변경 라인 DoD 추적.

## minor (비차단)
- **M1(범위 밖 파일)**: 워킹트리에 `docs/board/tickets/FC-174.md` done 전이 기록이 동봉 — 코드 아닌 보드 기록(FC-174 done, 커밋 a37a84d 반영). 커밋 스테이징 시 atomic 경계는 메인세션 판단.

## 검증 실행
- `npx vitest run src/lib/api/client.test.ts src/auth/AuthProvider.test.tsx src/pages/MePage.test.tsx` → 26/26 pass.
- 전체 666 pass, 3 fail=`oauth.test.ts`(env 의존, 무관).

## 변경 파일
`frontend/src/lib/api/client.ts`·`client.test.ts`, `frontend/src/pages/MePage.tsx`·`MePage.test.tsx`.
