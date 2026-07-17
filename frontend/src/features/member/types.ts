/**
 * member feature 타입 (계약 §2.5). 계약 스키마와 1:1 — 임의 필드 금지.
 * 중앙 types/api.ts 는 편집하지 않는다(per-feature 타입 — spec §4.1).
 */

/** GET·PATCH /me 응답 (조회·수정 동일 스키마) */
export interface MeResponse {
  userPublicId: string;
  nickname: string;
  isAdmin: boolean;
  createdAt: string;
}

/** PATCH /me 요청 — 수정 가능 필드는 nickname 뿐 */
export interface UpdateNicknameRequest {
  nickname: string;
}

/** DELETE /me 요청 — 잔액 소멸 명시 동의(D-080). 잔액 0이어도 필수 */
export interface WithdrawRequest {
  balanceForfeitAcknowledged: true;
}
