// Test utilities for HTML/CSS Editor Plugin
// Provides a simple testing framework without external dependencies

export interface TestResult {
	name: string;
	passed: boolean;
	error?: string;
	duration?: number;
}

export interface TestSuite {
	name: string;
	results: TestResult[];
	passed: boolean;
	duration: number;
}

export class TestRunner {
	private suites: TestSuite[] = [];

	async runTest(name: string, testFn: () => void | Promise<void>): Promise<TestResult> {
		const startTime = Date.now();
		
		try {
			await testFn();
			const duration = Date.now() - startTime;
			return { name, passed: true, duration };
		} catch (error) {
			const duration = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { name, passed: false, error: errorMessage, duration };
		}
	}

	async runSuite(suiteName: string, tests: Array<{ name: string; fn: () => void | Promise<void> }>): Promise<TestSuite> {
		const startTime = Date.now();
		const results: TestResult[] = [];

		// Running test suite: ${suiteName}

		for (const test of tests) {
			const result = await this.runTest(test.name, test.fn);
			results.push(result);
			
			if (!result.passed) {
				console.error(`Test failed: ${result.name} (${result.duration}ms) - ${result.error}`);
			}
		}

		const duration = Date.now() - startTime;
		const passed = results.every(r => r.passed);
		const suite: TestSuite = { name: suiteName, results, passed, duration };
		
		this.suites.push(suite);
		
		const passedCount = results.filter(r => r.passed).length;
		if (passedCount !== results.length) {
			console.error(`Suite ${suiteName}: ${passedCount}/${results.length} tests passed (${duration}ms)`);
		}
		
		return suite;
	}

	getSummary(): { totalSuites: number; passedSuites: number; totalTests: number; passedTests: number } {
		const totalSuites = this.suites.length;
		const passedSuites = this.suites.filter(s => s.passed).length;
		const totalTests = this.suites.reduce((sum, s) => sum + s.results.length, 0);
		const passedTests = this.suites.reduce((sum, s) => sum + s.results.filter(r => r.passed).length, 0);
		
		return { totalSuites, passedSuites, totalTests, passedTests };
	}

	printSummary(): void {
		const summary = this.getSummary();
		
		if (summary.passedTests !== summary.totalTests) {
			console.error(`TEST SUMMARY: ${summary.passedTests}/${summary.totalTests} tests passed, ${summary.passedSuites}/${summary.totalSuites} suites passed`);
		}
	}

	clear(): void {
		this.suites = [];
	}
}

// Assertion utilities
export class Assert {
	static isTrue(condition: boolean, message?: string): void {
		if (!condition) {
			throw new Error(message || 'Expected condition to be true');
		}
	}

	static isFalse(condition: boolean, message?: string): void {
		if (condition) {
			throw new Error(message || 'Expected condition to be false');
		}
	}

	static equals<T>(actual: T, expected: T, message?: string): void {
		if (actual !== expected) {
			throw new Error(message || `Expected ${expected}, got ${actual}`);
		}
	}

	static notEquals<T>(actual: T, expected: T, message?: string): void {
		if (actual === expected) {
			throw new Error(message || `Expected values to be different, but both were ${actual}`);
		}
	}

	static deepEquals(actual: any, expected: any, message?: string): void {
		if (!this.deepEqual(actual, expected)) {
			throw new Error(message || `Deep equality failed:\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
		}
	}

	static throws(fn: () => void, expectedError?: string | RegExp, message?: string): void {
		let threw = false;
		let error: any;
		
		try {
			fn();
		} catch (e) {
			threw = true;
			error = e;
		}
		
		if (!threw) {
			throw new Error(message || 'Expected function to throw an error');
		}
		
		if (expectedError) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			if (typeof expectedError === 'string') {
				if (!errorMessage.includes(expectedError)) {
					throw new Error(message || `Expected error to contain "${expectedError}", got "${errorMessage}"`);
				}
			} else if (expectedError instanceof RegExp) {
				if (!expectedError.test(errorMessage)) {
					throw new Error(message || `Expected error to match ${expectedError}, got "${errorMessage}"`);
				}
			}
		}
	}

	static async throwsAsync(fn: () => Promise<void>, expectedError?: string | RegExp, message?: string): Promise<void> {
		let threw = false;
		let error: any;
		
		try {
			await fn();
		} catch (e) {
			threw = true;
			error = e;
		}
		
		if (!threw) {
			throw new Error(message || 'Expected async function to throw an error');
		}
		
		if (expectedError) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			if (typeof expectedError === 'string') {
				if (!errorMessage.includes(expectedError)) {
					throw new Error(message || `Expected error to contain "${expectedError}", got "${errorMessage}"`);
				}
			} else if (expectedError instanceof RegExp) {
				if (!expectedError.test(errorMessage)) {
					throw new Error(message || `Expected error to match ${expectedError}, got "${errorMessage}"`);
				}
			}
		}
	}

	static isNull(value: any, message?: string): void {
		if (value !== null) {
			throw new Error(message || `Expected null, got ${value}`);
		}
	}

	static isNotNull(value: any, message?: string): void {
		if (value === null) {
			throw new Error(message || 'Expected value to not be null');
		}
	}

	static isUndefined(value: any, message?: string): void {
		if (value !== undefined) {
			throw new Error(message || `Expected undefined, got ${value}`);
		}
	}

	static isDefined(value: any, message?: string): void {
		if (value === undefined) {
			throw new Error(message || 'Expected value to be defined');
		}
	}

	static isArray(value: any, message?: string): void {
		if (!Array.isArray(value)) {
			throw new Error(message || `Expected array, got ${typeof value}`);
		}
	}

	static hasLength(value: any[] | string, expectedLength: number, message?: string): void {
		if (value.length !== expectedLength) {
			throw new Error(message || `Expected length ${expectedLength}, got ${value.length}`);
		}
	}

	static contains<T>(array: T[], item: T, message?: string): void {
		if (!array.includes(item)) {
			throw new Error(message || `Expected array to contain ${item}`);
		}
	}

	static doesNotContain<T>(array: T[], item: T, message?: string): void {
		if (array.includes(item)) {
			throw new Error(message || `Expected array to not contain ${item}`);
		}
	}

	private static deepEqual(a: any, b: any): boolean {
		if (a === b) return true;
		
		if (a == null || b == null) return false;
		
		if (typeof a !== typeof b) return false;
		
		if (typeof a !== 'object') return false;
		
		if (Array.isArray(a) !== Array.isArray(b)) return false;
		
		const keysA = Object.keys(a);
		const keysB = Object.keys(b);
		
		if (keysA.length !== keysB.length) return false;
		
		for (const key of keysA) {
			if (!keysB.includes(key)) return false;
			if (!this.deepEqual(a[key], b[key])) return false;
		}
		
		return true;
	}
}

// Mock utilities for testing
export class MockUtils {
	static createMockApp(): any {
		return {
			workspace: {
				getLeavesOfType: (): any[] => [],
				detachLeavesOfType: () => {},
				getRightLeaf: () => ({
					setViewState: async () => {},
				}),
				revealLeaf: () => {},
			},
			vault: {
				create: async (path: string, content: string) => ({ name: path }),
				modify: async () => {},
				getAbstractFileByPath: (): any => null,
			}
		};
	}

	static createMockPlugin(): any {
		return {
			settings: {
				autoRefresh: true,
				refreshDelay: 300,
				fontSize: 14,
				lineHeight: 1.4,
				showLineNumbers: true,
				previewPosition: 'vertical',
				editorRatio: 0.5,
				theme: 'inherit',
				previewBackground: '#ffffff',
				enableAutocomplete: true,
				enableCodeFolding: true,
				version: 1,
				lastUpdated: new Date().toISOString(),
			},
			saveSettings: async () => {},
			loadSettings: async () => {},
			saveData: async () => {},
			loadData: async () => ({}),
		};
	}

	static createMockNotice(): any {
		return class MockNotice {
			constructor(public message: string) {}
		};
	}
}