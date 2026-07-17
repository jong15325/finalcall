import { apiClient } from '@/lib/api/client';
import type { BalanceResponse } from '../types';

/** GET /me/balance — 내 잔액 4필드 (계약 §4.4). 향후 charges/exchanges 확장 자리. */
export function getBalance(): Promise<BalanceResponse> {
  return apiClient.get<BalanceResponse>('/me/balance');
}
