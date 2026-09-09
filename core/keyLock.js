// © flux0n. All rights reserved.
// Tiny in-process mutex to make "read list -> modify -> write list" sequences
// atomic per key. Without this, two commands (or a command racing a cron job)
// that both read the same DB key before either writes back will silently
// lose one of the updates (classic lost-update race condition).

const chains = new Map();

/**
 * Runs `fn` exclusively with respect to any other call using the same `key`.
 * Calls for the same key are queued and run one after another; calls for
 * different keys run concurrently as normal.
 */
function withKeyLock(key, fn) {
  const prev = chains.get(key) || Promise.resolve();
  const run = prev.then(fn, fn);
  // Keep the chain alive regardless of success/failure of this call, and
  // clear it once nothing is pending so the map doesn't grow forever.
  const cleanup = run.then(
    () => {},
    () => {}
  ).then(() => {
    if (chains.get(key) === next) chains.delete(key);
  });
  const next = run.then(
    (v) => v,
    (e) => { throw e; }
  );
  chains.set(key, cleanup);
  return next;
}

module.exports = { withKeyLock };
