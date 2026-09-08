// Minimal in-memory stand-in for the handful of Supabase query-builder
// patterns our API routes actually use. Not a general Supabase mock —
// just enough surface area to smoke-test our route logic without a real
// database.

function makeFilterChain(rowsGetter, filters, opts) {
  const { onEmptyUpdate } = opts || {};

  function matches() {
    return rowsGetter().filter((row) => filters.every((f) => f(row)));
  }

  const chain = {
    eq(col, val) {
      return makeFilterChain(rowsGetter, [...filters, (row) => row[col] === val], opts);
    },
    maybeSingle() {
      const rows = matches();
      return Promise.resolve({ data: rows[0] || null, error: null });
    },
    single() {
      const rows = matches();
      return Promise.resolve({
        data: rows[0] || null,
        error: rows[0] ? null : { message: 'not found' },
      });
    },
    then(resolve, reject) {
      try {
        const rows = matches();
        if (onEmptyUpdate) onEmptyUpdate(rows);
        resolve({ data: rows, error: null });
      } catch (e) {
        reject(e);
      }
    },
  };
  return chain;
}

function makeFakeDb() {
  const museums = new Map();
  const artworks = new Map();
  let counter = 1;
  const nextId = (prefix) => `${prefix}-${counter++}`;

  function museumsTable() {
    return {
      insert(obj) {
        return {
          select() {
            return {
              single() {
                const id = nextId('museum');
                const row = {
                  id,
                  edit_token: `tok-${id}`,
                  created_at: new Date().toISOString(),
                  title: 'Museum of Us',
                  settings: {},
                  ...obj,
                };
                museums.set(id, row);
                return Promise.resolve({ data: row, error: null });
              },
            };
          },
        };
      },
      select() {
        return makeFilterChain(() => [...museums.values()], []);
      },
      update(fields) {
        return makeFilterChain(() => [...museums.values()], [], {
          onEmptyUpdate: (rows) => rows.forEach((r) => Object.assign(r, fields)),
        });
      },
      delete() {
        return {
          eq(col, val) {
            for (const [id, row] of museums) {
              if (row[col] === val) museums.delete(id);
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };
  }

  function artworksTable() {
    return {
      insert(rowsOrRow) {
        const rows = Array.isArray(rowsOrRow) ? rowsOrRow : [rowsOrRow];
        rows.forEach((r) => {
          const id = nextId('artwork');
          artworks.set(id, { id, ...r });
        });
        return Promise.resolve({ data: null, error: null });
      },
      select() {
        return makeFilterChain(() => [...artworks.values()], []);
      },
      update(fields) {
        return makeFilterChain(() => [...artworks.values()], [], {
          onEmptyUpdate: (rows) => rows.forEach((r) => Object.assign(r, fields)),
        });
      },
    };
  }

  function from(table) {
    if (table === 'museums') return museumsTable();
    if (table === 'artworks') return artworksTable();
    throw new Error(`fakeDb: unknown table ${table}`);
  }

  const storageFiles = new Map();
  const storage = {
    from(bucket) {
      return {
        upload(path, buffer, opts) {
          storageFiles.set(`${bucket}/${path}`, { buffer, opts });
          return Promise.resolve({ data: { path }, error: null });
        },
        getPublicUrl(path) {
          return { data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/${bucket}/${path}` } };
        },
      };
    },
  };

  return { from, storage, _debug: { museums, artworks, storageFiles } };
}

module.exports = { makeFakeDb };
