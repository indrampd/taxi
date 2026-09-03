import E from "@unseenco/e";
import {
  appendElement,
  attributeToDataset,
  parseDom,
  processUrl,
  reloadElement,
} from "./helpers";
import Renderer from "./Renderer";
import RouteStore from "./RouteStore";
import Transition from "./Transition";

const IN_PROGRESS = "A transition is currently in progress";

/**
 * @typedef CacheEntry
 * @type {object}
 * @property {typeof Renderer|Renderer} renderer
 * @property {Document|Node} page
 * @property {array} scripts
 * @property {HTMLLinkElement[]} styles
 * @property {string} finalUrl
 * @property {boolean} skipCache
 * @property {string} title
 * @property {HTMLElement|Element} content
 */

export default class Core {
  isTransitioning = false;

  /**
   * @type {CacheEntry|null}
   */
  currentCacheEntry = null;

  /**
   * @type {Map<string, CacheEntry>}
   */
  cache = new Map();

  /**
   * @private
   * @type {Map<string, Promise>}
   */
  activePromises = new Map();

  /**
   * @param {{
   * 		schema?: object,
   * 		links?: string,
   * 		removeOldContent?: boolean,
   * 		allowInterruption?: boolean,
   * 		bypassCache?: boolean,
   * 		enablePrefetch?: boolean,
   * 		renderers?: Object.<string, typeof Renderer>,
   * 		transitions?: Object.<string, typeof Transition>,
   * 		reloadJsFilter?: boolean|function(HTMLElement): boolean,
   * 		reloadCssFilter?: boolean|function(HTMLLinkElement): boolean
   * }} parameters
   */
  constructor(parameters = {}) {
    const defaultSchema = {
      prefix: "data-taxi",
      wrapper: "",
      view: "view",
      ignore: "ignore",
      nocache: "nocache",
      reload: "reload",
    };

    const userSchema = parameters.schema || {};
    const schemaConfig = { ...defaultSchema, ...userSchema };

    this.schema = {
      prefix: schemaConfig.prefix,
      wrapper: schemaConfig.wrapper
        ? `${schemaConfig.prefix}-${schemaConfig.wrapper}`
        : schemaConfig.prefix,
      view: `${schemaConfig.prefix}-${schemaConfig.view}`,
      ignore: `${schemaConfig.prefix}-${schemaConfig.ignore}`,
      nocache: `${schemaConfig.prefix}-${schemaConfig.nocache}`,
      reload: `${schemaConfig.prefix}-${schemaConfig.reload}`,
    };

    this.schemaDataset = {
      view: attributeToDataset(this.schema.view),
      reload: attributeToDataset(this.schema.reload),
    };

    const {
      links = `a[href]:not([target]):not([href^=\\#]):not([${this.schema.ignore}])`,
      removeOldContent = true,
      allowInterruption = false,
      bypassCache = false,
      enablePrefetch = true,
      renderers = {
        default: Renderer,
      },
      transitions = {
        default: Transition,
      },
      reloadJsFilter = (element) =>
        element.dataset[this.schemaDataset.reload] !== undefined,
      reloadCssFilter = (element) => true, //element.dataset.taxiReload !== undefined
      updateScroll = false,
      a11y = true,
      maxCacheSize = 12,
    } = parameters;

    this.renderers = renderers;
    this.transitions = transitions;
    this.defaultRenderer = this.renderers.default || Renderer;
    this.defaultTransition = this.transitions.default || Transition;
    this.wrapper = document.querySelector(`[${this.schema.wrapper}]`);
    this.reloadJsFilter = reloadJsFilter;
    this.reloadCssFilter = reloadCssFilter;
    this.removeOldContent = removeOldContent;
    this.allowInterruption = allowInterruption;
    this.bypassCache = bypassCache;
    this.enablePrefetch = enablePrefetch;
    this.maxCacheSize = maxCacheSize;
    this.cache = new Map();
    this.isPopping = false;

    const defaultScroll = {
      reset: true,
      restore: true,
      animate: false,
    };
    this.scrollConfig =
      typeof updateScroll === "object"
        ? { ...defaultScroll, ...updateScroll }
        : {
            ...defaultScroll,
            reset: Boolean(updateScroll),
            restore: Boolean(updateScroll),
          };

    this.scrollPositions = new Map();

    if (
      typeof window !== "undefined" &&
      "scrollRestoration" in window.history &&
      (this.scrollConfig.reset || this.scrollConfig.restore)
    ) {
      this.previousScrollRestoration = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
    }

    const defaultA11y = {
      announce: true,
      focus: true,
      announcerMessage: (title) => title,
      focusTarget: null,
    };
    this.a11yConfig =
      typeof a11y === "object"
        ? { ...defaultA11y, ...a11y }
        : {
            ...defaultA11y,
            announce: Boolean(a11y),
            focus: Boolean(a11y),
          };

    this.announcer = null;
    this._createdAnnouncer = false;

    if (
      typeof document !== "undefined" &&
      document.body &&
      this.a11yConfig.announce
    ) {
      let announcer = document.querySelector("[data-taxi-announcer]");
      if (!announcer) {
        announcer = document.createElement("div");
        announcer.setAttribute("data-taxi-announcer", "");
        announcer.setAttribute("aria-live", "polite");
        announcer.setAttribute("aria-atomic", "true");
        announcer.style.position = "absolute";
        announcer.style.left = "-9999px";
        announcer.style.top = "-9999px";
        announcer.style.width = "1px";
        announcer.style.height = "1px";
        announcer.style.overflow = "hidden";
        announcer.style.clip = "rect(0, 0, 0, 0)";
        announcer.style.clipPath = "inset(50%)";
        announcer.style.whiteSpace = "nowrap";
        document.body.appendChild(announcer);
        this._createdAnnouncer = true;
      }
      this.announcer = announcer;
    }

    // Add delegated link events
    this.attachEvents(links);

    this.currentLocation = processUrl(window.location.href);

    // as this is the initial page load, prime this page into the cache
    this.setCache(
      this.currentLocation.href,
      this.createCacheEntry(document.cloneNode(true), window.location.href),
    );

    // fire the current Renderer enter methods
    this.currentCacheEntry = this.getCache(this.currentLocation.href);
    this.currentCacheEntry.renderer.initialLoad();
  }

  /**
   * @param {string} renderer
   */
  setDefaultRenderer(renderer) {
    this.defaultRenderer = this.renderers[renderer];
  }

  /**
   * @param {string} transition
   */
  setDefaultTransition(transition) {
    this.defaultTransition = this.transitions[transition];
  }

  /**
   * Registers a route into the RouteStore
   *
   * @param {string} fromPattern
   * @param {string} toPattern
   * @param {string} transition
   */
  addRoute(fromPattern, toPattern, transition) {
    if (!this.router) {
      this.router = new RouteStore();
    }

    this.router.add(fromPattern, toPattern, transition);
  }

  /**
   * Prime the cache for a given URL
   *
   * @param {string} url
   * @param {boolean} [preloadAssets]
   * @return {Promise}
   */
  preload(url, preloadAssets = false) {
    // convert relative URLs to absolute
    url = processUrl(url).href;

    if (!this.cache.has(url)) {
      return this.fetch(url, false)
        .then(async (response) => {
          this.setCache(
            url,
            this.createCacheEntry(response.html, response.url),
          );

          if (preloadAssets) {
            this.cache.get(url)?.renderer?.createDom();
          }
        })
        .catch((err) => console.warn(err));
    }

    return Promise.resolve();
  }

  /**
   * Updates the HTML cache for a given URL.
   * If no URL is passed, then cache for the current page is updated.
   * Useful when adding/removing content via AJAX such as a search page or infinite loader.
   *
   * @param {string} [url]
   */
  updateCache(url) {
    const key = processUrl(url || window.location.href).href;
    this.setCache(key, this.createCacheEntry(document.cloneNode(true), key));
  }

  /**
   * Clears the cache for a given URL.
   * If no URL is passed, then cache for the current page is cleared.
   *
   * @param {string} [url]
   */
  clearCache(url) {
    const key = processUrl(url || window.location.href).href;

    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
  }

  /**
   * Sets a cache entry and prunes older entries based on LRU policy.
   *
   * @param {string} key
   * @param {CacheEntry} entry
   */
  setCache(key, entry) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, entry);
    this.pruneCache();
  }

  /**
   * Retrieves a cache entry and marks it as recently used in LRU cache.
   *
   * @param {string} key
   * @return {CacheEntry|undefined}
   */
  getCache(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const entry = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  /**
   * Evicts least recently used cache entries when cache size exceeds maxCacheSize.
   */
  pruneCache() {
    if (
      !this.maxCacheSize ||
      this.maxCacheSize <= 0 ||
      !isFinite(this.maxCacheSize)
    ) {
      return;
    }

    while (this.cache.size > this.maxCacheSize) {
      let keyToEvict = null;
      for (const key of this.cache.keys()) {
        if (key !== this.currentLocation?.href) {
          keyToEvict = key;
          break;
        }
      }

      if (keyToEvict) {
        this.cache.delete(keyToEvict);
      } else {
        break;
      }
    }
  }

  /**
   * @param {string} url
   * @param {string|false} [transition]
   * @param {string|false|HTMLElement} [trigger]
   * @return {Promise<void|Error>}
   */
  navigateTo(url, transition = false, trigger = false) {
    return new Promise((resolve, reject) => {
      // Don't allow multiple navigations to occur at once
      if (!this.allowInterruption && this.isTransitioning) {
        reject(new Error(IN_PROGRESS));
        return;
      }

      this.isTransitioning = true;
      this.isPopping = true;
      this.targetLocation = processUrl(url);
      this.popTarget = window.location.href;

      const TransitionClass = new (this.chooseTransition(transition))({
        wrapper: this.wrapper,
      });

      let navigationPromise;

      if (
        this.bypassCache ||
        !this.cache.has(this.targetLocation.href) ||
        this.cache.get(this.targetLocation.href).skipCache
      ) {
        const fetched = this.fetch(this.targetLocation.href, false)
          .then((response) => {
            this.setCache(
              this.targetLocation.href,
              this.createCacheEntry(response.html, response.url),
            );
            this.cache.get(this.targetLocation.href)?.renderer?.createDom();
          })
          .catch((err) => {
            // we encountered a 4** or 5** error, redirect to the requested URL
            this.isTransitioning = false;
            this.isPopping = false;
            window.location.href = url;
            throw err;
          });

        navigationPromise = this.beforeFetch(
          this.targetLocation,
          TransitionClass,
          trigger,
        ).then(async () => {
          return fetched.then(async () => {
            return await this.afterFetch(
              this.targetLocation,
              TransitionClass,
              this.getCache(this.targetLocation.href),
              trigger,
            );
          });
        });
      } else {
        const cachedEntry = this.getCache(this.targetLocation.href);
        cachedEntry.renderer.createDom();

        navigationPromise = this.beforeFetch(
          this.targetLocation,
          TransitionClass,
          trigger,
        ).then(async () => {
          return await this.afterFetch(
            this.targetLocation,
            TransitionClass,
            cachedEntry,
            trigger,
          );
        });
      }

      navigationPromise
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  /**
   * Add an event listener.
   * @param {string} event
   * @param {any} callback
   */
  on(event, callback) {
    E.on(event, callback);
  }

  /**
   * Remove an event listener.
   * @param {string} event
   * @param {any} [callback]
   */
  off(event, callback) {
    E.off(event, callback);
  }

  /**
   * @private
   * @param {{ raw: string, href: string, hasHash: boolean, pathname: string }} url
   * @param {Transition} TransitionClass
   * @param {string|HTMLElement|false} trigger
   * @return {Promise<void>}
   */
  beforeFetch(url, TransitionClass, trigger) {
    if (this.scrollConfig.restore && this.currentLocation) {
      this.scrollPositions.set(this.currentLocation.href, {
        x:
          typeof window !== "undefined"
            ? window.scrollX || window.pageXOffset || 0
            : 0,
        y:
          typeof window !== "undefined"
            ? window.scrollY || window.pageYOffset || 0
            : 0,
      });
    }

    E.emit("NAVIGATE_OUT", {
      from: this.currentCacheEntry,
      trigger,
    });

    if (TransitionClass?.isViewTransition) {
      TransitionClass.beforeTransition?.({
        from: this.currentCacheEntry?.renderer?.content,
        trigger,
      });

      if (trigger !== "popstate") {
        window.history.pushState({}, "", url.raw);
      }

      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const currentContent = this.currentCacheEntry.renderer.content;
      this.siblingAfter = currentContent ? currentContent.nextSibling : null;
      this.currentCacheEntry.renderer
        .leave(TransitionClass, trigger, this.removeOldContent)
        .then(() => {
          if (trigger !== "popstate") {
            window.history.pushState({}, "", url.raw);
          }

          resolve();
        });
    });
  }

  /**
   * @private
   * @param {{ raw: string, href: string, host: string, hasHash: boolean, pathname: string }} url
   * @param {Transition} TransitionClass
   * @param {CacheEntry} entry
   * @param {string|HTMLElement|false} trigger
   * @return {Promise<void>}
   */
  afterFetch(url, TransitionClass, entry, trigger) {
    this.currentLocation = url;
    this.popTarget = this.currentLocation.href;

    const updateDom = () => {
      let targetSibling = this.siblingAfter;

      if (!this.removeOldContent) {
        const oldContent = this.wrapper.querySelector(`[${this.schema.view}]`);
        targetSibling = oldContent ? oldContent.nextSibling : null;
      } else if (TransitionClass?.isViewTransition) {
        const oldContent = this.currentCacheEntry?.renderer?.content;
        if (oldContent && this.wrapper.contains(oldContent)) {
          targetSibling = oldContent.nextSibling;
          oldContent.remove();
        }
      }

      entry.renderer.update(targetSibling);

      this.handleScroll(url, trigger);

      E.emit("NAVIGATE_IN", {
        from: this.currentCacheEntry,
        to: entry,
        trigger,
      });

      if (this.reloadJsFilter) {
        this.loadScripts(entry.scripts);
      }

      if (this.reloadCssFilter) {
        this.loadStyles(entry.styles);
      }

      // If the fetched url had a redirect chain, then replace the history to reflect the final resolved URL
      if (
        trigger !== "popstate" &&
        url.href !== processUrl(entry.finalUrl).href
      ) {
        window.history.replaceState({}, "", entry.finalUrl);
      }
    };

    if (
      TransitionClass?.isViewTransition &&
      typeof document !== "undefined" &&
      typeof document.startViewTransition === "function"
    ) {
      const vt = document.startViewTransition(() => {
        updateDom();
      });

      if (
        TransitionClass.types &&
        Array.isArray(TransitionClass.types) &&
        vt.types
      ) {
        for (const type of TransitionClass.types) {
          vt.types.add(type);
        }
      }

      const finishPromise = vt.finished ? vt.finished : Promise.resolve();

      return finishPromise.then(() => {
        E.emit("NAVIGATE_END", {
          from: this.currentCacheEntry,
          to: entry,
          trigger,
        });

        TransitionClass.afterTransition?.({
          to: entry.renderer?.content,
          trigger,
          transition: vt,
        });

        this.handleA11y(entry, trigger);

        this.currentCacheEntry = entry;
        this.isTransitioning = false;
        this.isPopping = false;
      });
    }

    return new Promise((resolve) => {
      updateDom();

      entry.renderer.enter(TransitionClass, trigger).then(() => {
        E.emit("NAVIGATE_END", {
          from: this.currentCacheEntry,
          to: entry,
          trigger,
        });

        if (TransitionClass?.isViewTransition) {
          TransitionClass.afterTransition?.({
            to: entry.renderer?.content,
            trigger,
          });
        }

        this.handleA11y(entry, trigger);

        this.currentCacheEntry = entry;
        this.isTransitioning = false;
        this.isPopping = false;
        resolve();
      });
    });
  }

  /**
   * Load up scripts from the target page if needed
   *
   * @param {HTMLElement[]} cachedScripts
   */
  loadScripts(cachedScripts) {
    const newScripts = [...cachedScripts];
    const currentScripts = Array.from(
      document.querySelectorAll("script"),
    ).filter(this.reloadJsFilter);

    // loop through all new scripts
    for (let i = 0; i < currentScripts.length; i++) {
      for (let n = 0; n < newScripts.length; n++) {
        if (currentScripts[i].outerHTML === newScripts[n].outerHTML) {
          reloadElement(currentScripts[i], "SCRIPT");
          newScripts.splice(n, 1);
          break;
        }
      }
    }

    for (const script of newScripts) {
      appendElement(script, "SCRIPT");
    }
  }

  /**
   * Load up styles from the target page if needed
   *
   * @param {Array<HTMLLinkElement|HTMLStyleElement>} cachedStyles
   */
  loadStyles(cachedStyles) {
    const currentStyles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]'),
    ).filter(this.reloadCssFilter);
    const currentInlineStyles = Array.from(
      document.querySelectorAll("style"),
    ).filter(this.reloadCssFilter);

    const newInlineStyles = cachedStyles.filter((el) => {
      // no el.href, assume it's an inline style
      if (!el.href) {
        return true;
      } else if (!currentStyles.find((link) => link.href === el.href)) {
        document.body.append(el);
        return false;
      }
    });

    // loop through all new inline styles
    for (let i = 0; i < currentInlineStyles.length; i++) {
      for (let n = 0; n < newInlineStyles.length; n++) {
        if (currentInlineStyles[i].outerHTML === newInlineStyles[n].outerHTML) {
          reloadElement(currentInlineStyles[i], "STYLE");
          newInlineStyles.splice(n, 1);
          break;
        }
      }
    }

    for (const style of newInlineStyles) {
      appendElement(style, "STYLE");
    }
  }

  /**
   * @private
   * @param {string} links
   */
  attachEvents(links) {
    this.links = links;
    E.delegate("click", links, this.onClick);
    E.on("popstate", window, this.onPopstate);

    if (this.enablePrefetch) {
      E.delegate("mouseenter focus", links, this.onPrefetch);
    }
  }

  /**
   * Updates scroll position on page transition.
   *
   * @private
   * @param {{ raw: string, href: string, host: string, hasHash: boolean, hash: string, pathname: string }} url
   * @param {string|HTMLElement|false} trigger
   */
  handleScroll(url, trigger) {
    if (
      typeof window === "undefined" ||
      (!this.scrollConfig.reset && !this.scrollConfig.restore)
    ) {
      return;
    }

    if (trigger === "popstate" && this.scrollConfig.restore) {
      const saved = this.scrollPositions.get(url.href);
      if (saved) {
        window.scrollTo({
          left: saved.x,
          top: saved.y,
          behavior: this.scrollConfig.animate ? "smooth" : "auto",
        });
        return;
      }
    }

    if (url.hasHash && url.hash) {
      try {
        const target = document.querySelector(url.hash);
        if (target) {
          target.scrollIntoView({
            behavior: this.scrollConfig.animate ? "smooth" : "auto",
          });
          return;
        }
      } catch {
        // Ignore invalid selector in hash
      }
    }

    if (this.scrollConfig.reset) {
      window.scrollTo({
        left: 0,
        top: 0,
        behavior: this.scrollConfig.animate ? "smooth" : "auto",
      });
    }
  }

  /**
   * Manages accessibility live announcements and focus shifting on navigation.
   *
   * @private
   * @param {CacheEntry} entry
   * @param {string|HTMLElement|false} trigger
   */
  handleA11y(entry, trigger) {
    if (
      typeof document === "undefined" ||
      (!this.a11yConfig.announce && !this.a11yConfig.focus)
    ) {
      return;
    }

    if (this.a11yConfig.announce && this.announcer && entry.title) {
      const message =
        typeof this.a11yConfig.announcerMessage === "function"
          ? this.a11yConfig.announcerMessage(entry.title)
          : entry.title;
      this.announcer.textContent = "";
      this.announcer.textContent = message;
    }

    if (this.a11yConfig.focus) {
      const activeContainer = entry.renderer?.content || entry.content;
      if (activeContainer) {
        let focusTarget = null;
        if (typeof this.a11yConfig.focusTarget === "string") {
          focusTarget =
            activeContainer.querySelector(this.a11yConfig.focusTarget) ||
            document.querySelector(this.a11yConfig.focusTarget);
        } else if (this.a11yConfig.focusTarget instanceof HTMLElement) {
          focusTarget = this.a11yConfig.focusTarget;
        }

        if (!focusTarget) {
          focusTarget = activeContainer.querySelector("h1") || activeContainer;
        }

        if (focusTarget && typeof focusTarget.focus === "function") {
          if (!focusTarget.hasAttribute("tabindex")) {
            focusTarget.setAttribute("tabindex", "-1");
          }
          focusTarget.focus({ preventScroll: true });
        }
      }
    }
  }

  /**
   * Removes all event listeners and clears the cache.
   */
  destroy() {
    E.off("click", this.links, this.onClick);
    E.off("popstate", window, this.onPopstate);

    if (this.enablePrefetch) {
      E.off("mouseenter focus", this.links, this.onPrefetch);
    }

    if (
      typeof window !== "undefined" &&
      "scrollRestoration" in window.history &&
      this.previousScrollRestoration
    ) {
      window.history.scrollRestoration = this.previousScrollRestoration;
    }

    if (this._createdAnnouncer && this.announcer && this.announcer.parentNode) {
      this.announcer.parentNode.removeChild(this.announcer);
    }
    this.announcer = null;

    this.scrollPositions.clear();
    this.cache.clear();
    this.activePromises.clear();
  }

  /**
   * @private
   * @param {MouseEvent} e
   */
  onClick = (e) => {
    if (!(e.metaKey || e.ctrlKey)) {
      const target = processUrl(e.currentTarget.href);
      this.currentLocation = processUrl(window.location.href);

      if (this.currentLocation.host !== target.host) {
        return;
      }

      // the target is a new URL, or is removing the hash from the current URL
      if (
        this.currentLocation.href !== target.href ||
        (this.currentLocation.hasHash && !target.hasHash)
      ) {
        e.preventDefault();
        // noinspection JSIgnoredPromiseFromCall
        this.navigateTo(
          target.raw,
          e.currentTarget.dataset.transition || false,
          e.currentTarget,
        ).catch((err) => console.warn(err));
        return;
      }

      // a click to the current URL was detected
      if (!this.currentLocation.hasHash && !target.hasHash) {
        e.preventDefault();
      }
    }
  };

  /**
   * @private
   * @return {void|boolean}
   */
  onPopstate = () => {
    const target = processUrl(window.location.href);

    // don't trigger for on-page anchors
    if (
      target.pathname === this.currentLocation.pathname &&
      target.search === this.currentLocation.search &&
      !this.isPopping
    ) {
      return false;
    }

    if (!this.allowInterruption && (this.isTransitioning || this.isPopping)) {
      // overwrite history state with current page if currently navigating
      window.history.pushState({}, "", this.popTarget);
      console.warn(IN_PROGRESS);
      return false;
    }

    if (!this.isPopping) {
      this.popTarget = window.location.href;
    }

    this.isPopping = true;

    // noinspection JSIgnoredPromiseFromCall
    this.navigateTo(window.location.href, false, "popstate");
  };

  /**
   * @private
   * @param {MouseEvent} e
   */
  onPrefetch = (e) => {
    const target = processUrl(e.currentTarget.href);

    if (this.currentLocation.host !== target.host) {
      return;
    }

    this.preload(e.currentTarget.href, false);
  };

  /**
   * @private
   * @param {string} url
   * @param {boolean} [runFallback]
   * @return {Promise<{html: Document, url: string}>}
   */
  fetch(url, runFallback = true) {
    // If Taxi is currently performing a fetch for the given URL, return that instead of starting a new request
    if (this.activePromises.has(url)) {
      return this.activePromises.get(url);
    }

    const request = new Promise((resolve, reject) => {
      let resolvedUrl;

      fetch(url, {
        mode: "same-origin",
        method: "GET",
        headers: { "X-Requested-With": "Taxi" },
        credentials: "same-origin",
      })
        .then((response) => {
          if (!response.ok) {
            if (runFallback) {
              window.location.href = url;
            }
            reject(
              new Error(`Taxi encountered HTTP status ${response.status}`),
            );
            return;
          }

          resolvedUrl = response.url;

          return response.text();
        })
        .then((htmlString) => {
          if (htmlString !== undefined) {
            resolve({ html: parseDom(htmlString), url: resolvedUrl });
          }
        })
        .catch((err) => {
          if (runFallback) {
            window.location.href = url;
          }
          reject(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          this.activePromises.delete(url);
        });
    });

    this.activePromises.set(url, request);

    return request;
  }

  /**
   * @private
   * @param {string|false} transition
   * @return {Transition|function}
   */
  chooseTransition(transition) {
    if (transition) {
      return this.transitions[transition];
    }

    const routeTransition = this.router?.findMatch(
      this.currentLocation,
      this.targetLocation,
    );

    if (routeTransition) {
      return this.transitions[routeTransition];
    }

    return this.defaultTransition;
  }

  /**
   * @private
   * @param {Document|Node} page
   * @param {string} url
   * @return {CacheEntry}
   */
  createCacheEntry(page, url) {
    const content = page.querySelector(`[${this.schema.view}]`);
    const rendererKey = content.dataset[this.schemaDataset.view] || "";
    let Renderer = rendererKey.length
      ? this.renderers[rendererKey]
      : this.defaultRenderer;

    if (!Renderer) {
      console.warn(
        `The Renderer "${rendererKey}" was set in the ${this.schema.view} of the requested page, but not registered in Taxi.`,
      );
      Renderer = this.defaultRenderer;
    }

    return {
      page,
      content,
      finalUrl: url,
      skipCache: content.hasAttribute(this.schema.nocache),
      scripts: this.reloadJsFilter
        ? Array.from(page.querySelectorAll("script")).filter(
            this.reloadJsFilter,
          )
        : [],
      styles: this.reloadCssFilter
        ? Array.from(
            page.querySelectorAll('link[rel="stylesheet"], style'),
          ).filter(this.reloadCssFilter)
        : [],
      title: page.title,
      renderer: new Renderer({
        wrapper: this.wrapper,
        title: page.title,
        content,
        page,
        schema: this.schema,
      }),
    };
  }
}
