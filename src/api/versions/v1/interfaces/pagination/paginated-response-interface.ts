/**
 * Generic paginated response interface with configurable cursor type.
 * @template T - The type of data items in the response
 * @template TCursor - The type of the cursor (defaults to number for compatibility)
 */
export interface PaginatedResponse<T, TCursor = number> {
  data: T[];
  /**
   * Optional cursor for pagination. Can be a number, string (encoded token),
   * or bigint for large datasets to avoid precision issues with PostgreSQL BIGINT.
   */
  nextCursor?: TCursor;
}
