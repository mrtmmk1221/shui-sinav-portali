/* =========================================================
   Soru Bankası — app.js (Vanilla JS, harici kütüphane yok)
   Bölümler: Util · Store · Data · Session · Views · Events
   ========================================================= */
(() => {
  'use strict';

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const DATA_URL = 'sorular.json';
  const DEFAULT_SECONDS_PER_QUESTION = 75;

  /* ---------------------------------------------------------
     Util
     --------------------------------------------------------- */
  const Util = {
    $: (sel, root = document) => root.querySelector(sel),
    $$: (sel, root = document) => [...root.querySelectorAll(sel)],
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    hash(str) { // kısa, kararlı kimlik üretir (djb2)
      let h = 5381;
      for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
      return h.toString(36);
    },
    fmtTime(sec) {
      sec = Math.max(0, Math.round(sec));
      return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    },
    pct: (a, b) => (b ? Math.round((a / b) * 100) : 0),
    el(tag, attrs = {}, ...children) {
      const node = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('data-')) node.setAttribute(k, v);
        else node[k] = v;
      }
      children.flat().forEach(c => c != null && node.append(c));
      return node;
    },
    mount(templateId) {
      const app = Util.$('#app');
      app.replaceChildren(Util.$('#' + templateId).content.cloneNode(true));
      window.scrollTo({ top: 0 });
      return app;
    },
  };

  /* ---------------------------------------------------------
     Store — localStorage ile kalıcı veri
     --------------------------------------------------------- */
  const Store = {
    KEY: 'sb_veri_v1',
    data: null,
    blank: () => ({ cevaplar: {}, yanlislar: [], testler: [], tercih: {} }),
    load() {
      try { this.data = Object.assign(this.blank(), JSON.parse(localStorage.getItem(this.KEY)) || {}); }
      catch (e) { this.data = this.blank(); }
    },
    save() {
      try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* gizli mod vb. */ }
      Views.updateBadge();
    },
    /** Bir sorunun sonucunu kaydeder. sonuc: 'dogru' | 'yanlis' | 'bos' */
    record(id, sonuc) {
      const c = this.data.cevaplar[id] || (this.data.cevaplar[id] = { d: 0, y: 0 });
      if (sonuc === 'dogru') {
        c.d++;
        this.data.yanlislar = this.data.yanlislar.filter(x => x !== id);
      } else {
        c.y++;
        if (!this.data.yanlislar.includes(id)) this.data.yanlislar.push(id);
      }
      c.son = sonuc;
    },
    addTest(t) {
      this.data.testler.push(t);
      this.data.testler = this.data.testler.slice(-50);
    },
  };

  /* ---------------------------------------------------------
     Data — sorular.json okunur ve doğrulanır
     --------------------------------------------------------- */
  const Data = {
    meta: {},
    questions: [],
    byId: {},
    async load() {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.sorular;
      this.meta = Array.isArray(json) ? {} : json;
      this.questions = [];
      (list || []).forEach((raw, i) => {
        const q = this.normalize(raw, i);
        if (q) { this.questions.push(q); this.byId[q.id] = q; }
      });
      if (!this.questions.length) throw new Error('Geçerli soru bulunamadı');
    },
    normalize(raw, i) {
      const secenekler = Array.isArray(raw.secenekler) ? raw.secenekler.map(String) : [];
      const harf = String(raw.dogru || '').trim().toUpperCase();
      const dogru = LETTERS.indexOf(harf);
      if (!raw.soru || secenekler.length < 2 || dogru < 0 || dogru >= secenekler.length) {
        console.warn(`sorular.json: ${i + 1}. soru atlandı (soru, secenekler veya dogru alanı hatalı)`, raw);
        return null;
      }
      const kategori = String(raw.kategori || 'Genel').trim();
      let id = raw.id != null ? String(raw.id) : 'q' + Util.hash(kategori + '|' + raw.soru);
      while (this.byId[id]) id += '_'; // aynı soru iki kez yazılmışsa çakışmayı önle
      return {
        id, kategori,
        konu: String(raw.konu || 'Genel').trim(),
        soru: String(raw.soru),
        secenekler, dogru,
        aciklama: String(raw.aciklama || ''),
      };
    },
    categories() { return [...new Set(this.questions.map(q => q.kategori))]; },
    topics(kategori) {
      const pool = kategori ? this.questions.filter(q => q.kategori === kategori) : this.questions;
      return [...new Set(pool.map(q => q.konu))].sort((a, b) => a.localeCompare(b, 'tr'));
    },
    filter(kategori, konu) {
      return this.questions.filter(q => (!kategori || q.kategori === kategori) && (!konu || q.konu === konu));
    },
    secondsPerQuestion() { return Number(this.meta.soruBasinaSaniye) || DEFAULT_SECONDS_PER_QUESTION; },
  };

  /* ---------------------------------------------------------
     Session — aktif test
     --------------------------------------------------------- */
  const Session = {
    s: null,
    /** list: soru dizisi, opts: {mod, karistirSik, etiket} */
    start(list, opts) {
      const items = list.map(q => ({
        q,
        sira: opts.karistirSik ? Util.shuffle(q.secenekler.map((_, i) => i)) : q.secenekler.map((_, i) => i),
      }));
      const sinav = opts.mod === 'sinav';
      this.s = {
        mod: opts.mod, etiket: opts.etiket, karistirSik: opts.karistirSik,
        items, cevap: new Array(items.length).fill(null), // gösterilen şık indeksi
        idx: 0, basla: Date.now(), bitti: false,
        sure: sinav ? items.length * Data.secondsPerQuestion() : 0,
      };
      Timer.stop();
      Views.quiz();
      if (sinav) Timer.start(this.s.sure, () => this.finish());
    },
    current() { return this.s.items[this.s.idx]; },
    /** Gösterilen şıktan asıl şık indeksine */
    realIndex(item, shown) { return item.sira[shown]; },
    choose(shown) {
      const s = this.s; if (!s || s.bitti) return;
      const item = this.current();
      if (shown >= item.sira.length) return;
      if (s.mod === 'calisma') {
        if (s.cevap[s.idx] !== null) return; // çalışma modunda cevap kilitlenir
        s.cevap[s.idx] = shown;
        const ok = this.realIndex(item, shown) === item.q.dogru;
        Store.record(item.q.id, ok ? 'dogru' : 'yanlis');
        Store.save();
      } else {
        s.cevap[s.idx] = s.cevap[s.idx] === shown ? null : shown; // aynı şıkka tekrar basınca boşalt
      }
      Views.renderQuestion();
    },
    go(delta) {
      const s = this.s; if (!s) return;
      const n = s.idx + delta;
      if (n < 0) return;
      if (n >= s.items.length) { this.finish(); return; }
      s.idx = n;
      Views.renderQuestion();
    },
    jump(i) { if (this.s) { this.s.idx = i; Views.renderQuestion(); } },
    finish() {
      const s = this.s; if (!s || s.bitti) return;
      s.bitti = true; Timer.stop();
      let dogru = 0, yanlis = 0, bos = 0;
      s.items.forEach((item, i) => {
        const shown = s.cevap[i];
        if (shown === null) {
          bos++;
          if (s.mod === 'sinav') Store.record(item.q.id, 'bos');
        } else if (this.realIndex(item, shown) === item.q.dogru) {
          dogru++;
          if (s.mod === 'sinav') Store.record(item.q.id, 'dogru');
        } else {
          yanlis++;
          if (s.mod === 'sinav') Store.record(item.q.id, 'yanlis');
        }
      });
      s.sonuc = { dogru, yanlis, bos, toplam: s.items.length, yuzde: Util.pct(dogru, s.items.length), sureSn: Math.round((Date.now() - s.basla) / 1000) };
      Store.addTest({ tarih: new Date().toISOString(), etiket: s.etiket, mod: s.mod, ...s.sonuc });
      Store.save();
      Views.result();
    },
    /** Karnedeki "hatalı soruları tekrar çöz" */
    retryWrong() {
      const s = this.s; if (!s) return;
      const list = s.items.filter((item, i) => s.cevap[i] === null || this.realIndex(item, s.cevap[i]) !== item.q.dogru).map(it => it.q);
      if (list.length) this.start(list, { mod: s.mod, karistirSik: s.karistirSik, etiket: 'Hatalı sorular tekrarı' });
    },
  };

  /* ---------------------------------------------------------
     Timer — sınav modu geri sayım
     --------------------------------------------------------- */
  const Timer = {
    id: null, bitis: 0,
    start(seconds, onEnd) {
      this.bitis = Date.now() + seconds * 1000;
      const tick = () => {
        const left = (this.bitis - Date.now()) / 1000;
        const el = Util.$('#q-timer');
        if (el) { el.textContent = '⏱ ' + Util.fmtTime(left); el.classList.toggle('is-low', left <= 60); }
        if (left <= 0) { this.stop(); onEnd(); }
      };
      tick();
      this.id = setInterval(tick, 500);
    },
    stop() { clearInterval(this.id); this.id = null; },
  };

  /* ---------------------------------------------------------
     Views — ekranlar
     --------------------------------------------------------- */
  const Views = {
    setNav(name) {
      Util.$$('.nav__btn').forEach(b => b.classList.toggle('is-active', b.dataset.action === name));
    },
    themeIcon() {
      const b = Util.$('[data-action="theme"]');
      if (b) b.textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '☾';
    },
    updateBadge() {
      const el = Util.$('#mistake-count');
      if (el && Store.data) el.textContent = Store.data.yanlislar.filter(id => Data.byId[id]).length;
    },

    /* ---------- Ana ekran ---------- */
    home() {
      Timer.stop(); Session.s = null;
      Util.mount('tpl-home'); this.setNav('home');
      const t = Store.data.tercih;
      const kSel = Util.$('#f-kategori'), konuSel = Util.$('#f-konu');

      kSel.replaceChildren(Util.el('option', { value: '', text: `Tüm kategoriler (${Data.questions.length})` }),
        ...Data.categories().map(k => Util.el('option', { value: k, text: `${k} (${Data.filter(k).length})` })));
      kSel.value = Data.categories().includes(t.kategori) ? t.kategori : '';

      const fillTopics = () => {
        konuSel.replaceChildren(Util.el('option', { value: '', text: 'Tüm konular' }),
          ...Data.topics(kSel.value).map(k => Util.el('option', { value: k, text: `${k} (${Data.filter(kSel.value, k).length})` })));
        konuSel.value = Data.topics(kSel.value).includes(t.konu) ? t.konu : '';
      };
      fillTopics();

      if (t.sayi != null) { const r = Util.$(`input[name=sayi][value="${t.sayi}"]`); if (r) r.checked = true; }
      if (t.mod) { const r = Util.$(`input[name=mod][value="${t.mod}"]`); if (r) r.checked = true; }
      if (t.karistirSoru != null) Util.$('#f-karistir-soru').checked = t.karistirSoru;
      if (t.karistirSik != null) Util.$('#f-karistir-sik').checked = t.karistirSik;

      const form = Util.$('#setup-form');
      const update = () => {
        const p = this.readForm();
        const n = Data.filter(p.kategori, p.konu).length;
        const adet = p.sayi ? Math.min(p.sayi, n) : n;
        Util.$('#f-ozet').textContent = `Bu seçimde ${n} soru var · ${adet} soru sorulacak`;
        Util.$('#mod-info').textContent = p.mod === 'sinav'
          ? `Süre: ${Util.fmtTime(adet * Data.secondsPerQuestion())} (soru başına ${Data.secondsPerQuestion()} sn). Sonuçlar sınav bitince gösterilir.`
          : 'Şıkkı seçtiğin an doğru/yanlış ve çözüm açıklaması görünür.';
        const m = Store.data.yanlislar.filter(id => Data.byId[id]).length;
        const mb = Util.$('#btn-mistake-test');
        mb.textContent = `Sadece yanlışlarımdan test (${m})`; mb.disabled = !m;
      };
      kSel.addEventListener('change', () => { t.konu = ''; fillTopics(); update(); });
      form.addEventListener('change', update);
      form.addEventListener('submit', e => { e.preventDefault(); this.startFromForm(); });
      update();
      this.renderStats();
    },
    readForm() {
      return {
        kategori: Util.$('#f-kategori').value,
        konu: Util.$('#f-konu').value,
        sayi: Number(Util.$('input[name=sayi]:checked').value),
        mod: Util.$('input[name=mod]:checked').value,
        karistirSoru: Util.$('#f-karistir-soru').checked,
        karistirSik: Util.$('#f-karistir-sik').checked,
      };
    },
    startFromForm() {
      const p = this.readForm();
      Store.data.tercih = p; Store.save();
      let list = Data.filter(p.kategori, p.konu);
      if (p.karistirSoru) list = Util.shuffle(list);
      if (p.sayi) list = list.slice(0, p.sayi);
      if (!list.length) return;
      const etiket = [p.kategori || 'Tüm kategoriler', p.konu].filter(Boolean).join(' · ');
      Session.start(list, { mod: p.mod, karistirSik: p.karistirSik, etiket });
    },
    startMistakeTest() {
      const t = Store.data.tercih;
      let list = Store.data.yanlislar.map(id => Data.byId[id]).filter(Boolean);
      if (!list.length) return;
      if (t.karistirSoru !== false) list = Util.shuffle(list);
      Session.start(list, { mod: t.mod || 'calisma', karistirSik: !!t.karistirSik, etiket: 'Yanlışlarım' });
    },
    renderStats() {
      const c = Store.data.cevaplar;
      const ids = Object.keys(c).filter(id => Data.byId[id]);
      const d = ids.reduce((a, id) => a + c[id].d, 0), y = ids.reduce((a, id) => a + c[id].y, 0);
      const stat = (v, l) => Util.el('div', { class: 'stat' }, Util.el('b', { text: v }), Util.el('span', { text: l }));
      Util.$('#stats').replaceChildren(
        stat(`${ids.length}/${Data.questions.length}`, 'Görülen soru'),
        stat('%' + Util.pct(d, d + y), 'Doğru oranı'),
        stat(String(Store.data.testler.length), 'Tamamlanan test'));

      Util.$('#cat-stats').replaceChildren(...Data.categories().map(k => {
        const qs = Data.filter(k);
        const mastered = qs.filter(q => c[q.id] && c[q.id].son === 'dogru').length;
        const p = Util.pct(mastered, qs.length);
        return Util.el('div', {},
          Util.el('div', { class: 'bar__head' }, Util.el('span', { text: k }), Util.el('b', { text: `%${p}` })),
          Util.el('div', { class: 'bar__track', title: `${mastered}/${qs.length} soruyu en son doğru çözdün` },
            Util.el('div', { class: 'bar__fill', style: `width:${p}%` })));
      }));

      const h = Util.$('#history');
      const tests = Store.data.testler.slice(-6).reverse();
      h.replaceChildren(...(tests.length ? tests.map(t => {
        const tone = t.yuzde >= 70 ? 'tone-ok' : t.yuzde >= 50 ? 'tone-warn' : 'tone-bad';
        const date = new Date(t.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        return Util.el('li', {},
          Util.el('span', { text: `${date} · ${t.mod === 'sinav' ? 'Sınav' : 'Çalışma'} · ${t.etiket || ''}` }),
          Util.el('b', { class: tone, text: `${t.dogru}/${t.toplam} · %${t.yuzde}` }));
      }) : [Util.el('li', { class: 'muted', text: 'Henüz test çözmedin.' })]));
    },

    /* ---------- Soru ekranı ---------- */
    quiz() {
      Util.mount('tpl-quiz'); this.setNav('');
      const s = Session.s;
      Util.$('#q-timer').classList.toggle('hidden', s.mod !== 'sinav');
      Util.$('#q-palette').classList.toggle('hidden', s.mod !== 'sinav');
      this.renderQuestion();
    },
    renderQuestion() {
      const s = Session.s; if (!s) return;
      const item = Session.current(), q = item.q, shown = s.cevap[s.idx];
      const study = s.mod === 'calisma', answered = shown !== null, last = s.idx === s.items.length - 1;

      Util.$('#q-count').textContent = `${s.idx + 1} / ${s.items.length}`;
      Util.$('#q-progress').style.width = Util.pct(s.idx + 1, s.items.length) + '%';
      Util.$('#q-meta').textContent = `${q.kategori} · ${q.konu}${Store.data.yanlislar.includes(q.id) ? ' · daha önce yanlış' : ''}`;
      Util.$('#q-text').textContent = q.soru;

      Util.$('#q-options').replaceChildren(...item.sira.map((real, i) => {
        let cls = 'option';
        if (study && answered) {
          if (real === q.dogru) cls += ' is-correct';
          else if (i === shown) cls += ' is-wrong';
        } else if (i === shown) cls += ' is-selected';
        return Util.el('button', {
          class: cls, type: 'button', 'data-action': 'choose', 'data-i': String(i),
          disabled: study && answered, role: 'radio', ariaChecked: String(i === shown),
        }, Util.el('span', { class: 'option__key', text: LETTERS[i] }), Util.el('span', { class: 'option__text', text: q.secenekler[real] }));
      }));

      const ex = Util.$('#q-explain');
      if (study && answered) {
        const ok = item.sira[shown] === q.dogru;
        const correctShown = item.sira.indexOf(q.dogru);
        ex.className = 'explain ' + (ok ? 'is-ok' : 'is-bad');
        ex.replaceChildren(
          Util.el('b', { text: ok ? '✓ Doğru!' : `✗ Yanlış. Doğru cevap: ${LETTERS[correctShown]}) ${q.secenekler[q.dogru]}` }),
          Util.el('p', { style: 'margin:0', text: q.aciklama || 'Bu soru için henüz çözüm açıklaması eklenmemiş.' }));
      } else ex.className = 'explain hidden';

      Util.$('#btn-next').textContent = last ? (study ? 'Testi Bitir' : 'Sınavı Bitir') : 'Sonraki →';

      if (!study) {
        Util.$('#palette-grid').replaceChildren(...s.items.map((_, i) => Util.el('button', {
          type: 'button', text: String(i + 1), 'data-action': 'jump', 'data-i': String(i),
          class: (s.cevap[i] !== null ? 'is-answered ' : '') + (i === s.idx ? 'is-current' : ''),
          ariaLabel: `${i + 1}. soru${s.cevap[i] !== null ? ', işaretli' : ', boş'}`,
        })));
      }
    },

    /* ---------- Karne ---------- */
    result() {
      Util.mount('tpl-result'); this.setNav('');
      const s = Session.s, r = s.sonuc;
      Util.$('#r-ring').style.setProperty('--p', r.yuzde);
      Util.$('#r-pct').textContent = '%' + r.yuzde;
      Util.$('#r-dogru').textContent = r.dogru;
      Util.$('#r-yanlis').textContent = r.yanlis;
      Util.$('#r-bos').textContent = r.bos;
      Util.$('#r-sure').textContent = Util.fmtTime(r.sureSn);
      const retry = Util.$('#btn-retry');
      retry.disabled = !(r.yanlis + r.bos);
      retry.textContent = r.yanlis + r.bos ? `Hatalı Soruları Tekrar Çöz (${r.yanlis + r.bos})` : 'Hatalı soru yok 🎉';

      Util.$('#review').replaceChildren(...s.items.map((item, i) => {
        const shown = s.cevap[i], q = item.q;
        const state = shown === null ? 'empty' : item.sira[shown] === q.dogru ? 'ok' : 'bad';
        return this.reviewCard(q, i + 1, state, shown === null ? null : item.sira[shown], state !== 'ok');
      }));
    },
    reviewCard(q, no, state, mine, open) {
      const body = Util.el('div', { class: 'review__body' },
        Util.el('div', { class: 'review__ans', text: `Doğru cevap: ${LETTERS[q.dogru]}) ${q.secenekler[q.dogru]}` }),
        mine != null && mine !== q.dogru ? Util.el('div', { class: 'review__mine', text: `Senin cevabın: ${LETTERS[mine]}) ${q.secenekler[mine]}` }) : null,
        state === 'empty' ? Util.el('div', { class: 'muted', text: 'Boş bıraktın.' }) : null,
        Util.el('div', { class: 'muted', text: q.aciklama || 'Açıklama eklenmemiş.' }));
      return Util.el('details', { open },
        Util.el('summary', {},
          Util.el('span', { class: 'review__dot ' + state, text: state === 'ok' ? '✓' : state === 'bad' ? '✗' : '–' }),
          Util.el('span', {}, Util.el('small', { class: 'muted', text: `${no ? no + '. soru · ' : ''}${q.kategori} · ${q.konu}` }), Util.el('div', { text: q.soru }))),
        body);
    },

    /* ---------- Yanlışlarım ---------- */
    mistakes() {
      Timer.stop(); Session.s = null;
      Util.mount('tpl-mistakes'); this.setNav('mistakes');
      const list = Store.data.yanlislar.map(id => Data.byId[id]).filter(Boolean);
      Util.$$('[data-action="mistake-test"], #btn-clear').forEach(b => { b.disabled = !list.length; });
      Util.$('#mistake-list').replaceChildren(...(list.length
        ? list.map(q => this.reviewCard(q, null, 'bad', null, false))
        : [Util.el('p', { class: 'empty-state', text: 'Hata defterin boş. Yanlış yaptığın sorular burada birikir.' })]));
    },

    error(msg) {
      Util.$('#app').replaceChildren(Util.el('div', { class: 'card' },
        Util.el('h1', { class: 'h1', text: 'Sorular yüklenemedi' }),
        Util.el('p', { text: msg }),
        Util.el('p', { class: 'muted', text: 'Dosyayı bilgisayarda çift tıklayarak açtıysan tarayıcı güvenlik nedeniyle sorular.json okunamaz. GitHub Pages üzerinden aç ya da klasörde "python -m http.server" çalıştırıp http://localhost:8000 adresine git.' })));
    },
  };

  /* ---------------------------------------------------------
     Events — tek noktadan tıklama ve klavye yönetimi
     --------------------------------------------------------- */
  let quitArmed = null;
  const actions = {
    home: () => Views.home(),
    mistakes: () => Views.mistakes(),
    theme: () => {
      const root = document.documentElement;
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('sb_tema', root.dataset.theme); } catch (e) { /* yok say */ }
      Views.themeIcon();
    },
    choose: btn => Session.choose(Number(btn.dataset.i)),
    jump: btn => Session.jump(Number(btn.dataset.i)),
    next: () => Session.go(1),
    prev: () => Session.go(-1),
    quit: btn => { // yanlışlıkla çıkmayı önlemek için iki adım
      const s = Session.s;
      if (s && !s.bitti && s.cevap.some(c => c !== null) && quitArmed !== btn) {
        quitArmed = btn; btn.textContent = 'Emin misin? Tekrar bas';
        setTimeout(() => { if (quitArmed === btn) { quitArmed = null; btn.textContent = '✕ Çık'; } }, 3000);
        return;
      }
      quitArmed = null; Views.home();
    },
    'retry-wrong': () => Session.retryWrong(),
    'mistake-test': () => Views.startMistakeTest(),
    'clear-mistakes': btn => {
      if (btn.dataset.armed) { Store.data.yanlislar = []; Store.save(); Views.mistakes(); return; }
      btn.dataset.armed = '1'; btn.textContent = 'Emin misin? Tekrar bas';
    },
  };

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const fn = actions[btn.dataset.action];
    if (fn) { e.preventDefault(); fn(btn); }
  });

  document.addEventListener('keydown', e => {
    const s = Session.s;
    if (!s || s.bitti || !Util.$('#q-options')) return;
    if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const i = 'abcdef'.indexOf(k) >= 0 ? 'abcdef'.indexOf(k) : '123456'.indexOf(k);
    if (i >= 0 && k.length === 1) { e.preventDefault(); Session.choose(i); }
    else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); Session.go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); Session.go(-1); }
  });

  /* ---------------------------------------------------------
     Başlat
     --------------------------------------------------------- */
  (async function init() {
    Store.load();
    try {
      await Data.load();
    } catch (err) {
      Views.error('Ayrıntı: ' + err.message);
      return;
    }
    if (Data.meta.baslik) { Util.$('#app-title').textContent = Data.meta.baslik; document.title = Data.meta.baslik; }
    if (Data.meta.aciklama) Util.$('#app-subtitle').textContent = Data.meta.aciklama;
    Views.themeIcon();
    Views.updateBadge();
    Views.home();
  })();
})();
