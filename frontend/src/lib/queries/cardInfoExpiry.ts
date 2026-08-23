import { useEffect, useRef } from 'react'
import { hashKey, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

const MAX_TIMEOUT_MS = 2_147_483_647

export function earliestCardInfoValidUntil(data: unknown): number | null {
    let earliest: number | null = null
    const visited = new Set<object>()

    const visit = (value: unknown) => {
        if (value === null || typeof value !== 'object') return
        if (visited.has(value)) return
        visited.add(value)

        if (value instanceof Map) {
            value.forEach(visit)
            return
        }
        if (Array.isArray(value)) {
            value.forEach(visit)
            return
        }

        const record = value as Record<string, unknown>
        const validUntil = record.validUntil
        if (
            'calculatedAt' in record &&
            'frame' in record &&
            typeof validUntil === 'string'
        ) {
            const timestamp = Date.parse(validUntil)
            if (Number.isFinite(timestamp)) {
                earliest =
                    earliest === null
                        ? timestamp
                        : Math.min(earliest, timestamp)
            }
        }
        Object.values(record).forEach(visit)
    }

    visit(data)
    return earliest
}

export function useCardInfoExpiry(
    queryKey: QueryKey,
    data: unknown,
    exact = true,
): void {
    const queryClient = useQueryClient()
    const queryKeyRef = useRef(queryKey)
    queryKeyRef.current = queryKey
    const queryHash = hashKey(queryKey)
    const validUntil = earliestCardInfoValidUntil(data)
    const handled = useRef(new Set<string>())

    useEffect(() => {
        if (validUntil === null) return
        const boundary = `${queryHash}:${validUntil}`
        if (handled.current.has(boundary)) return
        let timer = 0
        let cancelled = false
        const schedule = () => {
            const delay = Math.min(
                Math.max(0, validUntil - Date.now()),
                MAX_TIMEOUT_MS,
            )
            timer = window.setTimeout(() => {
                if (cancelled) return
                if (Date.now() < validUntil) {
                    schedule()
                    return
                }
                handled.current.add(boundary)
                void queryClient.invalidateQueries({
                    queryKey: queryKeyRef.current,
                    exact,
                    refetchType: 'active',
                })
            }, delay)
        }
        schedule()

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [exact, queryClient, queryHash, validUntil])
}
