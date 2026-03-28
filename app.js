'use strict';

/* ============================================================
   APP.JS — SPA Engine
   Hash router · GSAP + Lenis + Splitting · Advanced interactions
   Vineet Vishesh · Offensive Security
   ============================================================ */

(function () {

    /* ----------------------------------------------------------
       GSAP SETUP
       ---------------------------------------------------------- */
    gsap.registerPlugin(ScrollTrigger);

    /* ----------------------------------------------------------
       LENIS SMOOTH SCROLL
       ---------------------------------------------------------- */
    var lenis = new Lenis({
        duration: 1.2,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        orientation: 'vertical',
        smoothWheel: true
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Connect Lenis to GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    /* ----------------------------------------------------------
       ROUTE CONFIG
       ---------------------------------------------------------- */
    var ROUTES = {
        '/':             'page-home',
        '/about':        'page-about',
        '/work':         'page-work',
        '/capabilities': 'page-capabilities',
        '/credentials':  'page-credentials',
        '/contact':      'page-contact'
    };

    var ROUTE_TITLES = {
        '/':             'Vineet Vishesh — Offensive Security',
        '/about':        'About — Vineet Vishesh',
        '/work':         'Selected Work — Vineet Vishesh',
        '/capabilities': 'Capabilities — Vineet Vishesh',
        '/credentials':  'Credentials — Vineet Vishesh',
        '/contact':      'Contact — Vineet Vishesh'
    };

    var app = document.getElementById('app');
    var currentRoute = null;
    var isTransitioning = false;

    /* ----------------------------------------------------------
       NAVIGATION
       ---------------------------------------------------------- */
    var nav = document.getElementById('nav');
    var burger = document.getElementById('navBurger');
    var mobileMenu = document.getElementById('navMobile');
    var mobileOpen = false;

    function handleNavScroll() {
        if (window.scrollY > 60) {
            nav.classList.add('nav--scrolled');
        } else {
            nav.classList.remove('nav--scrolled');
        }
    }
    window.addEventListener('scroll', handleNavScroll, { passive: true });

    burger.addEventListener('click', function () {
        mobileOpen = !mobileOpen;
        burger.setAttribute('aria-expanded', String(mobileOpen));
        burger.classList.toggle('open', mobileOpen);
        if (mobileOpen) {
            mobileMenu.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    function closeMobile() {
        mobileOpen = false;
        burger.setAttribute('aria-expanded', 'false');
        burger.classList.remove('open');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
    }

    mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeMobile);
    });

    function updateActiveNav(route) {
        document.querySelectorAll('.nav__link').forEach(function (link) {
            var href = link.getAttribute('href');
            if (href === '#' + route) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    /* ----------------------------------------------------------
       PAGE TRANSITION
       ---------------------------------------------------------- */
    var transitionBar = document.querySelector('.page-transition__bar');

    function transitionOut() {
        return new Promise(function (resolve) {
            var items = app.querySelectorAll('.anim-item, .project-card, .cap-card, .trust-item, .stat-block');
            if (items.length === 0) { resolve(); return; }

            var tl = gsap.timeline({ onComplete: resolve });
            tl.to(items, {
                opacity: 0,
                y: -20,
                duration: 0.25,
                stagger: 0.02,
                ease: 'power2.in'
            });
            tl.fromTo(transitionBar,
                { scaleX: 0 },
                { scaleX: 1, duration: 0.35, ease: 'power3.inOut' },
                '-=0.1'
            );
        });
    }

    function transitionIn() {
        var tl = gsap.timeline();

        // Collapse the bar
        tl.to(transitionBar, {
            scaleX: 0,
            duration: 0.3,
            ease: 'power3.inOut',
            onComplete: function () {
                gsap.set(transitionBar, { scaleX: 0 });
            }
        });

        // Animate page items in
        var items = app.querySelectorAll('.anim-item, .project-card, .cap-card, .trust-item, .stat-block');
        tl.fromTo(items,
            { opacity: 0, y: 40 },
            {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.06,
                ease: 'expo.out'
            },
            '-=0.15'
        );

        return tl;
    }

    /* ----------------------------------------------------------
       ROUTER
       ---------------------------------------------------------- */
    function getRouteFromHash() {
        var hash = window.location.hash || '#/';
        var route = hash.replace('#', '') || '/';
        if (!ROUTES[route]) { route = '/'; }
        return route;
    }

    function loadPage(route, skipTransition) {
        if (isTransitioning) return;

        var templateId = ROUTES[route];
        if (!templateId) return;

        var template = document.getElementById(templateId);
        if (!template) return;

        // Update title
        document.title = ROUTE_TITLES[route] || ROUTE_TITLES['/'];
        updateActiveNav(route);

        if (skipTransition || currentRoute === null) {
            // First load or skip: no transition
            renderPage(template);
            currentRoute = route;
            if (skipTransition) {
                animatePageEntrance();
            } else {
                // Initial load: cinematic entrance
                setTimeout(animatePageEntrance, 100);
            }
            return;
        }

        if (route === currentRoute) return;

        isTransitioning = true;
        currentRoute = route;

        // Kill existing ScrollTriggers
        ScrollTrigger.getAll().forEach(function (st) { st.kill(); });

        transitionOut().then(function () {
            renderPage(template);
            lenis.scrollTo(0, { immediate: true });
            handleNavScroll();
            animatePageEntrance();

            setTimeout(function () {
                isTransitioning = false;
            }, 800);
        });
    }

    function renderPage(template) {
        app.innerHTML = '';
        var content = template.content.cloneNode(true);
        app.appendChild(content);
    }

    function animatePageEntrance() {
        // Splitting.js for headings
        var splitTargets = app.querySelectorAll('.split-heading');
        splitTargets.forEach(function (el) {
            Splitting({ target: el, by: 'chars' });
        });

        // Character animations
        var chars = app.querySelectorAll('.split-heading .char');
        if (chars.length) {
            gsap.fromTo(chars,
                { opacity: 0, y: 60, rotation: 4 },
                {
                    opacity: 1,
                    y: 0,
                    rotation: 0,
                    duration: 0.7,
                    stagger: 0.025,
                    ease: 'expo.out',
                    delay: 0.3
                }
            );
        }

        // Page items stagger in
        var items = app.querySelectorAll('.anim-item, .project-card, .cap-card, .trust-item, .stat-block');
        gsap.fromTo(items,
            { opacity: 0, y: 40 },
            {
                opacity: 1,
                y: 0,
                duration: 0.7,
                stagger: 0.07,
                ease: 'expo.out',
                delay: 0.15
            }
        );

        // Page-specific setup
        setupScrollAnimations();
        setupCounters();
        setupInteractions();

        // Hero-specific entrance
        var heroMeta = app.querySelector('.hero__meta');
        var heroSub = app.querySelector('.hero__sub');
        var heroLines = app.querySelectorAll('.hero__headline .line-inner');

        if (heroLines.length) {
            gsap.fromTo(heroMeta,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', delay: 0.1 }
            );
            gsap.fromTo(heroLines,
                { opacity: 0, y: '100%' },
                {
                    opacity: 1,
                    y: '0%',
                    duration: 0.9,
                    stagger: 0.15,
                    ease: 'expo.out',
                    delay: 0.3
                }
            );
            gsap.fromTo(heroSub,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', delay: 0.85 }
            );
        }
    }

    /* ----------------------------------------------------------
       SCROLL-TRIGGERED ANIMATIONS (GSAP ScrollTrigger)
       ---------------------------------------------------------- */
    function setupScrollAnimations() {
        // Parallax on hero grid
        var bgGrid = app.querySelector('.hero__bg-grid');
        if (bgGrid) {
            gsap.to(bgGrid, {
                y: 120,
                ease: 'none',
                scrollTrigger: {
                    trigger: '.hero',
                    start: 'top top',
                    end: 'bottom top',
                    scrub: 1
                }
            });
        }

        // Parallax on crimson wash
        var wash = app.querySelector('.hero__crimson-wash');
        if (wash) {
            gsap.to(wash, {
                y: 80,
                scale: 1.1,
                ease: 'none',
                scrollTrigger: {
                    trigger: '.hero',
                    start: 'top top',
                    end: 'bottom top',
                    scrub: 1.5
                }
            });
        }

        // Stat blocks scale-in on scroll
        var statBlocks = app.querySelectorAll('.stat-block');
        if (statBlocks.length) {
            gsap.fromTo(statBlocks,
                { scale: 0.92, opacity: 0 },
                {
                    scale: 1,
                    opacity: 1,
                    duration: 0.6,
                    stagger: 0.08,
                    ease: 'expo.out',
                    scrollTrigger: {
                        trigger: '.stats-row',
                        start: 'top 85%',
                        once: true
                    }
                }
            );
        }

        // Project cards — stagger reveal with scale
        var projectCards = app.querySelectorAll('.project-card');
        projectCards.forEach(function (card, i) {
            gsap.fromTo(card,
                { opacity: 0, y: 60, scale: 0.96 },
                {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.8,
                    ease: 'expo.out',
                    scrollTrigger: {
                        trigger: card,
                        start: 'top 88%',
                        once: true
                    }
                }
            );
        });

        // Capability cards
        var capCards = app.querySelectorAll('.cap-card');
        capCards.forEach(function (card, i) {
            gsap.fromTo(card,
                { opacity: 0, y: 40 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.6,
                    delay: i * 0.05,
                    ease: 'expo.out',
                    scrollTrigger: {
                        trigger: card,
                        start: 'top 90%',
                        once: true
                    }
                }
            );
        });

        // Trust items
        var trustItems = app.querySelectorAll('.trust-item');
        trustItems.forEach(function (item, i) {
            gsap.fromTo(item,
                { opacity: 0, x: -30 },
                {
                    opacity: 1,
                    x: 0,
                    duration: 0.6,
                    delay: i * 0.08,
                    ease: 'expo.out',
                    scrollTrigger: {
                        trigger: item,
                        start: 'top 90%',
                        once: true
                    }
                }
            );
        });
    }

    /* ----------------------------------------------------------
       COUNTER ANIMATION
       ---------------------------------------------------------- */
    function setupCounters() {
        var counters = app.querySelectorAll('[data-count]');
        counters.forEach(function (el) {
            var target = parseInt(el.getAttribute('data-count'), 10);
            gsap.fromTo(el, { innerText: 0 }, {
                innerText: target,
                duration: 2,
                ease: 'power2.out',
                snap: { innerText: 1 },
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                    once: true
                }
            });
        });
    }

    /* ----------------------------------------------------------
       ADVANCED INTERACTIONS
       ---------------------------------------------------------- */
    function setupInteractions() {
        setupMagneticButtons();
        setupCardTilt();
        setupGlowGrid();
    }

    // --- Magnetic Buttons ---
    function setupMagneticButtons() {
        var wraps = app.querySelectorAll('.magnetic-wrap');
        wraps.forEach(function (wrap) {
            var btn = wrap.querySelector('.btn');
            if (!btn) return;

            wrap.addEventListener('mousemove', function (e) {
                var rect = wrap.getBoundingClientRect();
                var x = e.clientX - rect.left - rect.width / 2;
                var y = e.clientY - rect.top - rect.height / 2;
                gsap.to(btn, {
                    x: x * 0.25,
                    y: y * 0.25,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            });

            wrap.addEventListener('mouseleave', function () {
                gsap.to(btn, {
                    x: 0,
                    y: 0,
                    duration: 0.6,
                    ease: 'elastic.out(1, 0.4)'
                });
            });
        });
    }

    // --- Project Card Tilt ---
    function setupCardTilt() {
        var cards = app.querySelectorAll('.project-card');
        cards.forEach(function (card) {
            card.addEventListener('mousemove', function (e) {
                var rect = card.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                var cx = rect.width / 2;
                var cy = rect.height / 2;
                var rotX = ((y - cy) / cy) * -2;
                var rotY = ((x - cx) / cx) * 2;

                gsap.to(card, {
                    rotateX: rotX,
                    rotateY: rotY,
                    transformPerspective: 800,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            });

            card.addEventListener('mouseleave', function () {
                gsap.to(card, {
                    rotateX: 0,
                    rotateY: 0,
                    duration: 0.6,
                    ease: 'expo.out'
                });
            });
        });
    }

    // --- Cursor Glow on Capability Grid ---
    function setupGlowGrid() {
        var grid = app.querySelector('.glow-grid');
        if (!grid) return;

        grid.addEventListener('mousemove', function (e) {
            var rect = grid.getBoundingClientRect();
            grid.style.setProperty('--glow-x', (e.clientX - rect.left) + 'px');
            grid.style.setProperty('--glow-y', (e.clientY - rect.top) + 'px');
        });
    }

    /* ----------------------------------------------------------
       HASH CHANGE LISTENER
       ---------------------------------------------------------- */
    window.addEventListener('hashchange', function () {
        var route = getRouteFromHash();
        loadPage(route, false);
    });

    // Intercept route links for immediate response
    document.addEventListener('click', function (e) {
        var link = e.target.closest('[data-route]');
        if (!link) return;

        var href = link.getAttribute('href');
        if (!href || href.charAt(0) !== '#') return;

        // Let hashchange handle it, but close mobile menu
        closeMobile();
    });

    /* ----------------------------------------------------------
       INIT
       ---------------------------------------------------------- */
    function init() {
        var route = getRouteFromHash();
        loadPage(route, false);

        // Reveal body
        requestAnimationFrame(function () {
            document.body.classList.add('ready');
        });

        handleNavScroll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
