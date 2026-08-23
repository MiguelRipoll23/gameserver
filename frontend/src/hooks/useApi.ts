import { useQuery, useMutation, type UseQueryOptions } from '@tanstack/react-query'
import { networkError, toRunResult, type RunResult } from '../api/client'
import { useConfig } from '../lib/config'

/** The shape returned by every openapi-fetch method call. */
export type FetchOutcome = Promise<{ data?: unknown; error?: unknown; response: Response }>

/** A normalized API call backed by react-query; `key` drives the query key. */
export function useApiGet(
  key: unknown[],
  request: () => FetchOutcome,
  enabled = true,
  options?: Omit<UseQueryOptions<RunResult, Error, RunResult, unknown[]>, 'queryKey' | 'queryFn'>,
) {
  const { configKey } = useConfig()
  return useQuery({
    queryKey: ['api', ...key, configKey] as unknown[],
    queryFn: async () => {
      const start = performance.now()
      try {
        const { data, error, response } = await request()
        return toRunResult(start, data, error, response)
      } catch (err) {
        return networkError(start, err)
      }
    },
    enabled,
    retry: false,
    ...options,
  })
}

export function useApiMutation<TInput>(
  key: unknown[],
  request: (input: TInput) => FetchOutcome,
) {
  const { configKey } = useConfig()
  return useMutation({
    mutationKey: ['api-mut', ...key, configKey] as unknown[],
    mutationFn: async (input: TInput) => {
      const start = performance.now()
      try {
        const { data, error, response } = await request(input)
        return toRunResult(start, data, error, response)
      } catch (err) {
        return networkError(start, err)
      }
    },
  })
}

/** Extracts a readable error message from a failed run result. */
export function errorText(result: RunResult | null | undefined): string {
  if (!result) return ''
  if (result.status === 0) return result.bodyText
  if (result.isJson && result.body && typeof result.body === 'object') {
    const b = result.body as Record<string, unknown>
    if (typeof b.message === 'string') return b.message
    if (typeof b.code === 'string') return b.code
  }
  if (result.bodyText) return result.bodyText.slice(0, 300)
  return result.statusText
}
