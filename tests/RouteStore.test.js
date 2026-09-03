import { describe, it, expect, beforeEach } from 'vitest';
import RouteStore from '../src/RouteStore';

describe('RouteStore', () => {
	let router;

	beforeEach(() => {
		router = new RouteStore();
	});

	it('matches an exact route transition', () => {
		router.add('/home', '/about', 'fade');

		const match = router.findMatch(
			{ pathname: '/home' },
			{ pathname: '/about' }
		);

		expect(match).toBe('fade');
	});

	it('returns null when fromPattern matches but toPattern does not', () => {
		router.add('/home', '/about', 'fade');

		const match = router.findMatch(
			{ pathname: '/home' },
			{ pathname: '/contact' }
		);

		expect(match).toBeNull();
	});

	it('returns null when fromPattern does not match', () => {
		router.add('/home', '/about', 'fade');

		const match = router.findMatch(
			{ pathname: '/services' },
			{ pathname: '/about' }
		);

		expect(match).toBeNull();
	});

	it('supports regex patterns', () => {
		router.add('/blog/.*', '/posts/.*', 'slide');

		const match = router.findMatch(
			{ pathname: '/blog/my-first-post' },
			{ pathname: '/posts/featured' }
		);

		expect(match).toBe('slide');
	});

	it('supports multiple to-patterns for the same from-pattern', () => {
		router.add('/home', '/about', 'fade');
		router.add('/home', '/contact', 'slide');

		expect(router.findMatch({ pathname: '/home' }, { pathname: '/about' })).toBe('fade');
		expect(router.findMatch({ pathname: '/home' }, { pathname: '/contact' })).toBe('slide');
	});

	it('continues to evaluate other matching from-patterns if the first matching from-pattern does not match to-pattern', () => {
		router.add('/.*', '/about', 'general-to-about');
		router.add('/blog/.*', '/contact', 'blog-to-contact');

		const match = router.findMatch(
			{ pathname: '/blog/post-1' },
			{ pathname: '/contact' }
		);

		expect(match).toBe('blog-to-contact');
	});
});

