import { describe, it, expect } from 'vitest';
import * as Taxi from '../src/taxi';
import Core from '../src/Core';
import Renderer from '../src/Renderer';
import Transition from '../src/Transition';
import ViewTransition from '../src/ViewTransition';

describe('Taxi root exports', () => {
	it('exports Core, Renderer, Transition, and ViewTransition', () => {
		expect(Taxi.Core).toBe(Core);
		expect(Taxi.Renderer).toBe(Renderer);
		expect(Taxi.Transition).toBe(Transition);
		expect(Taxi.ViewTransition).toBe(ViewTransition);
	});
});
