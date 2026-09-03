import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Core from '../src/Core';
import Renderer from '../src/Renderer';
import Transition from '../src/Transition';

describe('Core', () => {
	let wrapper;
	let content;
	let activeTaxi = null;

	beforeEach(() => {
		document.body.innerHTML = `
			<div data-taxi>
				<main data-taxi-view>
					<h1>Home Page</h1>
				</main>
			</div>
		`;
		wrapper = document.querySelector('[data-taxi]');
		content = document.querySelector('[data-taxi-view]');
		document.title = 'Home Page';
		window.scrollTo = vi.fn();
	});

	afterEach(() => {
		if (activeTaxi) {
			activeTaxi.destroy();
			activeTaxi = null;
		}
		vi.restoreAllMocks();
	});

	it('initializes and primes the current page into the cache', () => {
		const taxi = (activeTaxi = new Core());

		expect(taxi.cache.size).toBe(1);
		expect(taxi.currentCacheEntry).not.toBeNull();
		expect(taxi.currentCacheEntry.title).toBe('Home Page');
	});

	it('supports custom schema configurations', () => {
		document.body.innerHTML = `
			<div data-custom-router>
				<main data-custom-view="home">
					<h1>Custom Home</h1>
				</main>
			</div>
		`;

		const taxi = (activeTaxi = new Core({
			schema: {
				prefix: 'data-custom',
				wrapper: 'router',
				view: 'view',
			},
		}));

		expect(taxi.schema.wrapper).toBe('data-custom-router');
		expect(taxi.schema.view).toBe('data-custom-view');
		expect(taxi.wrapper).toBe(document.querySelector('[data-custom-router]'));
	});

	it('preloads a page into cache via fetch', async () => {
		const targetUrl = `${window.location.origin}/about`;
		const mockHtml = `
			<!DOCTYPE html>
			<html>
			<head><title>About Us</title></head>
			<body>
				<div data-taxi>
					<main data-taxi-view><h1>About Us Page</h1></main>
				</div>
			</body>
			</html>
		`;

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			url: targetUrl,
			text: () => Promise.resolve(mockHtml),
		});

		const taxi = (activeTaxi = new Core());
		await taxi.preload(targetUrl);

		expect(global.fetch).toHaveBeenCalledWith(
			targetUrl,
			expect.objectContaining({
				headers: { 'X-Requested-With': 'Taxi' },
			})
		);
		expect(taxi.cache.has(targetUrl)).toBe(true);
	});

	it('navigates to a new page and emits lifecycle events', async () => {
		const targetUrl = `${window.location.origin}/contact`;
		const mockHtml = `
			<!DOCTYPE html>
			<html>
			<head><title>Contact</title></head>
			<body>
				<div data-taxi>
					<main data-taxi-view><h1>Contact Us</h1></main>
				</div>
			</body>
			</html>
		`;

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			url: targetUrl,
			text: () => Promise.resolve(mockHtml),
		});

		const taxi = (activeTaxi = new Core());

		const navigateOutSpy = vi.fn();
		const navigateInSpy = vi.fn();
		const navigateEndSpy = vi.fn();

		taxi.on('NAVIGATE_OUT', navigateOutSpy);
		taxi.on('NAVIGATE_IN', navigateInSpy);
		taxi.on('NAVIGATE_END', navigateEndSpy);

		await taxi.navigateTo(targetUrl);

		expect(navigateOutSpy).toHaveBeenCalledTimes(1);
		expect(navigateInSpy).toHaveBeenCalledTimes(1);
		expect(navigateEndSpy).toHaveBeenCalledTimes(1);
		expect(document.title).toBe('Contact');
		expect(wrapper.querySelector('h1')?.textContent).toBe('Contact Us');
	});

	it('blocks concurrent navigations when allowInterruption is false', async () => {
		const taxi = (activeTaxi = new Core({ allowInterruption: false }));
		taxi.isTransitioning = true;

		await expect(taxi.navigateTo('/about')).rejects.toThrow(
			'A transition is currently in progress'
		);
	});

	it('allows clearing and updating cache entries', () => {
		const taxi = (activeTaxi = new Core());
		const currentUrl = window.location.href;

		expect(taxi.cache.has(currentUrl)).toBe(true);
		taxi.clearCache(currentUrl);
		expect(taxi.cache.has(currentUrl)).toBe(false);

		taxi.updateCache(currentUrl);
		expect(taxi.cache.has(currentUrl)).toBe(true);
	});

	it('selects route-based transitions when registered', () => {
		class CustomTransition extends Transition {}

		const taxi = (activeTaxi = new Core({
			transitions: {
				custom: CustomTransition,
			},
		}));

		taxi.addRoute('/home', '/about', 'custom');

		taxi.currentLocation = { pathname: '/home' };
		taxi.targetLocation = { pathname: '/about' };

		const ChosenTransition = taxi.chooseTransition();
		expect(ChosenTransition).toBe(CustomTransition);
	});

	it('prefetches on mouseenter when enablePrefetch is true', () => {
		const taxi = (activeTaxi = new Core({ enablePrefetch: true }));
		const preloadSpy = vi.spyOn(taxi, 'preload').mockResolvedValue(undefined);

		const link = document.createElement('a');
		link.href = `${window.location.origin}/prefetch-test`;
		document.body.appendChild(link);

		link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

		expect(preloadSpy).toHaveBeenCalledWith(
			`${window.location.origin}/prefetch-test`,
			false
		);
		link.remove();
	});

	it('intercepts standard link clicks and triggers navigateTo', () => {
		const taxi = (activeTaxi = new Core());
		const navigateSpy = vi.spyOn(taxi, 'navigateTo').mockResolvedValue(undefined);

		const link = document.createElement('a');
		link.href = `${window.location.origin}/blog`;
		document.body.appendChild(link);

		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		link.dispatchEvent(event);

		expect(navigateSpy).toHaveBeenCalledWith(
			`${window.location.origin}/blog`,
			false,
			link
		);
		expect(event.defaultPrevented).toBe(true);
		link.remove();
	});

	it('ignores links with metaKey or ctrlKey pressed', () => {
		const taxi = (activeTaxi = new Core());
		const navigateSpy = vi.spyOn(taxi, 'navigateTo').mockResolvedValue(undefined);

		const link = document.createElement('a');
		link.href = `${window.location.origin}/blog`;
		link.addEventListener('click', (e) => e.preventDefault());
		document.body.appendChild(link);

		const event = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
		link.dispatchEvent(event);

		expect(navigateSpy).not.toHaveBeenCalled();
		link.remove();
	});

	it('cleans up event listeners and caches on destroy()', () => {
		const taxi = new Core();
		const navigateSpy = vi.spyOn(taxi, 'navigateTo');

		taxi.destroy();

		expect(taxi.cache.size).toBe(0);

		const link = document.createElement('a');
		link.href = `${window.location.origin}/after-destroy`;
		link.addEventListener('click', (e) => e.preventDefault());
		document.body.appendChild(link);

		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		link.dispatchEvent(event);

		expect(navigateSpy).not.toHaveBeenCalled();
		link.remove();
	});

	describe('scroll management & hash navigation', () => {
		it('defaults updateScroll to false so smooth scroll libraries (Lenis, Locomotive) can manage scroll', async () => {
			const scrollToSpy = vi.fn();
			window.scrollTo = scrollToSpy;

			const targetUrl = `${window.location.origin}/about-default`;
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Default Scroll</title></head>
				<body><div data-taxi><main data-taxi-view><h1>Default</h1></main></div></body>
				</html>
			`;
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				url: targetUrl,
				text: () => Promise.resolve(mockHtml),
			});

			const taxi = (activeTaxi = new Core());

			expect(taxi.scrollConfig.reset).toBe(false);
			expect(taxi.scrollConfig.restore).toBe(false);

			await taxi.navigateTo(targetUrl);

			expect(scrollToSpy).not.toHaveBeenCalled();
		});

		it('resets scroll to (0, 0) on forward navigation when updateScroll is true', async () => {
			const scrollToSpy = vi.fn();
			window.scrollTo = scrollToSpy;

			const targetUrl = `${window.location.origin}/about`;
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>About</title></head>
				<body><div data-taxi><main data-taxi-view><h1>About</h1></main></div></body>
				</html>
			`;
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				url: targetUrl,
				text: () => Promise.resolve(mockHtml),
			});

			const taxi = (activeTaxi = new Core({ updateScroll: true }));
			await taxi.navigateTo(targetUrl);

			expect(scrollToSpy).toHaveBeenCalledWith({
				left: 0,
				top: 0,
				behavior: 'auto',
			});
		});

		it('scrolls to matching element when navigating to a hash anchor and updateScroll is true', async () => {
			const targetUrl = `${window.location.origin}/features#section-two`;
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Features</title></head>
				<body>
					<div data-taxi>
						<main data-taxi-view>
							<h1>Features</h1>
							<div id="section-two">Target Section</div>
						</main>
					</div>
				</body>
				</html>
			`;
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				url: targetUrl,
				text: () => Promise.resolve(mockHtml),
			});

			const scrollIntoViewSpy = vi.fn();
			window.HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;

			const taxi = (activeTaxi = new Core({ updateScroll: true }));
			await taxi.navigateTo(targetUrl);

			expect(scrollIntoViewSpy).toHaveBeenCalledWith({
				behavior: 'auto',
			});
		});

		it('restores previous scroll position on popstate navigation when updateScroll is true', async () => {
			const scrollToSpy = vi.fn();
			window.scrollTo = scrollToSpy;
			window.scrollX = 0;
			window.scrollY = 450;

			const targetUrl = `${window.location.origin}/page-2`;
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Page 2</title></head>
				<body><div data-taxi><main data-taxi-view><h1>Page 2</h1></main></div></body>
				</html>
			`;
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				url: targetUrl,
				text: () => Promise.resolve(mockHtml),
			});

			const taxi = (activeTaxi = new Core({ updateScroll: true }));
			const initialUrl = taxi.currentLocation.href;

			// Navigate forward: records initialUrl scroll position as (0, 450)
			await taxi.navigateTo(targetUrl);

			expect(taxi.scrollPositions.get(initialUrl)).toEqual({ x: 0, y: 450 });

			// Simulate popstate back to initialUrl
			await taxi.navigateTo(initialUrl, false, 'popstate');

			expect(scrollToSpy).toHaveBeenLastCalledWith({
				left: 0,
				top: 450,
				behavior: 'auto',
			});
		});
	});

	describe('accessibility (A11y)', () => {
		it('injects an aria-live announcer into the document by default', () => {
			const taxi = (activeTaxi = new Core());

			const announcer = document.querySelector('[data-taxi-announcer]');
			expect(announcer).not.toBeNull();
			expect(announcer?.getAttribute('aria-live')).toBe('polite');
			expect(announcer?.getAttribute('aria-atomic')).toBe('true');
		});

		it('updates announcer text and shifts focus to new content h1 on navigation', async () => {
			const targetUrl = `${window.location.origin}/services`;
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Our Services</title></head>
				<body>
					<div data-taxi>
						<main data-taxi-view>
							<h1>Services Heading</h1>
						</main>
					</div>
				</body>
				</html>
			`;
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				url: targetUrl,
				text: () => Promise.resolve(mockHtml),
			});

			const taxi = (activeTaxi = new Core());
			await taxi.navigateTo(targetUrl);

			const announcer = document.querySelector('[data-taxi-announcer]');
			expect(announcer?.textContent).toBe('Our Services');

			const newHeading = document.querySelector('h1');
			expect(document.activeElement).toBe(newHeading);
			expect(newHeading?.getAttribute('tabindex')).toBe('-1');
		});

		it('supports custom announcerMessage format', async () => {
			const targetUrl = `${window.location.origin}/custom-message`;
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Custom Page</title></head>
				<body><div data-taxi><main data-taxi-view><h1>Custom</h1></main></div></body>
				</html>
			`;
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				url: targetUrl,
				text: () => Promise.resolve(mockHtml),
			});

			const taxi = (activeTaxi = new Core({
				a11y: {
					announcerMessage: (title) => `Page loaded: ${title}`,
				},
			}));

			await taxi.navigateTo(targetUrl);

			const announcer = document.querySelector('[data-taxi-announcer]');
			expect(announcer?.textContent).toBe('Page loaded: Custom Page');
		});

		it('supports custom focusTarget selector', async () => {
			const targetUrl = `${window.location.origin}/custom-focus`;
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Custom Focus</title></head>
				<body>
					<div data-taxi>
						<main data-taxi-view>
							<h1>Ignored Heading</h1>
							<div id="target-container">Focus Here</div>
						</main>
					</div>
				</body>
				</html>
			`;
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				url: targetUrl,
				text: () => Promise.resolve(mockHtml),
			});

			const taxi = (activeTaxi = new Core({
				a11y: {
					focusTarget: '#target-container',
				},
			}));

			await taxi.navigateTo(targetUrl);

			const targetContainer = document.querySelector('#target-container');
			expect(document.activeElement).toBe(targetContainer);
		});

		it('does not create announcer or shift focus when a11y is false', async () => {
			const targetUrl = `${window.location.origin}/disabled-a11y`;
			const mockHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>No A11y</title></head>
				<body><div data-taxi><main data-taxi-view><h1>Disabled</h1></main></div></body>
				</html>
			`;
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				url: targetUrl,
				text: () => Promise.resolve(mockHtml),
			});

			const taxi = (activeTaxi = new Core({ a11y: false }));

			expect(document.querySelector('[data-taxi-announcer]')).toBeNull();

			await taxi.navigateTo(targetUrl);

			expect(document.activeElement).toBe(document.body);
		});

		it('removes the announcer element upon destroy()', () => {
			const taxi = new Core();

			expect(document.querySelector('[data-taxi-announcer]')).not.toBeNull();

			taxi.destroy();

			expect(document.querySelector('[data-taxi-announcer]')).toBeNull();
		});
	});

	describe('LRU cache eviction & memory management', () => {
		it('defaults maxCacheSize to 12', () => {
			const taxi = (activeTaxi = new Core());
			expect(taxi.maxCacheSize).toBe(12);
		});

		it('evicts the least recently used entry when maxCacheSize is exceeded', async () => {
			global.fetch = vi.fn().mockImplementation((url) => {
				const html = `<!DOCTYPE html><html><head><title>${url}</title></head><body><div data-taxi><main data-taxi-view><h1>${url}</h1></main></div></body></html>`;
				return Promise.resolve({
					ok: true,
					url,
					text: () => Promise.resolve(html),
				});
			});

			const taxi = (activeTaxi = new Core({ maxCacheSize: 3 }));
			const page1 = taxi.currentLocation.href;
			const page2 = `${window.location.origin}/page-2`;
			const page3 = `${window.location.origin}/page-3`;
			const page4 = `${window.location.origin}/page-4`;

			await taxi.preload(page2);
			await taxi.preload(page3);

			expect(taxi.cache.size).toBe(3);
			expect(taxi.cache.has(page1)).toBe(true);
			expect(taxi.cache.has(page2)).toBe(true);
			expect(taxi.cache.has(page3)).toBe(true);

			// Preload 4th page: should evict page2 (oldest non-current page)
			await taxi.preload(page4);

			expect(taxi.cache.size).toBe(3);
			expect(taxi.cache.has(page1)).toBe(true); // Active page is preserved
			expect(taxi.cache.has(page2)).toBe(false); // Evicted!
			expect(taxi.cache.has(page3)).toBe(true);
			expect(taxi.cache.has(page4)).toBe(true);
		});

		it('promotes accessed cache entry to most recently used', async () => {
			global.fetch = vi.fn().mockImplementation((url) => {
				const html = `<!DOCTYPE html><html><head><title>${url}</title></head><body><div data-taxi><main data-taxi-view><h1>${url}</h1></main></div></body></html>`;
				return Promise.resolve({
					ok: true,
					url,
					text: () => Promise.resolve(html),
				});
			});

			const taxi = (activeTaxi = new Core({ maxCacheSize: 3 }));
			const page1 = taxi.currentLocation.href;
			const page2 = `${window.location.origin}/p-2`;
			const page3 = `${window.location.origin}/p-3`;
			const page4 = `${window.location.origin}/p-4`;

			await taxi.preload(page2);
			await taxi.preload(page3);

			// Access page2 so it becomes more recent than page3
			taxi.getCache(page2);

			// Preload page4: should evict page3 (now the least recently used non-current page)
			await taxi.preload(page4);

			expect(taxi.cache.size).toBe(3);
			expect(taxi.cache.has(page1)).toBe(true);
			expect(taxi.cache.has(page2)).toBe(true); // Preserved because it was recently accessed
			expect(taxi.cache.has(page3)).toBe(false); // Evicted!
			expect(taxi.cache.has(page4)).toBe(true);
		});

		it('does not evict when maxCacheSize is set to 0 (unlimited)', async () => {
			global.fetch = vi.fn().mockImplementation((url) => {
				const html = `<!DOCTYPE html><html><head><title>${url}</title></head><body><div data-taxi><main data-taxi-view><h1>${url}</h1></main></div></body></html>`;
				return Promise.resolve({
					ok: true,
					url,
					text: () => Promise.resolve(html),
				});
			});

			const taxi = (activeTaxi = new Core({ maxCacheSize: 0 }));

			for (let i = 1; i <= 15; i++) {
				await taxi.preload(`${window.location.origin}/page-${i}`);
			}

			// Initial page + 15 preloaded pages = 16 entries
			expect(taxi.cache.size).toBe(16);
		});
	});
});



