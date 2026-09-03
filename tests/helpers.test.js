import { describe, it, expect } from 'vitest';
import {
	parseDom,
	processUrl,
	attributeToDataset,
	duplicateElement,
	appendElement,
	reloadElement,
} from '../src/helpers';

describe('helpers', () => {
	describe('parseDom', () => {
		it('parses an HTML string into a Document', () => {
			const html = '<html><head><title>Test Page</title></head><body><div id="content">Hello</div></body></html>';
			const doc = parseDom(html);
			expect(doc).toBeInstanceOf(Document);
			expect(doc.title).toBe('Test Page');
			expect(doc.querySelector('#content')?.textContent).toBe('Hello');
		});

		it('returns the input directly if it is already a Document', () => {
			const doc = parseDom(document);
			expect(doc).toBe(document);
		});
	});

	describe('processUrl', () => {
		it('processes an absolute URL correctly', () => {
			const result = processUrl('https://example.com/about?foo=bar#section');
			expect(result.raw).toBe('https://example.com/about?foo=bar#section');
			expect(result.host).toBe('example.com');
			expect(result.pathname).toBe('/about');
			expect(result.search).toBe('?foo=bar');
			expect(result.hasHash).toBe(true);
			expect(result.hash).toBe('#section');
			expect(result.href).toBe('https://example.com/about?foo=bar');
		});

		it('strips trailing slashes from pathname', () => {
			const result = processUrl('https://example.com/blog/posts/');
			expect(result.pathname).toBe('/blog/posts');
		});

		it('resolves relative URLs against window.location.origin', () => {
			const result = processUrl('/contact');
			expect(result.pathname).toBe('/contact');
			expect(result.href).toBe(`${window.location.origin}/contact`);
			expect(result.hasHash).toBe(false);
			expect(result.hash).toBe('');
		});
	});

	describe('attributeToDataset', () => {
		it('converts data-* hyphenated attributes to camelCase', () => {
			expect(attributeToDataset('data-taxi')).toBe('taxi');
			expect(attributeToDataset('data-taxi-view')).toBe('taxiView');
			expect(attributeToDataset('data-custom-attribute-name')).toBe('customAttributeName');
		});

		it('returns original string if not starting with data-', () => {
			expect(attributeToDataset('taxi-view')).toBe('taxi-view');
			expect(attributeToDataset('custom')).toBe('custom');
		});
	});

	describe('duplicateElement', () => {
		it('duplicates a script element with its attributes and inline content', () => {
			const script = document.createElement('script');
			script.setAttribute('type', 'module');
			script.setAttribute('data-taxi-reload', '');
			script.innerHTML = 'console.log("hello");';

			const duplicated = duplicateElement(script, 'SCRIPT');
			expect(duplicated.tagName).toBe('SCRIPT');
			expect(duplicated.getAttribute('type')).toBe('module');
			expect(duplicated.hasAttribute('data-taxi-reload')).toBe(true);
			expect(duplicated.innerHTML).toBe('console.log("hello");');
		});

		it('duplicates a style element', () => {
			const style = document.createElement('style');
			style.setAttribute('data-test', 'true');
			style.innerHTML = 'body { color: red; }';

			const duplicated = duplicateElement(style, 'STYLE');
			expect(duplicated.tagName).toBe('STYLE');
			expect(duplicated.getAttribute('data-test')).toBe('true');
			expect(duplicated.innerHTML).toBe('body { color: red; }');
		});
	});

	describe('appendElement and reloadElement', () => {
		it('appends an element to head if parent is HEAD', () => {
			const headScript = document.createElement('script');
			headScript.src = '/test-head.js';
			document.head.appendChild(headScript);

			appendElement(headScript, 'SCRIPT');
			const scripts = document.head.querySelectorAll('script[src="/test-head.js"]');
			expect(scripts.length).toBe(2);

			headScript.remove();
			scripts.forEach((s) => s.remove());
		});

		it('replaces an element in-place via reloadElement', () => {
			const container = document.createElement('div');
			const style = document.createElement('style');
			style.id = 'style-to-reload';
			style.innerHTML = 'div { margin: 10px; }';
			container.appendChild(style);
			document.body.appendChild(container);

			reloadElement(style, 'STYLE');
			const reloaded = container.querySelector('#style-to-reload');
			expect(reloaded).not.toBeNull();
			expect(reloaded).not.toBe(style); // Should be a cloned replacement
			expect(reloaded?.innerHTML).toBe('div { margin: 10px; }');

			container.remove();
		});
	});
});
