import { vi } from 'vitest';

/**
 * `fetch` 스텁(FC-051).
 *
 * 스모크 테스트는 **네트워크를 타지 않는다.** MSW 같은 서버 목을 들이지 않고 `fetch` 를 직접 대체한다 —
 * 검증 대상이 "envelope 를 받은 화면이 렌더되는가"이지 HTTP 계층이 아니기 때문이다(계층을 얇게 유지).
 * 실제 요청 조립(URL·헤더·401 회전)은 `lib/api/client.ts` 가 그대로 수행하므로 계약 경로 오타는 잡힌다.
 *
 * 매칭은 **경로 부분일치**다. 등록되지 않은 경로 요청은 명시적으로 실패시킨다 — 조용한 undefined 로
 * 흘러가면 "왜 빈 화면인지" 알 수 없다.
 */
export interface StubRoute {
  /** 요청 URL에 포함돼야 하는 조각(예: `/auctions/`). 먼저 등록된 것이 우선한다. */
  match: string;
  /** 성공 envelope 의 `data` 로 실릴 값. */
  data: unknown;
}

/** 계약 §1.4 성공 envelope. */
function successEnvelope(data: unknown): string {
  return JSON.stringify({ success: true, data, timestamp: new Date().toISOString() });
}

export function stubApi(routes: StubRoute[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const route = routes.find((candidate) => url.includes(candidate.match));
      if (!route) {
        return Promise.reject(new Error(`스텁되지 않은 요청: ${url}`));
      }
      return Promise.resolve(
        new Response(successEnvelope(route.data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
}
