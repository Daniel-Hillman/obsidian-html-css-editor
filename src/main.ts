import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { HTMLCSSEditorView, VIEW_TYPE_HTML_CSS_EDITOR } from './HTMLCSSEditorView';
import { HTMLCSSEditorSettings, HTMLCSSEditorSettingTab, DEFAULT_SETTINGS, SettingsValidator } from './settings';

// Import styles
import './styles.css';

export default class HTMLCSSEditorPlugin extends Plugin {
	settings: HTMLCSSEditorSettings;

	async onload() {
		try {
			// Load settings
			await this.loadSettings();

			// Register the custom view type
			this.registerView(
				VIEW_TYPE_HTML_CSS_EDITOR,
				(leaf) => new HTMLCSSEditorView(leaf, this)
			);

			// Add ribbon icon
			this.addRibbonIcon('code', 'Open HTML/CSS Editor', () => {
				this.activateView();
			});

			// Add command
			this.addCommand({
				id: 'open-html-css-editor',
				name: 'Open Editor',
				callback: () => {
					this.activateView();
				}
			});

			// Add version check command
			this.addCommand({
				id: 'html-css-editor-version',
				name: 'Show Version Info',
				callback: () => {
					new Notice(`HTML/CSS Editor v2.3.6-updated\nIncludes: Mobile tab fix, responsive improvements, custom size fixes`, 5000);
				}
			});

			// Add development command for testing settings (only in development)
			if (process.env.NODE_ENV === 'development') {
				this.addCommand({
					id: 'test-html-css-editor-settings',
					name: 'Test Settings',
					callback: () => {
						this.runSettingsTests();
					}
				});
			}

			// Add settings tab
			this.addSettingTab(new HTMLCSSEditorSettingTab(this.app, this));

			// Plugin loaded successfully
		} catch (error) {
			this.handleError('Failed to load plugin', error);
		}
	}

	onunload() {
		try {
			// Plugin cleanup - views will be handled automatically by Obsidian
		} catch (error) {
			this.handleError('Error during plugin unload', error);
		}
	}

	async loadSettings() {
		try {
			const loadedData = await this.loadData();
			// Use migration system to handle version changes and validation
			this.settings = SettingsValidator.migrateSettings(loadedData);
			
			// Save migrated settings if they were updated
			if (!loadedData || loadedData.version !== this.settings.version) {
				await this.saveSettings();
				// Settings migrated and saved
			}
		} catch (error) {
			this.handleError('Failed to load settings', error);
			this.settings = { ...DEFAULT_SETTINGS };
			// Try to save default settings
			try {
				await this.saveSettings();
			} catch (saveError) {
				console.error('Failed to save default settings:', saveError);
			}
		}
	}

	async saveSettings() {
		try {
			// Validate settings before saving
			this.settings = SettingsValidator.validateSettings(this.settings);
			
			// Update timestamp
			this.settings.lastUpdated = new Date().toISOString();
			
			await this.saveData(this.settings);
		} catch (error) {
			this.handleError('Failed to save settings', error);
		}
	}

	onSettingsChanged() {
		// Notify all open editor views about settings changes
		try {
			const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_HTML_CSS_EDITOR);
			leaves.forEach(leaf => {
				const view = leaf.view as HTMLCSSEditorView;
				if (view && typeof view.onSettingsChanged === 'function') {
					view.onSettingsChanged();
				}
			});
		} catch (error) {
			this.handleError('Failed to notify views of settings change', error);
		}
	}

	// Method to test settings persistence (for development/debugging)
	async testSettingsPersistence(): Promise<boolean> {
		try {
			// Save current settings
			const originalSettings = { ...this.settings };
			
			// Modify a setting
			const testValue = Math.random();
			this.settings.editorRatio = testValue;
			await this.saveSettings();
			
			// Reload settings
			await this.loadSettings();
			
			// Check if the change persisted
			const persisted = Math.abs(this.settings.editorRatio - testValue) < 0.001;
			
			// Restore original settings
			this.settings = originalSettings;
			await this.saveSettings();
			
			return persisted;
		} catch (error) {
			this.handleError('Settings persistence test failed', error);
			return false;
		}
	}

	// Run comprehensive settings tests (for development)
	async runSettingsTests(): Promise<void> {
		try {
			// Running settings tests...
			
			// Import test classes dynamically to avoid including in production
			const { SettingsTestSuite } = await import('./settings-test');
			const { SettingsIntegrationTest } = await import('./settings-integration-test');
			
			// Run unit tests
			const unitTestsPassed = SettingsTestSuite.runAllTests();
			
			// Run integration tests
			const integrationTest = new SettingsIntegrationTest(this);
			const integrationTestsPassed = await integrationTest.runAllTests();
			
			// Run simple persistence test
			const persistenceTestPassed = await this.testSettingsPersistence();
			
			const allTestsPassed = unitTestsPassed && integrationTestsPassed && persistenceTestPassed;
			
			if (allTestsPassed) {
				new Notice('All settings tests passed ✓');
				// All settings tests passed
			} else {
				new Notice('Some settings tests failed ✗');
				console.error('HTML/CSS Editor: Some settings tests FAILED');
			}
			
		} catch (error) {
			this.handleError('Failed to run settings tests', error);
		}
	}

	async activateView() {
		try {
			const { workspace } = this.app;
			
			// Opening editor view

			let leaf: WorkspaceLeaf | null = null;
			const leaves = workspace.getLeavesOfType(VIEW_TYPE_HTML_CSS_EDITOR);

			if (leaves.length > 0) {
				// A view is already open, focus it
				leaf = leaves[0];
			} else {
				// MOBILE FIX: Different approach for mobile vs desktop
				// On mobile, we need to be more aggressive about main workspace
				
				// Close any sidebar panels first to force main area focus
				workspace.leftSplit.collapse();
				workspace.rightSplit.collapse();
				
				// Get the most recent leaf in main area
				leaf = workspace.getMostRecentLeaf();
				
				// If no leaf or it's in sidebar, create new one
				if (!leaf || this.isLeafInSidebar(leaf)) {
					// Force creation of new tab in main workspace
					leaf = workspace.getLeaf('tab');
				}
				
				if (leaf) {
					await leaf.setViewState({ 
						type: VIEW_TYPE_HTML_CSS_EDITOR, 
						active: true 
					});
				} else {
					throw new Error('Could not create leaf for HTML/CSS Editor');
				}
			}

			// Focus the leaf and ensure it's visible
			workspace.revealLeaf(leaf);
			
			// Ensure the leaf is active
			if (leaf) {
				workspace.setActiveLeaf(leaf, { focus: true });
			}
		} catch (error) {
			this.handleError('Failed to activate HTML/CSS Editor view', error);
		}
	}

	private isLeafInSidebar(leaf: WorkspaceLeaf): boolean {
		// Check if leaf is in left or right sidebar
		const parent = leaf.parent;
		return parent === this.app.workspace.leftSplit || parent === this.app.workspace.rightSplit;
	}

	private handleError(context: string, error: any) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`HTML/CSS Editor Plugin Error [${context}]:`, error);
		
		// Show user-friendly notice
		if (this.app && this.app.workspace) {
			// @ts-ignore - Notice is available in Obsidian API
			new Notice(`HTML/CSS Editor: ${errorMessage}`);
		}
	}
}