'use strict';

/* ============================================================
   APP.JS — SPA Engine v2
   Hash router · GSAP + Lenis + Splitting · Preloader · Custom Cursor
   Interactive Terminal · Scroll Progress · Reduced Motion
   Vineet Vishesh · Offensive Security
   ============================================================ */

(function () {

    /* ----------------------------------------------------------
       THEME TOGGLE (load before anything visual)
       ---------------------------------------------------------- */
    var savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    var themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            var current = document.documentElement.getAttribute('data-theme');
            var next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            // Update meta theme-color
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', next === 'light' ? '#ffffff' : '#0a0a0a');
        });
    }

    /* ----------------------------------------------------------
       REDUCED MOTION CHECK
       ---------------------------------------------------------- */
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ----------------------------------------------------------
       GSAP SETUP
       ---------------------------------------------------------- */
    gsap.registerPlugin(ScrollTrigger);

    /* ----------------------------------------------------------
       LENIS SMOOTH SCROLL (skip if reduced motion)
       ---------------------------------------------------------- */
    var lenis = null;
    if (!prefersReducedMotion) {
        lenis = new Lenis({
            duration: 1.2,
            easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
            orientation: 'vertical',
            smoothWheel: true
        });

        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(function (time) {
            lenis.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);
    }

    /* ----------------------------------------------------------
       CUSTOM CURSOR
       ---------------------------------------------------------- */
    var cursorDot = document.getElementById('cursorDot');
    var cursorRing = document.getElementById('cursorRing');
    var mouseX = 0, mouseY = 0;
    var ringX = 0, ringY = 0;

    if (cursorDot && cursorRing && window.matchMedia('(pointer: fine)').matches && !prefersReducedMotion) {
        document.addEventListener('mousemove', function (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
            gsap.set(cursorDot, { x: mouseX, y: mouseY });
        });

        gsap.ticker.add(function () {
            ringX += (mouseX - ringX) * 0.15;
            ringY += (mouseY - ringY) * 0.15;
            gsap.set(cursorRing, { x: ringX, y: ringY });
        });

        // Context-aware cursor states
        document.addEventListener('mouseover', function (e) {
            var projectCard = e.target.closest('.project-card');
            var capCard = e.target.closest('.cap-card');
            var link = e.target.closest('a[href^="mailto:"]');
            if (projectCard) {
                cursorRing.setAttribute('data-cursor-label', 'VIEW');
                cursorRing.classList.add('has-label');
            } else if (capCard) {
                cursorRing.classList.add('hover');
            } else if (link) {
                cursorRing.setAttribute('data-cursor-label', 'COPY');
                cursorRing.classList.add('has-label');
            } else if (e.target.closest('a, button, .btn, .nav__link, .terminal__input')) {
                cursorRing.classList.add('hover');
            }
        });
        document.addEventListener('mouseout', function (e) {
            if (e.target.closest('a, button, .btn, .project-card, .cap-card, .nav__link, .terminal__input')) {
                cursorRing.classList.remove('hover');
                cursorRing.classList.remove('has-label');
                cursorRing.setAttribute('data-cursor-label', '');
            }
        });
    } else {
        // Hide cursor elements on touch or reduced motion
        if (cursorDot) cursorDot.style.display = 'none';
        if (cursorRing) cursorRing.style.display = 'none';
    }

    /* ----------------------------------------------------------
       SCROLL PROGRESS BAR
       ---------------------------------------------------------- */
    var scrollProgress = document.getElementById('scrollProgress');
    if (scrollProgress && !prefersReducedMotion) {
        window.addEventListener('scroll', function () {
            var scrollTop = window.scrollY;
            var docHeight = document.documentElement.scrollHeight - window.innerHeight;
            var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            scrollProgress.style.width = pct + '%';
        }, { passive: true });
    }

    /* ----------------------------------------------------------
       BACK TO TOP BUTTON
       ---------------------------------------------------------- */
    var backToTop = document.getElementById('backToTop');
    if (backToTop) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 400) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        }, { passive: true });
        backToTop.addEventListener('click', function () {
            if (lenis) {
                lenis.scrollTo(0);
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    /* ----------------------------------------------------------
       ROUTE CONFIG
       ---------------------------------------------------------- */
    var ROUTES = {
        '/':               'page-home',
        '/about':          'page-about',
        '/work':           'page-work',
        '/work/osint':     'page-work-osint',
        '/work/privesc':   'page-work-privesc',
        '/capabilities':   'page-capabilities',
        '/credentials':    'page-credentials',
        '/contact':        'page-contact',
        '/404':            'page-404'
    };

    var ROUTE_TITLES = {
        '/':               'Vineet Vishesh — Offensive Security',
        '/about':          'About — Vineet Vishesh',
        '/work':           'Selected Work — Vineet Vishesh',
        '/work/osint':     'OSINT Pipeline — Vineet Vishesh',
        '/work/privesc':   'Privilege Escalation Research — Vineet Vishesh',
        '/capabilities':   'Capabilities — Vineet Vishesh',
        '/credentials':    'Credentials — Vineet Vishesh',
        '/contact':        'Contact — Vineet Vishesh',
        '/404':            '404 — Vineet Vishesh'
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
        if (!nav) return;
        if (window.scrollY > 60) {
            nav.classList.add('nav--scrolled');
        } else {
            nav.classList.remove('nav--scrolled');
        }
    }
    window.addEventListener('scroll', handleNavScroll, { passive: true });

    if (burger) burger.addEventListener('click', function () {
        mobileOpen = !mobileOpen;
        burger.setAttribute('aria-expanded', String(mobileOpen));
        burger.classList.toggle('open', mobileOpen);
        if (mobileOpen) {
            mobileMenu.classList.add('active');
            mobileMenu.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        } else {
            mobileMenu.classList.remove('active');
            mobileMenu.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    });

    function closeMobile() {
        mobileOpen = false;
        if (burger) burger.setAttribute('aria-expanded', 'false');
        if (burger) burger.classList.remove('open');
        if (mobileMenu) {
            mobileMenu.classList.remove('active');
            mobileMenu.setAttribute('aria-hidden', 'true');
        }
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
       PAGE TRANSITIONS — Per-Route Variants
       ---------------------------------------------------------- */
    var transitionSigil = document.getElementById('transitionSigil');

    function transitionOut() {
        if (prefersReducedMotion) return Promise.resolve();

        return new Promise(function (resolve) {
            var tl = gsap.timeline({ onComplete: resolve });

            // Fade out current page
            tl.to(app, {
                opacity: 0,
                y: -15,
                duration: 0.25,
                ease: 'power2.in'
            });

            // Flash the sigil overlay
            if (transitionSigil) {
                tl.set(transitionSigil, { visibility: 'visible' }, 0.1)
                  .fromTo(transitionSigil, { opacity: 0 }, {
                      opacity: 1,
                      duration: 0.15,
                      ease: 'power2.in'
                  }, 0.1)
                  .fromTo(transitionSigil.querySelector('svg'), {
                      scale: 0.6,
                      rotation: -45
                  }, {
                      scale: 1,
                      rotation: 0,
                      duration: 0.3,
                      ease: 'expo.out'
                  }, 0.1)
                  .to(transitionSigil, {
                      opacity: 0,
                      duration: 0.2,
                      ease: 'power2.out'
                  }, '+=0.05')
                  .set(transitionSigil, { visibility: 'hidden' });
            }
        });
    }

    /* ----------------------------------------------------------
       ROUTER
       ---------------------------------------------------------- */
    function getRouteFromHash() {
        var hash = window.location.hash || '#/';
        var route = hash.replace('#', '') || '/';
        if (!ROUTES[route]) { route = '/404'; }
        return route;
    }

    function loadPage(route, skipTransition) {
        if (isTransitioning) return;

        var templateId = ROUTES[route];
        if (!templateId) return;

        var template = document.getElementById(templateId);
        if (!template) return;

        document.title = ROUTE_TITLES[route] || ROUTE_TITLES['/'];
        updateActiveNav(route);

        if (skipTransition || currentRoute === null) {
            renderPage(template);
            currentRoute = route;
            if (skipTransition) {
                animatePageEntrance();
            } else {
                setTimeout(animatePageEntrance, 100);
            }
            return;
        }

        if (route === currentRoute) return;

        isTransitioning = true;
        currentRoute = route;

        ScrollTrigger.getAll().forEach(function (st) { st.kill(); });
        stopMatrixCanvas();
        stopParticleNetwork();

        transitionOut().then(function () {
            renderPage(template);
            if (lenis) {
                lenis.scrollTo(0, { immediate: true });
            } else {
                window.scrollTo(0, 0);
            }
            handleNavScroll();

            // Fade in the new page
            gsap.fromTo(app,
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
            );

            animatePageEntrance();

            setTimeout(function () {
                isTransitioning = false;
            }, 600);
        }).catch(function () {
            isTransitioning = false;
            gsap.set(app, { opacity: 1, y: 0 });
        });
    }

    function renderPage(template) {
        app.innerHTML = '';
        var content = template.content.cloneNode(true);
        app.appendChild(content);
    }

    function animatePageEntrance() {
        if (prefersReducedMotion) {
            // Just make everything visible immediately
            var allItems = app.querySelectorAll('.anim-item, .project-card, .cap-card, .trust-item, .stat-block, .split-heading .char');
            allItems.forEach(function (el) {
                el.style.opacity = '1';
                el.style.transform = 'none';
            });
            setupInteractions();
            setupTerminal();
            setupThreatFeed();
            setupCardHoverGlow();
            return;
        }

        // Splitting.js for headings
        var splitTargets = app.querySelectorAll('.split-heading');
        splitTargets.forEach(function (el) {
            Splitting({ target: el, by: 'chars' });
        });

        // Varied character animations based on page
        var pageEl = app.querySelector('[data-page]');
        var pageType = pageEl ? pageEl.getAttribute('data-page') : 'home';
        var chars = app.querySelectorAll('.split-heading .char');

        if (chars.length) {
            if (pageType === 'work') {
                // Glitch/scramble effect for work page
                gsap.fromTo(chars,
                    { opacity: 0, scale: 0.5, rotation: function () { return (Math.random() - 0.5) * 20; } },
                    {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        duration: 0.5,
                        stagger: { each: 0.02, from: 'random' },
                        ease: 'back.out(1.5)',
                        delay: 0.3
                    }
                );
            } else if (pageType === 'about') {
                // Clip-up line reveal for about page
                gsap.fromTo(chars,
                    { opacity: 0, y: '120%' },
                    {
                        opacity: 1,
                        y: '0%',
                        duration: 0.8,
                        stagger: 0.015,
                        ease: 'expo.out',
                        delay: 0.3
                    }
                );
            } else if (pageType === 'contact' || pageType === '404') {
                // Clean fade-in for impact pages
                gsap.fromTo(chars,
                    { opacity: 0, y: 10 },
                    {
                        opacity: 1,
                        y: 0,
                        duration: 0.5,
                        stagger: 0.02,
                        ease: 'power2.out',
                        delay: 0.3
                    }
                );
            } else {
                // Default: original char stagger
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
        setupTerminal();
        setupThreatFeed();
        setupMatrixCanvas();
        setupParticleNetwork();
        setupParallaxElements();
        setupCardHoverGlow();
        setupTextStrokeReveal();
        setupCardTilt();
        setupSigils();

        // Hero-specific entrance
        var heroMeta = app.querySelector('.hero__meta');
        var heroSub = app.querySelector('.hero__sub');
        var heroLines = app.querySelectorAll('.hero__headline .line-inner');

        if (heroLines.length) {
            gsap.fromTo(heroMeta,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', delay: 0.1 }
            );
            // Scramble decode on hero lines
            heroLines.forEach(function (line, i) {
                scrambleText(line, 0.3 + i * 0.2);
            });
            gsap.fromTo(heroSub,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', delay: 0.85 }
            );
        }
    }

    /* ----------------------------------------------------------
       SCRAMBLE TEXT DECODE EFFECT
       ---------------------------------------------------------- */
    function scrambleText(el, delay) {
        var originalText = el.textContent;
        var glitchChars = '!@#$%^&*()_+{}|:<>?0123456789ABCDEF';
        var duration = 1200;
        var startTime = null;

        el.style.opacity = '1';

        setTimeout(function () {
            function animate(timestamp) {
                if (!startTime) startTime = timestamp;
                var progress = (timestamp - startTime) / duration;

                if (progress >= 1) {
                    el.textContent = originalText;
                    return;
                }

                var result = '';
                for (var i = 0; i < originalText.length; i++) {
                    if (originalText[i] === ' ') {
                        result += ' ';
                    } else if (i < originalText.length * progress) {
                        result += originalText[i];
                    } else {
                        result += glitchChars[Math.floor(Math.random() * glitchChars.length)];
                    }
                }
                el.textContent = result;
                requestAnimationFrame(animate);
            }
            requestAnimationFrame(animate);
        }, delay * 1000);
    }

    /* ----------------------------------------------------------
       TEXT STROKE OUTLINE-TO-FILL ON SCROLL
       ---------------------------------------------------------- */
    function setupTextStrokeReveal() {
        if (prefersReducedMotion) return;
        var headings = app.querySelectorAll('.t-heading:not(.hero__headline):not(.split-heading)');
        headings.forEach(function (h) {
            h.classList.add('text-stroke-reveal');
            ScrollTrigger.create({
                trigger: h,
                start: 'top 80%',
                onEnter: function () { h.classList.add('is-filled'); },
                onLeaveBack: function () { h.classList.remove('is-filled'); }
            });
        });
    }

    /* ----------------------------------------------------------
       3D CARD TILT WITH PERSPECTIVE
       ---------------------------------------------------------- */
    function setupCardTilt() {
        if (prefersReducedMotion || window.matchMedia('(pointer: coarse)').matches) return;
        var cards = app.querySelectorAll('.project-card');
        cards.forEach(function (card) {
            card.style.transformStyle = 'preserve-3d';
            card.addEventListener('mousemove', function (e) {
                var rect = card.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                var centerX = rect.width / 2;
                var centerY = rect.height / 2;
                var rotateX = ((y - centerY) / centerY) * -4;
                var rotateY = ((x - centerX) / centerX) * 4;
                gsap.to(card, {
                    rotateX: rotateX,
                    rotateY: rotateY,
                    duration: 0.4,
                    ease: 'power2.out',
                    transformPerspective: 800
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

    /* ----------------------------------------------------------
       CYBER SIGILISM — LABEL ACCENTS & DRAW REVEALS
       ---------------------------------------------------------- */
    function setupSigils() {
        // Add small sigil accent to section labels
        var labels = app.querySelectorAll('.t-label');
        var sigilSVG = '<svg class="t-label__sigil sigil sigil--glow" viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M12,1 L16,10 L12,19 L8,10 Z" stroke-width="0.6"/><path d="M12,6 C9,10 5,12 1,13" stroke-width="0.5"/><path d="M12,6 C15,10 19,12 23,13" stroke-width="0.5"/><circle cx="1" cy="13" r="1" fill="currentColor" opacity="0.4" style="color:var(--crimson)"/><circle cx="23" cy="13" r="1" fill="currentColor" opacity="0.4" style="color:var(--crimson)"/><path d="M12,15 L14,20 L12,24 L10,20 Z" stroke-width="0.3" opacity="0.5"/></svg>';
        labels.forEach(function (label) {
            if (label.querySelector('.t-label__sigil')) return;
            label.insertAdjacentHTML('afterbegin', sigilSVG);
        });

        // Draw-reveal sigils on scroll
        if (prefersReducedMotion) return;
        var drawSigils = app.querySelectorAll('.sigil--draw');
        drawSigils.forEach(function (s) {
            ScrollTrigger.create({
                trigger: s,
                start: 'top 85%',
                onEnter: function () { s.classList.add('is-drawn'); },
                once: true
            });
        });

        // Page-specific background sigils
        var pageEl = app.querySelector('[data-page]');
        var pageType = pageEl ? pageEl.getAttribute('data-page') : '';
        var pageSigilData = {
            about: '<svg class="page-sigil page-sigil--right sigil" viewBox="0 0 120 400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><line x1="60" y1="0" x2="60" y2="400" stroke-width="0.2" opacity="0.3"/><path d="M60,20 L75,60 L60,100 L45,60 Z" stroke-width="0.5"/><path d="M60,100 C50,140 25,160 5,175" stroke-width="0.7"/><path d="M60,100 C70,140 95,160 115,175" stroke-width="0.7"/><circle cx="5" cy="175" r="2" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><circle cx="115" cy="175" r="2" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><path d="M60,200 L72,240 L60,280 L48,240 Z" stroke-width="0.4"/><path d="M60,280 C52,310 35,325 18,335" stroke-width="0.5"/><path d="M60,280 C68,310 85,325 102,335" stroke-width="0.5"/><path d="M60,350 L65,375 L60,400 L55,375 Z" stroke-width="0.3" opacity="0.5"/></svg>',
            work: '<svg class="page-sigil page-sigil--left sigil" viewBox="0 0 80 500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><line x1="40" y1="0" x2="40" y2="500" stroke-width="0.2" opacity="0.2"/><path d="M40,30 L55,80 L40,130 L25,80 Z" stroke-width="0.5"/><path d="M40,130 C32,170 15,195 2,210" stroke-width="0.6"/><path d="M40,130 C48,170 65,195 78,210" stroke-width="0.6"/><circle cx="2" cy="210" r="1.5" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><circle cx="78" cy="210" r="1.5" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><path d="M40,250 L50,290 L40,330 L30,290 Z" stroke-width="0.4"/><path d="M40,370 L48,420 L40,470 L32,420 Z" stroke-width="0.3" opacity="0.4"/></svg>',
            capabilities: '<svg class="page-sigil page-sigil--right sigil" viewBox="0 0 100 450" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><line x1="50" y1="0" x2="50" y2="450" stroke-width="0.2" opacity="0.2"/><path d="M50,15 L68,65 L50,115 L32,65 Z" stroke-width="0.5"/><path d="M50,70 C42,95 20,110 5,118" stroke-width="0.6"/><path d="M50,70 C58,95 80,110 95,118" stroke-width="0.6"/><path d="M50,160 L60,200 L50,240 L40,200 Z" stroke-width="0.4"/><path d="M50,240 C44,270 28,285 12,295" stroke-width="0.5"/><path d="M50,240 C56,270 72,285 88,295" stroke-width="0.5"/><circle cx="12" cy="295" r="1.5" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><circle cx="88" cy="295" r="1.5" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><path d="M50,340 L56,380 L50,420 L44,380 Z" stroke-width="0.3" opacity="0.5"/></svg>',
            contact: '<svg class="page-sigil page-sigil--left sigil" viewBox="0 0 100 300" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><line x1="50" y1="0" x2="50" y2="300" stroke-width="0.2" opacity="0.2"/><path d="M50,20 L65,60 L50,100 L35,60 Z" stroke-width="0.5"/><path d="M50,60 C42,80 22,92 5,100" stroke-width="0.6"/><path d="M50,60 C58,80 78,92 95,100" stroke-width="0.6"/><circle cx="5" cy="100" r="2" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><circle cx="95" cy="100" r="2" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><path d="M50,140 L58,180 L50,220 L42,180 Z" stroke-width="0.4"/><path d="M50,250 L55,275 L50,300 L45,275 Z" stroke-width="0.3" opacity="0.4"/></svg>'
        };
        if (pageSigilData[pageType] && pageEl) {
            pageEl.style.position = 'relative';
            pageEl.insertAdjacentHTML('afterbegin', pageSigilData[pageType]);
        }

        // Draw-reveal section divider sigils on scroll
        var dividerSigils = app.querySelectorAll('.section-divider--sigil .sigil');
        dividerSigils.forEach(function (s) {
            var paths = s.querySelectorAll('path, line');
            paths.forEach(function (p) {
                var len = p.getTotalLength ? p.getTotalLength() : 100;
                p.style.strokeDasharray = len;
                p.style.strokeDashoffset = len;
            });
            ScrollTrigger.create({
                trigger: s,
                start: 'top 85%',
                onEnter: function () {
                    paths.forEach(function (p, i) {
                        gsap.to(p, {
                            strokeDashoffset: 0,
                            duration: 1.5,
                            delay: i * 0.05,
                            ease: 'power2.out'
                        });
                    });
                },
                once: true
            });
        });

        // Hero sigil draw
        var heroSigil = app.querySelector('.hero__sigil');
        if (heroSigil) {
            heroSigil.classList.add('sigil--draw');
            // Calculate total path length for dasharray
            var paths = heroSigil.querySelectorAll('path, line');
            paths.forEach(function (p) {
                var len = p.getTotalLength ? p.getTotalLength() : 200;
                p.style.strokeDasharray = len;
                p.style.strokeDashoffset = len;
            });
            // Animate draw on entrance
            setTimeout(function () {
                paths.forEach(function (p, i) {
                    gsap.to(p, {
                        strokeDashoffset: 0,
                        duration: 2,
                        delay: 0.5 + i * 0.08,
                        ease: 'power2.out'
                    });
                });
            }, 300);
        }
    }

    /* ----------------------------------------------------------
       SCROLL-TRIGGERED ANIMATIONS
       ---------------------------------------------------------- */
    function setupScrollAnimations() {
        if (prefersReducedMotion) return;

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

        var projectCards = app.querySelectorAll('.project-card');
        projectCards.forEach(function (card) {
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

        // Line-by-line clip reveal for body text
        var bodyTexts = app.querySelectorAll('.t-body-lg');
        bodyTexts.forEach(function (el) {
            var lines = el.textContent.match(/[^.!?]*[.!?]+[\s]*/g) || [el.textContent];
            if (lines.length < 2) return;
            el.innerHTML = '';
            lines.forEach(function (line) {
                var wrapper = document.createElement('span');
                wrapper.className = 'line-reveal';
                wrapper.style.display = 'block';
                wrapper.style.overflow = 'hidden';
                var inner = document.createElement('span');
                inner.className = 'line-reveal__inner';
                inner.style.display = 'block';
                inner.textContent = line;
                wrapper.appendChild(inner);
                el.appendChild(wrapper);
            });
            var inners = el.querySelectorAll('.line-reveal__inner');
            gsap.fromTo(inners,
                { y: '100%', opacity: 0 },
                {
                    y: '0%',
                    opacity: 1,
                    duration: 0.7,
                    stagger: 0.1,
                    ease: 'expo.out',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 85%',
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
        if (prefersReducedMotion) return;

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
        setupGlowGrid();
    }

    function setupMagneticButtons() {
        if (prefersReducedMotion) return;

        var wraps = app.querySelectorAll('.magnetic-wrap');
        wraps.forEach(function (wrap) {
            var btn = wrap.querySelector('.btn');
            if (!btn) return;

            wrap.addEventListener('mousemove', function (e) {
                var rect = wrap.getBoundingClientRect();
                var x = e.clientX - rect.left - rect.width / 2;
                var y = e.clientY - rect.top - rect.height / 2;
                gsap.to(btn, {
                    x: x * 0.35,
                    y: y * 0.35,
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
       INTERACTIVE TERMINAL
       ---------------------------------------------------------- */
    var TERMINAL_COMMANDS = {
        help: function () {
            return [
                'Available commands:',
                '  whoami        — About me',
                '  skills        — Core competencies',
                '  certs         — Certifications',
                '  contact       — Get in touch',
                '  projects      — Selected work',
                '  tools         — Primary toolkit',
                '  clear         — Clear terminal',
                '  help          — Show this message'
            ].join('\n');
        },
        whoami: function () {
            return 'Vineet Vishesh — Offensive Security Professional\n' +
                   'Red team operator & penetration testing specialist\n' +
                   'Based in India · Available for remote engagements worldwide\n' +
                   '4+ years of controlled offensive validation across web, mobile, network, and cloud.';
        },
        skills: function () {
            return [
                'CORE COMPETENCIES',
                '─────────────────────────────────',
                '  [+] Red Team Operations      [+] Web App Pentesting',
                '  [+] Mobile Security Testing   [+] OSINT & Reconnaissance',
                '  [+] Network Infrastructure    [+] Cloud Security (AWS/Azure)',
                '  [+] Exploit Development       [+] Adversary Simulation'
            ].join('\n');
        },
        certs: function () {
            return [
                'CERTIFICATIONS',
                '─────────────────────────────────',
                '  [✓] CompTIA Security+           — Active (2024–2027)',
                '  [✓] Burp Suite Certified Pract.  — Active (exp. 2026)',
                '  [✓] Nessus Certified Prof.       — Active (exp. 2025)',
                '  [~] OSCP                         — In Preparation'
            ].join('\n');
        },
        contact: function () {
            return [
                'CONTACT',
                '─────────────────────────────────',
                '  Email:    vineetvishesh86@gmail.com',
                '  LinkedIn: linkedin.com/in/vineet-vishesh-66ab95281',
                '  GitHub:   github.com/vinne-1'
            ].join('\n');
        },
        projects: function () {
            return [
                'SELECTED WORK',
                '─────────────────────────────────',
                '  01  Automated OSINT Pipeline Framework',
                '      10K+ records/hr · 94% accuracy · 70% cost reduction',
                '  02  Polymorphic Privilege Escalation Generator',
                '      99.7% unique sigs · 0% detection · 89% success',
                '  03  Enterprise Web App Assessments — 18 critical findings',
                '  04  Mobile Application Security — 7 critical findings',
                '  05  Network & Cloud Assessments — 5 networks, 3 providers'
            ].join('\n');
        },
        tools: function () {
            return [
                'PRIMARY TOOLKIT',
                '─────────────────────────────────',
                '  Burp Suite Pro · Nmap · Metasploit · OWASP ZAP',
                '  Nessus · SQLMap · MobSF · Frida · Wireshark',
                '  Ghidra · Python · Bash · PowerShell · Docker · AWS'
            ].join('\n');
        }
    };

    function setupTerminal() {
        var terminal = app.querySelector('.terminal');
        if (!terminal) return;

        var output = terminal.querySelector('.terminal__output');
        var input = terminal.querySelector('.terminal__input');
        if (!output || !input) return;

        var cmdHistory = [];
        var historyIndex = -1;

        appendOutput(output, 'Welcome to vineet.sh \u2014 Type "help" for available commands.\n');

        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIndex < cmdHistory.length - 1) {
                    historyIndex++;
                    input.value = cmdHistory[cmdHistory.length - 1 - historyIndex];
                }
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    input.value = cmdHistory[cmdHistory.length - 1 - historyIndex];
                } else {
                    historyIndex = -1;
                    input.value = '';
                }
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                var partial = input.value.trim().toLowerCase();
                if (!partial) return;
                var matches = Object.keys(TERMINAL_COMMANDS).filter(function (k) {
                    return k.indexOf(partial) === 0;
                });
                if (matches.length === 1) {
                    input.value = matches[0];
                } else if (matches.length > 1) {
                    appendOutput(output, '\n' + matches.join('  '));
                    output.scrollTop = output.scrollHeight;
                }
                return;
            }
            if (e.key === 'Enter') {
                var cmd = input.value.trim().toLowerCase();
                input.value = '';
                historyIndex = -1;

                if (!cmd) return;

                cmdHistory.push(cmd);

                appendOutput(output, '\n<span style="color:var(--crimson)">visitor@vineet</span>:<span style="color:var(--gray-300)">~</span>$ ' + escapeHtml(cmd));

                if (cmd === 'clear') {
                    output.innerHTML = '';
                    return;
                }

                var handler = TERMINAL_COMMANDS[cmd];
                if (handler) {
                    appendOutput(output, '\n' + escapeHtml(handler()));
                } else {
                    appendOutput(output, '\nCommand not found: ' + escapeHtml(cmd) + '. Type "help" for available commands.');
                }

                output.scrollTop = output.scrollHeight;
            }
        });

        terminal.addEventListener('click', function () {
            input.focus();
        });
    }

    function appendOutput(container, html) {
        container.insertAdjacentHTML('beforeend', html);
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /* ----------------------------------------------------------
       MATRIX RAIN CANVAS
       ---------------------------------------------------------- */
    var matrixAnimFrame = null;

    function setupMatrixCanvas() {
        var canvas = app.querySelector('#heroMatrix');
        if (!canvas || prefersReducedMotion) return;

        var ctx = canvas.getContext('2d');
        var parent = canvas.parentElement;
        var fontSize = 14;
        var columns, drops;

        function resize() {
            canvas.width = parent.offsetWidth;
            canvas.height = parent.offsetHeight;
            columns = Math.floor(canvas.width / fontSize);
            drops = [];
            for (var i = 0; i < columns; i++) {
                drops[i] = Math.random() * -100;
            }
        }
        resize();

        // Clean up previous resize listener before adding new one
        if (window._matrixResizeHandler) {
            window.removeEventListener('resize', window._matrixResizeHandler);
        }
        window._matrixResizeHandler = resize;
        window.addEventListener('resize', resize);

        var chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

        function draw() {
            var isLight = document.documentElement.getAttribute('data-theme') === 'light';
            ctx.fillStyle = isLight ? 'rgba(245, 245, 245, 0.06)' : 'rgba(10, 10, 10, 0.06)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = fontSize + 'px monospace';

            for (var j = 0; j < drops.length; j++) {
                var char = chars[Math.floor(Math.random() * chars.length)];
                var x = j * fontSize;
                var y = drops[j] * fontSize;

                if (Math.random() > 0.97) {
                    ctx.fillStyle = isLight ? 'rgba(181, 13, 39, 0.7)' : 'rgba(200, 16, 46, 0.9)';
                } else {
                    ctx.fillStyle = isLight ? 'rgba(181, 13, 39, 0.08)' : 'rgba(200, 16, 46, 0.15)';
                }

                ctx.fillText(char, x, y);

                if (y > canvas.height && Math.random() > 0.98) {
                    drops[j] = 0;
                }
                drops[j] += 0.5;
            }

            matrixAnimFrame = requestAnimationFrame(draw);
        }

        draw();
    }

    function stopMatrixCanvas() {
        if (matrixAnimFrame) {
            cancelAnimationFrame(matrixAnimFrame);
            matrixAnimFrame = null;
        }
        if (window._matrixResizeHandler) {
            window.removeEventListener('resize', window._matrixResizeHandler);
            window._matrixResizeHandler = null;
        }
    }

    /* ----------------------------------------------------------
       PARTICLE NETWORK MESH (Home hero overlay)
       ---------------------------------------------------------- */
    var particleAnimFrame = null;

    function setupParticleNetwork() {
        var canvas = app.querySelector('#heroParticles');
        if (!canvas || prefersReducedMotion) return;

        var ctx = canvas.getContext('2d');
        var parent = canvas.parentElement;
        var particles = [];
        var PARTICLE_COUNT = 40;
        var CONNECTION_DIST = 120;
        var isLight = document.documentElement.getAttribute('data-theme') === 'light';

        function resize() {
            canvas.width = parent.offsetWidth;
            canvas.height = parent.offsetHeight;
        }
        resize();

        if (window._particleResizeHandler) {
            window.removeEventListener('resize', window._particleResizeHandler);
        }
        window._particleResizeHandler = resize;
        window.addEventListener('resize', resize);

        for (var i = 0; i < PARTICLE_COUNT; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 2 + 1
            });
        }

        function draw() {
            isLight = document.documentElement.getAttribute('data-theme') === 'light';
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            var nodeColor = isLight ? 'rgba(181, 13, 39, 0.5)' : 'rgba(200, 16, 46, 0.6)';
            var lineColor = isLight ? 'rgba(181, 13, 39, 0.08)' : 'rgba(200, 16, 46, 0.12)';

            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = nodeColor;
                ctx.fill();

                for (var j = i + 1; j < particles.length; j++) {
                    var q = particles[j];
                    var dx = p.x - q.x;
                    var dy = p.y - q.y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < CONNECTION_DIST) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.strokeStyle = lineColor;
                        ctx.lineWidth = 0.5;
                        ctx.globalAlpha = 1 - (dist / CONNECTION_DIST);
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                }
            }

            particleAnimFrame = requestAnimationFrame(draw);
        }

        draw();
    }

    function stopParticleNetwork() {
        if (particleAnimFrame) {
            cancelAnimationFrame(particleAnimFrame);
            particleAnimFrame = null;
        }
        if (window._particleResizeHandler) {
            window.removeEventListener('resize', window._particleResizeHandler);
            window._particleResizeHandler = null;
        }
    }

    /* ----------------------------------------------------------
       PARALLAX ELEMENTS (About page 3D scroll)
       ---------------------------------------------------------- */
    function setupParallaxElements() {
        if (prefersReducedMotion) return;

        var parallaxItems = app.querySelectorAll('[data-parallax-y]');
        parallaxItems.forEach(function (el) {
            var yAmount = parseInt(el.getAttribute('data-parallax-y'), 10) || 20;
            gsap.fromTo(el,
                { y: 0 },
                {
                    y: -yAmount,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: 1.5
                    }
                }
            );
        });

        // Timeline line draw effect
        var timelineLine = app.querySelector('.timeline__line');
        if (timelineLine) {
            gsap.fromTo(timelineLine,
                { scaleY: 0, transformOrigin: 'top' },
                {
                    scaleY: 1,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: '.timeline',
                        start: 'top 80%',
                        end: 'bottom 40%',
                        scrub: 1
                    }
                }
            );
        }

        // Timeline dots pulse in
        var timelineDots = app.querySelectorAll('.timeline__dot');
        timelineDots.forEach(function (dot) {
            gsap.fromTo(dot,
                { scale: 0 },
                {
                    scale: 1,
                    duration: 0.4,
                    ease: 'back.out(2)',
                    scrollTrigger: {
                        trigger: dot,
                        start: 'top 85%',
                        once: true
                    }
                }
            );
        });
    }

    /* ----------------------------------------------------------
       ENHANCED CARD HOVER GLOW
       ---------------------------------------------------------- */
    function setupCardHoverGlow() {
        var cards = app.querySelectorAll('.project-card');
        cards.forEach(function (card) {
            // Add glow element if not present
            if (!card.querySelector('.project-card__hover-glow')) {
                var glow = document.createElement('div');
                glow.className = 'project-card__hover-glow';
                card.appendChild(glow);
            }

            card.addEventListener('mousemove', function (e) {
                var rect = card.getBoundingClientRect();
                var x = ((e.clientX - rect.left) / rect.width) * 100;
                var y = ((e.clientY - rect.top) / rect.height) * 100;
                card.style.setProperty('--mouse-x', x + '%');
                card.style.setProperty('--mouse-y', y + '%');
            });
        });
    }

    /* ----------------------------------------------------------
       LIVE THREAT FEED
       ---------------------------------------------------------- */
    var THREAT_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:4000/api/cyber-news'
        : 'https://cyber-portfolio-hcxt.onrender.com/api/cyber-news';

    function setupThreatFeed() {
        var feedEl = app.querySelector('#threatFeed');
        if (!feedEl) return;

        fetch(THREAT_API)
            .then(function (res) {
                if (!res.ok) throw new Error('Feed unavailable');
                return res.json();
            })
            .then(function (data) {
                var articles = (data.articles || []).slice(0, 6);
                if (!articles.length) {
                    feedEl.innerHTML = '<div class="threat-feed__fallback">No threat intelligence available at this time.</div>';
                    return;
                }

                var ALLOWED_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
                function safeSeverity(sev) {
                    var s = (sev || 'medium').toLowerCase();
                    return ALLOWED_SEVERITIES.indexOf(s) !== -1 ? s : 'medium';
                }
                function safeUrl(url) {
                    if (!url) return '#';
                    try { var p = new URL(url); return (p.protocol === 'https:' || p.protocol === 'http:') ? url : '#'; }
                    catch (e) { return '#'; }
                }

                feedEl.innerHTML = articles.map(function (a) {
                    var sev = safeSeverity(a.severity);
                    var sevClass = 'threat-card__severity--' + sev;
                    var tags = (a.tags || []).map(function (t) {
                        return '<span class="threat-card__tag">' + escapeHtml(t) + '</span>';
                    }).join('');
                    var summary = a.summary ? a.summary.substring(0, 160) : '';

                    return '<div class="threat-card">' +
                        '<div class="threat-card__header">' +
                            '<span class="threat-card__severity ' + sevClass + '">' + escapeHtml(a.severity || 'Medium') + '</span>' +
                            '<span class="threat-card__source">' + escapeHtml(a.source || '') + '</span>' +
                        '</div>' +
                        '<div class="threat-card__title"><a href="' + escapeHtml(safeUrl(a.url)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(a.title || 'Untitled') + '</a></div>' +
                        (summary ? '<div class="threat-card__summary">' + escapeHtml(summary) + '</div>' : '') +
                        (tags ? '<div class="threat-card__tags">' + tags + '</div>' : '') +
                    '</div>';
                }).join('');

                // Animate cards in
                if (!prefersReducedMotion) {
                    var cards = feedEl.querySelectorAll('.threat-card');
                    gsap.fromTo(cards,
                        { opacity: 0, y: 20 },
                        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'expo.out' }
                    );
                }
            })
            .catch(function () {
                feedEl.innerHTML = '<div class="threat-feed__fallback">Threat feed offline — start the backend with <code style="color:var(--crimson)">npm start</code> in the <code>backend/</code> directory.</div>';
            });
    }

    /* ----------------------------------------------------------
       HASH CHANGE LISTENER
       ---------------------------------------------------------- */
    window.addEventListener('hashchange', function () {
        var route = getRouteFromHash();
        loadPage(route, false);
        // Track SPA navigation in Umami
        if (typeof umami !== 'undefined') {
            umami.track(function (props) { return Object.assign(Object.assign({}, props), { url: window.location.pathname + window.location.hash }); });
        }
    });

    document.addEventListener('click', function (e) {
        var link = e.target.closest('[data-route]');
        if (!link) return;

        var href = link.getAttribute('href');
        if (!href || href.charAt(0) !== '#') return;

        closeMobile();
    });

    /* ----------------------------------------------------------
       PRELOADER
       ---------------------------------------------------------- */
    function runPreloader(callback) {
        var preloader = document.getElementById('preloader');
        if (!preloader) { callback(); return; }

        if (prefersReducedMotion) {
            preloader.style.display = 'none';
            callback();
            return;
        }

        var paths = preloader.querySelectorAll('.preloader__sigil-path');
        var dots = preloader.querySelectorAll('.preloader__sigil-dot');
        var logo = preloader.querySelector('.preloader__logo');
        var tagline = preloader.querySelector('.preloader__tagline');

        var tl = gsap.timeline({
            onComplete: function () {
                gsap.to(preloader, {
                    opacity: 0,
                    duration: 0.4,
                    ease: 'power2.inOut',
                    onComplete: function () {
                        preloader.style.display = 'none';
                        callback();
                    }
                });
            }
        });

        // Draw sigil paths sequentially
        tl.to(paths, {
            strokeDashoffset: 0,
            duration: 1.4,
            stagger: 0.08,
            ease: 'power2.inOut'
        })
        // Pop in accent dots
        .to(dots, {
            opacity: 1,
            scale: 1,
            duration: 0.3,
            stagger: 0.05,
            ease: 'back.out(3)'
        }, '-=0.4')
        // Fade in text
        .to(logo, { opacity: 1, duration: 0.4, ease: 'power2.out' }, '-=0.3')
        .to(tagline, { opacity: 1, duration: 0.3, ease: 'power2.out' }, '-=0.2')
        .to({}, { duration: 0.3 }); // Brief pause before exit
    }

    /* ----------------------------------------------------------
       INIT
       ---------------------------------------------------------- */
    function init() {
        runPreloader(function () {
            var route = getRouteFromHash();
            loadPage(route, false);

            requestAnimationFrame(function () {
                document.body.classList.add('ready');
            });

            handleNavScroll();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
