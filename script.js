(() => {
    const qs = (s, el = document) => el.querySelector(s);
    const qsa = (s, el = document) => [...el.querySelectorAll(s)];

    const header = qs('[data-header]');
    const navbtn = qs('#navbtn');
    const mnav = qs('#mnav');
    const overlay = qs('[data-overlay]');
    const prog = qs('.navProgress span');

    // =====================================================================
    // UNIFIED SCROLL LOOP
    // Single RAF callback — one layout read per frame, zero redundant style
    // recalculations. All scroll-driven work registered here.
    // =====================================================================
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
        for (let i = 0; i < _scrollTasks.length; i++) {
            _scrollTasks[i](y);
        }
    }

    function addScrollTask(fn) { _scrollTasks.push(fn); }

    window.addEventListener('scroll', _onScroll, { passive: true });

    // ===== TOPBAR =====
    // Only touch classList — no layout reads, no style recalcs
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

    // ===== TOPBAR HEIGHT SYNC =====
    // Syncs --topbarH CSS var once on load and on resize (debounced).
    // Uses ResizeObserver on the header itself for accuracy.
    function syncTopbarH() {
        if (!header) return;
        const h = Math.round(header.getBoundingClientRect().height);
        document.documentElement.style.setProperty('--topbarH', h + 'px');
    }

    // ===== Mobile menu =====
    function closeMenu() {
        document.body.classList.remove('menu-open');
        navbtn?.setAttribute('aria-expanded', 'false');
        mnav?.setAttribute('aria-hidden', 'true');
        overlay?.setAttribute('aria-hidden', 'true');
        _lastSolid = null; // force re-eval
        setHeader(window.scrollY);
    }
    function openMenu() {
        document.body.classList.add('menu-open');
        navbtn?.setAttribute('aria-expanded', 'true');
        mnav?.setAttribute('aria-hidden', 'false');
        overlay?.setAttribute('aria-hidden', 'false');
        _lastSolid = null; // force re-eval
        setHeader(window.scrollY);
    }
    function toggleMenu() {
        document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
    }

    // ===== SMOOTH SCROLL =====
    function bindSmoothScroll() {
        qsa('[data-scroll]').forEach(a => {
            a.addEventListener('click', (e) => {
                const href = a.getAttribute('href') || '';
                if (!href.startsWith('#')) return;
                const target = qs(href);
                if (!target) return;
                e.preventDefault();
                closeMenu();
                // Read layout once outside RAF
                const y = window.scrollY + target.getBoundingClientRect().top - (header ? header.offsetHeight : 0) - 12;
                window.scrollTo({ top: y, behavior: 'smooth' });
            });
        });
    }

    // ===== ACTIVE NAV LINKS =====
    // Uses cached section tops, updated only on resize — zero getBCR during scroll
    function bindActiveLinks() {
        const navLinks = qsa('.nav a[data-scroll]');
        const targets = navLinks.map(a => qs(a.getAttribute('href'))).filter(Boolean);
        if (!navLinks.length || !targets.length) return;

        // Cache of absolute top positions
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

        // Resize: debounced cache update
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(updateCache, 150);
        }, { passive: true });
    }

    // ===== PROGRESS BAR =====
    // Uses transform:scaleX (compositor-only) instead of width — zero layout/paint cost
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
            // Round to 2 decimal places to reduce style writes
            const scale = Math.round(Math.max(0, Math.min(1, raw)) * 100) / 100;
            if (scale !== lastScale) {
                prog.style.transform = `scaleX(${scale})`;
                lastScale = scale;
            }
        }

        setProgress(window.scrollY);
        addScrollTask(setProgress);
    }

    // ===== HERO SLIDESHOW =====
    // CSS handles crossfade; JS only toggles classes. No timers running when tab hidden.
    function initHeroSlides() {
        const slides = qsa('.heroSlides__img');
        if (!slides.length) return;
        let idx = 0;

        const show = (nextIdx) => {
            const current = qs('.heroSlides__img.is-active');
            if (current === slides[nextIdx]) return;
            if (current) {
                current.classList.remove('is-active');
                current.classList.add('is-leaving');
                // Remove is-leaving after transition completes
                setTimeout(() => current.classList.remove('is-leaving'), 1400);
            }
            slides[nextIdx].classList.add('is-active');
        };

        show(0);

        // Use visibility API to pause when tab is hidden — saves GPU
        let timer;
        function startTimer() {
            timer = setInterval(() => {
                idx = (idx + 1) % slides.length;
                show(idx);
            }, 8000);
        }
        function stopTimer() { clearInterval(timer); }

        document.addEventListener('visibilitychange', () => {
            document.hidden ? stopTimer() : startTimer();
        });

        setTimeout(startTimer, 4000);
    }

    // ===== SPOTLIGHT BORDERS =====
    // RAF-throttled, skipped on touch devices, only updates the hovered card
    function initSpotlight() {
        if (window.matchMedia('(pointer: coarse)').matches) return;
        let pending = false;
        let mx = 0, my = 0;
        let lastCard = null;

        document.addEventListener('mousemove', e => {
            mx = e.clientX; my = e.clientY;
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => {
                pending = false;
                const card = document.elementFromPoint(mx, my)?.closest('.spotlight-card');
                if (card !== lastCard) {
                    if (lastCard) lastCard.style.setProperty('--opacity', '0');
                    lastCard = card;
                }
                if (!card) return;
                const rect = card.getBoundingClientRect();
                card.style.setProperty('--x', `${mx - rect.left}px`);
                card.style.setProperty('--y', `${my - rect.top}px`);
                card.style.setProperty('--opacity', '1');
            });
        }, { passive: true });
    }

    // ===== FLOATING DOCK =====
    // heroBottom cached, recalculated only on resize. Class toggle only.
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

    // ===== REVEAL + WIPE =====
    // IntersectionObserver only, no scroll polling
    function initMegaReveal() {
        const wipeEls = qsa('[data-reveal="wipe"]');
        wipeEls.forEach(el => {
            if (el.querySelector('.wipeText')) return;
            el.innerHTML = `<span class="wipeText">${el.innerHTML}</span>`;
        });
        const items = qsa('.reveal, [data-reveal]');
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

    // ===== NAV COMIC LETTERS =====
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
            for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
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

        // Debounced resize
        let resizeTimer;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(wrapAll, 80);
        }, { passive: true });

        wrapAll();
        if (document.fonts?.ready) document.fonts.ready.then(wrapAll).catch(() => {});
    }

    // ===== YEAR =====
    function setYear() {
        const y = qs('#year');
        if (y) y.textContent = new Date().getFullYear();
    }

    // ===== COUNTER ANIMATION =====
    // One IntersectionObserver, one RAF loop per element, no setInterval
    function initSpeedometer() {
        const numbers = [
            ...qsa('.std3__pnum'),
            ...qsa('.pstep__n'),
            ...qsa('.svcItem__n'),
            ...qsa('.statItem__num')
        ];

        const animate = (el) => {
            const raw = el.textContent.trim();
            // Support formats: "25k", "300+", "10g", "100%", "01", plain numbers
            const match = raw.match(/^(\D*)(\d+)(\D*)$/);
            if (!match) return;
            const [, prefix, numStr, suffix] = match;
            const val = parseInt(numStr, 10);
            if (isNaN(val) || val === 0) return;
            const hasLeadingZero = numStr.length > 1 && numStr.startsWith('0');
            const duration = 1600;
            const startTime = performance.now();

            const update = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(1, elapsed / duration);
                // Ease-out expo
                const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                const current = Math.floor(ease * val);
                let currentStr = current.toString();
                if (hasLeadingZero && current < 10) currentStr = '0' + currentStr;
                el.textContent = `${prefix}${currentStr}${suffix}`;
                if (progress < 1) requestAnimationFrame(update);
                else el.textContent = raw; // snap to final value
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

    // ===== PIT STOP RANDOMIZER =====
    function initPitStop() {
        const el = qs('.pitTime__val');
        if (!el) return;
        const rand = Math.floor(Math.random() * 11 + 20); // 20-30
        el.innerHTML = `~${rand}<span class="pitTime__blink">:</span>00 MIN`;
    }

    // ===== DATA DECODE REVEAL =====
    // Replaced setInterval with requestAnimationFrame for smoother animation
    // and zero timer drift
    function initDataDecode() {
        const items = qsa('[data-decode]');
        if (!items.length) return;

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';

        const decode = (el) => {
            const original = el.innerText;
            const len = original.length;
            const isHero = el.dataset.decode === 'hero';
            const speed = isHero ? 0.8 : 0.5;
            el.style.opacity = '1';

            let iterations = 0;
            let startTime = null;

            const tick = (now) => {
                if (!startTime) startTime = now;
                // ~30ms per frame equivalent via time
                const elapsed = now - startTime;
                iterations = (elapsed / 30) * speed;

                el.innerText = original.split('').map((char, index) => {
                    if (index < iterations) return original[index];
                    if (char === ' ') return ' ';
                    return chars[Math.floor(Math.random() * chars.length)];
                }).join('');

                if (iterations < len) {
                    requestAnimationFrame(tick);
                } else {
                    el.innerText = original;
                }
            };

            requestAnimationFrame(tick);
        };

        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    decode(entry.target);
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });

        items.forEach(el => {
            const isHero = el.dataset.decode === 'hero';
            if (isHero) {
                setTimeout(() => decode(el), 300 + (items.indexOf(el) * 100));
            } else {
                el.style.opacity = '0';
                obs.observe(el);
            }
        });
    }

    // ===== TECHNICAL BREAKDOWN =====
    function initTechnicalBreakdown() {
        const breakdown = qs('.breakdown');
        if (!breakdown) return;
        const highlights = qsa('.breakdown__highlight');
        const steps = qsa('.breakdown__step');
        if (!highlights.length || !steps.length) return;

        const obs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const stepIndex = steps.indexOf(entry.target);
                    highlights.forEach((h, i) => {
                        h.classList.toggle('is-active', i === stepIndex);
                    });
                }
            });
        }, { threshold: 0.5 });

        steps.forEach(step => obs.observe(step));
    }

    // ===== FAQ ACCORDION =====
    function initFAQ() {
        const triggers = qsa('.faqItem__trigger');
        if (!triggers.length) return;

        triggers.forEach(trigger => {
            trigger.addEventListener('click', () => {
                const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
                const item = trigger.closest('.faqItem');

                // Close all others
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

    // ===== BOOT =====
    function initApp() {
        // 1. Sync topbar height BEFORE anything else — fixes hero spacing
        syncTopbarH();

        // 2. Use ResizeObserver on header for accurate real-time height tracking
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => syncTopbarH());
            ro.observe(header);
        } else {
            // Fallback: debounced resize
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(syncTopbarH, 100);
            }, { passive: true });
        }

        // 3. Initial header state
        setHeader(window.scrollY);

        // 4. Register scroll tasks
        addScrollTask(setHeader);
        bindProgress();
        bindActiveLinks();

        // 5. Menu
        if (navbtn && mnav) navbtn.addEventListener('click', toggleMenu);
        overlay?.addEventListener('click', closeMenu);
        mnav?.addEventListener('click', (e) => { if (e.target === mnav) closeMenu(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
        });

        bindSmoothScroll();
        setYear();

        // 6. Critical above-fold
        initHeroSlides();
        initFabDock();
        initPitStop();

        // 7. Non-critical — deferred to idle time
        const defer = () => {
            const run = () => {
                initNavComic();
                initMegaReveal();
                initSpotlight();
                initSpeedometer();
                initDataDecode();
                initTechnicalBreakdown();
                initFAQ();
            };

            if (window.requestIdleCallback) {
                requestIdleCallback(run, { timeout: 1500 });
            } else {
                setTimeout(run, 80);
            }
        };

        if (document.readyState === 'complete') defer();
        else window.addEventListener('load', defer, { once: true });

        // Mark ready — enables CSS transitions (prevents FOUC)
        setTimeout(() => document.body.classList.add('is-ready'), 50);

        // Navigation Button Logic
        const navBtns = document.querySelectorAll('.js-navigate-btn');
        navBtns.forEach(btn => {
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
