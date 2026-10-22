'use strict';

/* ============================================================
   APP.JS — SPA Engine v2
   Hash router · GSAP + Lenis + Splitting · Preloader · Custom Cursor
   Interactive Terminal · Scroll Progress · Reduced Motion
   Vineet Vishesh · Offensive Security
   ============================================================ */

(function () {

    /* ----------------------------------------------------------
       REDUCED MOTION CHECK
       ---------------------------------------------------------- */
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hasGSAP = typeof gsap !== 'undefined';
    var animationsDisabled = prefersReducedMotion || !hasGSAP;

    /* ----------------------------------------------------------
       GSAP SETUP
       ---------------------------------------------------------- */
    var hasScrollTrigger = hasGSAP && typeof ScrollTrigger !== 'undefined';
    if (hasScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
    }

    /* ----------------------------------------------------------
       LENIS SMOOTH SCROLL (skip if reduced motion)
       ---------------------------------------------------------- */
    var lenis = null;
    if (!animationsDisabled && typeof Lenis !== 'undefined') {
        lenis = new Lenis({
            duration: 1.2,
            easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
            orientation: 'vertical',
            smoothWheel: true
        });

        if (hasScrollTrigger) {
            lenis.on('scroll', ScrollTrigger.update);
        }
        gsap.ticker.add(function (time) {
            lenis.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);
    }

    /* ----------------------------------------------------------
       CLEANUP TRACKING
       ---------------------------------------------------------- */
    var pendingTimers = [];
    var pendingRAFs = [];
    var pendingIntervals = [];
    var activeFetchController = null;

    function trackTimeout(fn, delay) {
        var id = setTimeout(fn, delay);
        pendingTimers.push(id);
        return id;
    }

    function trackInterval(fn, delay) {
        var id = setInterval(fn, delay);
        pendingIntervals.push(id);
        return id;
    }

    function cleanupPending() {
        pendingTimers.forEach(clearTimeout);
        pendingTimers = [];
        pendingRAFs.forEach(cancelAnimationFrame);
        pendingRAFs = [];
        pendingIntervals.forEach(clearInterval);
        pendingIntervals = [];
        if (activeFetchController) {
            activeFetchController.abort();
            activeFetchController = null;
        }
    }

    /* ----------------------------------------------------------
       CUSTOM CURSOR
       ---------------------------------------------------------- */
    var cursorDot = document.getElementById('cursorDot');
    var cursorRing = document.getElementById('cursorRing');
    var mouseX = 0, mouseY = 0;
    var ringX = 0, ringY = 0;

    if (cursorDot && cursorRing && window.matchMedia('(pointer: fine)').matches && !animationsDisabled) {
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
    function syncBackToTop() {
        if (!backToTop) return;
        var isVisible = window.scrollY > 400 && !mobileOpen;
        backToTop.classList.toggle('visible', isVisible);
        backToTop.toggleAttribute('inert', !isVisible);
        backToTop.setAttribute('aria-hidden', String(!isVisible));
        backToTop.tabIndex = isVisible ? 0 : -1;
        if (!isVisible && document.activeElement === backToTop) backToTop.blur();
    }
    if (backToTop) {
        window.addEventListener('scroll', syncBackToTop, { passive: true });
        syncBackToTop();
        backToTop.addEventListener('click', function () {
            if (lenis) {
                lenis.scrollTo(0);
            } else {
                window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
            }
        });
    }

    /* ----------------------------------------------------------
       ROUTE CONFIG (HTML5 History API)
       ---------------------------------------------------------- */
    var BASE_PATH = window.location.hostname === 'vinne-1.github.io' ? '/cyber-portfolio-cybersigil' : '';
    var SITE_ORIGIN = 'https://vineedoesstuff.in';

    var ROUTES = {
        '/':               'page-home',
        '/about':          'page-about',
        '/work':           'page-work',
        '/products':       'page-products',
        '/tools/website-health': 'page-tool-website-health',
        '/threat-landscape': 'page-threat-landscape',
        '/credentials':    'page-credentials',
        '/contact':        'page-contact',
        '/privacy':        'page-privacy',
        '/404':            'page-404'
    };

    var ROUTE_TITLES = {
        '/':               'Vineet Vishesh — Offensive Security',
        '/about':          'About — Vineet Vishesh',
        '/work':           'Work & Capabilities — Vineet Vishesh',
        '/products':       'Products — Vineet Vishesh',
        '/tools/website-health': 'Website Health Report — Vineet Vishesh',
        '/threat-landscape': 'Threat Landscape — Vineet Vishesh',
        '/credentials':    'Credentials — Vineet Vishesh',
        '/contact':        'Contact — Vineet Vishesh',
        '/privacy':        'Privacy Policy — Vineet Vishesh',
        '/404':            '404 — Vineet Vishesh'
    };

    var ROUTE_DESCRIPTIONS = {
        '/':               'Vineet Vishesh — Offensive Security Specialist. Penetration tester and red team analyst with 3+ years of combined experience across web, API, network, and cloud environments.',
        '/about':          'About Vineet Vishesh — offensive security background, methodology, certifications, and skill proficiency.',
        '/work':           'Selected offensive security work and capabilities — web/API VAPT, SIEM detection engineering, toolkit, and skill proficiency.',
        '/products':       'Products built by Vineet Vishesh — independent apps, starting with TithiPath, plus free tools including a Website Health Report and a live Threat Landscape feed.',
        '/tools/website-health': 'Free Website Health Report — security headers, SEO, performance, SSL/TLS, and DNS analysis for any URL.',
        '/threat-landscape': 'Live cybersecurity threat landscape — deduplicated coverage from 6 sources, ranked by severity, corroboration, and recency.',
        '/credentials':    'Certifications and credentials — CompTIA Security+, Certified Red Team Analyst (CRTA), and professional endorsements.',
        '/contact':        'Get in touch with Vineet Vishesh for offensive security engagements, red team operations, and penetration testing.',
        '/privacy':        'How this site handles data — analytics, the free tools, local storage, and advertising disclosure.',
        '/404':            'Page not found — Vineet Vishesh offensive security portfolio.'
    };

    var app = document.getElementById('app');
    var currentRoute = null;
    var isTransitioning = false;
    // Last-wins queue: rapid nav clicks during a transition used to pushState
    // the new URL then bail out of loadPage, leaving URL and content out of sync.
    var pendingRoute = null;

    function showAppImmediately() {
        if (!app) return;
        app.style.opacity = '1';
        app.style.transform = 'none';
    }

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

    function setMobileInert(isInert) {
        if (!mobileMenu) return;
        if (isInert) {
            mobileMenu.setAttribute('inert', '');
        } else {
            mobileMenu.removeAttribute('inert');
        }
        // Fallback for browsers without `inert` support: pull focusable
        // children out of the tab order directly so they can't be
        // keyboard-focused while the panel is visually hidden.
        mobileMenu.querySelectorAll('a, button').forEach(function (el) {
            if (isInert) {
                el.setAttribute('tabindex', '-1');
            } else {
                el.removeAttribute('tabindex');
            }
        });
    }

    function setMenuBackgroundInert(isInert) {
        [
            app,
            document.querySelector('.skip-link'),
            document.querySelector('.footer'),
            document.querySelector('.nav__logo'),
            document.querySelector('.nav__links'),
            document.querySelector('.nav__cta-wrap')
        ].forEach(function (el) {
            if (!el) return;
            el.toggleAttribute('inert', isInert);
        });
        syncBackToTop();
    }

    function getMobileFocusables() {
        var focusables = mobileMenu
            ? Array.prototype.slice.call(mobileMenu.querySelectorAll('a[href], button:not([disabled])'))
            : [];
        if (burger) focusables.unshift(burger);
        return focusables;
    }
    setMobileInert(true);

    function syncBurgerLabel() {
        if (!burger) return;
        burger.setAttribute(
            'aria-label',
            mobileOpen ? 'Close navigation menu' : 'Open navigation menu'
        );
    }

    if (burger) burger.addEventListener('click', function () {
        if (mobileOpen) {
            closeMobile();
            return;
        }
        mobileOpen = true;
        burger.setAttribute('aria-expanded', 'true');
        burger.classList.add('open');
        syncBurgerLabel();
        mobileMenu.classList.add('active');
        mobileMenu.setAttribute('aria-hidden', 'false');
        setMobileInert(false);
        setMenuBackgroundInert(true);
        document.body.style.overflow = 'hidden';
        var focusables = getMobileFocusables();
        if (focusables.length > 1) focusables[1].focus();
    });

    function closeMobile(restoreFocus) {
        var wasOpen = mobileOpen;
        mobileOpen = false;
        if (burger) burger.setAttribute('aria-expanded', 'false');
        if (burger) burger.classList.remove('open');
        syncBurgerLabel();
        if (mobileMenu) {
            mobileMenu.classList.remove('active');
            mobileMenu.setAttribute('aria-hidden', 'true');
            setMobileInert(true);
        }
        setMenuBackgroundInert(false);
        document.body.style.overflow = '';
        if (wasOpen && burger && restoreFocus !== false) burger.focus();
    }

    mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeMobile);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mobileOpen) {
            closeMobile();
            return;
        }
        if (e.key === 'Tab' && mobileOpen) {
            var focusables = getMobileFocusables();
            if (!focusables.length) return;
            var first = focusables[0];
            var last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            } else if (focusables.indexOf(document.activeElement) === -1) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    window.addEventListener('resize', function () {
        if (mobileOpen && window.innerWidth > 768) {
            closeMobile(false);
            focusMainLandmark();
        }
    }, { passive: true });

    function updateActiveNav(route) {
        document.querySelectorAll('#nav [data-route], #navMobile [data-route]').forEach(function (link) {
            var href = link.getAttribute('href');
            var linkRoute = href ? href.replace(BASE_PATH, '') || '/' : '';
            if (linkRoute === route) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
        document.querySelectorAll('.nav__link').forEach(function (link) {
            var href = link.getAttribute('href');
            var linkRoute = href ? href.replace(BASE_PATH, '') || '/' : '';
            if (linkRoute === route) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        // Home has no numbered nav link — mark the brand logo instead so
        // visitors can tell which "plane" they're on.
        var logo = document.querySelector('.nav__logo');
        if (logo) {
            if (route === '/') {
                logo.classList.add('active');
            } else {
                logo.classList.remove('active');
            }
        }
    }

    /* ----------------------------------------------------------
       PAGE TRANSITIONS — Per-Route Variants
       ---------------------------------------------------------- */
    var transitionSigil = document.getElementById('transitionSigil');

    function transitionOut() {
        if (animationsDisabled) return Promise.resolve();

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
    function getRouteFromPath() {
        var path = window.location.pathname;
        // Strip base path prefix
        if (path.indexOf(BASE_PATH) === 0) {
            path = path.slice(BASE_PATH.length) || '/';
        }
        // Normalize trailing slash
        if (path !== '/' && path.charAt(path.length - 1) === '/') {
            path = path.slice(0, -1);
        }
        if (!ROUTES[path]) { path = '/404'; }
        return path;
    }

    function focusMainLandmark() {
        if (!app) return;
        // Move keyboard/AT focus into the new page content after SPA navigation.
        // tabindex=-1 keeps #app out of the normal tab order while allowing focus().
        if (!app.hasAttribute('tabindex')) {
            app.setAttribute('tabindex', '-1');
        }
        try {
            app.focus({ preventScroll: true });
        } catch (err) {
            app.focus();
        }
    }

    function finishRouteTransition() {
        isTransitioning = false;
        if (pendingRoute && pendingRoute !== currentRoute) {
            var next = pendingRoute;
            pendingRoute = null;
            loadPage(next, false);
        } else {
            pendingRoute = null;
        }
    }

    function loadPage(route, skipTransition) {
        if (isTransitioning) {
            pendingRoute = route;
            return;
        }

        var templateId = ROUTES[route];
        if (!templateId) return;

        var template = document.getElementById(templateId);
        if (!template) return;

        document.title = ROUTE_TITLES[route] || ROUTE_TITLES['/'];
        var metaDesc = document.querySelector('meta[name="description"]');
        var routeDescription = ROUTE_DESCRIPTIONS[route] || ROUTE_DESCRIPTIONS['/'];
        if (metaDesc) metaDesc.setAttribute('content', routeDescription);

        // Keep canonical URL / Open Graph metadata in sync with the route so
        // crawlers and link-preview bots see the real page, not always the
        // homepage (SPA routing never navigates, so these otherwise stay static).
        var canonicalUrl = SITE_ORIGIN + (route === '/' ? '/' : route);
        var canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink) canonicalLink.setAttribute('href', canonicalUrl);
        var ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) ogUrl.setAttribute('content', canonicalUrl);
        var ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', document.title);
        var ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', routeDescription);
        // Twitter Card tags mirror the OG ones -- without this they stay stuck
        // on the homepage's title/description for every route, same bug as above.
        var twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) twitterTitle.setAttribute('content', document.title);
        var twitterDesc = document.querySelector('meta[name="twitter:description"]');
        if (twitterDesc) twitterDesc.setAttribute('content', routeDescription);

        updateActiveNav(route);
        var announcer = document.getElementById('routeAnnouncer');
        if (announcer) announcer.textContent = document.title;

        if (skipTransition || currentRoute === null) {
            var isFirstLoad = currentRoute === null;
            renderPage(template);
            currentRoute = route;
            if (!isFirstLoad) {
                focusMainLandmark();
            }
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

        if (hasScrollTrigger) {
            ScrollTrigger.getAll().forEach(function (st) { st.kill(); });
            ScrollTrigger.refresh();
        }
        cleanupPending();
        stopHeroVisibilityObserver();
        stopMatrixCanvas();
        stopParticleNetwork();

        transitionOut().then(function () {
            renderPage(template);
            focusMainLandmark();
            if (lenis) {
                lenis.scrollTo(0, { immediate: true });
            } else {
                window.scrollTo(0, 0);
            }
            handleNavScroll();

            // Fade in the new page (skip the tween under reduced motion —
            // just land on the final state instantly)
            if (animationsDisabled) {
                showAppImmediately();
            } else {
                gsap.fromTo(app,
                    { opacity: 0, y: 15 },
                    { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
                );
            }

            animatePageEntrance();

            if (animationsDisabled) {
                finishRouteTransition();
            } else {
                setTimeout(finishRouteTransition, 600);
            }
        }).catch(function () {
            showAppImmediately();
            finishRouteTransition();
        });
    }

    function renderPage(template) {
        app.innerHTML = '';
        var content = template.content.cloneNode(true);
        app.appendChild(content);
    }

    function animatePageEntrance() {
        if (animationsDisabled) {
            // Just make everything visible immediately
            var allItems = app.querySelectorAll('.anim-item, .project-card, .cap-card, .trust-item, .stat-block, .split-heading .char');
            allItems.forEach(function (el) {
                el.style.opacity = '1';
                el.style.transform = 'none';
            });
            setupInteractions();
            setupTerminal();
            setupThreatFeed();
            setupThreatLandscapePage();
            setupWebsiteHealthTool();
            setupDevice3DShowcase();
            setupCardHoverGlow();
            return;
        }

        // Splitting.js for headings (degrade gracefully if the CDN script didn't load)
        if (typeof Splitting !== 'undefined') {
            var splitTargets = app.querySelectorAll('.split-heading');
            splitTargets.forEach(function (el) {
                // Splitting.js rewrites the heading's text into many
                // per-character <span> wrappers for the stagger animation.
                // Screen readers can read those inconsistently (dropped
                // spacing / char-by-char announcement), so give the
                // heading an explicit accessible name up front and hide
                // the generated markup from assistive tech.
                var fullText = el.textContent.trim();
                Splitting({ target: el, by: 'chars' });
                el.setAttribute('aria-label', fullText);
                el.querySelectorAll('.word, .char').forEach(function (part) {
                    part.setAttribute('aria-hidden', 'true');
                });
            });
        }

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
        setupThreatLandscapePage();
        setupWebsiteHealthTool();
        setupDevice3DShowcase();
        setupMatrixCanvas();
        setupParticleNetwork();
        setupHeroVisibilityObserver();
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

        trackTimeout(function () {
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
                var id = requestAnimationFrame(animate);
                pendingRAFs.push(id);
            }
            var id = requestAnimationFrame(animate);
            pendingRAFs.push(id);
        }, delay * 1000);
    }

    /* ----------------------------------------------------------
       TEXT STROKE OUTLINE-TO-FILL ON SCROLL
       ---------------------------------------------------------- */
    function setupTextStrokeReveal() {
        if (animationsDisabled || !hasScrollTrigger) return;
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
        if (animationsDisabled || window.matchMedia('(pointer: coarse)').matches) return;
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
        if (animationsDisabled) return;
        var drawSigils = app.querySelectorAll('.sigil--draw');
        drawSigils.forEach(function (s) {
            if (hasScrollTrigger) {
                ScrollTrigger.create({
                    trigger: s,
                    start: 'top 85%',
                    onEnter: function () { s.classList.add('is-drawn'); },
                    once: true
                });
            } else {
                s.classList.add('is-drawn');
            }
        });

        // Page-specific background sigils
        var pageEl = app.querySelector('[data-page]');
        var pageType = pageEl ? pageEl.getAttribute('data-page') : '';
        var pageSigilData = {
            about: '<svg class="page-sigil page-sigil--right sigil" viewBox="0 0 120 400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><line x1="60" y1="0" x2="60" y2="400" stroke-width="0.2" opacity="0.3"/><path d="M60,20 L75,60 L60,100 L45,60 Z" stroke-width="0.5"/><path d="M60,100 C50,140 25,160 5,175" stroke-width="0.7"/><path d="M60,100 C70,140 95,160 115,175" stroke-width="0.7"/><circle cx="5" cy="175" r="2" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><circle cx="115" cy="175" r="2" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><path d="M60,200 L72,240 L60,280 L48,240 Z" stroke-width="0.4"/><path d="M60,280 C52,310 35,325 18,335" stroke-width="0.5"/><path d="M60,280 C68,310 85,325 102,335" stroke-width="0.5"/><path d="M60,350 L65,375 L60,400 L55,375 Z" stroke-width="0.3" opacity="0.5"/></svg>',
            work: '<svg class="page-sigil page-sigil--left sigil" viewBox="0 0 80 500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><line x1="40" y1="0" x2="40" y2="500" stroke-width="0.2" opacity="0.2"/><path d="M40,30 L55,80 L40,130 L25,80 Z" stroke-width="0.5"/><path d="M40,130 C32,170 15,195 2,210" stroke-width="0.6"/><path d="M40,130 C48,170 65,195 78,210" stroke-width="0.6"/><circle cx="2" cy="210" r="1.5" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><circle cx="78" cy="210" r="1.5" fill="currentColor" opacity="0.3" style="color:var(--crimson)"/><path d="M40,250 L50,290 L40,330 L30,290 Z" stroke-width="0.4"/><path d="M40,370 L48,420 L40,470 L32,420 Z" stroke-width="0.3" opacity="0.4"/></svg>',
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
            if (hasScrollTrigger) {
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
            } else {
                paths.forEach(function (p) { p.style.strokeDashoffset = 0; });
            }
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
        if (animationsDisabled) return;

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
        if (animationsDisabled) return;

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
        if (animationsDisabled) return;

        var wraps = app.querySelectorAll('.magnetic-wrap');
        wraps.forEach(function (wrap) {
            var btn = wrap.querySelector('.btn');
            if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;

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
                   'Penetration tester & red team analyst\n' +
                   'Based in India · Open to new opportunities\n' +
                   '3+ years of combined experience across VAPT, SOC/detection engineering, and technical training.';
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
                '  [✓] CompTIA Security+                — Active',
                '  [✓] Certified Red Team Analyst (CRTA) — Cyberwarfare Labs, May 2026',
                '  [~] OSCP                              — In Preparation'
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
                '  01  Web & API VAPT',
                '      Burp Suite · Nessus · OWASP Top 10 / API Top 10 · CVSS',
                '  02  SIEM Detection Engineering',
                '      AWS + Google Workspace telemetry · MITRE ATT&CK correlation',
                '  03  Mobile Application Security — methodology'
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
                var partial = input.value.trim().toLowerCase();
                if (!partial) return;
                e.preventDefault();
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

                appendPromptLine(output, cmd);

                if (cmd === 'clear') {
                    output.innerHTML = '';
                    return;
                }

                var handler = TERMINAL_COMMANDS[cmd];
                if (handler) {
                    appendOutput(output, handler());
                } else {
                    appendOutput(output, 'Command not found: ' + cmd + '. Type "help" for available commands.', true);
                }

                output.scrollTop = output.scrollHeight;
            }
        });

        terminal.addEventListener('click', function () {
            input.focus();
        });
    }

    function appendPromptLine(container, cmd) {
        var line = document.createElement('div');
        var user = document.createElement('span');
        user.style.color = 'var(--crimson-text)';
        user.textContent = 'visitor@vineet';
        var sep = document.createElement('span');
        sep.style.color = 'var(--gray-300)';
        sep.textContent = ':~';
        var dollar = document.createTextNode('$ ' + cmd);
        line.appendChild(user);
        line.appendChild(sep);
        line.appendChild(dollar);
        container.appendChild(line);
    }

    function appendOutput(container, text, isError) {
        var line = document.createElement('div');
        if (isError) {
            line.style.color = 'var(--crimson-text)';
        }
        line.textContent = text;
        container.appendChild(line);
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
    var matrixResizeHandler = null;
    var particleResizeHandler = null;
    var heroVisibilityObserver = null;

    function isMobileViewport() { return window.innerWidth < 768; }

    function setupMatrixCanvas() {
        if (isMobileViewport()) return;
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
        if (matrixResizeHandler) {
            window.removeEventListener('resize', matrixResizeHandler);
        }
        matrixResizeHandler = resize;
        window.addEventListener('resize', resize);

        var chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

        function draw() {
            ctx.fillStyle = 'rgba(10, 10, 10, 0.06)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = fontSize + 'px monospace';

            for (var j = 0; j < drops.length; j++) {
                var char = chars[Math.floor(Math.random() * chars.length)];
                var x = j * fontSize;
                var y = drops[j] * fontSize;

                if (Math.random() > 0.97) {
                    ctx.fillStyle = 'rgba(165, 13, 34, 0.9)';
                } else {
                    ctx.fillStyle = 'rgba(165, 13, 34, 0.15)';
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
        if (matrixResizeHandler) {
            window.removeEventListener('resize', matrixResizeHandler);
            matrixResizeHandler = null;
        }
    }

    /* ----------------------------------------------------------
       PARTICLE NETWORK MESH (Home hero overlay)
       ---------------------------------------------------------- */
    var particleAnimFrame = null;

    function setupParticleNetwork() {
        if (isMobileViewport()) return;
        var canvas = app.querySelector('#heroParticles');
        if (!canvas || prefersReducedMotion) return;

        var ctx = canvas.getContext('2d');
        var parent = canvas.parentElement;
        var particles = [];
        var PARTICLE_COUNT = 40;
        var CONNECTION_DIST = 120;

        function resize() {
            canvas.width = parent.offsetWidth;
            canvas.height = parent.offsetHeight;
        }
        resize();

        if (particleResizeHandler) {
            window.removeEventListener('resize', particleResizeHandler);
        }
        particleResizeHandler = resize;
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
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            var nodeColor = 'rgba(165, 13, 34, 0.6)';
            var lineColor = 'rgba(165, 13, 34, 0.12)';

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
        if (particleResizeHandler) {
            window.removeEventListener('resize', particleResizeHandler);
            particleResizeHandler = null;
        }
    }

    /* ----------------------------------------------------------
       HERO VISIBILITY OBSERVER
       Pauses the matrix/particle canvases while the hero is
       scrolled off-screen, resumes them when it re-enters view.
       ---------------------------------------------------------- */
    function setupHeroVisibilityObserver() {
        stopHeroVisibilityObserver();

        if (typeof IntersectionObserver === 'undefined') return;

        var heroEl = app.querySelector('.hero.section[data-page="home"]');
        if (!heroEl) return;

        heroVisibilityObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    // Guard against re-starting an already-running loop
                    // (e.g. the initial observe firing right after setup).
                    if (!matrixAnimFrame) setupMatrixCanvas();
                    if (!particleAnimFrame) setupParticleNetwork();
                } else {
                    stopMatrixCanvas();
                    stopParticleNetwork();
                }
            });
        }, { threshold: 0 });

        heroVisibilityObserver.observe(heroEl);
    }

    function stopHeroVisibilityObserver() {
        if (heroVisibilityObserver) {
            heroVisibilityObserver.disconnect();
            heroVisibilityObserver = null;
        }
    }

    /* ----------------------------------------------------------
       PARALLAX ELEMENTS (About page 3D scroll)
       ---------------------------------------------------------- */
    function setupParallaxElements() {
        if (animationsDisabled) return;

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
        if (prefersReducedMotion) return;

        var groups = [
            { selector: '.project-card', glowClass: 'project-card__hover-glow' },
            { selector: '.cert-badge', glowClass: 'cert-badge__hover-glow' },
            { selector: '.device-frame', glowClass: 'device-frame__hover-glow' }
        ];

        groups.forEach(function (group) {
            var cards = app.querySelectorAll(group.selector);
            cards.forEach(function (card) {
                if (card.dataset.hoverGlowBound) return; // avoid double-binding across re-renders
                card.dataset.hoverGlowBound = '1';

                if (!card.querySelector('.' + group.glowClass)) {
                    var glow = document.createElement('div');
                    glow.className = group.glowClass;
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
        });
    }

    /* ----------------------------------------------------------
       3D PHONE SHOWCASE (Products — TithiPath)
       Single phone, cycling screenshots, idle 3D tilt + mouse parallax.
       ---------------------------------------------------------- */
    function setupDevice3DShowcase() {
        var stage = app.querySelector('#tithipath3d');
        if (!stage || stage.dataset.device3dBound) return;
        stage.dataset.device3dBound = '1';

        var phone = stage.querySelector('.device-3d-phone');
        var slides = Array.prototype.slice.call(stage.querySelectorAll('.device-3d-slide'));
        var dotsWrap = app.querySelector('#tithipath3dDots');
        var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.querySelectorAll('.device-3d-dot')) : [];
        var pauseButton = app.querySelector('#tithipath3dPause');
        if (!phone || !slides.length) return;

        var active = 0;
        var cycleTimer = null;
        var isPaused = prefersReducedMotion;

        function showSlide(index) {
            active = (index + slides.length) % slides.length;
            slides.forEach(function (slide, i) {
                var isActive = i === active;
                slide.classList.toggle('is-active', isActive);
                slide.setAttribute('aria-hidden', String(!isActive));
            });
            dots.forEach(function (dot, i) {
                var isActive = i === active;
                dot.classList.toggle('is-active', isActive);
                dot.setAttribute('aria-pressed', String(isActive));
            });
        }

        function syncPlaybackControl() {
            if (!pauseButton) return;
            pauseButton.textContent = isPaused ? 'Start slideshow' : 'Pause slideshow';
        }

        function startCycle() {
            stopCycle();
            isPaused = false;
            cycleTimer = trackInterval(function () { showSlide(active + 1); }, 3200);
            syncPlaybackControl();
        }
        function stopCycle() {
            if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
        }

        function pauseCycle() {
            isPaused = true;
            stopCycle();
            syncPlaybackControl();
        }

        dots.forEach(function (dot, i) {
            dot.addEventListener('click', function () {
                showSlide(i);
                if (!isPaused) startCycle();
            });
        });

        if (pauseButton) {
            pauseButton.addEventListener('click', function () {
                if (isPaused) {
                    startCycle();
                } else {
                    pauseCycle();
                }
            });
        }

        showSlide(0);
        if (prefersReducedMotion) {
            pauseCycle();
        } else {
            startCycle();
        }

        // Mouse-parallax tilt (desktop + reduced-motion-safe: skip entirely if the user prefers less motion)
        if (!prefersReducedMotion) {
            stage.addEventListener('mousemove', function (e) {
                var rect = stage.getBoundingClientRect();
                var px = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5..0.5
                var py = (e.clientY - rect.top) / rect.height - 0.5;
                phone.style.setProperty('--tilt-y', (px * 48) + 'deg');
                phone.style.setProperty('--tilt-x', (py * -22) + 'deg');
            });
            stage.addEventListener('mouseleave', function () {
                phone.style.removeProperty('--tilt-y');
                phone.style.removeProperty('--tilt-x');
            });
        }
    }

    /* ----------------------------------------------------------
       LIVE THREAT FEED / THREAT LANDSCAPE
       ---------------------------------------------------------- */
    // Backend-free: a GitHub Actions workflow (.github/workflows/update-threat-feed.yml)
    // regenerates this static JSON every ~20 minutes using the exact same
    // aggregation/dedup/ranking logic as backend/threatLandscape.js (no
    // duplication — the script requires that module directly), and commits
    // it straight into the repo. Served same-origin from GitHub Pages, so
    // there's no CORS issue and no live backend/Render dependency at all.
    var THREAT_FEED_URL = BASE_PATH + '/data/threat-feed.json';

    var TL_ALLOWED_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
    function tlSafeSeverity(sev) {
        var s = (sev || 'medium').toLowerCase();
        return TL_ALLOWED_SEVERITIES.indexOf(s) !== -1 ? s : 'medium';
    }
    function tlSafeUrl(url) {
        if (!url) return '#';
        try { var p = new URL(url); return (p.protocol === 'https:' || p.protocol === 'http:') ? url : '#'; }
        catch (e) { return '#'; }
    }
    function tlRelativeTime(iso) {
        var ms = Date.now() - new Date(iso).getTime();
        if (!(ms >= 0)) return '';
        var hrs = Math.floor(ms / 3600000);
        if (hrs < 1) return 'just now';
        if (hrs < 24) return hrs + 'h ago';
        return Math.floor(hrs / 24) + 'd ago';
    }

    function tlClusterCardHtml(c) {
        var sev = tlSafeSeverity(c.severity);
        var sevClass = 'threat-card__severity--' + sev;
        var tags = (c.tags || []).slice(0, 4).map(function (t) {
            return '<span class="threat-card__tag">' + escapeHtml(t) + '</span>';
        }).join('');
        var summary = c.summary ? c.summary.substring(0, 160) : '';
        var sourceLabel = c.sourceCount > 1 ? (c.sourceCount + ' sources') : (c.sources && c.sources[0] ? c.sources[0] : '');

        return '<div class="threat-card" data-severity="' + sev + '">' +
            '<div class="threat-card__header">' +
                '<span class="threat-card__severity ' + sevClass + '">' + escapeHtml(c.severity || 'Medium') + '</span>' +
                '<span class="threat-card__sourcecount">' + escapeHtml(sourceLabel) + '</span>' +
            '</div>' +
            '<div class="threat-card__title"><a href="' + escapeHtml(tlSafeUrl(c.url)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(c.title || 'Untitled') + '<span class="sr-only"> (opens in a new tab)</span></a></div>' +
            (summary ? '<div class="threat-card__summary">' + escapeHtml(summary) + '</div>' : '') +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; gap:0.5rem; flex-wrap:wrap;">' +
                (tags ? '<div class="threat-card__tags">' + tags + '</div>' : '<span></span>') +
                '<span class="t-mono" style="font-size:0.65rem; color:var(--gray-300);">' + escapeHtml(tlRelativeTime(c.date)) + '</span>' +
            '</div>' +
        '</div>';
    }

    function tlTop3CardHtml(c, rank) {
        var sev = tlSafeSeverity(c.severity);
        var sevClass = 'threat-card__severity--' + sev;
        var sourceLabel = c.sourceCount > 1 ? (c.sourceCount + ' sources corroborating') : (c.sources && c.sources[0] ? c.sources[0] : '');
        var summary = c.summary ? c.summary.substring(0, 180) : '';

        return '<div class="top3-card" data-severity="' + sev + '">' +
            '<div style="display:flex; justify-content:space-between; align-items:flex-start;">' +
                '<span class="top3-card__rank">0' + rank + '</span>' +
                '<span class="threat-card__severity ' + sevClass + '">' + escapeHtml(c.severity || 'Medium') + '</span>' +
            '</div>' +
            '<div class="threat-card__title"><a href="' + escapeHtml(tlSafeUrl(c.url)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(c.title || 'Untitled') + '<span class="sr-only"> (opens in a new tab)</span></a></div>' +
            (summary ? '<div class="threat-card__summary">' + escapeHtml(summary) + '</div>' : '') +
            '<div class="top3-card__score">' + escapeHtml(sourceLabel) + (sourceLabel ? ' &middot; ' : '') + 'score ' + escapeHtml(String(c.score)) + '/100</div>' +
        '</div>';
    }

    function tlRenderTop3Into(container, top3) {
        if (!container) return;
        if (!top3 || !top3.length) { container.innerHTML = ''; return; }
        container.innerHTML =
            '<div style="font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--gray-300); margin-bottom:1rem;">Top 3 Today &mdash; automated ranking, not an official severity rating</div>' +
            '<div class="top3-grid">' + top3.map(function (c, i) { return tlTop3CardHtml(c, i + 1); }).join('') + '</div>';
        if (!animationsDisabled) {
            gsap.fromTo(container.querySelectorAll('.top3-card'),
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'expo.out' }
            );
        }
    }

    function fetchThreatLandscape() {
        activeFetchController = new AbortController();
        return fetch(THREAT_FEED_URL, { signal: activeFetchController.signal }).then(function (res) {
            if (!res.ok) throw new Error('Feed unavailable');
            return res.json();
        });
    }

    function setupThreatFeed() {
        var feedEl = app.querySelector('#threatFeed');
        var top3El = app.querySelector('#top3Today');
        if (!feedEl) return;

        fetchThreatLandscape()
            .then(function (data) {
                var top3Titles = (data.top3 || []).map(function (c) { return c.title; });
                var rest = (data.clusters || data.articles || []).filter(function (c) {
                    return top3Titles.indexOf(c.title) === -1;
                });
                var clusters = rest.slice(0, 6);
                tlRenderTop3Into(top3El, data.top3);

                if (!clusters.length) {
                    feedEl.innerHTML = '<div class="threat-feed__fallback">No threat intelligence available at this time.</div>';
                    return;
                }

                feedEl.innerHTML = clusters.map(tlClusterCardHtml).join('');

                if (!animationsDisabled) {
                    var cards = feedEl.querySelectorAll('.threat-card');
                    gsap.fromTo(cards,
                        { opacity: 0, y: 20 },
                        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'expo.out' }
                    );
                }
            })
            .catch(function () {
                feedEl.innerHTML = '<div class="threat-feed__fallback">Threat feed data unavailable right now — it refreshes automatically every ~20 minutes.</div>';
            });
    }

    function setupThreatLandscapePage() {
        var listEl = app.querySelector('#tlFullList');
        if (!listEl) return;

        var top3El = app.querySelector('#tlTop3');
        var filtersEl = app.querySelector('#tlFilters');
        var methodologyEl = app.querySelector('#tlMethodology');
        var allClusters = [];
        var activeFilter = 'all';

        var LIST_DISPLAY_CAP = 30;

        function renderList() {
            var filtered = activeFilter === 'all'
                ? allClusters
                : allClusters.filter(function (c) { return tlSafeSeverity(c.severity) === activeFilter; });
            var shown = filtered.slice(0, LIST_DISPLAY_CAP);
            var capNote = filtered.length > LIST_DISPLAY_CAP
                ? '<p style="grid-column:1/-1; text-align:center; font-size:0.75rem; color:var(--gray-300); margin-top:1rem;">Showing ' + shown.length + ' of ' + filtered.length + ' — use the filters above to narrow this down.</p>'
                : '';
            listEl.innerHTML = shown.length
                ? shown.map(tlClusterCardHtml).join('') + capNote
                : '<div class="threat-feed__fallback">No stories match this filter right now.</div>';
            if (!animationsDisabled) {
                gsap.fromTo(listEl.querySelectorAll('.threat-card'),
                    { opacity: 0, y: 15 },
                    { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, ease: 'power2.out' }
                );
            }
        }

        function renderFilters() {
            if (!filtersEl) return;
            var options = [
                ['all', 'All'], ['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']
            ];
            filtersEl.setAttribute('role', 'group');
            filtersEl.setAttribute('aria-label', 'Filter by severity');
            filtersEl.innerHTML = options.map(function (opt) {
                var active = opt[0] === activeFilter;
                return '<button type="button" class="btn ' + (active ? 'btn--primary' : 'btn--outline') +
                    '" data-filter="' + opt[0] + '" aria-pressed="' + active + '" style="font-size:0.75rem; padding:0.5rem 1rem;">' + opt[1] + '</button>';
            }).join('');
            filtersEl.querySelectorAll('button[data-filter]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    activeFilter = btn.getAttribute('data-filter');
                    renderFilters();
                    renderList();
                });
            });
        }

        listEl.innerHTML = '<div class="whr-skel whr-skel-card"></div><div class="whr-skel whr-skel-card"></div><div class="whr-skel whr-skel-card"></div>';

        fetchThreatLandscape()
            .then(function (data) {
                allClusters = data.clusters || [];
                tlRenderTop3Into(top3El, data.top3);
                if (methodologyEl) methodologyEl.textContent = data.rankingMethodology || '';
                renderFilters();
                renderList();
            })
            .catch(function () {
                listEl.innerHTML = '<div class="threat-feed__fallback">Threat landscape data unavailable right now — it refreshes automatically every ~20 minutes.</div>';
            });
    }

    /* ----------------------------------------------------------
       WEBSITE HEALTH REPORT TOOL
       ---------------------------------------------------------- */
    var HEALTH_REPORT_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:4000/api/health-report'
        : 'https://cyber-portfolio-hcxt.onrender.com/api/health-report';

    function whrScoreColor(score) {
        if (score === null || score === undefined) return 'var(--gray-300)';
        if (score >= 90) return '#28c840';
        if (score >= 50) return '#ffd700';
        return 'var(--crimson)';
    }

    function whrScoreCircle(label, score) {
        var display = (score === null || score === undefined) ? 'N/A' : score;
        var color = whrScoreColor(score);
        var textColor = score !== null && score !== undefined && score < 50
            ? 'var(--crimson-text)'
            : color;
        var circumference = 2 * Math.PI * 26;
        // Rendered at dashoffset = full circumference (0%) initially; whrAnimateScoreCircles
        // tweens each one in to its real value once the results block is visible, matching
        // how PageSpeed Insights/GTmetrix reveal their score gauges.
        return '<div style="text-align:center; width:90px;">' +
            '<svg width="64" height="64" viewBox="0 0 64 64" style="transform:rotate(-90deg);">' +
                '<circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" stroke-width="5"/>' +
                '<circle class="whr-ring" data-score="' + (score === null || score === undefined ? '' : score) + '" cx="32" cy="32" r="26" fill="none" stroke="' + color + '" stroke-width="5" ' +
                    'stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + circumference.toFixed(1) + '" stroke-linecap="round"/>' +
            '</svg>' +
            '<div style="margin-top:-46px; font-family:var(--font-mono); font-weight:600; font-size:0.95rem; color:' + textColor + ';">' + escapeHtml(String(display)) + '</div>' +
            '<div style="margin-top:36px; font-size:0.7rem; color:var(--gray-300); text-transform:uppercase; letter-spacing:0.05em;">' + escapeHtml(label) + '</div>' +
        '</div>';
    }

    function whrAnimateScoreCircles(container) {
        var circumference = 2 * Math.PI * 26;
        var rings = container.querySelectorAll('.whr-ring');
        rings.forEach(function (ring, i) {
            var score = ring.getAttribute('data-score');
            var pct = score === '' ? 0 : Number(score);
            var targetOffset = circumference * (1 - pct / 100);
            if (animationsDisabled) {
                ring.setAttribute('stroke-dashoffset', targetOffset.toFixed(1));
                return;
            }
            gsap.to(ring, {
                attr: { 'stroke-dashoffset': targetOffset },
                duration: 1,
                delay: 0.15 + i * 0.08,
                ease: 'power2.out'
            });
        });
    }

    function whrChecklistRow(label, pass, detail) {
        return '<div class="whr-row ' + (pass ? 'whr-row--pass' : 'whr-row--fail') + '">' +
            '<span style="width:8px; height:8px; border-radius:50%; background:' + (pass ? '#28c840' : 'var(--crimson)') + '; margin-top:0.35rem; flex-shrink:0;"></span>' +
            '<div>' +
                '<div style="font-size:0.85rem; color:var(--white); font-weight:500;">' + escapeHtml(label) + '</div>' +
                (detail ? '<div style="font-size:0.75rem; color:var(--gray-300); margin-top:0.15rem;">' + escapeHtml(String(detail)) + '</div>' : '') +
            '</div>' +
        '</div>';
    }

    // Renders a checklist with failures shown immediately (the actionable part)
    // and passed checks tucked behind a collapsible toggle, so a mostly-passing
    // report doesn't bury the few things that need attention — same pattern
    // SecurityHeaders.com/PSI use (opportunities/issues first, passed audits collapsed).
    var whrGroupIdCounter = 0;
    function whrRenderGroupedChecklist(targetEl, items) {
        if (!targetEl) return;
        var fails = items.filter(function (i) { return !i.pass; });
        var passes = items.filter(function (i) { return i.pass; });
        var groupId = 'whrGroup' + (whrGroupIdCounter++);

        var html = fails.map(function (i) { return whrChecklistRow(i.label, false, i.detail); }).join('');

        if (passes.length) {
            html += '<button type="button" class="whr-passed-toggle" aria-expanded="false" aria-controls="' + groupId + '">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' +
                (fails.length ? 'Show ' : '') + passes.length + ' passed check' + (passes.length === 1 ? '' : 's') +
            '</button>' +
            '<div class="whr-passed-list" id="' + groupId + '">' +
                passes.map(function (i) { return whrChecklistRow(i.label, true, i.detail); }).join('') +
            '</div>';
        }

        targetEl.innerHTML = html || whrChecklistRow('No checks available', true, null);

        var toggle = targetEl.querySelector('.whr-passed-toggle');
        if (toggle) {
            toggle.addEventListener('click', function () {
                var expanded = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', String(!expanded));
                var list = targetEl.querySelector('#' + groupId);
                if (list) list.classList.toggle('is-open', !expanded);
            });
        }
    }

    // Classifies a PSI displayValue string (e.g. "2.1 s", "150 ms", "0.05")
    // against Google's published Core Web Vitals good/needs-improvement/poor
    // thresholds, so each vital can carry an honest color rather than a flat neutral one.
    var WHR_VITAL_THRESHOLDS = {
        LCP: { unit: 's', good: 2.5, ok: 4 },
        CLS: { unit: '', good: 0.1, ok: 0.25 },
        TBT: { unit: 'ms', good: 200, ok: 600 },
        FCP: { unit: 's', good: 1.8, ok: 3 },
        'Speed Index': { unit: 's', good: 3.4, ok: 5.8 }
    };
    function whrVitalRating(key, displayValue) {
        var spec = WHR_VITAL_THRESHOLDS[key];
        if (!spec || !displayValue) return null;
        var num = parseFloat(String(displayValue).replace(/,/g, ''));
        if (isNaN(num)) return null;
        // Normalize ms-based displayValues that PSI sometimes renders in seconds for s-based metrics
        if (spec.unit === 's' && /ms/.test(displayValue)) num = num / 1000;
        if (num <= spec.good) return 'good';
        if (num <= spec.ok) return 'ok';
        return 'poor';
    }

    function whrInfoCardTitle(text) {
        return '<h3 style="font-size:0.8rem; font-weight:600; color:var(--gray-300); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">' + escapeHtml(text) + '</h3>';
    }

    function whrRenderResults(report) {
        var resultsEl = app.querySelector('#whrResults');
        if (!resultsEl) return;

        // Security headers, on-page SEO, SSL, crawlability, and HTTP status all
        // need the backend (reading cross-origin headers/body or a raw TLS
        // handshake isn't possible in plain browser JS) — DNS and Performance
        // above are always real since they run client-side regardless. Default
        // the backend-only fields to a safe "unavailable" shape so a degraded
        // report (backend down) still renders instead of throwing.
        report.security = report.security || { score: null, findings: [], unavailable: true };
        report.seo = report.seo || { score: null, checks: [], unavailable: true };
        report.http = report.http || { statusCode: null, responseTimeMs: null };
        var backendNoteEl = app.querySelector('#whrBackendNote');
        if (backendNoteEl) backendNoteEl.style.display = report.backendUnavailable ? '' : 'none';

        // Overall grade badge
        var gradeEl = app.querySelector('#whrGrade');
        var gradeBadge = app.querySelector('#whrGradeBadge');
        var grade = report.overallGrade || 'N/A';
        if (gradeEl) gradeEl.textContent = grade;
        if (gradeBadge) gradeBadge.setAttribute('data-grade', grade.charAt(0));
        var urlEl = app.querySelector('#whrTargetUrl');
        if (urlEl) {
            var reportUrl = report.url || '';
            var hrefOk = /^https?:\/\//i.test(reportUrl);
            urlEl.innerHTML = escapeHtml(reportUrl) + (hrefOk ? '<span class="sr-only"> (opens in a new tab)</span>' : '');
            urlEl.title = reportUrl;
            urlEl.setAttribute('href', hrefOk ? reportUrl : '#');
            if (!hrefOk) urlEl.addEventListener('click', function (e) { e.preventDefault(); }, { once: true });
        }

        // Score circles (performance/seo/accessibility/best-practices from PSI, plus our own security/seo scores)
        var circlesEl = app.querySelector('#whrScoreCircles');
        if (circlesEl) {
            var circles = '';
            if (report.performance && report.performance.ok) {
                circles += whrScoreCircle('Performance', report.performance.scores.performance);
                circles += whrScoreCircle('Accessibility', report.performance.scores.accessibility);
                circles += whrScoreCircle('Best Practices', report.performance.scores.bestPractices);
            }
            circles += whrScoreCircle('Security', report.security.score);
            circles += whrScoreCircle('SEO', report.seo.score);
            circlesEl.innerHTML = circles;
            whrAnimateScoreCircles(circlesEl);
        }

        // Core Web Vitals — color-coded against Google's published good/needs-improvement/poor thresholds
        var vitalsWrap = app.querySelector('#whrVitalsWrap');
        var vitalsEl = app.querySelector('#whrVitals');
        if (vitalsWrap && vitalsEl) {
            if (report.performance && report.performance.ok) {
                var cwv = report.performance.coreWebVitals;
                var vitalItems = [
                    ['LCP', cwv.lcp], ['CLS', cwv.cls], ['TBT', cwv.tbt], ['FCP', cwv.fcp], ['Speed Index', cwv.speedIndex]
                ];
                var WHR_VITAL_RATING_LABEL = { good: 'Good', ok: 'Needs work', poor: 'Poor' };
                vitalsEl.innerHTML = vitalItems.map(function (pair) {
                    var rating = whrVitalRating(pair[0], pair[1]);
                    var chipClass = rating ? ' whr-vital-chip--' + rating : '';
                    var ratingLabel = rating ? '<span class="whr-vital-chip__rating">' + WHR_VITAL_RATING_LABEL[rating] + '</span>' : '';
                    return '<div class="whr-vital-chip' + chipClass + '">' +
                        '<div style="font-family:var(--font-mono); font-size:1rem; color:var(--white);">' + escapeHtml(pair[1] || '—') + '</div>' +
                        '<div style="font-size:0.7rem; color:var(--gray-300); margin-top:0.25rem; text-transform:uppercase;">' + pair[0] + '</div>' +
                        ratingLabel +
                    '</div>';
                }).join('');
                vitalsWrap.style.display = '';
            } else {
                vitalsWrap.style.display = 'none';
            }
        }

        // Security headers — failures surfaced first, passed checks collapsible
        whrRenderGroupedChecklist(
            app.querySelector('#whrSecurity'),
            report.security.findings.map(function (f) {
                return { label: f.header, pass: f.present, detail: f.present ? (f.value || 'Present') : f.advice };
            })
        );

        // SEO checklist — same grouping
        whrRenderGroupedChecklist(
            app.querySelector('#whrSeo'),
            report.seo.checks.map(function (c) { return { label: c.label, pass: c.pass, detail: c.detail }; })
        );

        // SSL card
        var sslEl = app.querySelector('#whrSsl');
        if (sslEl) {
            var ssl = report.ssl;
            if (ssl && ssl.ok) {
                var expiryColor = ssl.daysRemaining < 14 ? 'var(--crimson-text)' : (ssl.daysRemaining < 30 ? '#ffd700' : '#28c840');
                sslEl.innerHTML = whrInfoCardTitle('SSL / TLS') +
                    '<div style="font-size:0.85rem; color:var(--white);">' + escapeHtml(ssl.protocol || 'Unknown protocol') + (ssl.authorized ? ' &middot; Trusted chain' : ' &middot; Not trusted') + '</div>' +
                    '<div style="font-size:0.8rem; color:' + expiryColor + '; margin-top:0.35rem;">Expires in ' + escapeHtml(String(ssl.daysRemaining)) + ' days</div>' +
                    '<div style="font-size:0.75rem; color:var(--gray-300); margin-top:0.35rem;">Issuer: ' + escapeHtml(ssl.issuer || 'Unknown') + '</div>';
            } else {
                sslEl.innerHTML = whrInfoCardTitle('SSL / TLS') + '<div style="font-size:0.85rem; color:var(--crimson-text);">' + escapeHtml((ssl && ssl.error) || 'Could not check.') + '</div>';
            }
        }

        // DNS card
        var dnsEl = app.querySelector('#whrDns');
        if (dnsEl) {
            var d = report.dns;
            if (d) {
                dnsEl.innerHTML = whrInfoCardTitle('DNS') +
                    '<div style="font-size:0.8rem; color:var(--gray-300); line-height:1.8;">' +
                        'A records: ' + d.a.length + '<br>' +
                        'MX records: ' + (d.mx && d.mx.length && d.mx[0].exchange ? d.mx.length : 0) + '<br>' +
                        'SPF: ' + (d.hasSpf ? 'Yes' : 'No') + '<br>' +
                        'DMARC: ' + (d.hasDmarc ? 'Yes' : 'No') +
                    '</div>';
            } else {
                dnsEl.innerHTML = whrInfoCardTitle('DNS') + '<div style="font-size:0.85rem; color:var(--gray-300);">Unavailable.</div>';
            }
        }

        // robots.txt / sitemap.xml
        var crawlEl = app.querySelector('#whrCrawl');
        if (crawlEl) {
            var rs = report.robotsAndSitemap;
            crawlEl.innerHTML = whrInfoCardTitle('Crawlability') +
                '<div style="font-size:0.8rem; color:var(--gray-300); line-height:1.8;">' +
                    'robots.txt: ' + ((rs && rs.robotsTxt.present) ? 'Found' : (rs ? 'Missing' : 'Unavailable')) + '<br>' +
                    'sitemap.xml: ' + ((rs && rs.sitemapXml.present) ? 'Found' : (rs ? 'Missing' : 'Unavailable')) + '<br>' +
                    'HTTP status: ' + escapeHtml(report.http.statusCode === null ? 'Unavailable' : String(report.http.statusCode)) + '<br>' +
                    'Response time: ' + (report.http.responseTimeMs === null ? 'Unavailable' : escapeHtml(String(report.http.responseTimeMs)) + 'ms') +
                '</div>';
        }

        // Top opportunities
        var oppsWrap = app.querySelector('#whrOppsWrap');
        var oppsEl = app.querySelector('#whrOpps');
        if (oppsWrap && oppsEl) {
            if (report.performance && report.performance.ok && report.performance.topOpportunities && report.performance.topOpportunities.length) {
                oppsEl.innerHTML = report.performance.topOpportunities.map(function (o) {
                    return whrChecklistRow(o.title, false, 'Potential savings: ~' + Math.round(o.savingsMs) + 'ms');
                }).join('');
                oppsWrap.style.display = '';
            } else {
                oppsWrap.style.display = 'none';
            }
        }

        resultsEl.style.display = '';
        if (!animationsDisabled) {
            gsap.fromTo(resultsEl, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
        }
    }

    /* ----------------------------------------------------------
       WEBSITE HEALTH REPORT — backend-free client-side checks
       ---------------------------------------------------------- */
    // DNS and Performance can run entirely in the browser (both DNS-over-HTTPS
    // and the PageSpeed Insights API are CORS-enabled, confirmed empirically).
    // Security headers, SSL/TLS, on-page SEO, and robots/sitemap checks all
    // need to read another origin's raw response headers/body or do a raw
    // TLS handshake, none of which plain browser JS can do for an arbitrary
    // third-party URL — those still go through the backend and degrade
    // gracefully (not fatally) if it's unavailable.
    function whrParseDohAnswer(json, type) {
        return (json.Answer || []).filter(function (a) { return a.type === type; }).map(function (a) { return a.data; });
    }

    function whrDohQuery(hostname, type) {
        return fetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(hostname) + '&type=' + type, {
            headers: { Accept: 'application/dns-json' }
        }).then(function (res) { return res.ok ? res.json() : { Answer: [] }; }).catch(function () { return { Answer: []}; });
    }

    function whrFetchDnsClientSide(hostname) {
        return Promise.all([
            whrDohQuery(hostname, 'A'),
            whrDohQuery(hostname, 'AAAA'),
            whrDohQuery(hostname, 'MX'),
            whrDohQuery(hostname, 'TXT'),
            whrDohQuery(hostname, 'NS'),
            whrDohQuery('_dmarc.' + hostname, 'TXT')
        ]).then(function (results) {
            var a = whrParseDohAnswer(results[0], 1);
            var aaaa = whrParseDohAnswer(results[1], 28);
            var mxRaw = whrParseDohAnswer(results[2], 15);
            var mx = mxRaw.map(function (s) {
                var parts = s.split(' ');
                return { priority: parseInt(parts[0], 10) || 0, exchange: (parts[1] || '').replace(/\.$/, '') };
            });
            var txt = whrParseDohAnswer(results[3], 16).map(function (s) { return s.replace(/^"|"$/g, ''); });
            var ns = whrParseDohAnswer(results[4], 2).map(function (s) { return s.replace(/\.$/, ''); });
            var dmarcTxt = whrParseDohAnswer(results[5], 16).map(function (s) { return s.replace(/^"|"$/g, ''); });
            return {
                a: a, aaaa: aaaa, mx: mx, txt: txt.map(function (t) { return [t]; }), ns: ns,
                hasSpf: txt.some(function (t) { return t.toLowerCase().indexOf('v=spf1') === 0; }),
                hasDmarc: dmarcTxt.some(function (t) { return t.toLowerCase().indexOf('v=dmarc1') === 0; })
            };
        });
    }

    function whrFetchPerformanceClientSide(targetUrl) {
        var categories = ['performance', 'seo', 'accessibility', 'best-practices'].map(function (c) { return 'category=' + c; }).join('&');
        var apiUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' + encodeURIComponent(targetUrl) + '&strategy=mobile&' + categories;
        return fetch(apiUrl).then(function (res) {
            return res.json().then(function (json) {
                if (json.error) return { ok: false, error: json.error.message || 'PageSpeed Insights error.' };
                var lr = json.lighthouseResult;
                if (!lr) return { ok: false, error: 'No Lighthouse result returned.' };
                function categoryScore(id) { return lr.categories && lr.categories[id] ? Math.round(lr.categories[id].score * 100) : null; }
                function auditValue(id) { return lr.audits && lr.audits[id] ? lr.audits[id].displayValue : null; }
                var opportunities = Object.keys(lr.audits || {}).map(function (k) { return lr.audits[k]; })
                    .filter(function (a) { return a.details && a.details.type === 'opportunity' && a.score !== null && a.score < 0.9; })
                    .sort(function (a, b) { return (b.details.overallSavingsMs || 0) - (a.details.overallSavingsMs || 0); })
                    .slice(0, 5)
                    .map(function (a) { return { title: a.title, savingsMs: a.details.overallSavingsMs || 0 }; });
                return {
                    ok: true,
                    scores: { performance: categoryScore('performance'), seo: categoryScore('seo'), accessibility: categoryScore('accessibility'), bestPractices: categoryScore('best-practices') },
                    coreWebVitals: { lcp: auditValue('largest-contentful-paint'), cls: auditValue('cumulative-layout-shift'), tbt: auditValue('total-blocking-time'), fcp: auditValue('first-contentful-paint'), speedIndex: auditValue('speed-index') },
                    topOpportunities: opportunities
                };
            });
        }).catch(function (err) { return { ok: false, error: err.message || 'PageSpeed Insights request failed.' }; });
    }

    function setupWebsiteHealthTool() {
        var input = app.querySelector('#whrUrlInput');
        var runBtn = app.querySelector('#whrRunBtn');
        if (!input || !runBtn) return;

        var statusEl = app.querySelector('#whrStatus');
        var statusTextEl = app.querySelector('#whrStatusText');
        var inlineErrorEl = app.querySelector('#whrInlineError');
        var resultsEl = app.querySelector('#whrResults');
        var emptyStateEl = app.querySelector('#whrEmptyState');
        var runAnotherBtn = app.querySelector('#whrRunAnotherBtn');
        var BACKEND_TIMEOUT_MS = 38000; // backend is a free-tier host; cold starts can exceed the ~30s copy

        function clearInlineError() {
            if (inlineErrorEl) { inlineErrorEl.style.display = 'none'; inlineErrorEl.textContent = ''; }
            input.removeAttribute('aria-invalid');
            input.removeAttribute('aria-describedby');
        }

        function showInlineError(message) {
            if (inlineErrorEl) {
                inlineErrorEl.textContent = message;
                inlineErrorEl.style.display = '';
            }
            input.setAttribute('aria-invalid', 'true');
            input.setAttribute('aria-describedby', 'whrInlineError');
        }

        function runReport() {
            var rawUrl = input.value.trim();
            clearInlineError();
            if (!rawUrl) { showInlineError('Enter a URL to check.'); input.focus(); return; }

            var normalizedUrl;
            var hostname;
            try {
                normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl;
                hostname = new URL(normalizedUrl).hostname;
            } catch (e) {
                showInlineError('That doesn’t look like a valid URL.');
                input.focus();
                return;
            }

            runBtn.disabled = true;
            runBtn.textContent = 'Running…';
            if (resultsEl) resultsEl.style.display = 'none';
            if (emptyStateEl) emptyStateEl.style.display = 'none';
            if (statusEl) statusEl.style.display = '';
            if (statusTextEl) statusTextEl.textContent = 'Running Performance and DNS checks in your browser, and Security/SEO/SSL via the backend — this can take up to 30 seconds…';

            // DNS and Performance always run client-side (no backend needed).
            // Everything else needs the backend and degrades gracefully if it's down —
            // including a hang: the free-tier backend can cold-start slower than the
            // "up to 30 seconds" copy promises, so this is given its own timeout rather
            // than letting the button spin forever.
            var backendController = new AbortController();
            var backendTimeout = setTimeout(function () { backendController.abort(); }, BACKEND_TIMEOUT_MS);

            Promise.allSettled([
                whrFetchDnsClientSide(hostname),
                whrFetchPerformanceClientSide(normalizedUrl),
                fetch(HEALTH_REPORT_API + '?url=' + encodeURIComponent(rawUrl), { signal: backendController.signal }).then(function (res) {
                    return res.json().then(function (data) {
                        if (!res.ok) throw new Error(data.message || 'Backend request failed.');
                        return data;
                    });
                })
            ]).then(function (results) {
                clearTimeout(backendTimeout);
                var dnsResult = results[0].status === 'fulfilled' ? results[0].value : null;
                var perfResult = results[1].status === 'fulfilled' ? results[1].value : { ok: false, error: 'Client-side performance check failed.' };
                var backendResult = results[2].status === 'fulfilled' ? results[2].value : null;

                var report;
                if (backendResult) {
                    report = backendResult;
                    report.dns = dnsResult || report.dns; // prefer the client-side source
                    report.performance = perfResult.ok ? perfResult : report.performance;
                } else {
                    report = {
                        url: normalizedUrl,
                        overallGrade: null,
                        dns: dnsResult,
                        performance: perfResult,
                        backendUnavailable: true
                    };
                }

                if (statusEl) statusEl.style.display = 'none';
                whrRenderResults(report);
            }).finally(function () {
                runBtn.disabled = false;
                runBtn.textContent = 'Run Report';
            });
        }

        runBtn.addEventListener('click', runReport);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') runReport();
        });
        if (runAnotherBtn) {
            runAnotherBtn.addEventListener('click', function () {
                if (resultsEl) resultsEl.style.display = 'none';
                if (emptyStateEl) emptyStateEl.style.display = '';
                input.value = '';
                input.focus();
                if (!prefersReducedMotion && lenis) {
                    lenis.scrollTo(input, { offset: -140 });
                } else {
                    input.scrollIntoView({ block: 'center' });
                }
            });
        }
    }

    /* ----------------------------------------------------------
       HASH CHANGE LISTENER
       ---------------------------------------------------------- */
    window.addEventListener('popstate', function () {
        var route = getRouteFromPath();
        loadPage(route, false);
    });

    document.addEventListener('click', function (e) {
        var link = e.target.closest('[data-route]');
        if (!link) return;

        e.preventDefault();
        var href = link.getAttribute('href');
        if (!href) return;

        closeMobile();

        // Push new state and load
        var fullPath = (href === '/') ? (BASE_PATH + '/') : (BASE_PATH + href);
        if (fullPath !== window.location.pathname) {
            history.pushState(null, '', fullPath);
            var route = getRouteFromPath();
            loadPage(route, false);
            // Track SPA navigation in Umami
            if (typeof umami !== 'undefined') {
                umami.track(function (props) { return Object.assign(Object.assign({}, props), { url: window.location.pathname }); });
            }
        }
    });

    /* ----------------------------------------------------------
       PRELOADER
       ---------------------------------------------------------- */
    function runPreloader(callback) {
        var preloader = document.getElementById('preloader');
        if (!preloader) { callback(); return; }

        if (animationsDisabled) {
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
            var route = getRouteFromPath();
            loadPage(route, false);

            requestAnimationFrame(function () {
                var siteShell = document.getElementById('siteShell');
                if (siteShell) { siteShell.classList.add('ready'); }
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
