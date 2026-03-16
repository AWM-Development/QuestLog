/** Return the first element of a query result array. */
export function first<T>(rows: T[]): T {
	return rows[0] as T;
}
