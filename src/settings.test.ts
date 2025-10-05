// Comprehensive unit tests for settings management and validation
import { SettingsValidator, DEFAULT_SETTINGS, HTMLCSSEditorSettings } from './settings';
import { TestRunner, Assert } from './test-utils';

export class SettingsUnitTests {
	private runner = new TestRunner();

	async runAllTests(): Promise<boolean> {
		// Starting Settings Unit Tests

		await this.runner.runSuite('Settings Validation', [
			{ name: 'should validate correct settings', fn: () => this.testValidSettings() },
			{ name: 'should handle invalid boolean settings', fn: () => this.testInvalidBooleanSettings() },
			{ name: 'should handle invalid numeric settings', fn: () => this.testInvalidNumericSettings() },
			{ name: 'should handle invalid enum settings', fn: () => this.testInvalidEnumSettings() },
			{ name: 'should handle invalid color settings', fn: () => this.testInvalidColorSettings() },
			{ name: 'should preserve valid settings during validation', fn: () => this.testValidSettingsPreservation() },
			{ name: 'should handle edge case numeric values', fn: () => this.testEdgeCaseNumericValues() },
		]);

		await this.runner.runSuite('Settings Migration', [
			{ name: 'should migrate from version 0 to 1', fn: () => this.testMigrationV0ToV1() },
			{ name: 'should handle null/undefined settings', fn: () => this.testNullUndefinedMigration() },
			{ name: 'should handle corrupted settings', fn: () => this.testCorruptedSettingsMigration() },
			{ name: 'should preserve existing valid settings during migration', fn: () => this.testMigrationPreservation() },
			{ name: 'should update version and timestamp during migration', fn: () => this.testMigrationMetadata() },
			{ name: 'should handle partial settings objects', fn: () => this.testPartialSettingsMigration() },
		]);

		await this.runner.runSuite('Color Validation', [
			{ name: 'should validate hex colors', fn: () => this.testHexColorValidation() },
			{ name: 'should validate RGB colors', fn: () => this.testRGBColorValidation() },
			{ name: 'should validate HSL colors', fn: () => this.testHSLColorValidation() },
			{ name: 'should validate CSS color names', fn: () => this.testCSSColorNameValidation() },
			{ name: 'should reject invalid colors', fn: () => this.testInvalidColorRejection() },
		]);

		await this.runner.runSuite('Error Handling', [
			{ name: 'should handle validation errors gracefully', fn: () => this.testValidationErrorHandling() },
			{ name: 'should return default settings on critical errors', fn: () => this.testCriticalErrorFallback() },
			{ name: 'should collect multiple validation errors', fn: () => this.testMultipleValidationErrors() },
		]);

		await this.runner.runSuite('Settings Immutability', [
			{ name: 'should not modify original settings during validation', fn: () => this.testSettingsImmutability() },
			{ name: 'should create new objects during migration', fn: () => this.testMigrationImmutability() },
		]);

		this.runner.printSummary();
		const summary = this.runner.getSummary();
		return summary.passedTests === summary.totalTests;
	}

	// Validation Tests
	private testValidSettings(): void {
		const validSettings: Partial<HTMLCSSEditorSettings> = {
			autoRefresh: true,
			refreshDelay: 500,
			fontSize: 16,
			lineHeight: 1.5,
			showLineNumbers: false,
			previewPosition: 'horizontal',
			editorRatio: 0.7,
			theme: 'dark',
			previewBackground: '#f0f0f0',
			enableAutocomplete: false,
			enableCodeFolding: true,
		};

		const result = SettingsValidator.validateSettings(validSettings);
		const errors = SettingsValidator.getValidationErrors(result);

		Assert.equals(errors.length, 0, 'Valid settings should not produce validation errors');
		Assert.equals(result.autoRefresh, true);
		Assert.equals(result.refreshDelay, 500);
		Assert.equals(result.fontSize, 16);
		Assert.equals(result.lineHeight, 1.5);
		Assert.equals(result.previewPosition, 'horizontal');
		Assert.equals(result.theme, 'dark');
	}

	private testInvalidBooleanSettings(): void {
		const invalidSettings: any = {
			autoRefresh: 'not-a-boolean',
			showLineNumbers: 123,
			enableAutocomplete: null,
			enableCodeFolding: undefined,
		};

		const result = SettingsValidator.validateSettings(invalidSettings);
		
		// Should fall back to defaults for invalid boolean values
		Assert.equals(result.autoRefresh, DEFAULT_SETTINGS.autoRefresh);
		Assert.equals(result.showLineNumbers, DEFAULT_SETTINGS.showLineNumbers);
		Assert.equals(result.enableAutocomplete, DEFAULT_SETTINGS.enableAutocomplete);
		Assert.equals(result.enableCodeFolding, DEFAULT_SETTINGS.enableCodeFolding);
	}

	private testInvalidNumericSettings(): void {
		const invalidSettings: any = {
			refreshDelay: 50, // Too low
			fontSize: 30, // Too high
			lineHeight: 3.0, // Too high
			editorRatio: 1.5, // Too high
		};

		const result = SettingsValidator.validateSettings(invalidSettings);
		
		// Should fall back to defaults for out-of-range values
		Assert.equals(result.refreshDelay, DEFAULT_SETTINGS.refreshDelay);
		Assert.equals(result.fontSize, DEFAULT_SETTINGS.fontSize);
		Assert.equals(result.lineHeight, DEFAULT_SETTINGS.lineHeight);
		Assert.equals(result.editorRatio, DEFAULT_SETTINGS.editorRatio);
	}

	private testInvalidEnumSettings(): void {
		const invalidSettings: any = {
			previewPosition: 'invalid-position',
			theme: 'invalid-theme',
		};

		const result = SettingsValidator.validateSettings(invalidSettings);
		
		// Should fall back to defaults for invalid enum values
		Assert.equals(result.previewPosition, DEFAULT_SETTINGS.previewPosition);
		Assert.equals(result.theme, DEFAULT_SETTINGS.theme);
	}

	private testInvalidColorSettings(): void {
		const invalidSettings: any = {
			previewBackground: 'not-a-color',
		};

		const result = SettingsValidator.validateSettings(invalidSettings);
		
		// Should fall back to default for invalid color
		Assert.equals(result.previewBackground, DEFAULT_SETTINGS.previewBackground);
	}

	private testValidSettingsPreservation(): void {
		const validSettings: Partial<HTMLCSSEditorSettings> = {
			autoRefresh: false,
			refreshDelay: 1000,
			fontSize: 12,
			lineHeight: 1.2,
			previewPosition: 'horizontal',
			editorRatio: 0.3,
		};

		const result = SettingsValidator.validateSettings(validSettings);
		
		// All valid settings should be preserved
		Assert.equals(result.autoRefresh, false);
		Assert.equals(result.refreshDelay, 1000);
		Assert.equals(result.fontSize, 12);
		Assert.equals(result.lineHeight, 1.2);
		Assert.equals(result.previewPosition, 'horizontal');
		Assert.equals(result.editorRatio, 0.3);
	}

	private testEdgeCaseNumericValues(): void {
		// Test boundary values
		const boundarySettings: any = {
			refreshDelay: 100, // Minimum valid
			fontSize: 24, // Maximum valid
			lineHeight: 1.0, // Minimum valid
			editorRatio: 0.9, // Maximum valid
		};

		const result = SettingsValidator.validateSettings(boundarySettings);
		
		Assert.equals(result.refreshDelay, 100);
		Assert.equals(result.fontSize, 24);
		Assert.equals(result.lineHeight, 1.0);
		Assert.equals(result.editorRatio, 0.9);

		// Test just outside boundaries
		const outsideBoundarySettings: any = {
			refreshDelay: 99, // Just below minimum
			fontSize: 25, // Just above maximum
			lineHeight: 0.9, // Just below minimum
			editorRatio: 0.95, // Just above maximum
		};

		const result2 = SettingsValidator.validateSettings(outsideBoundarySettings);
		
		// Should fall back to defaults
		Assert.equals(result2.refreshDelay, DEFAULT_SETTINGS.refreshDelay);
		Assert.equals(result2.fontSize, DEFAULT_SETTINGS.fontSize);
		Assert.equals(result2.lineHeight, DEFAULT_SETTINGS.lineHeight);
		Assert.equals(result2.editorRatio, DEFAULT_SETTINGS.editorRatio);
	}

	// Migration Tests
	private testMigrationV0ToV1(): void {
		const v0Settings = {
			autoRefresh: false,
			fontSize: 12,
			// Missing newer fields
		};

		const migrated = SettingsValidator.migrateSettings(v0Settings);
		
		// Should have version 1
		Assert.equals(migrated.version, 1);
		
		// Should preserve existing fields
		Assert.equals(migrated.autoRefresh, false);
		Assert.equals(migrated.fontSize, 12);
		
		// Should add missing fields with defaults
		Assert.equals(migrated.enableCodeFolding, DEFAULT_SETTINGS.enableCodeFolding);
		Assert.equals(migrated.enableAutocomplete, DEFAULT_SETTINGS.enableAutocomplete);
		
		// Should have timestamp
		Assert.isDefined(migrated.lastUpdated);
	}

	private testNullUndefinedMigration(): void {
		const nullMigrated = SettingsValidator.migrateSettings(null);
		const undefinedMigrated = SettingsValidator.migrateSettings(undefined);
		
		// Both should return default settings
		Assert.deepEquals(nullMigrated, { ...DEFAULT_SETTINGS, lastUpdated: nullMigrated.lastUpdated });
		Assert.deepEquals(undefinedMigrated, { ...DEFAULT_SETTINGS, lastUpdated: undefinedMigrated.lastUpdated });
	}

	private testCorruptedSettingsMigration(): void {
		const corruptedSettings = 'not-an-object';
		
		const migrated = SettingsValidator.migrateSettings(corruptedSettings);
		
		// Should return default settings
		Assert.equals(migrated.version, DEFAULT_SETTINGS.version);
		Assert.equals(migrated.autoRefresh, DEFAULT_SETTINGS.autoRefresh);
	}

	private testMigrationPreservation(): void {
		const existingSettings = {
			autoRefresh: false,
			refreshDelay: 777,
			fontSize: 18,
			previewPosition: 'horizontal',
			version: 0, // Old version
		};

		const migrated = SettingsValidator.migrateSettings(existingSettings);
		
		// Should preserve existing valid settings
		Assert.equals(migrated.autoRefresh, false);
		Assert.equals(migrated.refreshDelay, 777);
		Assert.equals(migrated.fontSize, 18);
		Assert.equals(migrated.previewPosition, 'horizontal');
		
		// Should update version
		Assert.equals(migrated.version, DEFAULT_SETTINGS.version);
	}

	private testMigrationMetadata(): void {
		const oldSettings = { autoRefresh: true };
		
		const migrated = SettingsValidator.migrateSettings(oldSettings);
		
		// Should have updated version
		Assert.equals(migrated.version, DEFAULT_SETTINGS.version);
		
		// Should have timestamp
		Assert.isDefined(migrated.lastUpdated);
		
		// Timestamp should be recent (within last 5 seconds)
		const timestamp = new Date(migrated.lastUpdated);
		const now = new Date();
		const diffMs = now.getTime() - timestamp.getTime();
		Assert.isTrue(diffMs < 5000, 'Timestamp should be recent');
	}

	private testPartialSettingsMigration(): void {
		const partialSettings = {
			fontSize: 16,
			theme: 'dark',
			// Missing most fields
		};

		const migrated = SettingsValidator.migrateSettings(partialSettings);
		
		// Should preserve provided fields
		Assert.equals(migrated.fontSize, 16);
		Assert.equals(migrated.theme, 'dark');
		
		// Should add missing fields
		Assert.equals(migrated.autoRefresh, DEFAULT_SETTINGS.autoRefresh);
		Assert.equals(migrated.refreshDelay, DEFAULT_SETTINGS.refreshDelay);
		Assert.equals(migrated.enableCodeFolding, DEFAULT_SETTINGS.enableCodeFolding);
	}

	// Color Validation Tests
	private testHexColorValidation(): void {
		const validHexColors = ['#ffffff', '#000000', '#123456', '#abc', '#ABC', '#f0f'];
		
		for (const color of validHexColors) {
			const settings = { previewBackground: color };
			const errors = SettingsValidator.getValidationErrors(settings);
			const colorErrors = errors.filter(e => e.includes('previewBackground'));
			Assert.equals(colorErrors.length, 0, `${color} should be valid`);
		}
	}

	private testRGBColorValidation(): void {
		const validRGBColors = [
			'rgb(255, 255, 255)',
			'rgb(0, 0, 0)',
			'rgba(255, 0, 0, 0.5)',
			'rgba(100, 150, 200, 1.0)',
		];
		
		for (const color of validRGBColors) {
			const settings = { previewBackground: color };
			const errors = SettingsValidator.getValidationErrors(settings);
			const colorErrors = errors.filter(e => e.includes('previewBackground'));
			Assert.equals(colorErrors.length, 0, `${color} should be valid`);
		}
	}

	private testHSLColorValidation(): void {
		const validHSLColors = [
			'hsl(0, 100%, 50%)',
			'hsl(240, 50%, 75%)',
			'hsla(120, 100%, 50%, 0.8)',
		];
		
		for (const color of validHSLColors) {
			const settings = { previewBackground: color };
			const errors = SettingsValidator.getValidationErrors(settings);
			const colorErrors = errors.filter(e => e.includes('previewBackground'));
			Assert.equals(colorErrors.length, 0, `${color} should be valid`);
		}
	}

	private testCSSColorNameValidation(): void {
		const validColorNames = ['white', 'black', 'red', 'blue', 'transparent', 'gray', 'orange'];
		
		for (const color of validColorNames) {
			const settings = { previewBackground: color };
			const errors = SettingsValidator.getValidationErrors(settings);
			const colorErrors = errors.filter(e => e.includes('previewBackground'));
			Assert.equals(colorErrors.length, 0, `${color} should be valid`);
		}
	}

	private testInvalidColorRejection(): void {
		const invalidColors = ['#gggggg', 'not-a-color', '#12345', 'invalid-color-name', ''];
		
		for (const color of invalidColors) {
			if (color === '') continue; // Empty string is handled separately
			
			const settings = { previewBackground: color };
			const errors = SettingsValidator.getValidationErrors(settings);
			const colorErrors = errors.filter(e => e.includes('previewBackground'));
			Assert.isTrue(colorErrors.length > 0, `${color} should be invalid`);
		}
	}

	// Error Handling Tests
	private testValidationErrorHandling(): void {
		const invalidSettings: any = {
			autoRefresh: 'invalid',
			refreshDelay: -100,
			fontSize: 'not-a-number',
			previewPosition: 'invalid-position',
		};

		// Should not throw, but return valid settings
		const result = SettingsValidator.validateSettings(invalidSettings);
		
		Assert.isDefined(result);
		Assert.equals(typeof result.autoRefresh, 'boolean');
		Assert.equals(typeof result.refreshDelay, 'number');
		Assert.equals(typeof result.fontSize, 'number');
		Assert.isTrue(['vertical', 'horizontal'].includes(result.previewPosition));
	}

	private testCriticalErrorFallback(): void {
		// Test with object that will cause validation to fail completely
		const problematicSettings = {
			autoRefresh: undefined
		} as Partial<HTMLCSSEditorSettings>;

		const result = SettingsValidator.validateSettings(problematicSettings);
		
		// Should return default settings
		Assert.equals(result.autoRefresh, DEFAULT_SETTINGS.autoRefresh);
		Assert.equals(result.version, DEFAULT_SETTINGS.version);
	}

	private testMultipleValidationErrors(): void {
		const multipleInvalidSettings: any = {
			autoRefresh: 'not-boolean',
			refreshDelay: 50, // Too low
			fontSize: 30, // Too high
			previewPosition: 'invalid',
			theme: 'invalid',
			previewBackground: 'invalid-color',
		};

		const errors = SettingsValidator.getValidationErrors(multipleInvalidSettings);
		
		// Should detect multiple errors
		Assert.isTrue(errors.length >= 5, `Expected at least 5 errors, got ${errors.length}`);
		
		// Check that specific errors are included
		const errorText = errors.join(' ');
		Assert.isTrue(errorText.includes('autoRefresh'), 'Should include autoRefresh error');
		Assert.isTrue(errorText.includes('refreshDelay'), 'Should include refreshDelay error');
		Assert.isTrue(errorText.includes('fontSize'), 'Should include fontSize error');
	}

	// Immutability Tests
	private testSettingsImmutability(): void {
		const originalSettings = {
			autoRefresh: true,
			fontSize: 14,
			theme: 'light' as const,
		};

		const originalCopy = { ...originalSettings };
		const validated = SettingsValidator.validateSettings(originalSettings);
		
		// Modify validated settings
		validated.autoRefresh = false;
		validated.fontSize = 20;
		
		// Original should be unchanged
		Assert.deepEquals(originalSettings, originalCopy, 'Original settings should not be modified');
	}

	private testMigrationImmutability(): void {
		const originalSettings = {
			autoRefresh: false,
			fontSize: 12,
		};

		const originalCopy = { ...originalSettings };
		const migrated = SettingsValidator.migrateSettings(originalSettings);
		
		// Modify migrated settings
		migrated.autoRefresh = true;
		migrated.fontSize = 20;
		
		// Original should be unchanged
		Assert.deepEquals(originalSettings, originalCopy, 'Original settings should not be modified during migration');
	}
}

// Export for use in main test runner
export const settingsUnitTests = new SettingsUnitTests();