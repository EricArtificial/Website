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
  const KEY = '971314';
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

  function completeHarvest(){
    const st = read();
    // only complete if ready
    if(!st.readyForHarvest) return { ok: false, message: 'not_ready', harvestCount: st.harvestCount };
    const next = { wateredCount: 0, lastWatered: null, harvestCount: (st.harvestCount || 0) + 1, readyForHarvest: false };
    write(next);
    return { ok: true, harvestCount: next.harvestCount };
  }

  // expose API
  window.TreeStorage = {
    getState: read,
    reset,
    canWaterToday,
    water,
    completeHarvest
  };
})();
