// ===== Roxy Games: all of the website's code =====
// One file for every page (the pages themselves are all in index.html).
// The server (netlify/functions/api.mts) also loads this file for the word filter,
// so everything that needs a web page is inside the "if (typeof document ...)" part.

// ==================== Word filter ====================
// ----- Username filter: bad words, slurs and "Roxy Games Sucks" -----
// Catches tricks like "FuUuCk", "f_u_c_k", "sh1t" and "B1gAss".
// To block more words, add them (lowercase, letters only) to one of the lists.
const BadWords = (() => {
  // Blocked anywhere in the name, even squashed into other letters ("xxfuckxx")
  const ANYWHERE = [
    "fuck", "fuk", "fck", "phuck", "shit", "bitch", "biatch", "cunt", "pussy", "whore", "slut",
    "bastard", "asshole", "arsehole", "motherf", "dildo", "penis", "vagina", "porn", "jizz",
    "wank", "twat", "nutsack", "ballsack", "blowjob", "handjob", "boob", "rapist", "molest",
    "pedophile", "nigger", "nigga", "nigg", "niglet", "faggot", "fagot", "faggit", "retard", "tranny",
    "chink", "kike", "kyke", "wetback", "beaner", "towelhead", "raghead", "porchmonkey",
    "junglebunny", "golliwog", "hitler", "nazi", "kkk", "heilhitler", "siegheil",
  ];

  // Only blocked as a whole word, because they hide inside normal words
  // (class, grape, raccoon, spice, cocktail, Scunthorpe...)
  const WHOLE = [
    "ass", "arse", "dick", "cock", "fag", "fags", "cum", "tit", "tits", "hoe", "hoes", "sex",
    "rape", "prick", "damn", "crap", "spic", "spick", "gook", "coon", "dyke", "paki", "wop",
    "negro", "cracker", "gringo", "jap", "homo", "lesbo", "skank", "thot", "pedo",
  ];

  // Numbers and symbols people swap in for letters
  const LOOKALIKES = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", 9: "g", "@": "a", $: "s", "!": "i", "|": "i", "+": "t" };

  // "fuck" becomes /f+u+c+k+/ so stretched letters ("fuuuuck") still match
  const stretch = (word) => word.split("").map((c) => c + "+").join("");
  const anywhere = new RegExp(ANYWHERE.map(stretch).join("|"));
  const whole = new RegExp(`^(${WHOLE.map(stretch).join("|")})s*$`);

  function variants(text) {
    const plain = text.normalize("NFKD").replace(/[̀-ͯ]/g, ""); // é -> e
    const swapped = plain.replace(/[0-9@$!|+]/g, (c) => LOOKALIKES[c] || c);
    return [swapped, swapped.replace(/1|\|/g, "l"), plain.replace(/1/g, "l")]; // 1 can be i or l
  }

  // true when the text should be blocked
  function check(text) {
    return variants(text).some((v) => {
      // split "BigAss_99" into "big" and "ass" for the whole-word list
      const words = v.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z]+/);
      const squashed = v.toLowerCase().replace(/[^a-z]/g, "");
      return anywhere.test(squashed)
        || words.some((w) => whole.test(w))
        || insultsRoxy(squashed);
    });
  }

  // "Roxy Games Sucks" and friends
  function insultsRoxy(squashed) {
    return /roxy(games?)?(is|are|so|really|kinda|just|totally|very)*(suck|sux|suk|stink|trash|worst|garbage)|hates?roxy/.test(squashed);
  }

  // For chat messages: checks each word on its own, so innocent words that run
  // together ("that's hit" -> "thatshit") don't get blocked. "Roxy Games sucks"
  // is still caught across words.
  function checkMessage(text) {
    return text.split(/\s+/).some((w) => w && check(w))
      || variants(text).some((v) => insultsRoxy(v.toLowerCase().replace(/[^a-z]/g, "")));
  }

  return { check, checkMessage };
})();

// Lets the server use the same filter (browsers ignore this)
if (typeof module !== "undefined") module.exports = BadWords;

if (typeof document !== "undefined") {
  // ==================== Sign-in settings ====================
  // true  = visitors must sign in (or make an account) before they can use the site
  // false = signing in is optional (the account button still shows)
  const REQUIRE_LOGIN = true;

  // ==================== Which page is this? ====================
  // Every page is in index.html, inside <template>s. The address (/, /games, /chat,
  // /staff...) picks the page; only its templates are put into the page.
  const PAGES = ["home", "games", "play", "chat", "ai", "login", "account", "banned", "staff"];
  const TITLES = {
    home: "Roxy Games", games: "Games - Roxy Games", play: "Play - Roxy Games", chat: "Chat - Roxy Games", ai: "AI - Roxy Games",
    login: "Sign In - Roxy Games", account: "Account - Roxy Games", banned: "Banned - Roxy Games", staff: "Staff Panel - Roxy Games",
  };
  // "/chat" and the old "/chat.html" both mean the chat page (so does /roxygames-v1beta/chat on GitHub Pages)
  const PAGE = (() => {
    const name = location.pathname.split("/").pop().replace(/\.html$/, "");
    return PAGES.includes(name) ? name : "home";
  })();

  document.querySelectorAll("template[data-page]").forEach((t) => {
    if (t.dataset.page.split(" ").includes(PAGE)) t.replaceWith(t.content);
    else t.remove();
  });
  document.title = TITLES[PAGE];
  if (PAGE === "banned") document.body.classList.add("ban-page");
  document.querySelectorAll(".site-header .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === PAGE));

  // ==================== Game list ====================
  // To add a game, copy a line and fill it in:
  //   id:       short name with no spaces, used in the link (must be unique)
  //   title:    name shown on the card and the game page
  //   category: one of the CATEGORIES below
  //   embed:    the game's web address (an https:// address that can go in an iframe)
  //   thumb:    picture for the card, kept in the thumbs folder ("" to use the plain placeholder)
  // Categories with no games are hidden automatically.

  const CATEGORIES = ["Puzzle", "Arcade", "Action", "Adventure", "Strategy", "Idle", "Sandbox", "Cards"];

  const GAMES = [
    { id: "slope", title: "Slope", category: "Action", embed: "https://storage.y8.com/y8-studio/unity_webgl/Gani/slope_2026_v2/", thumb: "thumbs/slope.webp" },
  ];

  // ==================== Admin Abuse (music, screen effects, sound effects) ====================
  // Music, screen effects and sound effects the Owner turns on for everyone from
  // the Staff Panel. Auth hands it what the server says is playing every time it
  // checks in.
  // All the music and sounds are made right here in the browser (Web Audio), so
  // there are no sound files. The ids match the server (netlify/functions/api.mts) and the Staff Panel.
  const RoxyAbuse = (() => {
    const MUTED = "roxyAbuseMuted";      // this browser turned the sound off
    const SEEN = "roxySeenSounds";       // sound effects already played (so a new page doesn't replay them)
    const SOUND_LATE = 15000;            // ms; older sound effects are skipped
    const LIGHTNING_EVERY = 10000;       // ms between lightning flashes
    const MUSIC_NAMES = { sushi: "Sushi", tacos: "Tacos", pop: "Pop", heavy: "HEAVY", casual: "Casual" };
    const EFFECT_NAMES = { disco: "Disco FX", confetti: "Confetti FX", lightning: "Lightning FX", sushi: "Sushi FX", taco: "Taco FX" };

    function read(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    }
    function write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }

    // ===== Sound =====
    const AC = window.AudioContext || window.webkitAudioContext;
    let ctx = null, master = null;
    let muted = read(MUTED) === true;

    function audio() {
      if (!AC) return null;
      if (!ctx) {
        ctx = new AC();
        // A limiter at the end so stacked sounds never get painfully loud
        const limit = ctx.createDynamicsCompressor();
        limit.threshold.value = -10;
        limit.knee.value = 6;
        limit.ratio.value = 10;
        limit.attack.value = 0.003;
        limit.release.value = 0.2;
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.8;
        master.connect(limit);
        limit.connect(ctx.destination);
        // Browsers only allow sound once the person has clicked or pressed a key
        const unlock = () => { if (ctx.state !== "running") ctx.resume().then(updateChip, () => {}); };
        for (const ev of ["pointerdown", "keydown", "touchstart"]) document.addEventListener(ev, unlock, { passive: true });
        ctx.onstatechange = updateChip;
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return ctx;
    }
    const running = () => !!ctx && ctx.state === "running";
    const freq = (n) => 440 * Math.pow(2, (n - 69) / 12); // note number -> Hz (69 = A4)

    // Optional filters between a sound and its volume control
    function filtered(src, t, time, { lp, lpTo, hp, bp, q = 1 }) {
      let node = src;
      for (const [type, f] of [["lowpass", lp], ["highpass", hp], ["bandpass", bp]]) {
        if (!f) continue;
        const fl = ctx.createBiquadFilter();
        fl.type = type;
        fl.Q.value = q;
        fl.frequency.setValueAtTime(f, t);
        if (type === "lowpass" && lpTo) fl.frequency.exponentialRampToValueAtTime(lpTo, t + time);
        node.connect(fl);
        node = fl;
      }
      return node;
    }

    // A sound that starts sharply and dies away (plucks, drums)
    function hit(out, t, { type = "sine", f, to, glide = 0.1, d = 0.3, peak = 0.3, a = 0.003, detune = 0, ...filters }) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + glide);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
      filtered(o, t, d, filters).connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + a + d + 0.05);
    }

    // A burst of noise (hi-hats, snares, explosions, claps)
    let noiseBuffer = null;
    function hiss(out, t, { d = 0.1, peak = 0.2, a = 0.001, ...filters }) {
      if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer;
      s.loop = true;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
      filtered(s, t, d, filters).connect(g);
      g.connect(out);
      s.start(t, Math.random() * 1.5);
      s.stop(t + a + d + 0.05);
    }

    // A held note (bass, pads, whistles): fades in, holds for `len` seconds, then lets go
    function hold(out, t, len, { type = "sawtooth", f, to, glide = 0.1, peak = 0.15, a = 0.02, r = 0.1, detunes = [0], vibrato = 0, lpTime, ...filters }) {
      const top = t + Math.max(a, len);
      const end = top + r + 0.05;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.setValueAtTime(peak, top);
      g.gain.linearRampToValueAtTime(0, top + r);
      const mix = ctx.createGain();
      mix.gain.value = 1 / Math.sqrt(detunes.length);
      let wobbleBy = null;
      if (vibrato) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        wobbleBy = ctx.createGain();
        wobbleBy.gain.value = vibrato; // cents
        lfo.connect(wobbleBy);
        lfo.start(t);
        lfo.stop(end);
      }
      for (const dt of detunes) {
        const o = ctx.createOscillator();
        o.type = type;
        o.detune.value = dt;
        o.frequency.setValueAtTime(f, t);
        if (to) o.frequency.exponentialRampToValueAtTime(to, t + glide);
        if (wobbleBy) wobbleBy.connect(o.detune);
        o.connect(mix);
        o.start(t);
        o.stop(end);
      }
      filtered(mix, t, lpTime || len, filters).connect(g);
      g.connect(out);
    }

    // Dubstep "wub": a buzzy note with its filter opening and closing `rate` times a second
    function wobble(out, t, len, f, rate) {
      const end = t + len;
      const fl = ctx.createBiquadFilter();
      fl.type = "lowpass";
      fl.Q.value = 9;
      fl.frequency.value = 900;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const depth = ctx.createGain();
      depth.gain.value = 800;
      lfo.connect(depth);
      depth.connect(fl.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.01);
      g.gain.setValueAtTime(0.3, end - 0.04);
      g.gain.linearRampToValueAtTime(0, end);
      for (const [type, mult, dt] of [["sawtooth", 1, -7], ["square", 1, 7], ["sawtooth", 0.5, 0]]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * mult;
        o.detune.value = dt;
        o.connect(fl);
        o.start(t);
        o.stop(end + 0.05);
      }
      fl.connect(g);
      g.connect(out);
      lfo.start(t);
      lfo.stop(end + 0.05);
    }

    // Drums and instruments
    const kick = (out, t, peak = 0.9, low = 45) => hit(out, t, { f: 150, to: low, glide: 0.12, d: 0.4, peak });
    const snare = (out, t, peak = 0.35) => {
      hiss(out, t, { d: 0.16, peak, hp: 1500 });
      hit(out, t, { type: "triangle", f: 200, to: 140, glide: 0.05, d: 0.08, peak: peak * 0.6 });
    };
    const hat = (out, t, peak = 0.08, d = 0.04) => hiss(out, t, { d, peak, hp: 8000 });
    const clap = (out, t, peak = 0.3) => [0, 0.012, 0.024].forEach((o, i) => hiss(out, t + o, { d: i === 2 ? 0.14 : 0.02, peak, bp: 1400, q: 1.5 }));
    const taiko = (out, t, peak = 0.8) => {
      hit(out, t, { f: 120, to: 55, glide: 0.25, d: 0.7, peak });
      hiss(out, t, { d: 0.08, peak: peak * 0.3, lp: 600 });
    };
    const block = (out, t, peak = 0.15) => hit(out, t, { f: 1250, d: 0.05, peak });
    const pluck = (out, t, n, peak = 0.25) => {
      hit(out, t, { type: "triangle", f: freq(n), d: 0.9, peak });
      hit(out, t, { type: "sawtooth", f: freq(n), d: 0.25, peak: peak * 0.35, lp: 4000, lpTo: 500 });
    };
    const keys = (out, t, n, peak = 0.12, d = 1.6) => {
      hit(out, t, { f: freq(n), d, peak, a: 0.005 });
      hit(out, t, { f: freq(n) * 2, d: d * 0.4, peak: peak * 0.3 });
      hit(out, t, { type: "triangle", f: freq(n), d: 0.08, peak: peak * 0.4 });
    };
    const boom = (out, t, peak = 1) => {
      hit(out, t, { f: 110, to: 28, glide: 1.2, d: 1.8, peak });
      hiss(out, t, { d: 1.6, peak: peak * 0.7, lp: 2000, lpTo: 80 });
    };
    const thunder = (out, t) => {
      hiss(out, t, { d: 2.6, peak: 0.5, a: 0.02, lp: 900, lpTo: 120 });
      hit(out, t, { f: 70, to: 30, glide: 1.5, d: 2, peak: 0.6 });
    };

    // How long a melody note lasts: until the next note (up to `max` eighth notes)
    function lenOf(melody, index, eighth, max = 2) {
      let k = 1;
      while (k < max && !melody[(index + k) % melody.length]) k++;
      return k * eighth * 0.9;
    }

    // ===== The 5 songs =====
    // Each one is played a 16th note ("step") at a time: play(step, time, stepLength, { out, drive })
    // Melodies are written in eighth notes, 8 per bar (0 = rest).
    const SUSHI_TUNE = [ // Japanese "in" scale on D
      74, 0, 70, 69, 67, 0, 69, 70, 69, 0, 0, 0, 67, 63, 62, 0, 62, 63, 67, 69, 70, 0, 74, 75, 74, 0, 70, 0, 69, 67, 69, 0,
      79, 0, 75, 74, 70, 0, 74, 0, 75, 74, 70, 69, 67, 0, 0, 0, 62, 0, 67, 0, 69, 70, 69, 67, 63, 0, 62, 0, 0, 0, 0, 0,
    ];
    const TACOS_TUNE = [ // silly, bouncy marimba tune over C Am F G C Am G C
      72, 74, 76, 79, 76, 0, 72, 0, 69, 72, 76, 0, 74, 72, 69, 0, 65, 69, 72, 77, 76, 0, 72, 0, 74, 0, 71, 0, 67, 0, 0, 0,
      79, 0, 79, 76, 79, 0, 84, 0, 81, 79, 76, 72, 76, 0, 0, 0, 74, 76, 77, 74, 71, 74, 79, 0, 84, 0, 79, 0, 72, 0, 0, 0,
    ];
    const POP_TUNE = [ // C G Am F
      76, 0, 76, 79, 0, 76, 74, 72, 74, 0, 74, 79, 0, 74, 72, 71, 72, 0, 72, 76, 0, 72, 71, 69, 69, 0, 72, 0, 74, 0, 72, 0,
    ];
    const CASUAL_TUNE = [{ 2: 72, 6: 69, 11: 76 }, { 2: 71, 6: 67, 10: 74 }, { 3: 69, 6: 72, 10: 77, 14: 76 }, { 2: 71, 8: 67 }];

    const SONGS = {
      sushi: {
        bpm: 96,
        play(s, t, sd, { out }) {
          const bar = Math.floor(s / 16) % 8, i = s % 16;
          if (i % 2 === 0) {
            const n = SUSHI_TUNE[bar * 8 + i / 2];
            if (n) pluck(out, t, n, 0.26);
          }
          if (i % 4 === 0) pluck(out, t, [50, 57, 62, 57][i / 4], 0.12); // low koto
          if (i === 0 || i === 10) taiko(out, t, 0.85);
          if (i === 6) taiko(out, t, 0.4);
          if ((bar === 3 || bar === 7) && i >= 12) taiko(out, t, 0.4 + (i - 12) * 0.12); // drum fill
          if (i === 4 || i === 12) block(out, t);
        },
      },
      tacos: { // it's raining tacos! (an original silly kids-song style tune)
        bpm: 150,
        play(s, t, sd, { out }) {
          const bar = Math.floor(s / 16) % 8, i = s % 16;
          const chord = "CAFGCAGC"[bar];
          const root = { C: 36, A: 33, F: 29, G: 31 }[chord];
          const notes = { C: [60, 64, 67], A: [57, 60, 64], F: [57, 60, 65], G: [55, 59, 62] }[chord];
          // boom-chick drums
          if (i === 0 || i === 8) kick(out, t, 0.8, 55);
          if (i === 4 || i === 12) { clap(out, t, 0.3); snare(out, t, 0.12); }
          if (i % 4 === 2) hat(out, t, 0.07);
          // bouncy bass that jumps up and down an octave
          if (i % 2 === 0) hit(out, t, { type: "square", f: freq(i % 4 === 0 ? root : root + 12), d: sd * 1.6, peak: 0.16, lp: 900, lpTo: 300 });
          // ukulele strums
          if (i === 4 || i === 6 || i === 12 || i === 14) notes.forEach((n, k) => pluck(out, t + k * 0.01, n + 12, i % 8 === 4 ? 0.09 : 0.06));
          // marimba tune
          if (i % 2 === 0) {
            const n = TACOS_TUNE[bar * 8 + i / 2];
            if (n) {
              hit(out, t, { f: freq(n), d: 0.35, peak: 0.3 });
              hit(out, t, { f: freq(n) * 4, d: 0.05, peak: 0.08 });
            }
          }
          // tacos landing: "plop plop plop", then a slide whistle falling from the sky
          if (bar === 3 && (i === 10 || i === 12 || i === 14)) hit(out, t, { f: 300 + (i - 10) * 60, to: 900 + (i - 10) * 120, glide: 0.07, d: 0.1, peak: 0.25 });
          if (bar === 7 && i === 8) hold(out, t, sd * 7, { type: "sine", f: 1800, to: 500, glide: sd * 7, peak: 0.1, a: 0.02, r: 0.05, vibrato: 25 });
        },
      },
      pop: {
        bpm: 116,
        play(s, t, sd, { out }) {
          const bar = Math.floor(s / 16) % 8, i = s % 16, c = bar % 4;
          const chords = [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]];
          if (i === 0 || i === 8 || i === 10) kick(out, t, 0.85);
          if (i === 4 || i === 12) { clap(out, t, 0.28); snare(out, t, 0.15); }
          if (i % 2 === 0) {
            hat(out, t, i % 4 === 2 ? 0.09 : 0.05);
            hit(out, t, { type: "sawtooth", f: freq([36, 43, 45, 41][c]), d: sd * 1.8, peak: 0.22, lp: 700, lpTo: 200 });
          }
          if (i === 0) chords[c].forEach((n) => hold(out, t, sd * 15, { f: freq(n), peak: 0.035, a: 0.08, r: 0.3, lp: 1400, detunes: [-8, 8] }));
          if (i % 4 === 2) chords[c].forEach((n) => hit(out, t, { type: "square", f: freq(n + 12), d: 0.12, peak: 0.03, lp: 3000 }));
          if (i % 2 === 0) {
            const index = c * 8 + i / 2, n = POP_TUNE[index];
            if (n) hold(out, t, lenOf(POP_TUNE, index, sd * 2), { type: "square", f: freq(n), peak: 0.06, a: 0.01, r: 0.08, lp: 2800, detunes: [-5, 5] });
          }
          if (bar >= 4 && i % 2 === 1) hit(out, t, { type: "triangle", f: freq(chords[c][(i >> 1) % 3] + 24), d: 0.15, peak: 0.04 }); // sparkles
        },
      },
      heavy: {
        bpm: 140,
        play(s, t, sd, { out, drive }) {
          const bar = Math.floor(s / 16) % 4, i = s % 16;
          const root = [28, 28, 31, 26][bar];        // E1 E1 G1 D1: as low as it goes
          const beat = 140 / 60;
          const rates = [[2, 4], [4, 2], [2, 6], [8, 3]][bar];
          if (s % 64 === 0) boom(out, t, 0.8);
          if (i === 0 || i === 10) {
            kick(out, t, 1, 38);
            hold(drive, t, sd * (i === 0 ? 9 : 5), { type: "sine", f: freq(root), peak: 0.6, a: 0.005, r: 0.25 }); // 808 sub
          }
          if (i === 0 || i === 8) wobble(drive, t, sd * 8, freq(root + 12), rates[i / 8] * beat);
          if (i === 8) { snare(out, t, 0.45); clap(out, t, 0.3); }
          if (i % 2 === 0) hat(out, t, 0.05);
          if (bar === 3 && i >= 8) hat(out, t, 0.07);
        },
      },
      casual: {
        bpm: 80,
        swing: 0.3,
        play(s, t, sd, { out }) {
          const bar = Math.floor(s / 16) % 4, i = s % 16;
          const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]; // Fmaj7 Em7 Dm7 Cmaj7
          const root = [41, 40, 38, 36][bar];
          if (i === 0) chords[bar].forEach((n, k) => keys(out, t + k * 0.015, n, 0.07, 2.4));
          if (i === 10) chords[bar].slice(1).forEach((n) => keys(out, t, n, 0.04, 0.8));
          if (CASUAL_TUNE[bar][i]) keys(out, t, CASUAL_TUNE[bar][i], 0.06, 1.2);
          if (i === 0) hold(out, t, sd * 6, { type: "triangle", f: freq(root), peak: 0.22, a: 0.01, r: 0.15, lp: 500 });
          if (i === 10) hold(out, t, sd * 4, { type: "triangle", f: freq(root + 7), peak: 0.16, a: 0.01, r: 0.15, lp: 500 });
          if (i === 0 || i === 10) kick(out, t, 0.5, 50);
          if (i === 4 || i === 12) snare(out, t, 0.12);
          if (i % 2 === 0) hat(out, t, 0.03, 0.03);
          if (Math.random() < 0.3) hiss(out, t + Math.random() * sd, { d: 0.004, peak: 0.005 + Math.random() * 0.025, hp: 2000 }); // record crackle
        },
      },
    };

    // Plays the current song a little ahead of time, so it never stutters
    let songId = null, song = null, bus = null, songTimer = 0, nextTime = 0, step = 0;

    function setSong(id) {
      if (id === songId) return;
      stopSong();
      songId = id;
      if (!id || !SONGS[id] || !audio()) return;
      song = SONGS[id];
      const out = ctx.createGain();
      out.gain.value = 0.7;
      out.connect(master);
      // Heavy distortion for the HEAVY bass
      const drive = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let k = 0; k < curve.length; k++) curve[k] = Math.tanh(3 * (k * 2 / curve.length - 1));
      drive.curve = curve;
      const driveOut = ctx.createGain();
      driveOut.gain.value = 0.5;
      drive.connect(driveOut);
      driveOut.connect(out);
      bus = { out, drive };
      step = 0;
      nextTime = ctx.currentTime + 0.1;
      songTimer = setInterval(tick, 25);
      tick();
    }

    function tick() {
      if (!song) return;
      const ahead = document.hidden ? 1.5 : 0.15; // background tabs only get woken up about once a second
      if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05; // fell behind (tab was asleep)
      const sd = 60 / song.bpm / 4;
      while (nextTime < ctx.currentTime + ahead) {
        const t = nextTime + (song.swing && step % 4 === 2 ? sd * song.swing : 0);
        try { song.play(step, t, sd, bus); } catch (e) {}
        nextTime += sd;
        step++;
      }
    }

    function stopSong() {
      clearInterval(songTimer);
      if (bus) {
        const old = bus.out;
        old.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        setTimeout(() => old.disconnect(), 600);
      }
      song = null;
      bus = null;
      songId = null;
    }

    // ===== Sound effects (played once, for everyone) =====
    const SOUNDS = {
      airhorn(out, t) {
        for (const [o, len] of [[0, 0.22], [0.3, 0.22], [0.6, 0.9]]) {
          for (const f of [466, 470, 587, 592]) hold(out, t + o, len, { f, to: f * 0.97, glide: len, peak: 0.06, a: 0.01, r: 0.08, lp: 3500 });
        }
      },
      badumtss(out, t) {
        hit(out, t, { f: 220, to: 140, glide: 0.15, d: 0.25, peak: 0.5 });
        hit(out, t + 0.18, { f: 160, to: 100, glide: 0.15, d: 0.3, peak: 0.5 });
        kick(out, t + 0.42, 0.7);
        snare(out, t + 0.42, 0.2);
        hiss(out, t + 0.42, { d: 1.2, peak: 0.25, hp: 6000 });
      },
      boom: (out, t) => boom(out, t, 1),
      siren(out, t) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(650, t);
        for (let k = 1; k <= 5; k++) o.frequency.linearRampToValueAtTime(k % 2 ? 1300 : 650, t + k * 0.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.05);
        g.gain.setValueAtTime(0.12, t + 2.4);
        g.gain.linearRampToValueAtTime(0, t + 2.6);
        filtered(o, t, 2.6, { lp: 2500 }).connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + 2.7);
      },
      laser(out, t) {
        for (const o of [0, 0.16, 0.32]) hit(out, t + o, { type: "square", f: 2000, to: 150, glide: 0.16, d: 0.18, peak: 0.12, lp: 5000 });
      },
      drumroll(out, t) {
        for (let k = 0; k < 32; k++) snare(out, t + k * 0.05, 0.05 + k * 0.006);
        kick(out, t + 1.65, 0.9);
        hiss(out, t + 1.65, { d: 1.8, peak: 0.35, hp: 4000 });
      },
      applause(out, t) {
        for (let k = 0; k < 70; k++) {
          const o = Math.random() * 2.4;
          const loud = Math.min(1, o / 0.3) * Math.min(1, (2.6 - o) / 0.8);
          hiss(out, t + o, { d: 0.03, peak: 0.45 * loud + 0.02, bp: 1000 + Math.random() * 1500, q: 1.2 });
        }
      },
      wrong(out, t) {
        for (const [o, len] of [[0, 0.28], [0.38, 0.6]]) {
          for (const f of [110, 116]) hold(out, t + o, len, { f, peak: 0.12, a: 0.01, r: 0.05, lp: 1000 });
        }
      },
    };

    const playedSounds = new Set();
    function playSounds(list, serverNow) {
      if (!list.length) return;
      const seen = read(SEEN) || [];
      for (const s of list) {
        if (playedSounds.has(s.id) || seen.includes(s.id)) continue;
        playedSounds.add(s.id);
        seen.push(s.id);
        if ((serverNow || Date.now()) - s.at > SOUND_LATE || !SOUNDS[s.sound]) continue;
        if (audio() && running()) SOUNDS[s.sound](master, ctx.currentTime + 0.02);
      }
      write(SEEN, seen.slice(-40));
    }

    // ===== Screen effects (they stack) =====
    const active = new Set();
    let layer = null;

    function el(tag, className) {
      const e = document.createElement(tag);
      if (className) e.className = className;
      return e;
    }

    function getLayer() {
      if (!layer) {
        layer = el("div", "abuse-layer");
        layer.setAttribute("aria-hidden", "true");
        document.body.appendChild(layer);
      }
      return layer;
    }

    // --- Falling things: confetti, sushi, tacos (all on one canvas) ---
    const FALLING = {
      confetti: { rate: 90 },
      sushi: { rate: 3, emoji: ["🍣", "🍣", "🍙", "🍤", "🍱"] },
      taco: { rate: 3, emoji: ["🌮"] },
    };
    const CONFETTI_COLORS = ["#f43f5e", "#f59e0b", "#facc15", "#22c55e", "#22d3ee", "#3b82f6", "#a855f7", "#ec4899"];
    let canvas = null, pen = null, frameId = 0, lastFrame = 0;
    const particles = [];
    const spawnDue = {};
    const sprites = {};

    // Emoji drawn once onto a little canvas, then copied (much faster than drawing text every frame)
    function sprite(emoji) {
      if (!sprites[emoji]) {
        const c = document.createElement("canvas");
        c.width = c.height = 96;
        const x = c.getContext("2d");
        x.font = '72px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillText(emoji, 48, 54);
        sprites[emoji] = c;
      }
      return sprites[emoji];
    }

    function sizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function startFalling() {
      if (!canvas) {
        canvas = el("canvas", "abuse-canvas");
        pen = canvas.getContext("2d");
        if (!pen) return; // canvas not supported
        getLayer().appendChild(canvas);
        sizeCanvas();
        addEventListener("resize", sizeCanvas);
      }
      if (pen && !frameId) frameId = requestAnimationFrame(frame);
    }

    function newParticle(kind, w) {
      const info = FALLING[kind];
      if (kind === "confetti") {
        return {
          kind, x: Math.random() * w, y: -20, vy: 90 + Math.random() * 120, vx: (Math.random() - 0.5) * 40, sway: 30 + Math.random() * 40,
          phase: Math.random() * 6, spin: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
          w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, size: 12, color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        };
      }
      const size = 30 + Math.random() * 22;
      return {
        kind, x: Math.random() * w, y: -size, vy: 70 + Math.random() * 70, vx: 0, sway: 15 + Math.random() * 20,
        phase: Math.random() * 6, spin: 1 + Math.random(), rot: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 1.2,
        size, emoji: info.emoji[Math.floor(Math.random() * info.emoji.length)],
      };
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000);
      lastFrame = now;
      const w = innerWidth, h = innerHeight;
      const falling = Object.keys(FALLING).filter((k) => active.has(k));
      for (const kind of falling) {
        spawnDue[kind] = (spawnDue[kind] || 0) + FALLING[kind].rate * dt;
        while (spawnDue[kind] >= 1) {
          spawnDue[kind]--;
          if (particles.length < 500) particles.push(newParticle(kind, w));
        }
      }
      pen.clearRect(0, 0, w, h);
      for (let k = particles.length - 1; k >= 0; k--) {
        const p = particles[k];
        p.phase += p.spin * dt;
        p.y += p.vy * dt;
        p.x += (p.vx + Math.cos(p.phase) * p.sway) * dt;
        p.rot += p.vr * dt;
        if (p.y - p.size > h) { particles.splice(k, 1); continue; }
        pen.save();
        pen.translate(p.x, p.y);
        pen.rotate(p.rot);
        if (p.kind === "confetti") {
          pen.scale(1, Math.cos(p.phase * 2)); // flips over as it falls
          pen.fillStyle = p.color;
          pen.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          pen.drawImage(sprite(p.emoji), -p.size / 2, -p.size / 2, p.size, p.size);
        }
        pen.restore();
      }
      if (falling.length || particles.length) {
        frameId = requestAnimationFrame(frame);
      } else {
        frameId = 0;
        lastFrame = 0;
      }
    }

    // --- Disco: a spinning disco ball at the top, beams and coloured lights everywhere ---
    let disco = null;
    function startDisco() {
      disco = el("div", "abuse-disco");
      const colors = ["#ff2bd6", "#22d3ee", "#facc15", "#a855f7", "#22c55e", "#f43f5e", "#3b82f6", "#fb923c"];
      const spot = () => `${Math.round(Math.random() * 100)}vw, ${Math.round(Math.random() * 100)}vh`;
      let spots = "";
      for (let k = 0; k < 14; k++) {
        const [x1, x2, x3] = [spot(), spot(), spot()];
        spots += `<span class="disco-spot" style="--c:${colors[k % colors.length]};--p1:${x1};--p2:${x2};--p3:${x3};--d:${(3 + Math.random() * 4).toFixed(1)}s;--delay:-${(Math.random() * 6).toFixed(1)}s"></span>`;
      }
      let glints = "";
      for (let k = 0; k < 6; k++) {
        glints += `<span class="disco-glint" style="left:${15 + Math.random() * 65}%;top:${15 + Math.random() * 65}%;animation-delay:-${(Math.random() * 1.5).toFixed(2)}s"></span>`;
      }
      disco.innerHTML = `<div class="disco-wash"></div><div class="disco-beams"></div><div class="disco-beams two"></div>${spots}`
        + `<div class="disco-hang"><span class="disco-string"></span><span class="disco-ball">${glints}</span></div>`;
      getLayer().appendChild(disco);
    }

    // --- Lightning: the screen flashes white for a second, every 10 seconds ---
    let flash = null, lightningTimer = 0;
    function strike() {
      flash.classList.remove("go");
      void flash.offsetWidth; // restart the animation
      flash.classList.add("go");
      if (running()) thunder(master, ctx.currentTime + 0.15);
    }
    function startLightning() {
      flash = el("div", "abuse-flash");
      getLayer().appendChild(flash);
      strike();
      lightningTimer = setInterval(strike, LIGHTNING_EVERY);
    }

    function startEffect(id) {
      active.add(id);
      if (FALLING[id]) startFalling();
      if (id === "disco") startDisco();
      if (id === "lightning") { audio(); startLightning(); }
    }

    function stopEffect(id) {
      active.delete(id);
      if (id === "disco" && disco) { disco.remove(); disco = null; }
      if (id === "lightning" && flash) { clearInterval(lightningTimer); flash.remove(); flash = null; }
      // falling things just stop appearing; the ones on screen finish falling
    }

    // ===== Little "ADMIN ABUSE" box in the bottom-right corner, with a mute button =====
    let chip = null;
    function updateChip() {
      const what = [songId && `♪ ${MUSIC_NAMES[songId]}`, ...[...active].map((id) => EFFECT_NAMES[id])].filter(Boolean);
      if (!what.length) {
        if (chip) chip.remove();
        chip = null;
        return;
      }
      if (!chip) {
        chip = el("div", "abuse-chip");
        chip.innerHTML = '<span class="abuse-chip-label">⚡ ADMIN ABUSE</span><span class="abuse-chip-what"></span><button type="button" class="abuse-mute"></button>';
        chip.querySelector(".abuse-mute").addEventListener("click", () => {
          muted = !muted;
          write(MUTED, muted);
          if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
          updateChip();
        });
        document.body.appendChild(chip);
      }
      const locked = AC && songId && !running() && !muted;
      chip.querySelector(".abuse-chip-what").textContent = what.join(" · ") + (locked ? " — click anywhere for sound" : "");
      const mute = chip.querySelector(".abuse-mute");
      mute.textContent = muted ? "🔇" : "🔊";
      mute.setAttribute("aria-label", muted ? "Turn sound on" : "Mute");
      mute.title = muted ? "Turn sound on" : "Mute";
    }

    // ===== What the server says is on =====
    function apply(state) {
      state = state || {};
      setSong(state.music && SONGS[state.music] ? state.music : null);
      const want = new Set((state.effects || []).filter((id) => EFFECT_NAMES[id]));    for (const id of [...active]) if (!want.has(id)) stopEffect(id);
      for (const id of want) if (!active.has(id)) startEffect(id);
      if (layer) layer.dataset.effects = [...active].join(" ");
      playSounds(state.sounds || [], state.now);
      updateChip();
    }

    return { apply };
  })();

  // ==================== Accounts, roles, badges and staff tools ====================
  // ----- Accounts (username + password) -----
  // Accounts live on the Roxy Games server (netlify/functions/api.mts), so they
  // work on every computer, and roles / badges / bans can't be faked.
  // This browser keeps a sign-in token plus a copy of your account so pages
  // can show it straight away; the copy is re-checked with the server every few seconds.
  const Auth = (() => {
    const SESSION = "roxySession"; // { token, user } for whoever is signed in here
    const NOTICE = "roxyNotice";   // message for the sign-in page after being kicked out
    const CHECK_EVERY = 10000;     // ms between checks with the server
    const CHECK_FAST = 4000;       // ...while Admin Abuse is on, so changes (and "stop") show up quicker
    // The sign-in page and ban screen work without being signed in
    const onLoginPage = PAGE === "login" || PAGE === "banned";
    const onBanPage = PAGE === "banned";

    // Roles, highest first. Everyone starts as a Member.
    const ROLES = ["Owner", "Manager", "Administrator", "Developer", "Moderator", "Jr. Moderator", "Helper", "Contributor", "Member"];
    const STAFF_ROLES = ["Owner", "Manager", "Administrator", "Developer", "Moderator", "Jr. Moderator", "Helper"];
    const DEFAULT_ROLE = "Member";

    // Badges: icons shown next to the role. Someone can have any number of them (or none).
    const BADGES = [
      { id: "owner", name: "Owner", svg: '<g fill="#ef4444"><path d="M3.2 8.2l4.6 4.3L12 5.4l4.2 7.1 4.6-4.3-1.6 11.3H4.8z"/><circle cx="3" cy="7.3" r="1.7"/><circle cx="12" cy="4.2" r="1.7"/><circle cx="21" cy="7.3" r="1.7"/></g>' },
      { id: "developer", name: "Developer", svg: '<path d="M8 6.5L2.8 12 8 17.5M16 6.5l5.2 5.5-5.2 5.5M14 3.5L10 20.5" fill="none" stroke="#22c55e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' },
      { id: "verified", name: "Verified", svg: '<g fill="#4aa3f0"><circle cx="12" cy="12" r="7.5"/><circle cx="19" cy="12" r="3"/><circle cx="16.95" cy="16.95" r="3"/><circle cx="12" cy="19" r="3"/><circle cx="7.05" cy="16.95" r="3"/><circle cx="5" cy="12" r="3"/><circle cx="7.05" cy="7.05" r="3"/><circle cx="12" cy="5" r="3"/><circle cx="16.95" cy="7.05" r="3"/></g><path d="M8.3 12.2l2.5 2.5 4.9-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' },
      { id: "staff", name: "Staff", svg: '<g fill="#4aa3f0"><g transform="rotate(45 12 12)"><rect x="10.7" y="8" width="2.6" height="14" rx="1.2"/><path d="M8.6 2.2v3.6a3.4 3.4 0 0 0 6.8 0V2.2l-2 1.6v2.4h-2.8V3.8z"/></g><g transform="rotate(-45 12 12)"><rect x="9.6" y="14.5" width="4.8" height="7.5" rx="1.6"/><rect x="11.2" y="4" width="1.6" height="11"/><path d="M11.2 4l.8-1.8.8 1.8z"/></g></g>' },
      { id: "helper", name: "Helper", svg: '<g fill="#f59e0b"><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/><rect x="8.5" y="18" width="7" height="1.7" rx="0.85"/><rect x="9.6" y="20.4" width="4.8" height="1.6" rx="0.8"/></g><path d="M9.2 8.2a3.3 3.3 0 0 1 2.6-2.4" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="1.4" stroke-linecap="round"/>' },
      { id: "supporter", name: "Supporter", svg: '<circle cx="12" cy="12" r="10" fill="#10b981"/><path d="M14.8 8.6c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2.1 0 3 5.6 1.6 5.6 4.6 0 1.3-1.2 2.2-2.8 2.2-1.3 0-2.4-.6-2.9-1.6M12 5.6v1.6m0 9.6v1.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' },
      { id: "vip", name: "VIP", svg: '<path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="#a855f7"/>' },
      { id: "event-winner", name: "Event Winner", svg: '<g fill="#eab308"><rect x="9" y="13" width="6" height="9" rx="0.6"/><rect x="3" y="16" width="6" height="6" rx="0.6"/><rect x="15" y="18" width="6" height="4" rx="0.6"/><path d="M12 3.2l1.3 2.7 3 .4-2.2 2.1.5 3L12 10l-2.6 1.4.5-3-2.2-2.1 3-.4z"/></g>' },
      { id: "bug-hunter", name: "Bug Hunter", svg: '<g fill="#22c55e"><ellipse cx="12" cy="14.5" rx="5" ry="6.3"/><circle cx="12" cy="6.8" r="3"/></g><path d="M7.2 11.5L3.2 9.3M7 14.6H2.6M7.3 17.6l-3.8 2.3M16.8 11.5l4-2.2M17 14.6h4.4M16.7 17.6l3.8 2.3M10.6 4.4L9.3 2.4M13.4 4.4l1.3-2" fill="none" stroke="#22c55e" stroke-width="1.7" stroke-linecap="round"/><path d="M12 9.5v11" stroke="#14532d" stroke-width="1.1"/>' },
      { id: "og", name: "OG", svg: '<g fill="#facc15"><path d="M8.6 14.2L6.4 21.6l2.7-1.1 1.6 2.3 2-6.6zM15.4 14.2l2.2 7.4-2.7-1.1-1.6 2.3-2-6.6z" fill="#eab308"/><path fill-rule="evenodd" d="M12 1.6a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2zm0 4.4a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z"/></g>' },
    ];

    function read(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    }

    function write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }

    function session() {
      const s = read(SESSION);
      return s && s.token ? s : null;
    }

    // Stays signed in until they press Sign out (or staff kick / delete them),
    // so they're logged in automatically every visit
    function getUser() {
      const s = session();
      return s && s.user ? s.user : null;
    }

    function saveUser(user) {
      const s = session();
      if (s) write(SESSION, { token: s.token, user });
    }

    function endSession(message) {
      try { localStorage.removeItem(SESSION); } catch (e) {}
      if (message) write(NOTICE, message);
    }

    // The sign-in page shows this once (e.g. "You were kicked by staff")
    function takeNotice() {
      const message = read(NOTICE);
      try { localStorage.removeItem(NOTICE); } catch (e) {}
      return message || "";
    }

    // Only allow going back to one of this site's own pages after signing in
    function safeNext(value) {
      const m = /^([a-z]*)(\?[\w=&%.-]*)?$/.exec(value || "");
      return m && (m[1] === "" || (PAGES.includes(m[1]) && !["login", "banned"].includes(m[1]))) ? "./" + value : "./";
    }

    function currentPage() {
      return (PAGE === "home" ? "" : PAGE) + location.search;
    }

    function goToLogin() {
      location.replace(`login?next=${encodeURIComponent(currentPage())}`);
    }

    // Send signed-out visitors to the sign-in page before the page shows
    if (REQUIRE_LOGIN && !onLoginPage && !getUser()) {
      document.documentElement.style.visibility = "hidden";
      goToLogin();
    }

    // ----- Talking to the server -----
    // The server runs on Netlify. The GitHub Pages copy of the site (xyznostiq.github.io)
    // has no server of its own, so it talks to the Netlify one (same accounts, same chat).
    const API_BASE = location.hostname.endsWith("github.io") ? "https://roxygames-v1beta.netlify.app" : "";

    // Throws an Error with a message to show when something's wrong
    async function request(method, path, body, headers = {}) {
      const s = session();
      let res;
      try {
        res = await fetch(API_BASE + path, {
          method,
          headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(s ? { Authorization: `Bearer ${s.token}` } : {}), ...headers },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (e) {
        throw new Error("Can't reach Roxy Games right now. Check your internet.");
      }
      const data = await res.json().catch(() => ({}));

      // Signed out by the server (kicked, deleted, or the sign-in ran out)
      if (res.status === 401 && data.code) {
        endSession(data.code === "signed-out" ? "" : data.error);
        if (!onLoginPage) goToLogin();
      }
      // Banned or timed out
      if (res.status === 403 && data.code === "blocked" && !onBanPage) location.replace("banned");

      if (!res.ok) {
        const err = new Error(data.error || "Something went wrong. Please try again.");
        err.code = data.code;
        throw err;
      }
      return data;
    }

    function checkName(name) {
      if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return "Usernames are 3-20 letters, numbers or _";
      if (typeof BadWords !== "undefined" && BadWords.check(name)) return "That username isn't allowed. Please pick another.";
      return "";
    }

    // Both return { blocked } (the ban / timeout details, or null)
    async function signUp(name, password) {
      name = name.trim();
      const problem = checkName(name) || (password.length < 4 ? "Passwords need at least 4 characters" : "");
      if (problem) throw new Error(problem);
      const data = await request("POST", "/api/signup", { name, password });
      write(SESSION, { token: data.token, user: data.user });
      return { blocked: null };
    }

    async function signIn(name, password) {
      const data = await request("POST", "/api/login", { name, password });
      write(SESSION, { token: data.token, user: data.user });
      return { blocked: data.blocked };
    }

    async function signOut() {
      try { await request("POST", "/api/logout", {}); } catch (e) {}
      endSession();
      location.href = REQUIRE_LOGIN ? "login" : location.href;
    }

    // For the ban screen: the ban / timeout details, or null once it's over
    async function blockedStatus() {
      const data = await request("GET", "/api/me");
      saveUser(data.user);
      return data.blocked;
    }

    // ----- Account settings (for whoever is signed in) -----
    async function changeName(name) {
      name = name.trim();
      const problem = checkName(name);
      if (problem) throw new Error(problem);
      saveUser((await request("POST", "/api/me/name", { name })).user);
    }

    async function changePassword(current, next) {
      if (next.length < 4) throw new Error("Passwords need at least 4 characters");
      await request("POST", "/api/me/password", { current, next });
    }

    // picture is a small image as a data: URL, or "" to remove it
    async function setPicture(picture) {
      saveUser((await request("POST", "/api/me/picture", { picture })).user);
    }

    // ----- Staff tools (used by the staff panel) -----
    // Every staff request carries the number-pad code; the server checks it and your role
    let staffCode = "";
    const staffRequest = (method, path, body) => request(method, path, body, { "X-Staff-Code": staffCode });
    const act = (uid, action, body = {}) => staffRequest("POST", `/api/staff/users/${uid}/${action}`, body);
    const staff = {
      isStaff: (user) => !!user && STAFF_ROLES.includes(user.role),
      async unlock(code) {
        staffCode = code;
        try {
          await staffRequest("POST", "/api/staff/unlock", {});
        } catch (err) {
          staffCode = "";
          throw err;
        }
      },
      async list() { return (await staffRequest("GET", "/api/staff/users")).users; },
      setRole: (uid, role) => act(uid, "role", { role }),
      setBadge: (uid, id, on) => act(uid, "badge", { id, on }),
      warn: (uid, reason) => act(uid, "warn", { reason }),
      clearWarnings: (uid) => act(uid, "clear-warnings"),
      kick: (uid) => act(uid, "kick"),
      timeout: (uid, minutes, reason) => act(uid, "timeout", { minutes, reason }),
      endTimeout: (uid) => act(uid, "end-timeout"),
      ban: (uid, reason) => act(uid, "ban", { reason }),
      unban: (uid) => act(uid, "unban"),
      rename: (uid, name) => act(uid, "rename", { name }),
      setPassword: (uid, password) => act(uid, "password", { password }),
      remove: (uid) => act(uid, "delete"),
      removeWarning: (uid, at) => act(uid, "remove-warning", { at }),
      // Reports from chat, and deciding what happens: { action: "dismiss" | "none" | "warn" | "timeout" | "kick" | "ban", reason, minutes, deleteMessage }
      async reports() { return staffRequest("GET", "/api/staff/reports"); },
      resolveReport: (id, decision) => staffRequest("POST", `/api/staff/reports/${id}/resolve`, decision),
      // Every staff action, newest first, and undoing one
      async history() { return (await staffRequest("GET", "/api/staff/history")).entries; },
      undo: (id) => staffRequest("POST", `/api/staff/history/${id}/undo`, {}),
      // Broadcasts: a message that pops up on everyone's screen
      async broadcasts() { return (await staffRequest("GET", "/api/staff/broadcasts")).broadcasts; },
      broadcast: (text) => staffRequest("POST", "/api/staff/broadcasts", { text }),
      // Admin Abuse (Owner only): returns { music, effects } that are on now
      abuse: () => staffRequest("GET", "/api/staff/abuse"),
      abuseDo: (body) => staffRequest("POST", "/api/staff/abuse", body),
      formatTime: (ms) => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    };

    // "Owner" -> "role-owner", "Jr. Moderator" -> "role-jr-moderator" (for badge colours)
    function roleClass(role) {
      return "role-" + role.toLowerCase().replace(/[^a-z]+/g, "-");
    }

    // Coloured role badge, e.g. [Owner]
    function roleBadge(role) {
      const badge = document.createElement("span");
      badge.className = "role-badge " + roleClass(role || DEFAULT_ROLE);
      badge.textContent = role || DEFAULT_ROLE;
      return badge;
    }

    // Badge icons in a row. No text: hovering one shows its name.
    function badgeIcons(ids) {
      const row = document.createElement("span");
      row.className = "badge-icons";
      for (const b of BADGES) {
        if (!(ids || []).includes(b.id)) continue;
        const icon = document.createElement("span");
        icon.className = "badge-icon";
        icon.dataset.name = b.name; // shown on hover
        icon.setAttribute("role", "img");
        icon.setAttribute("aria-label", b.name);
        icon.tabIndex = 0; // lets keyboard users see the name too
        icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${b.svg}</svg>`;
        row.appendChild(icon);
      }
      return row;
    }

    // A username with its role badge and badge icons next to it.
    // Use this anywhere a username is shown on the site (now and in the future).
    function nameTag(name, role, badges) {
      const tag = document.createElement("span");
      tag.className = "name-tag";
      const text = document.createElement("span");
      text.className = "name-tag-name";
      text.textContent = name;
      tag.append(text, roleBadge(role));
      if (badges && badges.length) tag.appendChild(badgeIcons(badges));
      return tag;
    }

    // Pop-up showing warnings from staff the user hasn't seen yet
    function showWarnings(warnings) {
      if (onLoginPage || !warnings || !warnings.length || document.getElementById("warnPopup")) return;

      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.id = "warnPopup";
      const box = document.createElement("div");
      box.className = "modal-box warn-box";
      box.setAttribute("role", "alertdialog");
      const title = document.createElement("h2");
      title.textContent = warnings.length > 1 ? `⚠ You have ${warnings.length} warnings from staff` : "⚠ You have a warning from staff";
      const list = document.createElement("ul");
      for (const w of warnings) {
        const li = document.createElement("li");
        li.textContent = w.reason;
        list.appendChild(li);
      }
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "button small";
      ok.textContent = "I understand";
      ok.addEventListener("click", () => {
        request("POST", "/api/me/warnings-seen", {}).catch(() => {});
        backdrop.remove();
      });
      box.append(title, list, ok);
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);
    }

    // Broadcast pop-ups from staff: name + role + badges and the message, for 5 seconds.
    // The ✕ to close it shows when you hover over it.
    const BROADCAST_SHOW = 5000;
    const SEEN_BROADCASTS = "roxySeenBroadcasts"; // so moving to another page doesn't show it again
    const shownBroadcasts = new Set();

    function showBroadcasts(list) {
      if (onLoginPage || !list || !list.length) return;
      const seen = read(SEEN_BROADCASTS) || [];
      let stack = document.getElementById("broadcastStack");
      for (const b of list) {
        if (shownBroadcasts.has(b.id) || seen.includes(b.id)) continue;
        shownBroadcasts.add(b.id);
        seen.push(b.id);

        if (!stack) {
          stack = document.createElement("div");
          stack.id = "broadcastStack";
          stack.className = "broadcast-stack";
          stack.setAttribute("aria-live", "assertive");
          document.body.appendChild(stack);
        }
        const card = document.createElement("div");
        card.className = "broadcast";
        card.setAttribute("role", "alert");
        const head = document.createElement("div");
        head.className = "broadcast-head";
        const label = document.createElement("span");
        label.className = "broadcast-label";
        label.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10v4h4l6 4V6L7 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>BROADCAST';
        head.append(label, nameTag(b.from.name, b.from.role, b.from.badges));
        const text = document.createElement("p");
        text.className = "broadcast-text";
        text.textContent = b.text;
        const close = document.createElement("button");
        close.type = "button";
        close.className = "broadcast-x";
        close.setAttribute("aria-label", "Close");
        close.textContent = "✕";
        const bar = document.createElement("span");
        bar.className = "broadcast-bar";
        bar.style.animationDuration = BROADCAST_SHOW + "ms";

        const remove = () => {
          card.classList.add("leaving");
          setTimeout(() => card.remove(), 250);
        };
        close.addEventListener("click", remove);
        setTimeout(remove, BROADCAST_SHOW);
        card.append(close, head, text, bar);
        stack.appendChild(card);
      }
      write(SEEN_BROADCASTS, seen.slice(-50));
    }

    // Admin Abuse: music / screen effects / sound effects the Owner turned on for everyone
    let abuseOn = false;

    function applyAbuse(state) {
      if (onLoginPage || !state) return;
      abuseOn = !!(state.music || state.effects.length);
      RoxyAbuse.apply(state);
    }

    // Account button in the top-right corner: picture (or first letter) when signed in, menu with settings and sign out
    function renderAccount() {
      if (onLoginPage || PAGE === "account") return; // no corner button on these pages
      const user = getUser();

      let corner = document.querySelector(".top-right");
      if (!corner) {
        corner = document.createElement("div");
        corner.className = "top-right";
        document.body.appendChild(corner);
      }
      corner.querySelectorAll(".account").forEach((el) => el.remove()); // when redrawing

      const wrap = document.createElement("div");
      wrap.className = "account";
      const btn = document.createElement("button");
      btn.className = "icon-btn account-btn";
      btn.type = "button";

      if (!user) {
        btn.setAttribute("aria-label", "Sign in");
        btn.title = "Sign in";
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
        btn.addEventListener("click", () => {
          location.href = `login?next=${encodeURIComponent(currentPage())}`;
        });
        wrap.appendChild(btn);
        corner.prepend(wrap);
        return;
      }

      btn.setAttribute("aria-label", `Account: ${user.name}`);
      btn.title = user.name;
      if (user.picture) {
        const img = document.createElement("img");
        img.src = user.picture;
        img.alt = "";
        btn.appendChild(img);
      } else {
        btn.textContent = user.name.charAt(0).toUpperCase();
      }

      const menu = document.createElement("div");
      menu.className = "account-menu";
      menu.hidden = true;
      const name = document.createElement("div");
      name.className = "account-name";
      name.appendChild(nameTag(user.name, user.role, user.badges));
      const settings = document.createElement("a");
      settings.href = "account";
      settings.className = "tab";
      settings.textContent = "ACCOUNT SETTINGS";
      const out = document.createElement("button");
      out.type = "button";
      out.className = "tab";
      out.textContent = "SIGN OUT";
      out.addEventListener("click", signOut);
      menu.append(name, settings, out);

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
      });
      document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) menu.hidden = true;
      });

      wrap.append(btn, menu);
      corner.prepend(wrap);
    }

    // ----- Auto refresh -----
    // Checks your account with the server. If staff changed something (ban, kick,
    // timeout, rename, role, badges...) the page updates by itself right away.
    async function check() {
      // Hidden tabs skip checks, unless Admin Abuse is playing (so "stop" still gets through)
      if (!session() || (document.hidden && !abuseOn)) return;
      try {
        const before = JSON.stringify(getUser());
        const data = await request("GET", "/api/me");
        if (data.blocked) return location.replace("banned");
        saveUser(data.user);
        if (JSON.stringify(data.user) !== before) return location.reload();
        showWarnings(data.warnings);
        showBroadcasts(data.broadcasts);
        applyAbuse(data.abuse);
      } catch (e) {} // request() already handles being signed out; otherwise try again next time
    }

    function checkLoop() {
      setTimeout(async () => {
        await check();
        checkLoop();
      }, abuseOn ? CHECK_FAST : CHECK_EVERY);
    }

    document.addEventListener("DOMContentLoaded", renderAccount);
    if (!onLoginPage) {
      check();
      checkLoop();
      document.addEventListener("visibilitychange", check); // straight away when coming back to the tab
    }

    return {
      getUser, signIn, signUp, signOut, safeNext, takeNotice, blockedStatus, request,
      changeName, changePassword, setPicture, refreshAccount: renderAccount, staff, checkNow: check,
      ROLES, BADGES, roleClass, roleBadge, badgeIcons, nameTag,
    };
  })();

  // ==================== Background, cursor and clock (every page) ====================
  (() => {
    // ----- Network background -----
    const canvas = document.getElementById("bg");
    const ctx = canvas.getContext("2d");

    const LINK_DIST = 75; // how close two dots must be to connect
    const MOUSE_DIST = 170;  // how close a dot must be to connect to the cursor
    const SPEED = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.07;

    const COLORS = [
      { fill: "255, 255, 255", weight: 0.7 }, // white
      { fill: "139, 92, 246", weight: 0.18 }, // purple
      { fill: "34, 211, 238", weight: 0.12 }, // cyan
    ];

    let width, height, nodes = [];
    const mouse = { x: -9999, y: -9999, active: false };

    function pickColor() {
      let r = Math.random();
      for (const c of COLORS) {
        if (r < c.weight) return c.fill;
        r -= c.weight;
      }
      return COLORS[0].fill;
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(90, Math.floor((width * height) / 16000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 2 * SPEED,
        vy: (Math.random() - 0.5) * 2 * SPEED,
        r: Math.random() * 1.6 + 0.8,
        color: pickColor(),
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      // Move dots and bounce them off the edges
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }

      // Lines between nearby dots
      ctx.lineWidth = 0.8;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK_DIST) {
            ctx.strokeStyle = `rgba(150, 140, 210, ${(1 - d / LINK_DIST) * 0.3})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Lines from the cursor to nearby dots
      if (mouse.active) {
        ctx.lineWidth = 0.8;
        for (const n of nodes) {
          const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
          if (d < MOUSE_DIST) {
            ctx.strokeStyle = `rgba(139, 92, 246, ${(1 - d / MOUSE_DIST) * 0.4})`;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
      }

      // Dots with a soft glow
      for (const n of nodes) {
        ctx.fillStyle = `rgba(${n.color}, 0.07)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${n.color}, 0.6)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();
    draw();

    // ----- Custom cursor -----
    const dot = document.getElementById("cursorDot");
    const ring = document.getElementById("cursorRing");
    let ringX = 0, ringY = 0;

    function showCursorAt(x, y) {
      mouse.x = x;
      mouse.y = y;
      if (!mouse.active) {
        mouse.active = true;
        ringX = x;
        ringY = y;
        dot.style.opacity = ring.style.opacity = 1;
      }
      dot.style.transform = `translate(${x}px, ${y}px)`;
    }

    window.addEventListener("mousemove", (e) => showCursorAt(e.clientX, e.clientY));

    // Remember where the mouse was when leaving the page, so the cursor
    // shows up right away on the next page instead of vanishing until you move
    window.addEventListener("pagehide", () => {
      if (!mouse.active) return;
      try {
        sessionStorage.setItem("cursorPos", JSON.stringify({ x: mouse.x, y: mouse.y }));
      } catch (e) {}
    });

    try {
      const saved = JSON.parse(sessionStorage.getItem("cursorPos"));
      if (saved) {
        showCursorAt(saved.x, saved.y);
        // If the mouse is resting on a tab, start with the ring in its hover size
        const under = document.elementFromPoint(saved.x, saved.y);
        if (under && under.closest("a, button")) ring.classList.add("hover");
      }
    } catch (e) {}

    function hideCursor() {
      mouse.active = false;
      dot.style.opacity = ring.style.opacity = 0;
    }

    document.addEventListener("mouseleave", hideCursor);

    // Embedded games show their own cursor, so hide ours as soon as the mouse
    // crosses into one (the page stops getting mouse moves once it's inside)
    document.addEventListener("mouseover", (e) => {
      if (e.target.tagName === "IFRAME") hideCursor();
    });
    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget || e.relatedTarget.tagName === "IFRAME") hideCursor();
    });
    window.addEventListener("blur", hideCursor); // e.g. after clicking into a game

    // The ring trails slightly behind the dot
    function moveRing() {
      ringX += (mouse.x - ringX) * 0.2;
      ringY += (mouse.y - ringY) * 0.2;
      ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
      requestAnimationFrame(moveRing);
    }
    moveRing();

    // ----- Clock -----
    const clockTime = document.getElementById("clockTime");
    const clockDate = document.getElementById("clockDate");

    function updateClock() {
      if (!clockTime || !clockDate) return; // this page has no clock
      const now = new Date();
      clockTime.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const weekday = now.toLocaleDateString([], { weekday: "long" });
      clockDate.textContent = `${weekday}, ${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
    }
    updateClock();
    setInterval(updateClock, 1000);

    // Ring grows when hovering links and buttons (also ones added later, like game cards)
    document.addEventListener("mouseover", (e) => {
      ring.classList.toggle("hover", !!e.target.closest("a, button, input"));
    });
  })();

  // ==================== Games page ====================
  // ----- Games library: category bar + grid of game cards -----
  if (PAGE === "games") (() => {
    const bar = document.getElementById("categories");
    const sections = document.getElementById("gameSections");
    if (!bar || !sections) return;

    // Card for one game; clicking it opens the game page
    function card(game) {
      const a = document.createElement("a");
      a.className = "game-card";
      a.href = `play?id=${encodeURIComponent(game.id)}`;

      const thumb = document.createElement("div");
      thumb.className = "game-thumb";
      if (game.thumb) {
        const img = document.createElement("img");
        img.src = game.thumb;
        img.alt = "";
        img.loading = "lazy";
        thumb.appendChild(img);
      } else {
        thumb.textContent = game.title.charAt(0);
      }

      const title = document.createElement("div");
      title.className = "game-title";
      title.textContent = game.title;

      a.append(thumb, title);
      return a;
    }

    // One section per category, each with its own grid
    CATEGORIES.forEach((cat) => {
      const games = GAMES.filter((g) => g.category === cat);
      if (!games.length) return;

      const section = document.createElement("section");
      section.className = "game-section";
      section.dataset.category = cat;

      const head = document.createElement("div");
      head.className = "game-section-head";
      const heading = document.createElement("h2");
      heading.textContent = cat;
      const viewAll = document.createElement("button");
      viewAll.className = "view-all";
      viewAll.textContent = `View all ${games.length} →`;
      viewAll.addEventListener("click", () => show(cat));
      head.append(heading);
      if (games.length > 10) head.append(viewAll); // only needed when the preview hides some

      const grid = document.createElement("div");
      grid.className = "game-grid";
      games.forEach((g) => grid.appendChild(card(g)));

      section.append(head, grid);
      sections.appendChild(section);
    });

    // Category buttons: "All" shows a preview row of every category, the rest show one category in full
    function show(cat) {
      bar.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.category === cat));
      sections.querySelectorAll(".game-section").forEach((s) => {
        s.hidden = cat !== "All" && s.dataset.category !== cat;
        s.classList.toggle("preview", cat === "All");
      });
      if (cat !== "All") bar.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Only show buttons for categories that have games
    const used = CATEGORIES.filter((cat) => GAMES.some((g) => g.category === cat));
    ["All", ...used].forEach((cat) => {
      const b = document.createElement("button");
      b.className = "tab";
      b.dataset.category = cat;
      b.textContent = cat.toUpperCase();
      b.addEventListener("click", () => show(cat));
      bar.appendChild(b);
    });

    show("All");
  })();

  // ==================== Play page ====================
  // ----- Game page: embed, like/dislike, fullscreen -----
  if (PAGE === "play") (() => {
    const id = new URLSearchParams(location.search).get("id");
    const game = GAMES.find((g) => g.id === id);
    const frame = document.getElementById("playerFrame");
    const empty = document.getElementById("playerEmpty");
    const titleEl = document.getElementById("gameTitle");

    if (!game) {
      titleEl.textContent = "Game not found";
      empty.textContent = "This game doesn't exist. Head back to the games list.";
      empty.hidden = false;
      document.querySelector(".player-bar").hidden = true;
      return;
    }

    titleEl.textContent = game.title;
    document.title = `${game.title} - Roxy Games`;
    if (game.embed) {
      const iframe = document.createElement("iframe");
      iframe.src = game.embed;
      iframe.title = game.title;
      iframe.allow = "fullscreen; autoplay; gamepad";
      iframe.allowFullscreen = true;
      frame.appendChild(iframe);
    } else {
      empty.hidden = false;
    }

    // Like / dislike, remembered for this visitor only
    const likeBtn = document.getElementById("likeBtn");
    const dislikeBtn = document.getElementById("dislikeBtn");
    const key = `vote:${game.id}`;
    let vote = null;
    try { vote = localStorage.getItem(key); } catch (e) {}

    function renderVote() {
      likeBtn.classList.toggle("active", vote === "like");
      dislikeBtn.classList.toggle("active", vote === "dislike");
      likeBtn.setAttribute("aria-pressed", vote === "like");
      dislikeBtn.setAttribute("aria-pressed", vote === "dislike");
    }

    function setVote(v) {
      vote = vote === v ? null : v; // clicking again removes the vote
      try {
        if (vote) localStorage.setItem(key, vote);
        else localStorage.removeItem(key);
      } catch (e) {}
      renderVote();
    }

    likeBtn.addEventListener("click", () => setVote("like"));
    dislikeBtn.addEventListener("click", () => setVote("dislike"));
    renderVote();

    // Fullscreen
    const fsBtn = document.getElementById("fullscreenBtn");
    fsBtn.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (frame.requestFullscreen) frame.requestFullscreen();
    });
  })();

  // ==================== Chat page ====================
  // ----- Live chat -----
  // Messages are saved online by the Roxy Games server (netlify/functions/api.mts),
  // so everyone on every computer sees the same chat. The page checks for new
  // messages every couple of seconds while it's open.
  if (PAGE === "chat") (() => {
    const API = "/api/chat";
    const POLL = 2000;     // ms between checks for new messages
    const COOLDOWN = 1000; // ms between messages, stops spam
    // These roles can delete other people's messages (but only edit their own)
    const STAFF_ROLES = ["Owner", "Manager", "Administrator", "Developer", "Moderator", "Jr. Moderator", "Helper"];

    const list = document.getElementById("chatMessages");
    const form = document.getElementById("chatForm");
    const input = document.getElementById("chatInput");
    const sendBtn = form.querySelector("button");
    const error = document.getElementById("chatError");
    const toast = document.getElementById("toast");
    let lastSent = 0;
    let chat = { version: "", messages: [], users: {} };
    let offline = false;
    let editingId = null; // message being edited (the list doesn't redraw meanwhile)

    const ICONS = {
      edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
      del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
      report: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
    };

    function showToast(text) {
      toast.textContent = text;
      toast.classList.add("show");
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
    }

    // ----- Talking to the chat server -----
    // Auth.request signs every request with your account, so the server knows
    // who you are and what role you have (nobody can pretend to be you)
    const api = (method, url, body) => Auth.request(method, url, body);

    function setOffline(value) {
      if (offline === value) return;
      offline = value;
      input.disabled = sendBtn.disabled = value;
      input.placeholder = value ? "Chat is offline" : "Say something nice...";
      render(true);
    }

    async function refresh() {
      try {
        const data = await api("GET", `${API}?v=${encodeURIComponent(chat.version)}`);
        setOffline(false);
        if (!data.same) {
          chat = data;
          render();
        }
      } catch (e) {
        setOffline(true);
      }
    }

    // ----- Showing messages -----
    const isStaff = (user) => !!user && STAFF_ROLES.includes(user.role);
    const TOP_ROLES = ["Owner", "Manager", "Developer"];
    const rankOf = (role) => Auth.ROLES.indexOf(role);
    const canEdit = (user, m) => !!user && m.uid === user.uid;
    // Same rules as the staff panel: Owner / Manager / Developer can delete anyone's
    // messages (only the Owner can delete the Owner's), other staff only lower roles'
    function canDelete(user, m, sender) {
      if (canEdit(user, m)) return true;
      if (!isStaff(user) || (sender.role === "Owner" && user.role !== "Owner")) return false;
      if (TOP_ROLES.includes(user.role)) return true;
      return !TOP_ROLES.includes(sender.role) && rankOf(user.role) < rankOf(sender.role);
    }

    function avatar(user) {
      const el = document.createElement("div");
      el.className = "user-avatar chat-avatar";
      if (user.picture) {
        const img = document.createElement("img");
        img.src = user.picture;
        img.alt = "";
        el.appendChild(img);
      } else {
        el.textContent = user.name.charAt(0).toUpperCase();
      }
      return el;
    }

    function actionButton(kind, label, onClick) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat-action chat-" + kind;
      b.title = label;
      b.setAttribute("aria-label", label);
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[kind]}</svg>`;
      b.addEventListener("click", onClick);
      return b;
    }

    // Swaps the message text for a box to edit it in
    function startEdit(m, textEl) {
      editingId = m.id;
      const box = document.createElement("form");
      box.className = "chat-edit-box";
      const field = document.createElement("input");
      field.type = "text";
      field.maxLength = 300;
      field.value = m.text;
      field.setAttribute("aria-label", "Edit message");
      const saveBtn = document.createElement("button");
      saveBtn.type = "submit";
      saveBtn.className = "tab";
      saveBtn.textContent = "SAVE";
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "tab";
      cancelBtn.textContent = "CANCEL";
      const hint = document.createElement("p");
      hint.className = "chat-edit-hint";
      hint.textContent = "Enter to save, Esc to cancel";

      const stop = () => {
        editingId = null;
        render(true);
      };
      box.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = field.value.trim();
        if (!text) return;
        if (text === m.text) return stop();
        if (BadWords.checkMessage(text)) {
          hint.textContent = "Your message has words that aren't allowed.";
          hint.classList.add("bad");
          return;
        }
        try {
          await api("PATCH", `${API}/${m.id}`, { text });
          stop();
          refresh();
        } catch (err) {
          hint.textContent = err.message;
          hint.classList.add("bad");
        }
      });
      cancelBtn.addEventListener("click", stop);
      field.addEventListener("keydown", (e) => { if (e.key === "Escape") stop(); });

      box.append(field, saveBtn, cancelBtn);
      textEl.replaceWith(box, hint);
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }

    // First click arms the delete button, second click within 3 seconds deletes
    async function askDelete(m, name, button) {
      if (!button.classList.contains("armed")) {
        button.classList.add("armed");
        button.title = "Click again to delete";
        setTimeout(() => {
          button.classList.remove("armed");
          button.title = "Delete message";
        }, 3000);
        return;
      }
      try {
        await api("DELETE", `${API}/${m.id}`, {});
        showToast(m.uid === Auth.getUser().uid ? "Message deleted." : `Deleted ${name}'s message.`);
        refresh();
      } catch (err) {
        showToast(err.message);
      }
    }

    // ----- Reporting a message (staff see it in the Staff Panel's Reports/Bans tab) -----
    const reportModal = document.getElementById("reportModal");
    const reportForm = document.getElementById("reportForm");
    const reportError = document.getElementById("reportError");
    let reporting = null;

    function openReport(m, name) {
      reporting = m;
      document.getElementById("reportTitle").textContent = `Report ${name}'s message`;
      document.getElementById("reportQuote").textContent = m.text;
      document.getElementById("reportReason").value = "";
      reportError.textContent = "";
      reportModal.hidden = false;
      document.getElementById("reportReason").focus();
    }

    function closeReport() {
      reportModal.hidden = true;
      reporting = null;
    }

    reportForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!reporting) return;
      try {
        await api("POST", "/api/reports", { messageId: reporting.id, reason: document.getElementById("reportReason").value.trim() });
        closeReport();
        showToast("Thanks! Staff will take a look.");
      } catch (err) {
        reportError.textContent = err.message;
      }
    });
    document.getElementById("reportCancel").addEventListener("click", closeReport);
    reportModal.addEventListener("click", (e) => { if (e.target === reportModal) closeReport(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !reportModal.hidden) closeReport(); });

    let lastDrawn = "";
    function render(force) {
      if (editingId) return; // don't wipe out the edit box
      const user = Auth.getUser();
      const stamp = `${chat.version}|${offline}|${user && user.role}`;
      if (!force && stamp === lastDrawn) return;
      lastDrawn = stamp;

      const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
      list.innerHTML = "";

      if (offline) {
        const note = document.createElement("p");
        note.className = "chat-empty";
        note.textContent = location.protocol === "file:"
          ? "Chat only works on the online version of the site."
          : "Can't reach the chat right now. Trying again...";
        list.appendChild(note);
        return;
      }
      if (!chat.messages.length) {
        const empty = document.createElement("p");
        empty.className = "chat-empty";
        empty.textContent = "No messages yet. Say hi!";
        list.appendChild(empty);
      }

      for (const m of chat.messages) {
        const sender = chat.users[m.uid] || { name: "Unknown", role: "Member", badges: [], picture: "" };
        const row = document.createElement("div");
        row.className = "chat-message";

        const head = document.createElement("div");
        head.className = "chat-head";
        head.appendChild(Auth.nameTag(sender.name, sender.role, sender.badges));
        const time = document.createElement("span");
        time.className = "chat-time";
        time.textContent = new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        if (m.edited) {
          time.textContent += " (edited)";
          time.title = "Edited " + new Date(m.edited).toLocaleString();
        }
        head.appendChild(time);

        const text = document.createElement("div");
        text.className = "chat-text";
        text.textContent = m.text;

        const body = document.createElement("div");
        body.className = "chat-body";
        body.append(head, text);

        // Sender: edit + delete. Staff: delete. Everyone else: report.
        const actions = document.createElement("div");
        actions.className = "chat-actions";
        if (canEdit(user, m)) actions.appendChild(actionButton("edit", "Edit message", () => startEdit(m, text)));
        if (canDelete(user, m, sender)) {
          const del = actionButton("del", "Delete message", () => askDelete(m, sender.name, del));
          actions.appendChild(del);
        }
        if (!canEdit(user, m)) actions.appendChild(actionButton("report", "Report message", () => openReport(m, sender.name)));

        row.append(avatar(sender), body, actions);
        list.appendChild(row);
      }

      if (nearBottom) list.scrollTop = list.scrollHeight;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      error.textContent = "";
      if (!text || offline) return;

      if (Date.now() - lastSent < COOLDOWN) {
        error.textContent = "Slow down a little!";
        return;
      }
      if (BadWords.checkMessage(text)) {
        error.textContent = "Your message has words that aren't allowed.";
        return;
      }

      sendBtn.disabled = true;
      try {
        await api("POST", API, { text });
        lastSent = Date.now();
        input.value = "";
        await refresh();
        list.scrollTop = list.scrollHeight; // always jump to your own message
      } catch (err) {
        error.textContent = err.message;
      } finally {
        sendBtn.disabled = offline;
        input.focus();
      }
    });

    // Load the chat, then keep checking for new messages
    if (location.protocol === "file:") {
      setOffline(true);
    } else {
      refresh().then(() => {
        list.scrollTop = list.scrollHeight;
      });
      // Only check while the tab is visible, and right away when coming back to it
      setInterval(() => { if (!document.hidden) refresh(); }, POLL);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    }
    render(true);
    input.focus();
  })();

  // ==================== AI page ====================
  // ----- AI tab: chat with Claude -----
  // Each person's conversation only lives in this page (nothing is saved), so
  // closing or reloading the tab starts fresh. The server (netlify/functions/api.mts)
  // passes the conversation to Claude and sends back the answer.
  // People can add a picture (button or paste) and Claude can read it.
  if (PAGE === "ai") (() => {
    // Switch to true once the Anthropic key is added in Netlify (ANTHROPIC_API_KEY)
    const AI_READY = false;
    if (!AI_READY) {
      document.getElementById("aiSoon").hidden = false;
      document.querySelector(".chat-box").hidden = true;
      document.querySelector(".ai-note").hidden = true;
      return;
    }

    const list = document.getElementById("aiMessages");
    const form = document.getElementById("aiForm");
    const input = document.getElementById("aiInput");
    const sendBtn = form.querySelector('button[type="submit"]');
    const error = document.getElementById("aiError");
    const fileInput = document.getElementById("aiFile");
    const preview = document.getElementById("aiPreview");
    const previewImg = document.getElementById("aiPreviewImg");
    const AI_NAME = "Claude";
    const MAX_SIDE = 1568;   // pictures are shrunk to fit this many pixels before sending
    const SEND_IMAGES = 2;   // only the newest pictures are sent again with later questions
    const SPARKLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" fill="currentColor"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor"/></svg>';

    // { role: "user" | "assistant", text, image? (data: URL) } - only in memory
    let messages = [];
    let waiting = false;
    let pendingImage = null; // picture chosen but not sent yet (data: URL)

    function avatar(isAI) {
      const el = document.createElement("div");
      el.className = "user-avatar chat-avatar" + (isAI ? " ai-avatar" : "");
      if (isAI) {
        el.innerHTML = SPARKLE;
        return el;
      }
      const me = Auth.getUser();
      if (me.picture) {
        const img = document.createElement("img");
        img.src = me.picture;
        img.alt = "";
        el.appendChild(img);
      } else {
        el.textContent = me.name.charAt(0).toUpperCase();
      }
      return el;
    }

    function nameFor(isAI) {
      if (!isAI) {
        const me = Auth.getUser();
        return Auth.nameTag(me.name, me.role, me.badges);
      }
      const tag = document.createElement("span");
      tag.className = "name-tag";
      const name = document.createElement("span");
      name.className = "name-tag-name";
      name.textContent = AI_NAME;
      const badge = document.createElement("span");
      badge.className = "role-badge ai-badge";
      badge.textContent = "AI";
      tag.append(name, badge);
      return tag;
    }

    function row(isAI, text, image, extraClass = "") {
      const el = document.createElement("div");
      el.className = "chat-message " + extraClass;
      const head = document.createElement("div");
      head.className = "chat-head";
      head.appendChild(nameFor(isAI));
      const body = document.createElement("div");
      body.className = "chat-body";
      body.appendChild(head);
      if (image) {
        const img = document.createElement("img");
        img.className = "ai-image";
        img.src = image;
        img.alt = "Picture you sent";
        body.appendChild(img);
      }
      if (text) {
        const words = document.createElement("div");
        words.className = "chat-text";
        words.textContent = text;
        body.appendChild(words);
      }
      el.append(avatar(isAI), body);
      return el;
    }

    function render() {
      list.innerHTML = "";
      if (!messages.length) {
        const empty = document.createElement("p");
        empty.className = "chat-empty";
        empty.textContent = `Hi ${Auth.getUser().name}! Ask me anything, or add a picture and I'll take a look.`;
        list.appendChild(empty);
      }
      for (const m of messages) list.appendChild(row(m.role === "assistant", m.text, m.image));
      if (waiting) list.appendChild(row(true, "Thinking...", null, "ai-thinking"));
      list.scrollTop = list.scrollHeight;
    }

    // What the server gets: the newest pictures go along as images, older ones become a note
    function forServer() {
      let imagesLeft = SEND_IMAGES;
      const withImages = new Set();
      for (let i = messages.length - 1; i >= 0 && imagesLeft > 0; i--) {
        if (messages[i].image) {
          withImages.add(i);
          imagesLeft--;
        }
      }
      return messages.map((m, i) => {
        if (!m.image) return { role: m.role, content: m.text };
        if (!withImages.has(i)) return { role: m.role, content: `(I shared a picture here earlier.) ${m.text}` };
        const [, mediaType, data] = m.image.match(/^data:(image\/[a-z]+);base64,(.*)$/);
        return { role: m.role, content: [{ type: "image", source: { type: "base64", media_type: mediaType, data } }, { type: "text", text: m.text }] };
      });
    }

    // ----- Adding a picture -----
    // Shrinks big photos so they upload quickly (and stay under the size limit)
    function shrink(file) {
      return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) return reject(new Error("That file isn't a picture."));
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff"; // see-through parts of PNGs become white instead of black
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(img.src);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("Couldn't open that picture."));
        img.src = URL.createObjectURL(file);
      });
    }

    async function addPicture(file) {
      error.textContent = "";
      try {
        setPending(await shrink(file));
        input.focus();
      } catch (err) {
        error.textContent = err.message;
      }
    }

    function setPending(image) {
      pendingImage = image;
      preview.hidden = !image;
      if (image) previewImg.src = image;
      else previewImg.removeAttribute("src");
    }

    document.getElementById("aiAttach").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      fileInput.value = ""; // lets the same picture be picked again
      if (file) addPicture(file);
    });
    document.getElementById("aiPreviewRemove").addEventListener("click", () => setPending(null));

    // Pasting a picture (Ctrl+V) works too
    document.addEventListener("paste", (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      addPicture(item.getAsFile());
    });

    // ----- Sending -----
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const image = pendingImage;
      const text = input.value.trim() || (image ? "What's in this picture?" : "");
      error.textContent = "";
      if (!text || waiting) return;
      if (BadWords.checkMessage(text)) {
        error.textContent = "Your message has words that aren't allowed.";
        return;
      }

      messages.push({ role: "user", text, image });
      input.value = "";
      setPending(null);
      waiting = true;
      sendBtn.disabled = true;
      render();
      try {
        const { reply } = await Auth.request("POST", "/api/ai", { messages: forServer() });
        messages.push({ role: "assistant", text: reply });
      } catch (err) {
        messages.pop(); // take the question back off so it can be sent again
        input.value = image && text === "What's in this picture?" ? "" : text;
        setPending(image);
        error.textContent = err.message;
      } finally {
        waiting = false;
        sendBtn.disabled = false;
        render();
        input.focus();
      }
    });

    document.getElementById("aiNew").addEventListener("click", () => {
      if (waiting) return;
      messages = [];
      setPending(null);
      error.textContent = "";
      render();
      input.focus();
    });

    render();
    input.focus();
  })();

  // ==================== Sign-in page ====================
  if (PAGE === "login") (() => {
    const next = Auth.safeNext(new URLSearchParams(location.search).get("next"));
    if (Auth.getUser()) return location.replace(next); // already signed in

    const form = document.getElementById("loginForm");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const submit = document.getElementById("loginSubmit");
    const error = document.getElementById("loginError");
    let mode = "signin";

    // Explains why they ended up here (banned, timed out, kicked or deleted by staff)
    error.textContent = Auth.takeNotice();

    // Rule book: swap the sign-in screen for the rules, and back again
    const loginView = document.getElementById("loginView");
    const rulesView = document.getElementById("rulesView");
    const rulesOpen = document.getElementById("rulesOpen");
    const rulesBack = document.getElementById("rulesBack");

    function showRules(show) {
      loginView.hidden = show;
      rulesOpen.hidden = show;
      rulesView.hidden = !show;
      rulesBack.hidden = !show;
      if (!show) username.focus();
    }

    rulesOpen.addEventListener("click", () => showRules(true));
    document.getElementById("rulesLink").addEventListener("click", () => showRules(true));
    rulesBack.addEventListener("click", () => showRules(false));
    document.getElementById("rulesDone").addEventListener("click", () => showRules(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !rulesView.hidden) showRules(false);
    });

    document.querySelector(".login-tabs").addEventListener("click", (e) => {
      const tab = e.target.closest("button");
      if (!tab) return;
      mode = tab.dataset.mode;
      document.querySelectorAll(".login-tabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
      submit.textContent = mode === "signin" ? "Sign in" : "Create account";
      password.autocomplete = mode === "signin" ? "current-password" : "new-password";
      error.textContent = "";
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.textContent = "";
      submit.disabled = true;
      try {
        const { blocked } = mode === "signin"
          ? await Auth.signIn(username.value, password.value)
          : await Auth.signUp(username.value, password.value);
        location.href = blocked ? "banned" : next; // banned or timed out -> ban screen
      } catch (err) {
        error.textContent = err.message;
        form.classList.remove("shake");
        void form.offsetWidth; // restart the shake animation
        form.classList.add("shake");
        submit.disabled = false;
      }
    });
  })();

  // ==================== Account settings page ====================
  if (PAGE === "account") (() => {
    if (!Auth.getUser()) return location.replace("login?next=account");

    // Shows a message under a section: red for problems, green when it worked
    function say(el, text, ok) {
      el.textContent = text;
      el.classList.toggle("ok", !!ok);
    }

    // ----- Profile picture -----
    const preview = document.getElementById("pfpPreview");
    const pfpMsg = document.getElementById("pfpMsg");

    function showPicture() {
      const user = Auth.getUser();
      preview.innerHTML = "";
      if (user.picture) {
        const img = document.createElement("img");
        img.src = user.picture;
        img.alt = "Your profile picture";
        preview.appendChild(img);
      } else {
        preview.textContent = user.name.charAt(0).toUpperCase();
      }
      document.getElementById("pfpRemove").hidden = !user.picture;
      document.getElementById("profileName").replaceChildren(Auth.nameTag(user.name, user.role, user.badges));
    }

    // Crops the picture to a square and shrinks it so it uploads quickly
    function shrink(file) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const size = 160;
          const side = Math.min(img.width, img.height);
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          URL.revokeObjectURL(img.src);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("That file isn't a picture"));
        img.src = URL.createObjectURL(file);
      });
    }

    document.getElementById("pfpFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = ""; // lets the same file be picked again
      if (!file) return;
      try {
        say(pfpMsg, "Saving...", true);
        await Auth.setPicture(await shrink(file));
        showPicture();
        say(pfpMsg, "Profile picture saved!", true);
      } catch (err) {
        say(pfpMsg, err.message);
      }
    });

    document.getElementById("pfpRemove").addEventListener("click", async () => {
      try {
        await Auth.setPicture("");
        showPicture();
        say(pfpMsg, "Profile picture removed", true);
      } catch (err) {
        say(pfpMsg, err.message);
      }
    });

    showPicture();

    // ----- Username -----
    const newName = document.getElementById("newName");
    const nameMsg = document.getElementById("nameMsg");
    newName.value = Auth.getUser().name;

    document.getElementById("nameForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await Auth.changeName(newName.value);
        newName.value = Auth.getUser().name;
        showPicture(); // the letter in the circle may have changed
        say(nameMsg, "Username changed!", true);
      } catch (err) {
        say(nameMsg, err.message);
      }
    });

    // ----- Password -----
    const passForm = document.getElementById("passForm");
    const passMsg = document.getElementById("passMsg");

    passForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const next = document.getElementById("newPass").value;
      if (next !== document.getElementById("confirmPass").value) {
        return say(passMsg, "The new passwords don't match");
      }
      try {
        await Auth.changePassword(document.getElementById("currentPass").value, next);
        passForm.reset();
        say(passMsg, "Password changed!", true);
      } catch (err) {
        say(passMsg, err.message);
      }
    });
  })();

  // ==================== Ban / timeout page ====================
  if (PAGE === "banned") (() => {
    const title = document.getElementById("banTitle");
    let finished = false;
    Auth.takeNotice(); // this screen explains it, so the sign-in page doesn't need to later

    function countdown(ms) {
      const s = Math.max(0, Math.ceil(ms / 1000));
      const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
      if (d) return `${d}d ${h}h ${m}m`;
      if (h) return `${h}h ${m}m ${s % 60}s`;
      return `${m}m ${s % 60}s`;
    }

    if (!Auth.getUser()) return location.replace("login");
    let status = null;

    // Asks the server every few seconds: shows the ban, and goes back
    // to the site as soon as it's lifted
    async function check() {
      if (finished) return;
      try {
        status = await Auth.blockedStatus();
      } catch (err) {
        return; // signed out (handled by Auth) or offline: try again next time
      }
      if (!status) {
        finished = true;
        title.textContent = "You're Free!";
        document.body.classList.remove("ban-page");
        document.getElementById("banDone").textContent = "Your ban or timeout is over. Taking you back...";
        setTimeout(() => location.replace("./"), 1500);
        return;
      }
      draw();
    }

    // Redraws the screen (every second, so the timeout countdown ticks)
    function draw() {
      if (finished || !status) return;
      const isBan = status.type === "ban";
      title.textContent = isBan ? "You're Banned" : "You're Timed Out";
      document.title = (isBan ? "Banned" : "Timed Out") + " - Roxy Games";
      document.getElementById("banName").replaceChildren("Account: ", Auth.nameTag(status.name, status.role, status.badges));
      document.getElementById("banReason").textContent = status.reason || "No reason given";
      document.getElementById("banWhenLabel").textContent = isBan ? "Banned on" : "Ends at";
      document.getElementById("banWhen").textContent = Auth.staff.formatTime(isBan ? status.at : status.until);
      document.getElementById("banWhenRow").hidden = isBan && !status.at;
      document.getElementById("banLeftRow").hidden = isBan;
      if (!isBan) document.getElementById("banLeft").textContent = countdown(status.until - Date.now());
      document.getElementById("banHelp").textContent = isBan
        ? "If you think this is a mistake, talk to a staff member."
        : "You can sign in again when the timer runs out. This page will refresh by itself.";
    }

    check();
    setInterval(check, 5000);
    setInterval(() => {
      if (status && status.type === "timeout" && status.until <= Date.now()) check(); // timer ran out
      draw();
    }, 1000);
  })();

  // ==================== Staff Panel ====================
  // Only people with a staff role can get in, and they also need the number-pad
  // code. Both are checked by the server, so they can't be faked.
  // Owner, Manager and Developer can manage anyone (themselves too); other staff
  // only people ranked below them. Only the Owner can manage an Owner.
  // These rules match the server's (netlify/functions/api.mts), which has the final say.
  if (PAGE === "staff") (() => {
    const form = document.getElementById("staffLogin");
    const input = document.getElementById("staffCode");
    const error = document.getElementById("staffError");
    const panel = document.getElementById("staffPanel");
    const me = Auth.getUser();
    const TOP_ROLES = ["Owner", "Manager", "Developer"];
    const rankOf = (role) => Auth.ROLES.indexOf(role);

    function canManage(u) {
      if (u.role === "Owner" && me.role !== "Owner") return false;
      if (TOP_ROLES.includes(me.role)) return true;
      if (TOP_ROLES.includes(u.role)) return false;
      return rankOf(me.role) < rankOf(u.role);
    }

    function canGiveRole(role) {
      if (role === "Owner") return me.role === "Owner";
      if (TOP_ROLES.includes(me.role)) return true;
      return rankOf(role) > rankOf(me.role) && !TOP_ROLES.includes(role);
    }
    let checking = false;

    // Not staff: show the "staff only" screen instead of the number pad
    if (!Auth.staff.isStaff(me)) {
      form.hidden = true;
      document.getElementById("staffOnly").hidden = false;
      return;
    }

    function openPanel() {
      form.hidden = true;
      panel.hidden = false;
      document.getElementById("historyOpen").hidden = false;
      document.body.classList.add("staff-dark");
      loadUsers();
    }

    // ----- Tabs -----
    let view = "users";
    document.getElementById("staffTabs").addEventListener("click", (e) => {
      const tab = e.target.closest("button");
      if (!tab) return;
      view = tab.dataset.view;
      document.querySelectorAll("#staffTabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".staff-view").forEach((v) => { v.hidden = v.dataset.view !== view; });
      if (view === "reports") loadReports();
      if (view === "broadcasts") loadBroadcasts();
      if (view === "abuse") loadAbuse();
    });
    // Admin Abuse is only for the Owner (the server checks this too)
    if (me.role !== "Owner") document.getElementById("abuseTab").remove();

    // ----- Pop-up for actions -----
    const modal = document.getElementById("staffModal");
    const modalForm = document.getElementById("modalForm");
    const modalFields = document.getElementById("modalFields");
    const modalError = document.getElementById("modalError");
    const modalOk = document.getElementById("modalOk");
    let modalRun = null;

    // fields: [{ id, label, type ("text" | "select" | "checkbox"), value, options: [[value, label]] }]
    // run(values) does the action and returns the message to show after
    function ask({ title, text = "", fields = [], okText = "OK", danger = false, run }) {
      document.getElementById("modalTitle").textContent = title;
      document.getElementById("modalText").textContent = text;
      modalFields.innerHTML = "";
      for (const f of fields) {
        const label = document.createElement("label");
        label.htmlFor = "field-" + f.id;
        label.textContent = f.label;
        if (f.type === "checkbox") {
          // Tick box with its label next to it (value is "on" when ticked)
          const box = document.createElement("input");
          box.type = "checkbox";
          box.id = "field-" + f.id;
          box.name = f.id;
          box.checked = !!f.value;
          label.className = "modal-check";
          label.prepend(box);
          modalFields.appendChild(label);
          continue;
        }
        let field;
        if (f.type === "select") {
          field = document.createElement("select");
          for (const [value, name] of f.options) field.add(new Option(name, value));
        } else {
          field = document.createElement("input");
          field.type = "text";
          field.autocomplete = "off";
          if (f.placeholder) field.placeholder = f.placeholder;
          if (f.maxLength) field.maxLength = f.maxLength;
        }
        field.id = "field-" + f.id;
        field.name = f.id;
        field.value = f.value || field.value;
        if (f.required) field.required = true;
        modalFields.append(label, field);
      }
      modalOk.textContent = okText;
      modalOk.classList.toggle("danger", danger);
      modalError.textContent = "";
      modalRun = run;
      modal.hidden = false;
      (modalFields.querySelector("input, select") || modalOk).focus();
    }

    function closeModal() {
      modal.hidden = true;
      modalRun = null;
    }

    modalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(modalForm));
      for (const k in values) values[k] = values[k].trim();
      try {
        modalOk.disabled = true;
        const message = await modalRun(values);
        closeModal();
        afterAction(message);
      } catch (err) {
        modalError.textContent = err.message;
      } finally {
        modalOk.disabled = false;
      }
    });

    document.getElementById("modalCancel").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

    // ----- Users -----
    const userList = document.getElementById("userList");
    const search = document.getElementById("userSearch");
    const staffMsg = document.getElementById("staffMsg");
    const reportsMsg = document.getElementById("reportsMsg");
    const historyPanel = document.getElementById("historyPanel");
    let users = [];

    function afterAction(message) {
      for (const el of [staffMsg, reportsMsg]) {
        el.textContent = message || "";
        el.classList.add("ok");
      }
      refreshAll();
    }

    function showError(err) {
      for (const el of [staffMsg, reportsMsg]) {
        el.classList.remove("ok");
        el.textContent = err.message;
      }
    }

    // After anything changes, reload whatever is showing
    function refreshAll() {
      loadUsers();
      if (view === "reports") loadReports();
      if (!historyPanel.hidden) loadHistory();
    }

    // Runs a quick action that doesn't need the pop-up
    async function now(action, message) {
      try {
        await action();
        afterAction(message);
      } catch (err) {
        showError(err);
        loadUsers(); // put the role menu / tick boxes back how they really are
      }
    }

    async function loadUsers() {
      try {
        users = await Auth.staff.list();
        renderUsers();
        if (view === "reports") renderReports();
      } catch (err) {
        showError(err);
      }
    }

    const TIMEOUTS = [["5", "5 minutes"], ["10", "10 minutes"], ["30", "30 minutes"], ["60", "1 hour"], ["360", "6 hours"], ["1440", "1 day"], ["10080", "1 week"]];
    const reasonField = (required) => ({ id: "reason", label: required ? "Reason" : "Reason (optional)", placeholder: "Why?", maxLength: 200, required });

    // The buttons for one user: [label, what it does, extra class]
    function actionsFor(u) {
      const S = Auth.staff;
      const isYou = u.uid === me.uid;
      // Extra warning when it's your own account
      const careful = (text, what) => (isYou ? `This is YOUR account! ${what} ` : "") + text;
      return [
        u.banned
          ? ["UNBAN", () => now(() => S.unban(u.uid), `Unbanned ${u.name}`)]
          : ["BAN", () => ask({
            title: `Ban ${u.name}`,
            text: careful("Signs them out and blocks signing in until they're unbanned.", "You'd be locked out until another top staff member unbans you."),
            fields: [reasonField(false)],
            okText: "Ban",
            danger: true,
            run: async (v) => { await S.ban(u.uid, v.reason); return `Banned ${u.name}`; },
          }), "danger"],
        ["KICK", () => ask({
          title: `Kick ${u.name}`,
          text: "Signs them out everywhere. They can sign back in straight away.",
          okText: "Kick",
          run: async () => { await S.kick(u.uid); return `Kicked ${u.name}`; },
        })],
        u.timeoutUntil
          ? ["END TIMEOUT", () => now(() => S.endTimeout(u.uid), `Ended ${u.name}'s timeout`)]
          : ["TIMEOUT", () => ask({
            title: `Time out ${u.name}`,
            text: careful("Blocks them from using the site until the time is up.", "You'd be locked out until it ends."),
            fields: [{ id: "minutes", label: "How long", type: "select", options: TIMEOUTS, value: "10" }, reasonField(false)],
            okText: "Time out",
            run: async (v) => { await S.timeout(u.uid, Number(v.minutes), v.reason); return `Timed out ${u.name}`; },
          })],
        ["WARN", () => ask({
          title: `Warn ${u.name}`,
          text: "They'll see this message the next time they open a page.",
          fields: [reasonField(true)],
          okText: "Send warning",
          run: async (v) => { await S.warn(u.uid, v.reason); return `Warned ${u.name}`; },
        })],
        u.warnings.length && ["CLEAR WARNINGS", () => now(() => S.clearWarnings(u.uid), `Cleared ${u.name}'s warnings`)],
        ["USERNAME", () => ask({
          title: `Change ${u.name}'s username`,
          fields: [{ id: "name", label: "New username", value: u.name, maxLength: 20, required: true }],
          okText: "Change username",
          run: async (v) => { await S.rename(u.uid, v.name); return `Renamed ${u.name} to ${v.name}`; },
        })],
        ["PASSWORD", () => ask({
          title: `Change ${u.name}'s password`,
          text: "Tell them the new password so they can sign in.",
          fields: [{ id: "password", label: "New password", placeholder: "At least 4 characters", required: true }],
          okText: "Change password",
          run: async (v) => { await S.setPassword(u.uid, v.password); return `Changed ${u.name}'s password`; },
        })],
        ["DELETE", () => ask({
          title: `Delete ${u.name}?`,
          text: careful("This removes the account forever. It can't be undone.", "Your account and role would be gone."),
          okText: "Delete forever",
          danger: true,
          run: async () => { await S.remove(u.uid); return `Deleted ${u.name}`; },
        }), "danger"],
      ].filter(Boolean);
    }

    function badge(text, kind, title) {
      const b = document.createElement("span");
      b.className = "user-badge " + kind;
      b.textContent = text;
      if (title) b.title = title;
      return b;
    }

    // Role picker right next to the username; saves as soon as it's changed.
    // Greyed-out roles are ones you're not allowed to give.
    function roleSelect(u) {
      const select = document.createElement("select");
      select.className = "role-select " + Auth.roleClass(u.role);
      select.setAttribute("aria-label", `${u.name}'s role`);
      for (const role of Auth.ROLES) {
        const option = new Option(role, role);
        option.disabled = role !== u.role && !canGiveRole(role);
        select.add(option);
      }
      select.value = u.role;
      select.disabled = !canManage(u);
      select.addEventListener("change", () => {
        if (u.uid === me.uid && !confirm(`Change YOUR OWN role to ${select.value}? You might not be able to change it back.`)) {
          select.value = u.role;
          return;
        }
        now(() => Auth.staff.setRole(u.uid, select.value), `${u.name} is now ${select.value}`);
      });
      return select;
    }

    // Badge picker next to the role: tick any number of badges, saves straight away
    let openPicker = null; // whose picker is open, so it stays open while ticking
    function badgePicker(u) {
      const picker = document.createElement("details");
      picker.className = "badge-picker";
      picker.open = openPicker === u.uid;
      picker.addEventListener("toggle", () => {
        if (picker.open) openPicker = u.uid;
        else if (openPicker === u.uid) openPicker = null;
      });

      const summary = document.createElement("summary");
      summary.textContent = `BADGES${u.badges.length ? ` (${u.badges.length})` : ""}`;
      const menu = document.createElement("div");
      menu.className = "badge-menu";
      for (const b of Auth.BADGES) {
        const label = document.createElement("label");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = u.badges.includes(b.id);
        box.disabled = b.id === "owner" && me.role !== "Owner"; // only the Owner gives the Owner badge
        box.addEventListener("change", () => {
          now(() => Auth.staff.setBadge(u.uid, b.id, box.checked),
            box.checked ? `Gave ${u.name} the ${b.name} badge` : `Took ${b.name} badge from ${u.name}`);
        });
        const icon = document.createElement("span");
        icon.className = "badge-menu-icon";
        icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${b.svg}</svg>`;
        label.append(box, icon, b.name);
        menu.appendChild(label);
      }
      picker.append(summary, menu);
      return picker;
    }

    // Close the open badge picker when clicking somewhere else
    document.addEventListener("click", (e) => {
      if (openPicker && !e.target.closest(".badge-picker")) {
        openPicker = null;
        document.querySelectorAll(".badge-picker[open]").forEach((p) => { p.open = false; });
      }
    });

    function renderUsers() {
      if (panel.hidden) return;
      const q = search.value.trim().toLowerCase();
      const shown = users.filter((u) => u.name.toLowerCase().includes(q));

      document.getElementById("userCount").textContent = `${users.length} account${users.length === 1 ? "" : "s"}`;
      userList.innerHTML = "";
      if (!shown.length) {
        const empty = document.createElement("p");
        empty.className = "staff-placeholder";
        empty.textContent = users.length ? "No users match that search." : "No accounts yet.";
        userList.appendChild(empty);
        return;
      }

      for (const u of shown) {
        const isYou = me.uid === u.uid;
        const manageable = canManage(u);
        const row = document.createElement("div");
        row.className = "user-row" + (u.banned ? " is-banned" : "");

        const avatar = document.createElement("div");
        avatar.className = "user-avatar";
        if (u.picture) {
          const img = document.createElement("img");
          img.src = u.picture;
          img.alt = "";
          avatar.appendChild(img);
        } else {
          avatar.textContent = u.name.charAt(0).toUpperCase();
        }

        const info = document.createElement("div");
        info.className = "user-info";
        const name = document.createElement("div");
        name.className = "user-name";
        name.textContent = u.name;
        if (isYou) name.appendChild(badge("YOU", "you"));
        name.append(roleSelect(u), Auth.badgeIcons(u.badges));
        if (manageable) name.appendChild(badgePicker(u));
        const status = document.createElement("div");
        status.className = "user-status";
        if (u.banned) status.appendChild(badge("BANNED", "bad", u.banned.reason || "No reason given"));
        if (u.timeoutUntil) status.appendChild(badge(`TIMED OUT until ${Auth.staff.formatTime(u.timeoutUntil)}`, "warn", u.timeoutReason || "No reason given"));
        if (u.warnings.length) {
          status.appendChild(badge(`${u.warnings.length} WARNING${u.warnings.length === 1 ? "" : "S"}`, "warn", u.warnings.map((w) => "• " + w.reason).join("\n")));
        }
        const joined = document.createElement("span");
        joined.textContent = u.created ? `Joined ${new Date(u.created).toLocaleDateString()}` : "";
        status.appendChild(joined);
        info.append(name, status);

        const actions = document.createElement("div");
        actions.className = "user-actions";
        if (manageable) {
          for (const [label, onClick, kind] of actionsFor(u)) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "tab" + (kind ? " " + kind : "");
            b.textContent = label;
            b.addEventListener("click", onClick);
            actions.appendChild(b);
          }
        } else {
          const note = document.createElement("span");
          note.className = "user-locked";
          note.textContent = isYou
            ? "Only Owner, Manager and Developer can manage their own account."
            : u.role === "Owner" ? "Only the Owner can manage the Owner." : "Same or higher role than you, so you can't manage them.";
          actions.appendChild(note);
        }

        row.append(avatar, info, actions);
        userList.appendChild(row);
      }
    }

    search.addEventListener("input", renderUsers);
    // Keep the list up to date (new sign-ups, timeouts running out...), but not while staff are using it
    setInterval(() => {
      const busy = panel.hidden || document.hidden || !modal.hidden || openPicker
        || (document.activeElement && document.activeElement.matches(".role-select, #userSearch"));
      if (busy) return;
      loadUsers();
      if (view === "reports") loadReports(); // new reports show up by themselves
      if (view === "broadcasts") loadBroadcasts();
      if (view === "abuse") loadAbuse();
    }, 8000);

    // ----- Reports/Bans tab -----
    let reports = [];
    let people = {}; // current name / role / badges of everyone in the reports
    const timeoutLabel = (minutes) => (TIMEOUTS.find(([m]) => Number(m) === minutes) || [, `${minutes} minutes`])[1];
    const ago = (ms) => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

    async function loadReports() {
      try {
        // Reports + the latest banned / timed out / warned info
        let data;
        [data, users] = await Promise.all([Auth.staff.reports(), Auth.staff.list()]);
        ({ reports, people } = data);
        renderReports();
      } catch (err) {
        showError(err);
      }
    }

    function el(tag, className, text) {
      const e = document.createElement(tag);
      if (className) e.className = className;
      if (text != null) e.textContent = text;
      return e;
    }

    function button(label, onClick, kind) {
      const b = el("button", "tab" + (kind ? " " + kind : ""), label);
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    }

    // Someone's name with role + badges (as they are now)
    function who(uid, fallbackName) {
      const p = people[uid] || users.find((u) => u.uid === uid);
      return p ? Auth.nameTag(p.name, p.role, p.badges) : el("span", "name-tag-name", fallbackName);
    }

    function fill(listId, countId, items, emptyText) {
      const list = document.getElementById(listId);
      document.getElementById(countId).textContent = items.length ? `(${items.length})` : "";
      list.innerHTML = "";
      if (!items.length) list.appendChild(el("p", "mod-empty", emptyText));
      else items.forEach((item) => list.appendChild(item));
    }

    // Pop-up to decide what happens with a report
    function decide(r, action) {
      const target = people[r.target.uid] || r.target;
      const fields = [];
      if (action === "timeout") fields.push({ id: "minutes", label: "How long", type: "select", options: TIMEOUTS, value: "10" });
      if (action !== "none") fields.push({ ...reasonField(action === "warn"), value: r.reason || "" });
      if (action !== "dismiss" && action !== "none") fields.push({ id: "deleteMessage", label: "Also delete the reported message", type: "checkbox", value: true });
      const titles = {
        dismiss: `Dismiss this report?`, none: `Delete ${target.name}'s message?`, warn: `Warn ${target.name}`,
        timeout: `Time out ${target.name}`, kick: `Kick ${target.name}`, ban: `Ban ${target.name}`,
      };
      const done = {
        dismiss: "Report dismissed", none: "Message deleted", warn: `Warned ${target.name}`,
        timeout: `Timed out ${target.name}`, kick: `Kicked ${target.name}`, ban: `Banned ${target.name}`,
      };
      ask({
        title: titles[action],
        text: action === "dismiss" ? "Nothing happens to them. You can undo this from History." : "You can undo this later from History.",
        fields,
        okText: action === "dismiss" ? "Dismiss" : "Do it",
        danger: action === "ban",
        run: async (v) => {
          await Auth.staff.resolveReport(r.id, {
            action, reason: v.reason || "", minutes: Number(v.minutes || 0),
            deleteMessage: action === "none" || v.deleteMessage === "on",
          });
          return done[action];
        },
      });
    }

    function reportCard(r) {
      const card = el("div", "mod-card");
      const head = el("div", "mod-head");
      head.append(who(r.target.uid, r.target.name), el("span", "mod-meta", `reported by ${(people[r.reporter.uid] || r.reporter).name} · ${ago(r.at)}`));
      const quote = el("blockquote", "mod-quote", r.message.text);
      card.append(head, quote);
      if (r.reason) card.appendChild(el("p", "mod-reason", `Reason: ${r.reason}`));

      const actions = el("div", "user-actions");
      if (r.status === "open") {
        const target = people[r.target.uid] || users.find((u) => u.uid === r.target.uid);
        if (target && canManage(target)) {
          actions.append(
            button("BAN", () => decide(r, "ban"), "danger"),
            button("KICK", () => decide(r, "kick")),
            button("TIMEOUT", () => decide(r, "timeout")),
            button("WARN", () => decide(r, "warn")),
            button("DELETE MESSAGE", () => decide(r, "none")),
          );
        } else {
          actions.appendChild(el("span", "user-locked", target ? "Same or higher role than you, so you can only dismiss this." : "Their account is gone."));
        }
        actions.appendChild(button("DISMISS", () => decide(r, "dismiss")));
      } else {
        const res = r.resolution || {};
        const verb = { dismiss: "Dismissed", none: "Message deleted", warn: "Warned", timeout: "Timed out", kick: "Kicked", ban: "Banned" }[res.action] || "Closed";
        actions.appendChild(el("span", "mod-outcome " + (res.action === "dismiss" ? "" : "bad"),
          `${verb}${res.deleteMessage && res.action !== "none" ? " + message deleted" : ""} by ${res.by} · ${ago(res.at)}`));
      }
      card.appendChild(actions);
      return card;
    }

    function personRow(u, details, actions) {
      const card = el("div", "mod-card mod-person");
      const head = el("div", "mod-head");
      head.appendChild(who(u.uid, u.name));
      card.appendChild(head);
      for (const d of details) card.appendChild(d);
      const row = el("div", "user-actions");
      if (canManage(u)) actions.forEach((a) => row.appendChild(a));
      else row.appendChild(el("span", "user-locked", "Same or higher role than you."));
      card.appendChild(row);
      return card;
    }

    function renderReports() {
      const open = reports.filter((r) => r.status === "open");
      const closed = reports.filter((r) => r.status !== "open").slice(0, 50);
      fill("openReports", "openCount", open.map(reportCard), "No reports right now. Nice!");
      fill("closedReports", "closedCount", closed.map(reportCard), "No closed reports yet.");

      const S = Auth.staff;
      fill("bannedList", "bannedCount", users.filter((u) => u.banned).map((u) => personRow(u,
        [el("p", "mod-reason", `Reason: ${u.banned.reason || "No reason given"}`)],
        [button("UNBAN", () => now(() => S.unban(u.uid), `Unbanned ${u.name}`))])), "Nobody is banned.");

      fill("timeoutList", "timeoutCount", users.filter((u) => u.timeoutUntil).map((u) => personRow(u,
        [el("p", "mod-reason", `Until ${ago(u.timeoutUntil)} · Reason: ${u.timeoutReason || "No reason given"}`)],
        [button("END TIMEOUT", () => now(() => S.endTimeout(u.uid), `Ended ${u.name}'s timeout`))])), "Nobody is timed out.");

      const warned = users.filter((u) => u.warnings.length).sort((a, b) => b.warnings.length - a.warnings.length);
      fill("warnedList", "warnedCount", warned.map((u) => {
        const list = el("ul", "mod-warnings");
        for (const w of u.warnings) {
          const li = el("li", "", `${ago(w.at)}: ${w.reason}`);
          if (canManage(u)) {
            const x = button("✕", () => now(() => S.removeWarning(u.uid, w.at), `Removed a warning from ${u.name}`), "mod-x");
            x.title = "Remove this warning";
            li.appendChild(x);
          }
          list.appendChild(li);
        }
        const count = el("p", "mod-reason", `${u.warnings.length} warning${u.warnings.length === 1 ? "" : "s"}`);
        return personRow(u, [count, list], [button("CLEAR ALL", () => now(() => S.clearWarnings(u.uid), `Cleared ${u.name}'s warnings`))]);
      }), "Nobody has warnings.");
    }

    // ----- Broadcasts tab -----
    const broadcastForm = document.getElementById("broadcastForm");
    const broadcastText = document.getElementById("broadcastText");
    const broadcastMsg = document.getElementById("broadcastMsg");
    const broadcastCount = document.getElementById("broadcastCount");

    async function loadBroadcasts() {
      try {
        const sent = await Auth.staff.broadcasts();
        fill("sentBroadcasts", "sentCount", sent.map((b) => {
          const card = el("div", "mod-card mod-broadcast");
          const head = el("div", "mod-head");
          head.append(Auth.nameTag(b.from.name, b.from.role, b.from.badges), el("span", "mod-meta", ago(b.at)));
          card.append(head, el("blockquote", "mod-quote", b.text));
          return card;
        }), "No broadcasts yet.");
      } catch (err) {
        broadcastMsg.classList.remove("ok");
        broadcastMsg.textContent = err.message;
      }
    }

    async function sendBroadcast() {
      const text = broadcastText.value.trim();
      broadcastMsg.classList.remove("ok");
      if (!text) return (broadcastMsg.textContent = "Type a message first.");
      if (typeof BadWords !== "undefined" && BadWords.checkMessage(text)) return (broadcastMsg.textContent = "Your message has words that aren't allowed.");
      const send = document.getElementById("broadcastSend");
      try {
        send.disabled = true;
        await Auth.staff.broadcast(text);
        broadcastText.value = "";
        broadcastCount.textContent = "0/300";
        broadcastMsg.classList.add("ok");
        broadcastMsg.textContent = "Sent! Everyone will see it within 10 seconds.";
        Auth.checkNow(); // show it here straight away
        loadBroadcasts();
        if (!historyPanel.hidden) loadHistory();
      } catch (err) {
        broadcastMsg.textContent = err.message;
      } finally {
        send.disabled = false;
      }
    }

    broadcastForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendBroadcast();
    });
    // Enter sends, Shift+Enter makes a new line
    broadcastText.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBroadcast();
      }
    });
    broadcastText.addEventListener("input", () => { broadcastCount.textContent = `${broadcastText.value.length}/300`; });

    // ----- Admin Abuse tab (Owner only) -----
    // [id, emoji, name]. The ids match Admin Abuse above and the server.
    const ABUSE = {
      music: [["sushi", "🍣", "Sushi"], ["tacos", "🌮", "Tacos"], ["pop", "🎤", "Pop"], ["heavy", "🔊", "HEAVY"], ["casual", "☕", "Casual"]],
      effects: [["disco", "🪩", "Disco FX"], ["confetti", "🎉", "Confetti FX"], ["lightning", "⚡", "Lightning FX"], ["sushi", "🍣", "Sushi FX"], ["taco", "🌮", "Taco FX"]],
      sounds: [
        ["airhorn", "📯", "Air Horn"], ["badumtss", "🥁", "Ba Dum Tss"], ["boom", "💥", "Boom"], ["siren", "🚨", "Siren"],
        ["laser", "🛸", "Laser"], ["drumroll", "🪘", "Drum Roll"], ["applause", "👏", "Applause"], ["wrong", "❌", "Wrong"],
      ],
      controls: [
        ["stop-music", "⏹️", "STOP MUSIC", "Stopped the music"], ["stop-effects", "🚫", "STOP EFFECTS", "Turned off every effect"],
        ["all-effects", "▶️", "START ALL EFFECTS", "Turned on every effect"], ["stop-all", "🛑", "STOP EVERYTHING", "Stopped all Admin Abuse"],
      ],
    };
    const abuseMsg = document.getElementById("abuseMsg");
    let abuseState = { music: null, effects: [] };

    function abuseButton(emoji, name, onClick, kind) {
      const b = el("button", "abuse-btn" + (kind ? " " + kind : ""));
      b.type = "button";
      b.append(el("span", "abuse-emoji", emoji), el("span", "", name));
      b.addEventListener("click", onClick);
      return b;
    }

    function markOn(b, on) {
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.appendChild(el("span", "abuse-state", on ? "ON" : "OFF"));
      return b;
    }

    function renderAbuse() {
      const fillGrid = (id, items) => {
        const grid = document.getElementById(id);
        grid.innerHTML = "";
        items.forEach((b) => grid.appendChild(b));
      };
      fillGrid("abuseMusic", ABUSE.music.map(([id, emoji, name]) => {
        const on = abuseState.music === id;
        return markOn(abuseButton(emoji, name, () => abuseDo({ action: "music", id, on: !on }, on ? `Stopped ${name}` : `Playing ${name} for everyone`)), on);
      }));
      fillGrid("abuseEffects", ABUSE.effects.map(([id, emoji, name]) => {
        const on = abuseState.effects.includes(id);
        return markOn(abuseButton(emoji, name, () => abuseDo({ action: "effect", id, on: !on }, on ? `Turned off ${name}` : `Turned on ${name}`)), on);
      }));
      fillGrid("abuseSounds", ABUSE.sounds.map(([id, emoji, name]) => abuseButton(emoji, name, () => abuseDo({ action: "sound", id }, `Played ${name} for everyone`))));
      fillGrid("abuseControls", ABUSE.controls.map(([action, emoji, name, done]) => abuseButton(emoji, name, () => abuseDo({ action }, done), action === "all-effects" ? "" : "stop")));
    }

    async function loadAbuse() {
      try {
        abuseState = await Auth.staff.abuse();
        renderAbuse();
      } catch (err) {
        abuseMsg.classList.remove("ok");
        abuseMsg.textContent = err.message;
      }
    }

    async function abuseDo(body, message) {
      try {
        abuseState = await Auth.staff.abuseDo(body);
        renderAbuse();
        abuseMsg.classList.add("ok");
        abuseMsg.textContent = message;
        Auth.checkNow(); // see and hear it here straight away
        if (!historyPanel.hidden) loadHistory();
      } catch (err) {
        abuseMsg.classList.remove("ok");
        abuseMsg.textContent = err.message;
      }
    }

    // ----- History side tab -----
    const BADGE_NAMES = Object.fromEntries(Auth.BADGES.map((b) => [b.id, b.name]));

    // "Roxy banned Gamer_2010" etc.
    function describe(e) {
      const t = e.target.name, i = e.info || {};
      const why = i.reason ? `: "${i.reason}"` : "";
      switch (e.action) {
        case "warn": return `warned ${t}${why}`;
        case "remove-warning": return `removed a warning from ${t}${why}`;
        case "clear-warnings": return `cleared ${i.count} warning${i.count === 1 ? "" : "s"} from ${t}`;
        case "kick": return `kicked ${t}`;
        case "timeout": return `timed out ${t} for ${timeoutLabel(i.minutes)}${why}`;
        case "end-timeout": return `ended ${t}'s timeout`;
        case "ban": return `banned ${t}${why}`;
        case "unban": return `unbanned ${t}`;
        case "rename": return `renamed ${i.from} to ${i.to}`;
        case "password": return `changed ${t}'s password`;
        case "role": return `changed ${t}'s role from ${i.from} to ${i.to}`;
        case "badge": return i.on ? `gave ${t} the ${BADGE_NAMES[i.badge]} badge` : `took the ${BADGE_NAMES[i.badge]} badge from ${t}`;
        case "delete": return `deleted ${t}'s account`;
        case "delete-message": return `deleted a message from ${t}: "${i.text}"`;
        case "dismiss-report": return `dismissed a report about ${t}`;
        case "broadcast": return `broadcast: "${i.text}"`;
        case "abuse": return `${i.text} (Admin Abuse)`;
        default: return `${e.action} ${t}`;
      }
    }

    async function loadHistory() {
      const list = document.getElementById("historyList");
      try {
        const entries = await Auth.staff.history();
        list.innerHTML = "";
        if (!entries.length) list.appendChild(el("p", "mod-empty", "Nothing has happened yet."));
        for (const e of entries) {
          const item = el("div", "history-item" + (e.undone ? " is-undone" : ""));
          const line = el("p", "history-line");
          line.append(el("strong", "", e.by.name), " " + describe(e));
          if (e.reportId) line.appendChild(el("span", "history-tag", "REPORT"));
          const meta = el("div", "history-meta");
          meta.appendChild(el("span", "", ago(e.at)));
          if (e.undone) meta.appendChild(el("span", "history-undone", `Undone by ${e.undone.by}`));
          else if (e.canUndo) meta.appendChild(button("UNDO", () => undoEntry(e)));
          else meta.appendChild(el("span", "history-undone", "Can't be undone"));
          item.append(line, meta);
          list.appendChild(item);
        }
      } catch (err) {
        document.getElementById("historyMsg").textContent = err.message;
      }
    }

    async function undoEntry(e) {
      const msg = document.getElementById("historyMsg");
      try {
        await Auth.staff.undo(e.id);
        msg.classList.add("ok");
        msg.textContent = `Undid: ${e.by.name} ${describe(e)}`;
        refreshAll();
      } catch (err) {
        msg.classList.remove("ok");
        msg.textContent = err.message;
      }
    }

    function showHistory(show) {
      historyPanel.hidden = !show;
      document.getElementById("historyOpen").hidden = show;
      document.getElementById("historyMsg").textContent = "";
      if (show) loadHistory();
    }
    document.getElementById("historyOpen").addEventListener("click", () => showHistory(true));
    document.getElementById("historyClose").addEventListener("click", () => showHistory(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !historyPanel.hidden && modal.hidden) showHistory(false); });

    // ----- Number pad -----
    async function check() {
      checking = true;
      try {
        await Auth.staff.unlock(input.value);
        openPanel();
      } catch (err) {
        error.textContent = err.message;
        input.value = "";
        form.classList.remove("shake");
        void form.offsetWidth; // restart the shake animation
        form.classList.add("shake");
      } finally {
        checking = false;
      }
    }

    // Digits add to the code, and it checks itself once 4 are in
    function press(key) {
      if (!panel.hidden || checking) return;
      error.textContent = "";
      if (key === "clear") input.value = "";
      else if (key === "back") input.value = input.value.slice(0, -1);
      else if (input.value.length < 4) input.value += key;
      if (input.value.length === 4) setTimeout(check, 150); // brief pause so the 4th dot shows
    }

    document.getElementById("keypad").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) press(btn.dataset.key);
    });

    // Typing on the keyboard works too
    document.addEventListener("keydown", (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Escape") press("clear");
    });

    form.addEventListener("submit", (e) => e.preventDefault());
  })();
}
