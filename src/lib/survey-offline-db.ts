/**
 * Panteray — Survey Offline DB
 *
 * IndexedDB-backed write-first store for the survey module.
 * Every mutation is mirrored into a `sync_queue` store so the client can
 * push pending work to `/api/org/surveys/:id/sync` when back online.
 *
 * Contract matches the server-side sync route at
 * `src/app/api/org/surveys/[id]/sync/route.ts`:
 *   items: { table, action: 'upsert' | 'delete', data }[]
 */

import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'panteray-surveys'
const DB_VERSION = 1

export type SyncTable =
  | 'surveys'
  | 'survey_floor_plans'
  | 'survey_devices'
  | 'survey_infrastructure'
  | 'survey_photos'

export interface SyncItem {
  table: SyncTable
  action: 'upsert' | 'delete'
  data: Record<string, unknown>
  survey_id: string
  queued_at: number
}

const STORES = [
  'surveys',
  'survey_floor_plans',
  'survey_devices',
  'survey_infrastructure',
  'survey_photos',
  'sync_queue',
] as const

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('survey-offline-db is client-only'))
  }
  if (dbPromise) return dbPromise
  const p = openDB(DB_NAME, DB_VERSION, {
    upgrade(db: IDBPDatabase) {
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          if (name === 'sync_queue') {
            const store = db.createObjectStore(name, {
              keyPath: 'key',
              autoIncrement: true,
            })
            store.createIndex('by_survey', 'survey_id')
          } else {
            db.createObjectStore(name, { keyPath: 'id' })
          }
        }
      }
    },
  })
  dbPromise = p
  return p
}

/** Write-first: persist to IndexedDB and queue an upsert for later sync. */
export async function putLocal(
  table: SyncTable,
  data: Record<string, unknown> & { id: string; survey_id?: string },
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction([table, 'sync_queue'], 'readwrite')
  await tx.objectStore(table).put(data)
  await tx.objectStore('sync_queue').put({
    table,
    action: 'upsert',
    data,
    survey_id: (data.survey_id as string) || (table === 'surveys' ? data.id : ''),
    queued_at: Date.now(),
  })
  await tx.done
}

/** Soft delete: remove local record and queue a delete for later sync. */
export async function deleteLocal(
  table: SyncTable,
  id: string,
  surveyId: string,
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction([table, 'sync_queue'], 'readwrite')
  await tx.objectStore(table).delete(id)
  await tx.objectStore('sync_queue').put({
    table,
    action: 'delete',
    data: { id },
    survey_id: surveyId,
    queued_at: Date.now(),
  })
  await tx.done
}

/** Count of queued mutations across all surveys (for badge). */
export async function getPendingSyncCount(surveyId?: string): Promise<number> {
  try {
    const db = await getDb()
    if (!surveyId) return await db.count('sync_queue')
    const index = db.transaction('sync_queue').store.index('by_survey')
    return await index.count(surveyId)
  } catch {
    return 0
  }
}

/**
 * Push every queued mutation for a given survey to the server.
 * Clears the queue entries on success. No retry loop — caller re-invokes
 * on reconnect or via manual "Sync now" button.
 */
export async function processSyncQueue(surveyId: string): Promise<{
  synced: number
  failed: number
}> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0 }
  }
  const db = await getDb()
  const index = db.transaction('sync_queue').store.index('by_survey')
  const queued: Array<{ key: IDBValidKey; value: SyncItem & { key?: number } }> = []
  let cursor = await index.openCursor(surveyId)
  while (cursor) {
    queued.push({ key: cursor.primaryKey, value: cursor.value as SyncItem & { key?: number } })
    cursor = await cursor.continue()
  }
  if (queued.length === 0) return { synced: 0, failed: 0 }

  const items = queued.map((q) => ({
    table: q.value.table,
    action: q.value.action,
    data: q.value.data,
  }))

  try {
    const res = await fetch(`/api/org/surveys/${surveyId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (!res.ok) return { synced: 0, failed: queued.length }
    const result = (await res.json()) as { synced: number; failed: number; errors?: { index: number }[] }

    // Clear successful entries (if server reports any failures, keep those by index)
    const failedIndexes = new Set((result.errors || []).map((e) => e.index))
    const tx = db.transaction('sync_queue', 'readwrite')
    for (let i = 0; i < queued.length; i++) {
      if (!failedIndexes.has(i)) {
        await tx.store.delete(queued[i].key)
      }
    }
    await tx.done
    return { synced: result.synced || 0, failed: result.failed || 0 }
  } catch {
    return { synced: 0, failed: queued.length }
  }
}

/** Read cached survey (offline fallback when fetch fails). */
export async function getLocalSurvey(id: string): Promise<Record<string, unknown> | undefined> {
  try {
    const db = await getDb()
    return (await db.get('surveys', id)) as Record<string, unknown> | undefined
  } catch {
    return undefined
  }
}
