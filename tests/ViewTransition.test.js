import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Core from '../src/Core';
import ViewTransition from '../src/ViewTransition';

describe('ViewTransition and Native View Transitions API', () => {
	let activeTaxi = null;

	beforeEach(() => {
		document.title = 'Initial Page';
		document.body.innerHTML = `
			<div data-taxi>
				<main data-taxi-view>
					<h1>Initial View</h1>
				</main>
			</div>
		`;
	});

	afterEach(() => {
		if (activeTaxi) {
			activeTaxi.destroy();
			activeTaxi = null;
		}
		delete document.startViewTransition;
		vi.restoreAllMocks();
	});

	it('has default properties and hook placeholders', () => {
		const vt = new ViewTransition({ wrapper: document.querySelector('[data-taxi]') });
		expect(vt.isViewTransition).toBe(true);
		expect(Array.isArray(vt.types)).toBe(true);
		expect(vt.types.length).toBe(0);
	});

	it('delegates to document.startViewTransition when supported', async () => {
		const targetUrl = `${window.location.origin}/target-page`;
		const mockHtml = `
			<!DOCTYPE html>
			<html>
			<head><title>Target Page</title></head>
			<body>
				<div data-taxi>
					<main data-taxi-view>
						<h1>Target Heading</h1>
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

		const beforeSpy = vi.fn();
		const afterSpy = vi.fn();

		class CustomViewTransition extends ViewTransition {
			types = ['slide-left'];
			beforeTransition(props) {
				beforeSpy(props);
			}
			afterTransition(props) {
				afterSpy(props);
			}
		}

		const addedTypes = new Set();
		let transitionCallbackRan = false;

		// Mock document.startViewTransition
		document.startViewTransition = vi.fn().mockImplementation((updateCb) => {
			updateCb();
			transitionCallbackRan = true;
			return {
				types: {
					add: (type) => addedTypes.add(type),
				},
				finished: Promise.resolve(),
			};
		});

		const taxi = (activeTaxi = new Core({
			transitions: {
				default: CustomViewTransition,
			},
		}));

		await taxi.navigateTo(targetUrl);

		expect(beforeSpy).toHaveBeenCalled();
		expect(document.startViewTransition).toHaveBeenCalled();
		expect(transitionCallbackRan).toBe(true);
		expect(addedTypes.has('slide-left')).toBe(true);
		expect(afterSpy).toHaveBeenCalled();
		expect(document.querySelector('h1')?.textContent).toBe('Target Heading');
	});

	it('gracefully falls back when document.startViewTransition is not supported', async () => {
		const targetUrl = `${window.location.origin}/fallback-page`;
		const mockHtml = `
			<!DOCTYPE html>
			<html>
			<head><title>Fallback Page</title></head>
			<body>
				<div data-taxi>
					<main data-taxi-view>
						<h1>Fallback Heading</h1>
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

		const beforeSpy = vi.fn();
		const afterSpy = vi.fn();

		class FallbackViewTransition extends ViewTransition {
			beforeTransition(props) {
				beforeSpy(props);
			}
			afterTransition(props) {
				afterSpy(props);
			}
		}

		// Ensure startViewTransition does not exist
		delete document.startViewTransition;

		const taxi = (activeTaxi = new Core({
			transitions: {
				default: FallbackViewTransition,
			},
		}));

		await taxi.navigateTo(targetUrl);

		expect(beforeSpy).toHaveBeenCalled();
		expect(afterSpy).toHaveBeenCalled();
		expect(document.querySelector('h1')?.textContent).toBe('Fallback Heading');
	});
});
