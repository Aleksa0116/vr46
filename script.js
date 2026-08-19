(() => {
    const qs = (s, el = document) => el.querySelector(s);
    const qsa = (s, el = document) => [...el.querySelectorAll(s)];

    const header = qs('[data-header]');
    const navbtn = qs('#navbtn');
    const mnav = qs('#mnav');
    const overlay = qs('[data-overlay]');
    const prog = qs('.navProgress span');

    let _rafPending = false;
    let _scrollY = window.scrollY;
    const _scrollTasks = [];

    function _onScroll() {
        _scrollY = window.scrollY;
        if (_rafPending) return;
        _rafPending = true;
        requestAnimationFrame(_runScrollTasks);
    }

    function _runScrollTasks() {
        _rafPending = false;
        const y = _scrollY;
        for (let i = 0; i < _scrollTasks.length; i++) _scrollTasks[i](y);
    }

    function addScrollTask(fn) { _scrollTasks.push(fn); }
    window.addEventListener('scroll', _onScroll, { passive: true });

    let _lastSolid = null;
    let _lastAtTop = null;

    function setHeader(y) {
        if (!header) return;
        const atTop = y <= 2;
        const solid = document.body.classList.contains('menu-open') || y > 12;
        if (atTop !== _lastAtTop) {
            header.classList.toggle('is-top', atTop);
            _lastAtTop = atTop;
        }
        if (solid !== _lastSolid) {
            header.classList.toggle('is-solid', solid);
            _lastSolid = solid;
        }
    }

    function syncTopbarH() {
        if (!header) return;
        const h = Math.round(header.getBoundingClientRect().height);
        document.documentElement.style.setProperty('--topbarH', h + 'px');
    }

    function closeMenu() {
        document.body.classList.remove('menu-open');
        navbtn?.setAttribute('aria-expanded', 'false');
        mnav?.setAttribute('aria-hidden', 'true');
        overlay?.setAttribute('aria-hidden', 'true');
        _lastSolid = null;
        setHeader(window.scrollY);
    }

    function openMenu() {
        document.body.classList.add('menu-open');
        navbtn?.setAttribute('aria-expanded', 'true');
        mnav?.setAttribute('aria-hidden', 'false');
        overlay?.setAttribute('aria-hidden', 'false');
        _lastSolid = null;
        setHeader(window.scrollY);
    }

    function toggleMenu() {
        document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
    }

    function bindSmoothScroll() {
        qsa('[data-scroll]').forEach(a => {
            a.addEventListener('click', (e) => {
                const href = a.getAttribute('href') || '';
                if (!href.startsWith('#')) return;
                const target = qs(href);
                if (!target) return;
                e.preventDefault();
                closeMenu();
                const y = window.scrollY + target.getBoundingClientRect().top - (header ? header.offsetHeight : 0) - 12;
                window.scrollTo({ top: y, behavior: 'smooth' });
            });
        });
    }

    function bindActiveLinks() {
        const navLinks = qsa('.nav a[data-scroll]');
        const targets = navLinks.map(a => qs(a.getAttribute('href'))).filter(Boolean);
        if (!navLinks.length || !targets.length) return;

        let cachedTops = [];

        function updateCache() {
            const sy = window.scrollY;
            const headerH = header ? header.offsetHeight : 0;
            cachedTops = targets.map(sec => ({
                el: sec,
                top: sy + sec.getBoundingClientRect().top - headerH
            }));
        }

        function setActiveByScroll(y) {
            if (!cachedTops.length) return;
            const headerH = header ? header.offsetHeight : 0;
            const probeY = y + headerH + 24;
            let active = null;
            for (let i = cachedTops.length - 1; i >= 0; i--) {
                if (probeY >= cachedTops[i].top) {
                    active = targets[i];
                    break;
                }
            }
            navLinks.forEach(a => {
                const isActive = active && a.getAttribute('href') === `#${active.id}`;
                if (a.classList.contains('is-active') !== isActive) {
                    a.classList.toggle('is-active', isActive);
                }
            });
        }

        updateCache();
        setActiveByScroll(window.scrollY);
        addScrollTask(setActiveByScroll);

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(updateCache, 150);
        }, { passive: true });
    }

    function bindProgress() {
        if (!prog) return;
        const h = document.documentElement;
        let lastScale = -1;

        function setProgress(y) {
            const isTop = header && header.classList.contains('is-top');
            if (isTop) {
                if (lastScale !== 0) { prog.style.transform = 'scaleX(0)'; lastScale = 0; }
                return;
            }
            const max = h.scrollHeight - h.clientHeight;
            const raw = max > 0 ? y / max : 0;
            const scale = Math.round(Math.max(0, Math.min(1, raw)) * 100) / 100;
            if (scale !== lastScale) {
                prog.style.transform = `scaleX(${scale})`;
                lastScale = scale;
            }
        }

        setProgress(window.scrollY);
        addScrollTask(setProgress);
    }

    function initFabDock() {
        const dock = qs('.fabDock');
        const hero = qs('#hero');
        if (!dock || !hero) return;

        let showAt = 0;
        let lastVisible = null;

        function updateShowAt() {
            const heroRect = hero.getBoundingClientRect();
            const heroBottomAbs = window.scrollY + heroRect.bottom;
            showAt = heroBottomAbs - window.innerHeight * 0.45;
        }

        function toggleDock(y) {
            const vis = y > showAt;
            if (vis !== lastVisible) {
                dock.classList.toggle('is-visible', vis);
                lastVisible = vis;
            }
        }

        updateShowAt();
        toggleDock(window.scrollY);
        addScrollTask(toggleDock);

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                updateShowAt();
                toggleDock(window.scrollY);
            }, 200);
        }, { passive: true });
    }

    function initReveal() {
        const items = qsa('[data-reveal]');
        if (!items.length) return;

        const groupKey = (el) => el.closest('.section, .heroStage, main') || document.body;

        const io = new IntersectionObserver((entries) => {
            const entering = entries
                .filter(e => e.isIntersecting)
                .sort((a, b) => items.indexOf(a.target) - items.indexOf(b.target));

            const byGroup = new Map();
            for (const e of entering) {
                const g = groupKey(e.target);
                if (!byGroup.has(g)) byGroup.set(g, []);
                byGroup.get(g).push(e.target);
            }
            byGroup.forEach((els) => {
                els.forEach((el, i) => {
                    el.style.transitionDelay = `${Math.min(i * 70, 240)}ms`;
                    el.classList.add('is-in');
                    io.unobserve(el);
                });
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });

        items.forEach(el => io.observe(el));
    }

    function setYear() {
        const y = qs('#year');
        if (y) y.textContent = new Date().getFullYear();
    }

    function initCounters() {
        const numbers = qsa('.pstep__n, .statItem__num');

        const animate = (el) => {
            const raw = el.textContent.trim();
            const match = raw.match(/^(\D*)(\d+)(\D*)$/);
            if (!match) return;
            const [, prefix, numStr, suffix] = match;
            const val = parseInt(numStr, 10);
            if (!val) return;
            const hasLeadingZero = numStr.length > 1 && numStr.startsWith('0');
            const duration = 1400;
            const startTime = performance.now();

            const update = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(1, elapsed / duration);
                const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                const current = Math.floor(ease * val);
                let currentStr = current.toString();
                if (hasLeadingZero && current < 10) currentStr = '0' + currentStr;
                el.textContent = `${prefix}${currentStr}${suffix}`;
                if (progress < 1) requestAnimationFrame(update);
                else el.textContent = raw;
            };

            requestAnimationFrame(update);
        };

        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animate(entry.target);
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.4 });

        numbers.forEach(el => obs.observe(el));
    }

    function initNavComic() {
        const palette = ["#ffd400", "#ff3b3b", "#26e06f", "#3aa6ff", "#ff7a18", "#ffffff"];
        let isWrapping = false;

        function escapeHtml(str) {
            return str
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");
        }
        function textSeed(str) {
            let h = 0;
            for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
            return Math.abs(h);
        }
        function wrapElement(el) {
            const raw = (el.textContent || "").replace(/\s+/g, " ").trim();
            if (!raw || (el.dataset.raw === raw && el.dataset.wrapped === "1")) return;
            el.dataset.raw = raw;
            el.dataset.wrapped = "1";
            const seed = textSeed(raw);
            let html = "";
            let colorIndex = 0;
            for (let i = 0; i < raw.length; i++) {
                const ch = raw[i];
                if (ch === " ") { html += `<span class="sp" aria-hidden="true"></span>`; continue; }
                const color = palette[(seed + colorIndex) % palette.length];
                html += `<span class="ch" style="--fill:${color};color:${color};-webkit-text-fill-color:${color}">${escapeHtml(ch)}</span>`;
                colorIndex++;
            }
            el.innerHTML = html;
            el.setAttribute("aria-label", raw);
        }
        function wrapAll() {
            if (isWrapping) return;
            isWrapping = true;
            try { document.querySelectorAll(".navComic").forEach(wrapElement); }
            finally { isWrapping = false; }
        }

        wrapAll();
        if (document.fonts?.ready) document.fonts.ready.then(wrapAll).catch(() => {});
    }

    function initScrollTop() {
        const btn = qs('#scrollTop');
        const ring = qs('.scrollTop__fg');
        if (!btn) return;
        const circ = 2 * Math.PI * 18;
        if (ring) {
            ring.style.strokeDasharray = String(circ);
            ring.style.strokeDashoffset = String(circ);
        }

        let lastVisible = null;
        let lastEnd = null;
        function update(y) {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
            if (ring) ring.style.strokeDashoffset = String(circ * (1 - p));
            const vis = y > 280;
            if (vis !== lastVisible) {
                btn.classList.toggle('is-visible', vis);
                lastVisible = vis;
            }
            const atEnd = p >= 0.985;
            if (atEnd !== lastEnd) {
                btn.classList.toggle('is-end', atEnd);
                lastEnd = atEnd;
            }
        }

        update(window.scrollY);
        addScrollTask(update);
    }

    function initFAQ() {
        const triggers = qsa('.faqItem__trigger');
        if (!triggers.length) return;

        triggers.forEach(trigger => {
            trigger.addEventListener('click', () => {
                const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
                const item = trigger.closest('.faqItem');

                triggers.forEach(t => {
                    if (t !== trigger) {
                        t.setAttribute('aria-expanded', 'false');
                        t.closest('.faqItem')?.classList.remove('is-open');
                    }
                });

                const newState = !isExpanded;
                trigger.setAttribute('aria-expanded', newState ? 'true' : 'false');
                item?.classList.toggle('is-open', newState);
            });
        });
    }

    function initApp() {
        syncTopbarH();

        if (window.ResizeObserver && header) {
            const ro = new ResizeObserver(() => syncTopbarH());
            ro.observe(header);
        } else {
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(syncTopbarH, 100);
            }, { passive: true });
        }

        setHeader(window.scrollY);
        addScrollTask(setHeader);
        bindProgress();
        bindActiveLinks();

        if (navbtn && mnav) navbtn.addEventListener('click', toggleMenu);
        overlay?.addEventListener('click', closeMenu);
        mnav?.addEventListener('click', (e) => { if (e.target === mnav) closeMenu(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
        });

        bindSmoothScroll();
        setYear();
        initFabDock();
        initScrollTop();
        initNavComic();
        initReveal();
        initFAQ();

        const defer = () => {
            const run = () => initCounters();
            if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 1500 });
            else setTimeout(run, 80);
        };

        if (document.readyState === 'complete') defer();
        else window.addEventListener('load', defer, { once: true });

        setTimeout(() => document.body.classList.add('is-ready'), 50);

        qsa('.js-navigate-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const address = "VR46 DOO, Patrijarha Joanikija 3a, Beograd";
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                if (isIOS) {
                    window.location.href = `maps://?daddr=${encodeURIComponent(address)}`;
                } else {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', initApp);
})();
