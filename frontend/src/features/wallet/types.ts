/**
 * wallet feature 타입 (계약 §4.4). 계약 스키마와 1:1.
 * gameMoneyAvailable = gameMoneyBalance − gameMoneyHeld (백엔드 파생, 표시만).
 */
export interface BalanceResponse {
  cashBalance: number;
  gameMoneyBalance: number;
  gameMoneyHeld: number;
  gameMoneyAvailable: number;
}
