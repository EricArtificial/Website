/* TreeStorage: client-side state manager for the seedling
   - Persists state in localStorage under key 'tree_state_v1'
   - State shape: {
       wateredCount: number,
       lastWatered: 'YYYY-MM-DD' | null,
       harvestCount: number,
       readyForHarvest: boolean
     }
   - water(): attempts to water today; enforces once-per-day; returns { allowed, waterCount, readyForHarvest }
   - completeHarvest(): marks harvest done, increments harvestCount and resets wateredCount
   - reset(): clears state
*/
(function(){
  const KEY = 'tree_state_v1';
  const HARVEST_THRESHOLD = 10;

  function todayStr(){
    return new Date().toISOString().slice(0,10);
  }

  function read(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return { wateredCount: 0, lastWatered: null, harvestCount: 0, readyForHarvest: false };
      const obj = JSON.parse(raw);
      return {
        wateredCount: obj.wateredCount || 0,
        lastWatered: obj.lastWatered || null,
        harvestCount: obj.harvestCount || 0,
        readyForHarvest: !!obj.readyForHarvest
      };
    }catch(e){
      return { wateredCount: 0, lastWatered: null, harvestCount: 0, readyForHarvest: false };
    }
  }

  function write(state){
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function reset(){
    const st = { wateredCount: 0, lastWatered: null, harvestCount: 0, readyForHarvest: false };
    write(st);
    return st;
  }

  function canWaterToday(){
    const st = read();
    // disallow watering if already watered today or if waiting for harvest
    return st.lastWatered !== todayStr() && !st.readyForHarvest;
  }

  function water(){
    // legacy synchronous local version (keeps UI working if no server)
    const st = read();
    const today = todayStr();
    if(st.readyForHarvest){
      return { allowed: false, reason: 'need_harvest', waterCount: st.wateredCount };
    }
    if(st.lastWatered === today){
      return { allowed: false, reason: 'already_today', waterCount: st.wateredCount };
    }
    // increment
    const nextCount = (st.wateredCount || 0) + 1;
    const next = {
      wateredCount: nextCount,
      lastWatered: today,
      harvestCount: st.harvestCount || 0,
      readyForHarvest: false
    };
    // if reached threshold -> mark readyForHarvest but do not reset automatically
    if(nextCount >= HARVEST_THRESHOLD){
      next.wateredCount = HARVEST_THRESHOLD;
      next.readyForHarvest = true;
      write(next);
      return { allowed: true, waterCount: HARVEST_THRESHOLD, readyForHarvest: true };
    }
    write(next);
    return { allowed: true, waterCount: nextCount, readyForHarvest: false };
  }

  // Async server-backed water. Tries server first, falls back to local water().
  async function waterAsync(){
    try{
      const res = await fetch('/api/water', { method: 'POST', credentials: 'same-origin' });
      if(!res.ok) throw new Error('server');
      const data = await res.json();
      // mirror server state locally (best-effort)
      const current = read();
      const next = {
        wateredCount: data.waterCount || current.wateredCount || 0,
        lastWatered: (data.allowed && !data.readyForHarvest) ? todayStr() : current.lastWatered,
        harvestCount: current.harvestCount || 0,
        readyForHarvest: !!data.readyForHarvest
      };
      write(next);
      return { allowed: !!data.allowed, waterCount: data.waterCount || next.wateredCount, readyForHarvest: !!data.readyForHarvest };
    }catch(e){
      return water();
    }
  }


  function completeHarvest(){
    // legacy synchronous complete (local-only)
    const st = read();
    if(!st.readyForHarvest) return { ok: false, message: 'not_ready', harvestCount: st.harvestCount };
    const next = { wateredCount: 0, lastWatered: null, harvestCount: (st.harvestCount || 0) + 1, readyForHarvest: false };
    write(next);
    return { ok: true, harvestCount: next.harvestCount };
  }

  // Async server-backed harvest. Accepts admin password string (pw) and tries server call first.
  async function completeHarvestAsync(pw){
    try{
      const res = await fetch('/api/harvest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pw': pw || ''
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if(!res.ok) {
        // server returned error (likely 403)
        return { ok: false, message: data && data.error ? data.error : (data && data.message) || 'server' };
      }
      if(data.ok){
        // mirror server state locally
        const now = { wateredCount: 0, lastWatered: null, harvestCount: data.harvestCount || 0, readyForHarvest: false };
        write(now);
        return { ok: true, harvestCount: data.harvestCount };
      }
      return { ok: false, message: data.message || 'not_ready', harvestCount: data.harvestCount };
    }catch(e){
      // fallback to local
      if(pw === window.ADMIN_PW){
        return completeHarvest();
      }
      return { ok: false, message: 'network' };
    }
  }

  // Try to sync state from server and persist locally. Returns true if server responded.
  async function syncWithServer(){
    try{
      const res = await fetch('/api/tree', { method: 'GET', credentials: 'same-origin' });
      if(!res.ok) throw new Error('no');
      const data = await res.json();
      const st = {
        wateredCount: data.wateredCount || 0,
        lastWatered: data.lastWatered || null,
        harvestCount: data.harvestCount || 0,
        readyForHarvest: !!data.readyForHarvest
      };
      write(st);
      return true;
    }catch(e){
      return false;
    }
  }

  // expose API
  window.TreeStorage = {
    getState: read,
    reset,
    canWaterToday,
    water,
    completeHarvest,
    // async server-aware methods
    waterAsync,
    completeHarvestAsync,
    syncWithServer
  };
})();
