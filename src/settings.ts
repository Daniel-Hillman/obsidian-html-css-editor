import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import HTMLCSSEditorPlugin from './main';

export interface HTMLCSSEditorSettings {
	// Preview behavior
	autoRefresh: boolean;
	refreshDelay: number; // milliseconds
	
	// Editor appearance
	fontSize: number; // px
	lineHeight: number; // ratio
	showLineNumbers: boolean;
	
	// Layout
	previewPosition: 'vertical' | 'horizontal';
	editorRatio: number; // 0.0 to 1.0
	
	// Theme
	theme: 'inherit' | 'light' | 'dark';
	previewBackground: string;
	
	// Advanced
	enableAutocomplete: boolean;
	enableCodeFolding: boolean;
	
	// Settings metadata for migration
	version: number;
	lastUpdated: string;
}

export const DEFAULT_SETTINGS: HTMLCSSEditorSettings = {
	autoRefresh: true,
	refreshDelay: 300,
	fontSize: 14,
	lineHeight: 1.4,
	showLineNumbers: true,
	previewPosition: 'vertical', // Code on left, preview on right
	editorRatio: 0.6, // Give more space to code editor by default
	theme: 'inherit',
	previewBackground: '#ffffff',
	enableAutocomplete: true,
	enableCodeFolding: true,
	version: 1,
	lastUpdated: new Date().toISOString(),
};

// Settings version history for migration
export const SETTINGS_VERSION_HISTORY = {
	1: DEFAULT_SETTINGS
};

// Settings validation and migration functions
export class SettingsValidator {
	static validateSettings(settings: Partial<HTMLCSSEditorSettings>): HTMLCSSEditorSettings {
		const validated: HTMLCSSEditorSettings = { ...DEFAULT_SETTINGS };
		const errors: string[] = [];

		try {
			// Validate boolean settings
			if (typeof settings.autoRefresh === 'boolean') {
				validated.autoRefresh = settings.autoRefresh;
			} else if (settings.autoRefresh !== undefined) {
				errors.push(`Invalid autoRefresh value: ${settings.autoRefresh}`);
			}

			if (typeof settings.showLineNumbers === 'boolean') {
				validated.showLineNumbers = settings.showLineNumbers;
			} else if (settings.showLineNumbers !== undefined) {
				errors.push(`Invalid showLineNumbers value: ${settings.showLineNumbers}`);
			}

			if (typeof settings.enableAutocomplete === 'boolean') {
				validated.enableAutocomplete = settings.enableAutocomplete;
			} else if (settings.enableAutocomplete !== undefined) {
				errors.push(`Invalid enableAutocomplete value: ${settings.enableAutocomplete}`);
			}

			if (typeof settings.enableCodeFolding === 'boolean') {
				validated.enableCodeFolding = settings.enableCodeFolding;
			} else if (settings.enableCodeFolding !== undefined) {
				errors.push(`Invalid enableCodeFolding value: ${settings.enableCodeFolding}`);
			}

			// Validate numeric settings with ranges
			if (typeof settings.refreshDelay === 'number') {
				if (settings.refreshDelay >= 100 && settings.refreshDelay <= 2000) {
					validated.refreshDelay = settings.refreshDelay;
				} else {
					errors.push(`refreshDelay must be between 100-2000ms, got: ${settings.refreshDelay}`);
				}
			} else if (settings.refreshDelay !== undefined) {
				errors.push(`Invalid refreshDelay value: ${settings.refreshDelay}`);
			}

			if (typeof settings.fontSize === 'number') {
				if (settings.fontSize >= 10 && settings.fontSize <= 24) {
					validated.fontSize = settings.fontSize;
				} else {
					errors.push(`fontSize must be between 10-24px, got: ${settings.fontSize}`);
				}
			} else if (settings.fontSize !== undefined) {
				errors.push(`Invalid fontSize value: ${settings.fontSize}`);
			}

			if (typeof settings.lineHeight === 'number') {
				if (settings.lineHeight >= 1.0 && settings.lineHeight <= 2.0) {
					validated.lineHeight = settings.lineHeight;
				} else {
					errors.push(`lineHeight must be between 1.0-2.0, got: ${settings.lineHeight}`);
				}
			} else if (settings.lineHeight !== undefined) {
				errors.push(`Invalid lineHeight value: ${settings.lineHeight}`);
			}

			if (typeof settings.editorRatio === 'number') {
				if (settings.editorRatio >= 0.1 && settings.editorRatio <= 0.9) {
					validated.editorRatio = settings.editorRatio;
				} else {
					errors.push(`editorRatio must be between 0.1-0.9, got: ${settings.editorRatio}`);
				}
			} else if (settings.editorRatio !== undefined) {
				errors.push(`Invalid editorRatio value: ${settings.editorRatio}`);
			}

			// Validate enum settings
			if (settings.previewPosition === 'vertical' || settings.previewPosition === 'horizontal') {
				validated.previewPosition = settings.previewPosition;
			} else if (settings.previewPosition !== undefined) {
				errors.push(`Invalid previewPosition value: ${settings.previewPosition}`);
			}

			if (settings.theme === 'inherit' || settings.theme === 'light' || settings.theme === 'dark') {
				validated.theme = settings.theme;
			} else if (settings.theme !== undefined) {
				errors.push(`Invalid theme value: ${settings.theme}`);
			}

			// Validate color settings
			if (typeof settings.previewBackground === 'string') {
				if (this.isValidColor(settings.previewBackground)) {
					validated.previewBackground = settings.previewBackground;
				} else {
					errors.push(`Invalid previewBackground color: ${settings.previewBackground}`);
				}
			} else if (settings.previewBackground !== undefined) {
				errors.push(`Invalid previewBackground value: ${settings.previewBackground}`);
			}

			// Validate version and metadata
			if (typeof settings.version === 'number' && settings.version > 0) {
				validated.version = settings.version;
			}

			if (typeof settings.lastUpdated === 'string') {
				validated.lastUpdated = settings.lastUpdated;
			}

			// Update timestamp
			validated.lastUpdated = new Date().toISOString();

			// Log validation errors if any
			if (errors.length > 0) {
				console.warn('HTML/CSS Editor Settings validation errors:', errors);
			}

			return validated;

		} catch (error) {
			console.error('Settings validation failed:', error);
			return { ...DEFAULT_SETTINGS, lastUpdated: new Date().toISOString() };
		}
	}

	static migrateSettings(settings: any): HTMLCSSEditorSettings {
		try {
			// Handle null or undefined settings
			if (!settings || typeof settings !== 'object') {
				// Initializing with default settings
				return { ...DEFAULT_SETTINGS };
			}

			// Check if migration is needed
			const currentVersion = settings.version || 0;
			const latestVersion = DEFAULT_SETTINGS.version;

			if (currentVersion === latestVersion) {
				// No migration needed, just validate
				return this.validateSettings(settings);
			}

			// Migrating settings to latest version

			// Perform version-specific migrations
			let migratedSettings = { ...settings };

			// Migration from version 0 (no version) to version 1
			if (currentVersion < 1) {
				migratedSettings = this.migrateToVersion1(migratedSettings);
			}

			// Future migrations would go here
			// if (currentVersion < 2) {
			//     migratedSettings = this.migrateToVersion2(migratedSettings);
			// }

			// Set the new version
			migratedSettings.version = latestVersion;
			migratedSettings.lastUpdated = new Date().toISOString();

			// Validate the migrated settings
			const validatedSettings = this.validateSettings(migratedSettings);
			
			// Settings migration completed successfully
			return validatedSettings;

		} catch (error) {
			console.error('HTML/CSS Editor: Settings migration failed:', error);
			return { ...DEFAULT_SETTINGS };
		}
	}

	private static migrateToVersion1(settings: any): any {
		// Migration logic for version 1
		// This is the first version, so we just ensure all required fields exist
		const migrated = { ...settings };

		// Add any missing fields with defaults
		if (migrated.version === undefined) migrated.version = 1;
		if (migrated.lastUpdated === undefined) migrated.lastUpdated = new Date().toISOString();

		// Handle any legacy field names or value formats here
		// Example: if there was an old field name, rename it
		// if (migrated.oldFieldName !== undefined) {
		//     migrated.newFieldName = migrated.oldFieldName;
		//     delete migrated.oldFieldName;
		// }

		return migrated;
	}

	static getValidationErrors(settings: Partial<HTMLCSSEditorSettings>): string[] {
		const errors: string[] = [];

		// Check required fields and their types
		if (settings.autoRefresh !== undefined && typeof settings.autoRefresh !== 'boolean') {
			errors.push('autoRefresh must be a boolean');
		}

		if (settings.refreshDelay !== undefined) {
			if (typeof settings.refreshDelay !== 'number') {
				errors.push('refreshDelay must be a number');
			} else if (settings.refreshDelay < 100 || settings.refreshDelay > 2000) {
				errors.push('refreshDelay must be between 100-2000 milliseconds');
			}
		}

		if (settings.fontSize !== undefined) {
			if (typeof settings.fontSize !== 'number') {
				errors.push('fontSize must be a number');
			} else if (settings.fontSize < 10 || settings.fontSize > 24) {
				errors.push('fontSize must be between 10-24 pixels');
			}
		}

		if (settings.lineHeight !== undefined) {
			if (typeof settings.lineHeight !== 'number') {
				errors.push('lineHeight must be a number');
			} else if (settings.lineHeight < 1.0 || settings.lineHeight > 2.0) {
				errors.push('lineHeight must be between 1.0-2.0');
			}
		}

		if (settings.editorRatio !== undefined) {
			if (typeof settings.editorRatio !== 'number') {
				errors.push('editorRatio must be a number');
			} else if (settings.editorRatio < 0.1 || settings.editorRatio > 0.9) {
				errors.push('editorRatio must be between 0.1-0.9');
			}
		}

		if (settings.previewPosition !== undefined) {
			if (settings.previewPosition !== 'vertical' && settings.previewPosition !== 'horizontal') {
				errors.push('previewPosition must be "vertical" or "horizontal"');
			}
		}

		if (settings.theme !== undefined) {
			if (settings.theme !== 'inherit' && settings.theme !== 'light' && settings.theme !== 'dark') {
				errors.push('theme must be "inherit", "light", or "dark"');
			}
		}

		if (settings.previewBackground !== undefined) {
			if (typeof settings.previewBackground !== 'string' || !this.isValidColor(settings.previewBackground)) {
				errors.push('previewBackground must be a valid CSS color');
			}
		}

		return errors;
	}

	private static isValidColor(color: string): boolean {
		// Enhanced color validation
		if (!color || typeof color !== 'string') return false;

		// Hex colors (#fff, #ffffff)
		const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
		if (hexPattern.test(color)) return true;

		// RGB/RGBA colors
		const rgbPattern = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/;
		if (rgbPattern.test(color)) return true;

		// HSL/HSLA colors
		const hslPattern = /^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*[\d.]+\s*)?\)$/;
		if (hslPattern.test(color)) return true;

		// CSS color names
		const cssColors = [
			'transparent', 'white', 'black', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
			'gray', 'grey', 'silver', 'maroon', 'olive', 'lime', 'aqua', 'teal', 'navy', 'fuchsia', 'purple',
			'orange', 'pink', 'brown', 'gold', 'violet', 'indigo', 'turquoise', 'tan', 'khaki'
		];
		
		return cssColors.includes(color.toLowerCase());
	}
}

export class HTMLCSSEditorSettingTab extends PluginSettingTab {
	plugin: HTMLCSSEditorPlugin;
	private settingsContainer: HTMLElement;
	private validationErrors: Map<string, string> = new Map();

	constructor(app: App, plugin: HTMLCSSEditorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		try {
			const { containerEl } = this;
			containerEl.empty();
			this.settingsContainer = containerEl;

			containerEl.createEl('h2', { text: 'HTML/CSS Editor Settings' });
			
			// Version info
			const versionInfo = containerEl.createEl('div', { 
				cls: 'setting-item-description',
				text: 'Version: 2.3.6-updated (includes mobile tab fix and responsive improvements)'
			});
			versionInfo.addClass('html-css-editor-settings-version');

			// Add settings info section
			this.createSettingsInfo();

			// Preview Settings
			containerEl.createEl('h3', { text: 'Preview Settings' });

			new Setting(containerEl)
				.setName('Auto-refresh preview')
				.setDesc('Automatically update preview when code changes')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.autoRefresh)
					.onChange(async (value) => {
						await this.updateSetting('autoRefresh', value);
					}));

			new Setting(containerEl)
				.setName('Refresh delay')
				.setDesc('Delay in milliseconds before updating preview (when auto-refresh is enabled)')
				.addSlider(slider => slider
					.setLimits(100, 2000, 100)
					.setValue(this.plugin.settings.refreshDelay)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.updateSetting('refreshDelay', value);
					}));

			new Setting(containerEl)
				.setName('Preview position')
				.setDesc('Choose how to arrange editor and preview panes')
				.addDropdown(dropdown => dropdown
					.addOption('vertical', 'Side by side (vertical split)')
					.addOption('horizontal', 'Top and bottom (horizontal split)')
					.setValue(this.plugin.settings.previewPosition)
					.onChange(async (value: 'vertical' | 'horizontal') => {
						await this.updateSetting('previewPosition', value);
					}));

			// Editor Settings
			containerEl.createEl('h3', { text: 'Editor Settings' });

			new Setting(containerEl)
				.setName('Font size')
				.setDesc('Editor font size in pixels')
				.addSlider(slider => slider
					.setLimits(10, 24, 1)
					.setValue(this.plugin.settings.fontSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.updateSetting('fontSize', value);
					}));

			new Setting(containerEl)
				.setName('Line height')
				.setDesc('Editor line height ratio')
				.addSlider(slider => slider
					.setLimits(1.0, 2.0, 0.1)
					.setValue(this.plugin.settings.lineHeight)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.updateSetting('lineHeight', value);
					}));

			new Setting(containerEl)
				.setName('Show line numbers')
				.setDesc('Display line numbers in the editor')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showLineNumbers)
					.onChange(async (value) => {
						await this.updateSetting('showLineNumbers', value);
					}));

			new Setting(containerEl)
				.setName('Enable autocomplete')
				.setDesc('Show autocomplete suggestions for HTML and CSS')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableAutocomplete)
					.onChange(async (value) => {
						await this.updateSetting('enableAutocomplete', value);
					}));

			new Setting(containerEl)
				.setName('Enable code folding')
				.setDesc('Allow collapsing code sections')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableCodeFolding)
					.onChange(async (value) => {
						await this.updateSetting('enableCodeFolding', value);
					}));

			// Theme Settings
			containerEl.createEl('h3', { text: 'Theme Settings' });

			new Setting(containerEl)
				.setName('Editor theme')
				.setDesc('Choose editor color scheme')
				.addDropdown(dropdown => dropdown
					.addOption('inherit', 'Inherit from Obsidian')
					.addOption('light', 'Light theme')
					.addOption('dark', 'Dark theme')
					.setValue(this.plugin.settings.theme)
					.onChange(async (value: 'inherit' | 'light' | 'dark') => {
						await this.updateSetting('theme', value);
					}));

			const previewBgSetting = new Setting(containerEl)
				.setName('Preview background')
				.setDesc('Background color for the preview pane (hex color or CSS color name)')
				.addText(text => text
					.setPlaceholder('#ffffff')
					.setValue(this.plugin.settings.previewBackground)
					.onChange(async (value) => {
						await this.updateSetting('previewBackground', value || '#ffffff');
					}));
			
			// Add color validation indicator
			this.addValidationIndicator(previewBgSetting, 'previewBackground');

			// Layout Settings
			containerEl.createEl('h3', { text: 'Layout Settings' });

			new Setting(containerEl)
				.setName('Editor ratio')
				.setDesc('Proportion of space allocated to editor vs preview (0.1 = mostly preview, 0.9 = mostly editor)')
				.addSlider(slider => slider
					.setLimits(0.1, 0.9, 0.1)
					.setValue(this.plugin.settings.editorRatio)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.updateSetting('editorRatio', value);
					}));

			// Add settings actions section
			this.createSettingsActions();

		} catch (error) {
			this.handleError('Failed to display settings', error);
		}
	}

	private createSettingsInfo() {
		const infoContainer = this.settingsContainer.createEl('div', { 
			cls: 'html-css-editor-settings-info' 
		});

		// Settings version info
		const versionInfo = infoContainer.createEl('div', { 
			cls: 'setting-item-info' 
		});
		versionInfo.createEl('div', { 
			cls: 'setting-item-name',
			text: 'Settings Information' 
		});
		
		const versionDesc = versionInfo.createEl('div', { 
			cls: 'setting-item-description' 
		});
		versionDesc.createEl('div', { 
			text: `Settings Version: ${this.plugin.settings.version}` 
		});
		versionDesc.createEl('div', { 
			text: `Last Updated: ${new Date(this.plugin.settings.lastUpdated).toLocaleString()}` 
		});

		// Validation status
		const errors = SettingsValidator.getValidationErrors(this.plugin.settings);
		if (errors.length > 0) {
			const errorContainer = infoContainer.createEl('div', { 
				cls: 'setting-item-info mod-warning' 
			});
			errorContainer.createEl('div', { 
				cls: 'setting-item-name',
				text: 'Validation Issues' 
			});
			const errorList = errorContainer.createEl('ul', { 
				cls: 'setting-item-description' 
			});
			errors.forEach(error => {
				errorList.createEl('li', { text: error });
			});
		}
	}

	private createSettingsActions() {
		const actionsContainer = this.settingsContainer.createEl('div', { 
			cls: 'html-css-editor-settings-actions' 
		});

		actionsContainer.createEl('h3', { text: 'Settings Actions' });

		// Reset to defaults button
		new Setting(actionsContainer)
			.setName('Reset to defaults')
			.setDesc('Reset all settings to their default values')
			.addButton(button => button
				.setButtonText('Reset Settings')
				.setWarning()
				.onClick(async () => {
					await this.resetToDefaults();
				}));

		// Export settings button
		new Setting(actionsContainer)
			.setName('Export settings')
			.setDesc('Copy current settings to clipboard as JSON')
			.addButton(button => button
				.setButtonText('Export Settings')
				.onClick(async () => {
					await this.exportSettings();
				}));

		// Import settings button
		new Setting(actionsContainer)
			.setName('Import settings')
			.setDesc('Import settings from JSON (paste in text area below)')
			.addTextArea(textArea => textArea
				.setPlaceholder('Paste settings JSON here...')
				.onChange((value) => {
					// Store the value for import
					this.pendingImportData = value;
				}))
			.addButton(button => button
				.setButtonText('Import Settings')
				.onClick(async () => {
					await this.importSettings();
				}));

		// Validate settings button
		new Setting(actionsContainer)
			.setName('Validate settings')
			.setDesc('Check current settings for any issues')
			.addButton(button => button
				.setButtonText('Validate')
				.onClick(() => {
					this.validateCurrentSettings();
				}));
	}

	private async updateSetting(key: keyof HTMLCSSEditorSettings, value: any) {
		try {
			// Create a test settings object to validate the change
			const testSettings = { ...this.plugin.settings, [key]: value };
			const errors = SettingsValidator.getValidationErrors(testSettings);
			
			// Clear previous validation error for this field
			this.validationErrors.delete(key);
			
			if (errors.length > 0) {
				// Check if any errors are related to this specific field
				const fieldErrors = errors.filter(error => 
					error.toLowerCase().includes(key.toLowerCase())
				);
				
				if (fieldErrors.length > 0) {
					this.validationErrors.set(key, fieldErrors[0]);
					this.showValidationError(key, fieldErrors[0]);
					return; // Don't save invalid settings
				}
			}
			
			// Update the setting
			if (key in this.plugin.settings) {
				(this.plugin.settings as Record<string, any>)[key] = value;
			}
			
			// Save and notify
			await this.plugin.saveSettings();
			this.notifySettingsChange();
			
			// Clear any validation error display
			this.clearValidationError(key);
			
			// Show success feedback for important changes
			if (['theme', 'previewPosition', 'fontSize'].includes(key)) {
				new Notice(`${key} updated successfully`);
			}
			
		} catch (error) {
			this.handleError(`Failed to update ${key}`, error);
		}
	}

	private addValidationIndicator(setting: Setting, fieldKey: string) {
		// Add a validation indicator element to the setting
		const indicator = setting.settingEl.createEl('div', { 
			cls: 'html-css-editor-validation-indicator' 
		});
		
		// Store reference for later updates
		setting.settingEl.setAttribute('data-field', fieldKey);
	}

	private showValidationError(fieldKey: string, error: string) {
		const settingEl = this.settingsContainer.querySelector(`[data-field="${fieldKey}"]`);
		if (settingEl) {
			settingEl.addClass('has-validation-error');
			
			let indicator = settingEl.querySelector('.html-css-editor-validation-indicator');
			if (indicator) {
				indicator.textContent = `⚠️ ${error}`;
				indicator.addClass('error');
			}
		}
	}

	private clearValidationError(fieldKey: string) {
		const settingEl = this.settingsContainer.querySelector(`[data-field="${fieldKey}"]`);
		if (settingEl) {
			settingEl.removeClass('has-validation-error');
			
			let indicator = settingEl.querySelector('.html-css-editor-validation-indicator');
			if (indicator) {
				indicator.textContent = '';
				indicator.removeClass('error');
			}
		}
	}

	private async resetToDefaults() {
		try {
			// Confirm with user
			const confirmed = confirm('Are you sure you want to reset all settings to their default values? This cannot be undone.');
			if (!confirmed) return;

			// Reset to defaults
			this.plugin.settings = { ...DEFAULT_SETTINGS };
			await this.plugin.saveSettings();
			
			// Refresh the settings display
			this.display();
			
			// Notify views of the change
			this.notifySettingsChange();
			
			new Notice('Settings reset to defaults');
			
		} catch (error) {
			this.handleError('Failed to reset settings', error);
		}
	}

	private async exportSettings() {
		try {
			const settingsJson = JSON.stringify(this.plugin.settings, null, 2);
			
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(settingsJson);
				new Notice('Settings exported to clipboard');
			} else {
				// Fallback: show in a modal or text area
				const modal = document.createElement('div');
				modal.className = 'html-css-editor-settings-modal';
				
				const textarea = document.createElement('textarea');
				textarea.value = settingsJson;
				textarea.className = 'html-css-editor-settings-textarea';
				textarea.readOnly = true;
				textarea.select();
				
				modal.appendChild(textarea);
				
				const closeBtn = document.createElement('button');
				closeBtn.textContent = 'Close';
				closeBtn.onclick = () => document.body.removeChild(modal);
				modal.appendChild(closeBtn);
				
				document.body.appendChild(modal);
				new Notice('Settings displayed in modal (copy manually)');
			}
			
		} catch (error) {
			this.handleError('Failed to export settings', error);
		}
	}

	private pendingImportData: string = '';

	private async importSettings() {
		try {
			if (!this.pendingImportData.trim()) {
				new Notice('Please paste settings JSON in the text area first');
				return;
			}

			// Parse the JSON
			let importedSettings: any;
			try {
				importedSettings = JSON.parse(this.pendingImportData);
			} catch (parseError) {
				new Notice('Invalid JSON format');
				return;
			}

			// Validate the imported settings
			const errors = SettingsValidator.getValidationErrors(importedSettings);
			if (errors.length > 0) {
				const errorMsg = `Settings validation failed:\n${errors.join('\n')}`;
				new Notice(errorMsg);
				console.warn('Import validation errors:', errors);
				return;
			}

			// Confirm with user
			const confirmed = confirm('Are you sure you want to import these settings? Current settings will be overwritten.');
			if (!confirmed) return;

			// Apply the settings
			this.plugin.settings = SettingsValidator.validateSettings(importedSettings);
			await this.plugin.saveSettings();

			// Refresh the display
			this.display();
			
			// Notify views
			this.notifySettingsChange();
			
			// Clear the import data
			this.pendingImportData = '';
			
			new Notice('Settings imported successfully');

		} catch (error) {
			this.handleError('Failed to import settings', error);
		}
	}

	private validateCurrentSettings() {
		const errors = SettingsValidator.getValidationErrors(this.plugin.settings);
		
		if (errors.length === 0) {
			new Notice('All settings are valid ✓');
		} else {
			const errorMsg = `Found ${errors.length} validation issue(s):\n${errors.join('\n')}`;
			new Notice(errorMsg);
			console.warn('Settings validation errors:', errors);
		}
	}

	private handleError(context: string, error: any) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`HTML/CSS Editor Settings Error [${context}]:`, error);
		
		// Show user-friendly notice
		if (this.app && this.app.workspace) {
			new Notice(`HTML/CSS Editor Settings: ${errorMessage}`);
		}
	}

	private notifySettingsChange() {
		// Notify open editor instances about settings changes
		// This will be used by the editor view to update its configuration
		this.plugin.onSettingsChanged();
	}
}