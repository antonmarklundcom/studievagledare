/**
 * mysql2 auto-parses JSON columns to objects on real MySQL, but MariaDB
 * (used for local dev — it stores JSON as TEXT under the hood) returns the
 * raw string instead. Every read of a `json()` column in this codebase must
 * go through this — found the hard way (see interviews.ts / recommendations.ts
 * history) by actually running the app, not by typechecking: a string that
 * looks like an array/object passes TypeScript fine but breaks at runtime
 * the moment code calls an array/object method on it.
 */
export function parseJsonColumn<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}
