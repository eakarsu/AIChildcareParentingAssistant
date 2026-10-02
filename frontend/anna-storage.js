/**
 * Anna App storage client.
 *
 * Wraps the host `storage.*` RPC with the key scheme used across the app.
 * Every record lives at `<prefix><id>`, so `storage.list({prefix})` pages a
 * whole record type and the client sorts by the type's date column — replacing
 * the SQL `ORDER BY <dateCol> DESC LIMIT 25` from the standalone backend.
 */
import { HANDOFF_PREFIXES, sortRecords } from './anna-records';

let anna = null;

export function setRuntime(runtime) {
  anna = runtime;
}

export function getRuntime() {
  return anna;
}

/** Read every value under a prefix. Returns [] when the bucket is empty. */
export async function readAll(prefix, limit = 1000) {
  if (!anna) return [];
  try {
    const listed = await anna.storage.list({ prefix, limit });
    const items = listed?.items ?? [];
    const values = await Promise.all(
      items.map(async (row) => {
        const got = await anna.storage.get({ key: row.key });
        if (!got?.exists) return null;
        return { ...got.value, __key: row.key, __etag: got.etag };
      }),
    );
    return values.filter((v) => v !== null && v !== undefined);
  } catch {
    return [];
  }
}

/** Read one record by full key. */
export async function readOne(key) {
  if (!anna) return null;
  const got = await anna.storage.get({ key });
  if (!got?.exists) return null;
  return { ...got.value, __key: key, __etag: got.etag };
}

/** Write a record. Uses if_match when we hold an etag (optimistic concurrency). */
export async function writeOne(key, value, etag = null) {
  if (!anna) throw new Error('Anna runtime is not connected.');
  const args = { key, value };
  if (etag) args.if_match = etag;
  return anna.storage.set(args);
}

/** Remove a record. APS raises not_found on a missing key; callers tolerate it. */
export async function removeOne(key) {
  if (!anna) throw new Error('Anna runtime is not connected.');
  try {
    return await anna.storage.delete({ key });
  } catch (e) {
    if (String(e?.code) === 'not_found') return { deleted: false };
    throw e;
  }
}

/** Next id for a prefix, so keys stay stable and sortable. */
export async function nextId(prefix) {
  const listed = await anna.storage.list({ prefix, limit: 1000 });
  const items = listed?.items ?? [];
  let max = 0;
  for (const row of items) {
    const tail = String(row.key).slice(prefix.length);
    const n = Number(tail);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return String(max + 1);
}

/** Everything the handoff prompt needs, in the shape the old SQL produced. */
export async function gatherForHandoff() {
  const entries = await Promise.all(
    Object.entries(HANDOFF_PREFIXES).map(async ([name, prefix]) => [name, await readAll(prefix)]),
  );
  const out = {};
  for (const [name, rows] of entries) out[name] = rows;
  return out;
}

export { sortRecords };
