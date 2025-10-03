// Integration test for settings persistence across Obsidian sessions
// This can be run manually to verify settings work correctly

import HTMLCSSEditorPlugin from './main';
import { SettingsValidator, DEFAULT_SETTINGS } from './settings';

export class SettingsIntegrationTest {
	private plugin: HTMLCSSEditorPlugin;
	
	constructor(plugin: HTMLCSSEditorPlugin) {
		this.plugin = plugin;
	}
	
	async runPersistenceTest(): Promise<boolean> {
		console.log('Starting settings persistence integration test...');
		
		try {
			// Step 1: Save current settings as backup
			const originalSettings = { ...this.plugin.settings };
			console.log('Original settings backed up');
			
			// Step 2: Create test settings with unique values
			const testSettings = {
				...DEFAULT_SETTINGS,
				autoRefresh: !DEFAULT_SETTINGS.autoRefresh,
				refreshDelay: 777, // Unique value
				fontSize: 18,
				lineHeight: 1.7,
				previewPosition: 'horizontal' as const,
				editorRatio: 0.3,
				theme: 'dark' as const,
				previewBackground: '#f0f0f0',
				enableAutocomplete: !DEFAULT_SETTINGS.enableAutocomplete,
				enableCodeFolding: !DEFAULT_SETTINGS.enableCodeFolding,
				version: DEFAULT_SETTINGS.version,
				lastUpdated: new Date().toISOString()
			};
			
			// Step 3: Apply test settings
			this.plugin.settings = testSettings;
			await this.plugin.saveSettings();
			console.log('Test settings saved');
			
			// Step 4: Reload settings from storage
			await this.plugin.loadSettings();
			console.log('Settings reloaded from storage');
			
			// Step 5: Verify all settings persisted correctly
			const verificationResults = this.verifySettings(testSettings, this.plugin.settings);
			
			// Step 6: Restore original settings
			this.plugin.settings = originalSettings;
			await this.plugin.saveSettings();
			console.log('Original settings restored');
			
			// Step 7: Report results
			if (verificationResults.success) {
				console.log('✓ Settings persistence test PASSED');
				return true;
			} else {
				console.error('✗ Settings persistence test FAILED:', verificationResults.errors);
				return false;
			}
			
		} catch (error) {
			console.error('Settings persistence test error:', error);
			return false;
		}
	}
	
	private verifySettings(expected: any, actual: any): { success: boolean; errors: string[] } {
		const errors: string[] = [];
		
		// Check each setting
		const settingsToCheck = [
			'autoRefresh', 'refreshDelay', 'fontSize', 'lineHeight',
			'previewPosition', 'editorRatio', 'theme', 'previewBackground',
			'enableAutocomplete', 'enableCodeFolding'
		];
		
		for (const key of settingsToCheck) {
			if (expected[key] !== actual[key]) {
				errors.push(`${key}: expected ${expected[key]}, got ${actual[key]}`);
			}
		}
		
		// Check that version and timestamp are present
		if (!actual.version || actual.version < 1) {
			errors.push('Version field missing or invalid');
		}
		
		if (!actual.lastUpdated) {
			errors.push('lastUpdated field missing');
		}
		
		return {
			success: errors.length === 0,
			errors
		};
	}
	
	async runValidationTest(): Promise<boolean> {
		console.log('Starting settings validation integration test...');
		
		try {
			// Test with invalid settings
			const invalidSettings: any = {
				autoRefresh: 'not-boolean',
				refreshDelay: 50, // Too low
				fontSize: 50, // Too high
				lineHeight: 5.0, // Too high
				previewPosition: 'invalid',
				theme: 'invalid',
				previewBackground: 'not-a-color'
			};
			
			// Apply invalid settings - should be corrected by validation
			const correctedSettings = SettingsValidator.validateSettings(invalidSettings);
			
			// Check that invalid values were replaced with defaults
			if (correctedSettings.autoRefresh !== DEFAULT_SETTINGS.autoRefresh) {
				console.error('Validation test failed: autoRefresh not corrected');
				return false;
			}
			
			if (correctedSettings.refreshDelay !== DEFAULT_SETTINGS.refreshDelay) {
				console.error('Validation test failed: refreshDelay not corrected');
				return false;
			}
			
			console.log('✓ Settings validation test PASSED');
			return true;
			
		} catch (error) {
			console.error('Settings validation test error:', error);
			return false;
		}
	}
	
	async runMigrationTest(): Promise<boolean> {
		console.log('Starting settings migration integration test...');
		
		try {
			// Simulate old settings without version
			const oldSettings = {
				autoRefresh: false,
				fontSize: 12,
				// Missing newer fields like enableCodeFolding
			};
			
			// Test migration
			const migratedSettings = SettingsValidator.migrateSettings(oldSettings);
			
			// Verify migration worked
			if (migratedSettings.version !== DEFAULT_SETTINGS.version) {
				console.error('Migration test failed: Version not set');
				return false;
			}
			
			if (migratedSettings.enableCodeFolding !== DEFAULT_SETTINGS.enableCodeFolding) {
				console.error('Migration test failed: New fields not added');
				return false;
			}
			
			if (migratedSettings.autoRefresh !== false) {
				console.error('Migration test failed: Existing fields not preserved');
				return false;
			}
			
			console.log('✓ Settings migration test PASSED');
			return true;
			
		} catch (error) {
			console.error('Settings migration test error:', error);
			return false;
		}
	}
	
	async runAllTests(): Promise<boolean> {
		console.log('Running all settings integration tests...');
		
		const results = await Promise.all([
			this.runPersistenceTest(),
			this.runValidationTest(),
			this.runMigrationTest()
		]);
		
		const allPassed = results.every(result => result);
		
		console.log(`All settings integration tests ${allPassed ? 'PASSED' : 'FAILED'}`);
		return allPassed;
	}
}

// Export for use in development console
(window as any).SettingsIntegrationTest = SettingsIntegrationTest;