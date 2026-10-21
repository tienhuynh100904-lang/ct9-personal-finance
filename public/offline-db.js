/*
 * "Ghi offline": the on-device store, shared by the service worker (importScripts in public/sw.js)
 * and the offline page (public/offline.html). Plain script, no build step, so both can load it and
 * the service worker can keep a copy for when there is no network. See docs/ghi-offline.md.
 *
 * IndexedDB "ct9-offline":
 *   queue  (key: id)  entries saved offline, waiting to be sent
 *                     { id, user_id, kind, item_id, item_name, category, amount, occurred_on, note,
 *                       created_at, status: 'pending' | 'failed' | 'other_account', error? }
 *   meta   (key: name) 'snapshot' = { userId, items: [{ id, kind, name, category }], savedAt }
 *                      'sync'     = { needsLogin, lastTriedAt }
 */
;(function (scope) {
  var DB_NAME = 'ct9-offline'
  var DB_VERSION = 1
  var dbPromise = null

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = function () {
          var db = request.result
          if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' })
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
        }
        request.onsuccess = function () {
          var db = request.result
          // Another tab upgrading the schema: let it, and reopen next time.
          db.onversionchange = function () {
            db.close()
            dbPromise = null
          }
          resolve(db)
        }
        request.onerror = function () {
          dbPromise = null
          reject(request.error)
        }
      })
    }
    return dbPromise
  }

  /** Runs `work(store)` in one transaction and resolves with what the last request returned. */
  function run(storeName, mode, work) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode)
        var request = work(tx.objectStore(storeName))
        tx.oncomplete = function () {
          resolve(request ? request.result : undefined)
        }
        tx.onerror = function () {
          reject(tx.error)
        }
        tx.onabort = function () {
          reject(tx.error)
        }
      })
    })
  }

  scope.CT9Offline = {
    getMeta: function (name) {
      return run('meta', 'readonly', function (store) {
        return store.get(name)
      })
    },
    setMeta: function (name, value) {
      return run('meta', 'readwrite', function (store) {
        return store.put(value, name)
      })
    },
    deleteMeta: function (name) {
      return run('meta', 'readwrite', function (store) {
        return store.delete(name)
      })
    },
    /** Every queued entry, oldest first. */
    listQueue: function () {
      return run('queue', 'readonly', function (store) {
        return store.getAll()
      }).then(function (entries) {
        return (entries || []).sort(function (a, b) {
          return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
        })
      })
    },
    /** Adds or replaces an entry (same id = same entry). */
    putEntry: function (entry) {
      return run('queue', 'readwrite', function (store) {
        return store.put(entry)
      })
    },
    removeEntry: function (id) {
      return run('queue', 'readwrite', function (store) {
        return store.delete(id)
      })
    },
  }
})(self)
