// engine.js -- tiny helpers, object pools, spatial hash. No deps.
'use strict';

const E = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const choice = arr => arr[(Math.random() * arr.length) | 0];
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  const ang = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

  // deterministic hash noise for background decoration
  function hashNoise(ix, iy) {
    let h = (ix * 374761393 + iy * 668265263) | 0;
    h = (h ^ (h >> 13)) | 0;
    h = Math.imul(h, 1274126177);
    h = (h ^ (h >> 16)) >>> 0;
    return h / 4294967295;
  }

  // generic freelist pool: keeps dead objects for reuse, arrays managed by caller
  class Pool {
    constructor(make) { this.make = make; this.free = []; }
    get() { return this.free.length ? this.free.pop() : this.make(); }
    put(o) { this.free.push(o); }
  }

  // spatial hash for enemies. cell = 96px. wraparound keys are fine: callers
  // always distance-test, so collisions only cost a check, never miss one.
  class Grid {
    constructor(cell = 96) {
      this.cell = cell;
      this.map = new Map();
      this._spareArrs = [];
      this._queryBuf = [];
    }
    _key(ix, iy) { return ((ix & 2047) << 11) | (iy & 2047); }
    clear() {
      for (const arr of this.map.values()) { arr.length = 0; this._spareArrs.push(arr); }
      this.map.clear();
    }
    insert(o) {
      const k = this._key((o.x / this.cell) | 0, (o.y / this.cell) | 0);
      let arr = this.map.get(k);
      if (!arr) { arr = this._spareArrs.pop() || []; this.map.set(k, arr); }
      arr.push(o);
    }
    // returns shared buffer of candidates within r (broadphase only!)
    query(x, y, r) {
      const buf = this._queryBuf; buf.length = 0;
      const c = this.cell;
      const x0 = ((x - r) / c) | 0, x1 = ((x + r) / c) | 0;
      const y0 = ((y - r) / c) | 0, y1 = ((y + r) / c) | 0;
      for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
        const arr = this.map.get(this._key(ix, iy));
        if (arr) for (let i = 0; i < arr.length; i++) buf.push(arr[i]);
      }
      return buf;
    }
  }

  // persistent storage: localStorage first, cookies as write-through backup.
  // covers setups where localStorage is blocked/ephemeral but cookies survive.
  const store = {
    set(k, v) {
      v = String(v);
      try { localStorage.setItem(k, v); } catch (e) { /* blocked */ }
      try {
        document.cookie = k + '=' + encodeURIComponent(v) + ';max-age=31536000;path=/;SameSite=Lax';
      } catch (e) { /* file:// may refuse cookies; localStorage carried it */ }
    },
    get(k) {
      try {
        const v = localStorage.getItem(k);
        if (v !== null) return v;
      } catch (e) { /* fall through to cookie */ }
      try {
        const m = document.cookie.match('(?:^|;\\s*)' + k + '=([^;]*)');
        if (m) return decodeURIComponent(m[1]);
      } catch (e) { /* nothing */ }
      return null;
    },
  };

  return { TAU, clamp, lerp, rand, randi, choice, dist2, ang, hashNoise, Pool, Grid, store };
})();
