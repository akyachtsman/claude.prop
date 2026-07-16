// cloud.js — Supabase read/write ops for the `properties` table, shaped for the
// store's cloud backend (js/store.js setSession). The full property object lives
// in the `data` jsonb column; `user_id` defaults to auth.uid() server-side, so the
// client never sends it and RLS scopes every row to the signed-in user.

import { supabase } from './supabase.js';

const TABLE = 'properties';

// A row is { id, name, data }. `data` is the whole property object we already
// export — lossless round-trip: the property IS row.data.
function toRow(property) {
  return { id: property.id, name: property.name || null, data: property };
}
function fromRow(row) {
  // Prefer the embedded object; fall back to a minimal shape if a row predates it.
  return row && row.data ? row.data : { id: row.id, name: row.name };
}

// Normalize a Supabase error so the store can tell an expired session (auth/401)
// from a transient network blip. supabase-js surfaces `status` and PostgREST
// `code`; JWT problems come back 401 / code PGRST301.
function asCloudError(error) {
  const e = new Error(error.message || 'Cloud request failed');
  e.status = error.status;
  e.code = error.code;
  e.isAuth = error.status === 401 || error.code === 'PGRST301' ||
    /jwt|token|not authenticated|auth session/i.test(error.message || '');
  return e;
}

export const cloudOps = {
  async fetchAll() {
    const { data, error } = await supabase.from(TABLE).select('id, name, data');
    if (error) throw asCloudError(error);
    return (data || []).map(fromRow);
  },
  async upsert(property) {
    const { error } = await supabase.from(TABLE).upsert(toRow(property), { onConflict: 'user_id,id' });
    if (error) throw asCloudError(error);
  },
  async remove(id) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw asCloudError(error);
  },
};
