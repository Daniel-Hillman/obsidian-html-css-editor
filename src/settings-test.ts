// Settings persistence test utility
// This file can be used to test settings functionality during development

import { SettingsValidator, DEFAULT_SETTINGS, HTMLCSSEditorSettings } from './settings';

export class SettingsTestSuite {
	static runAllTests(): boolean {
		console.log('Running HTML/CSS Editor Settings Tests...');
		
		let allPassed = true;
		
		// Test 1: Validation with valid settings
		allPassed = this.testValidSettings() && allPassed;
		
		// Test 2: Validation with invalid settings
		allPassed = this.testInvalidSettings() && allPassed;
		
		// Test 3: Migration from version 0 to 1
		allPassed = this.testMigration() && allPassed;
		
		// Test 4: Color validation
		allPassed = this.testColorValidation() && allPassed;
		
		// Test 5: Settings cloning and immutability
		allPassed = this.testSettingsImmutability() && allPassed;
		
		console.log(`Settings tests ${allPassed ? 'PASSED' : 'FAILED'}`);
		return allPassed;
	}
	
	private static testValidSettings(): boolean {
		try {
			const validSettings: Partial<HTMLCSSEditorSettings> = {
				autoRefresh: true,
				refreshDelay: 500,
				fontSize: 16,
				lineHeight: 1.5,
				previewPosition: 'vertical',
				theme: 'dark',
				previewBackground: '#ffffff'
			};
			
			const result = SettingsValidator.validateSettings(validSettings);
			const errors = SettingsValidator.getValidationErrors(result);
			
			if (errors.length > 0) {
				console.error('Valid settings test failed:', errors);
				return false;
			}
			
			console.log('✓ Valid settings test passed');
			return true;
		} catch (error) {
			console.error('Valid settings test error:', error);
			return false;
		}
	}
	
	private static testInvalidSettings(): boolean {
		try {
			const invalidSettings: any = {
				autoRefresh: 'not-a-boolean',
				refreshDelay: 50, // Too low
				fontSize: 30, // Too high
				lineHeight: 3.0, // Too high
				previewPosition: 'invalid',
				theme: 'invalid-theme',
				previewBackground: 'invalid-color'
			};
			
			const errors = SettingsValidator.getValidationErrors(invalidSettings);
			
			if (errors.length === 0) {
				console.error('Invalid settings test failed: Expected validation errors');
				return false;
			}
			
			console.log('✓ Invalid settings test passed:', errors.length, 'errors detected');
			return true;
		} catch (error) {
			console.error('Invalid settings test error:', error);
			return false;
		}
	}
	
	private static testMigration(): boolean {
		try {
			// Test migration from version 0 (no version field)
			const oldSettings = {
				autoRefresh: false,
				fontSize: 12,
				// Missing some new fields
			};
			
			const migrated = SettingsValidator.migrateSettings(oldSettings);
			
			// Check that version was added
			if (migrated.version !== DEFAULT_SETTINGS.version) {
				console.error('Migration test failed: Version not updated');
				return false;
			}
			
			// Check that missing fields were added with defaults
			if (migrated.enableCodeFolding !== DEFAULT_SETTINGS.enableCodeFolding) {
				console.error('Migration test failed: Missing fields not added');
				return false;
			}
			
			// Check that existing fields were preserved
			if (migrated.autoRefresh !== false || migrated.fontSize !== 12) {
				console.error('Migration test failed: Existing fields not preserved');
				return false;
			}
			
			console.log('✓ Migration test passed');
			return true;
		} catch (error) {
			console.error('Migration test error:', error);
			return false;
		}
	}
	
	private static testColorValidation(): boolean {
		try {
			const validColors = ['#ffffff', '#fff', '#123456', 'white', 'black', 'transparent', 'red'];
			const invalidColors = ['#gggggg', 'not-a-color', '#12345', 'invalid', ''];
			
			for (const color of validColors) {
				const settings = { previewBackground: color };
				const errors = SettingsValidator.getValidationErrors(settings);
				const colorErrors = errors.filter(e => e.includes('previewBackground'));
				
				if (colorErrors.length > 0) {
					console.error(`Color validation test failed: ${color} should be valid`);
					return false;
				}
			}
			
			for (const color of invalidColors) {
				const settings = { previewBackground: color };
				const errors = SettingsValidator.getValidationErrors(settings);
				const colorErrors = errors.filter(e => e.includes('previewBackground'));
				
				if (colorErrors.length === 0 && color !== '') {
					console.error(`Color validation test failed: ${color} should be invalid`);
					return false;
				}
			}
			
			console.log('✓ Color validation test passed');
			return true;
		} catch (error) {
			console.error('Color validation test error:', error);
			return false;
		}
	}
	
	private static testSettingsImmutability(): boolean {
		try {
			const original = { ...DEFAULT_SETTINGS };
			const validated = SettingsValidator.validateSettings(original);
			
			// Modify the validated settings
			validated.fontSize = 20;
			
			// Check that original wasn't modified
			if (original.fontSize !== DEFAULT_SETTINGS.fontSize) {
				console.error('Settings immutability test failed: Original was modified');
				return false;
			}
			
			console.log('✓ Settings immutability test passed');
			return true;
		} catch (error) {
			console.error('Settings immutability test error:', error);
			return false;
		}
	}
}

// Export for use in development console
(window as any).SettingsTestSuite = SettingsTestSuite;