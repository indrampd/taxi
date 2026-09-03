<p align="center">
<img width="380" src="https://user-images.githubusercontent.com/3481634/181377879-5f972dd8-ea10-4f5b-be44-5a23edfd3d5a.svg">
</p>

<p align="center"><strong>Taxi.js is the spiritual successor to Highway.js.</strong></p>

<p align="center"><a href="https://taxi.js.org" target="_blank">Full Documentation</a></p>

<p align="center">
  <code>npm i @indrampd/taxi</code> or <code>yarn add @indrampd/taxi</code>
  <br><br>
  <a href="https://www.npmjs.com/package/@indrampd/taxi" target="_blank"><img src="https://img.shields.io/npm/v/@indrampd/taxi?color=F4BA00&style=flat-square"></a>
</p>

----

Taxi is a lightweight JavaScript library for adding seamless AJAX navigation, smooth transitions, and routing to your website.

Designed originally as a drop-in replacement for [Highway.js](https://github.com/Dogstudio/highway), Taxi has evolved into a modern, accessible, and high-performance client-side router for the web.

### Key Features

* **Native CSS View Transitions API**: First-class support via `ViewTransition` class and `document.startViewTransition()` with transition types and graceful fallback.
* **Built-in Accessibility (A11y)**: Automatic `aria-live="polite"` route announcement for screen readers and smart focus management on page changes.
* **LRU Cache & Memory Optimization**: Bounded HTML cache (`maxCacheSize`) with automatic eviction of least recently used pages while protecting active content.
* **Flexible DOM Structure**: `data-taxi-view` can be placed anywhere inside `data-taxi` — nested wrapper layouts and custom components work out of the box.
* **Scroll Management & Smooth Scroll Ready**: Compatible with smooth scrolling engines ([Lenis](https://lenis.darkroom.engineering/), Locomotive Scroll) with opt-in native scroll restoration.
* **URL-Based Routing**: Contextual transitions matching exact paths or regex patterns.
* **Preloading**: Predictive prefetching of pages on link `hover` or `focus`.
* **Automatic Script & Style Reloading**: Smart re-execution of page-specific assets via `data-taxi-reload`.
* **Teardown & Lifecycle Control**: Full instance destruction and listener cleanup via `taxi.destroy()`.

### Quick Start

#### 1. HTML Markup
Add `data-taxi` to the container and `data-taxi-view` to the content being swapped:

```html
<main data-taxi>
  <!-- data-taxi-view can be anywhere inside data-taxi, even in nested wrappers -->
  <article data-taxi-view>
    <h1>Page Title</h1>
    <p>Content goes here...</p>
    <a href="/about">About Us</a>
  </article>
</main>
```

#### 2. Modern ES Module (Vite, Astro, Webpack, Nuxt)
When using modern build tools, Taxi automatically loads the optimized `./dist/taxi.modern.js`:

```js
import { Core } from '@indrampd/taxi'

const taxi = new Core({
  updateScroll: true,  // Automatically reset scroll position on transition
  a11y: true,          // WCAG screen reader announcements & focus management
  maxCacheSize: 12,    // Memory optimization: Keep only 12 most recent pages in memory
})
```

#### 3. Modern Browser Direct via CDN (`type="module"`)
No bundler required! You can import modern ESM directly in the browser:

```html
<script type="module">
  import { Core, ViewTransition } from 'https://cdn.jsdelivr.net/npm/@indrampd/taxi/+esm'

  const taxi = new Core({
    transitions: {
      default: new ViewTransition()
    }
  })
</script>
```

---

## Modern Usage Examples

### 1. Native CSS View Transitions API
Use the browser's native View Transitions API with `ViewTransition` — pure CSS, zero heavy animation libraries:

```js
import { Core, ViewTransition } from '@indrampd/taxi'

const taxi = new Core({
  transitions: {
    default: new ViewTransition({
      types: ['fade-slide'], // Optional: Active view-transition-class / types
    })
  }
})
```

In your CSS:
```css
::view-transition-old(root) {
  animation: 0.3s ease-out both fade-out;
}

::view-transition-new(root) {
  animation: 0.3s ease-in both fade-in;
}

@keyframes fade-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-10px); }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

### 2. Smooth Scroll Integration (Locomotive Scroll / Lenis)
Taxi plays seamlessly with smooth scroll libraries. Set `updateScroll: false` and control scrolling via Taxi events:

```js
import { Core } from '@indrampd/taxi'
import LocomotiveScroll from '@indrampd/locomotive-scroll'

// Initialize smooth scrolling
const scroll = new LocomotiveScroll()

// Initialize Taxi
const taxi = new Core({
  updateScroll: false, // Let Locomotive Scroll handle scroll resetting
})

// Reset scroll smoothly on navigation
taxi.on('NAVIGATE_IN', () => {
  scroll.scrollTo(0, { immediate: true })
})
```

---

### 3. Custom JS Animation Transitions (e.g. GSAP)
Create customized animated transitions extending `Transition`:

```js
import { Core, Transition } from '@indrampd/taxi'
import gsap from 'gsap'

class FadeTransition extends Transition {
  onLeave({ from, trigger, done }) {
    gsap.to(from, {
      opacity: 0,
      duration: 0.4,
      onComplete: done
    })
  }

  onEnter({ to, trigger, done }) {
    gsap.fromTo(to, 
      { opacity: 0 },
      { opacity: 1, duration: 0.4, onComplete: done }
    )
  }
}

const taxi = new Core({
  transitions: {
    default: new FadeTransition(),
  }
})
```

---

### 4. Custom Renderers for Page-Specific Code
Run code on specific views using `Renderer`:

```html
<!-- In your HTML -->
<article data-taxi-view="contact">
  <form id="contact-form">...</form>
</article>
```

```js
import { Core, Renderer } from '@indrampd/taxi'

class ContactRenderer extends Renderer {
  initialLoad() {
    // Runs only on first site visit if on /contact
    this.initForm()
  }

  onEnter() {
    // Runs every time user navigates to contact page
    this.initForm()
  }

  onLeave() {
    // Cleanup listeners
  }

  initForm() {
    console.log('Contact form initialized')
  }
}

const taxi = new Core({
  renderers: {
    contact: ContactRenderer
  }
})
```

---

### Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `updateScroll` | `boolean` | `false` | Resets native scroll to `(0, 0)` on page transition. Keep `false` if using Lenis/Locomotive Scroll. |
| `a11y` | `boolean` | `true` | Enables automatic `aria-live="polite"` route announcements for screen readers and smart focus management. |
| `maxCacheSize` | `number` | `12` | LRU cache memory limit. Automatically evicts old cached pages to prevent memory leaks (`0` for unlimited). |
| `bypassCache` | `boolean` | `false` | When true, fetches fresh HTML on every link click instead of using cache. |
| `removeOldContent` | `boolean` | `true` | Automatically removes previous view element from DOM when transition finishes. |
| `links` | `string` | `'a:not([target]):not([href^="#"])'` | Query selector for links intercepted by Taxi. |
| `schema` | `object` | `{ prefix: 'data-taxi' }` | Customize data attribute names (e.g. prefix `data-router`). |

---

### Differences to Highway

* Different public API (`navigateTo` instead of `redirect`).
* `data-taxi`, `data-taxi-view`, `data-taxi-ignore` are used instead of `data-router-*`.
* Delegated link clicks — no manual `attach`/`detach` calls required.
* Automatic removal of old content during transitions (configurable via `removeOldContent`).
* Renderers support `initialLoad` lifecycle hook.

----

## License & Attribution

This project is licensed under the [BSD-3-Clause License](LICENSE.md).  
It is a fork maintained by [indrampd](https://github.com/indrampd) based on the original [Taxi](https://github.com/craftedbygc/taxi) by Jake Whiteley / Unseen Studio Ltd.

<p align="center"><a href="https://taxi.js.org" target="_blank">Full Documentation</a></p>
