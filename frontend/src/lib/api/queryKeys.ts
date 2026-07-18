/**
 * 쿼리 키 규약 헬퍼 (프론트 CLAUDE.md [4]): `[도메인, 리소스, 파라미터]`.
 * 도메인별 구체 키는 각 feature 의 api/ 훅에서 이 헬퍼로 만든다(스켈레톤은 규약만 제공 —
 * 도메인 지식을 스켈레톤에 넣지 않는다, skeleton-plan [1]).
 */
export function queryKey(domain: string, resource: string, params?: Record<string, unknown>) {
  return params !== undefined
    ? ([domain, resource, params] as const)
    : ([domain, resource] as const);
}

export type QueryKey = ReturnType<typeof queryKey>;
