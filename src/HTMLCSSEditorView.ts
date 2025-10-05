import { ItemView, WorkspaceLeaf, Notice, Menu, Modal, FuzzySuggestModal, TFolder, TFile, App, Setting } from 'obsidian';
import HTMLCSSEditorPlugin from './main';
import { ExportHandler } from './export';
import { EditorView, keymap, lineNumbers, highlightActiveLine, tooltips } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { autocompletion, completionKeymap, CompletionContext, CompletionResult, startCompletion, acceptCompletion, closeCompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches } from '@codemirror/search';
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, foldGutter, codeFolding, foldAll, unfoldAll } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import * as sass from 'sass';
import { colorPickerPlugin } from './colorPicker';
import { animationInspectorPlugin, AnimationPerformanceMonitor } from './animationSystem';
import { AnimationPresetsModal, AnimationBuilderModal, AnimationInspectorModal } from './animationBuilder';

export const VIEW_TYPE_HTML_CSS_EDITOR = 'html-css-editor-view';

interface ViewState {
	htmlContent: string;
	cssContent: string;
	cursorPosition: number;
	scrollPosition: number;
	isPreviewVisible: boolean;
	layout: 'vertical'; // Only side-by-side layout supported
	editorRatio: number;
	zoomLevel: number;
	currentDevice: string;
	isPipMode: boolean;
	pipPosition: { x: number; y: number };
	pipSize: { width: number; height: number };
	isSassMode: boolean;
}

export class HTMLCSSEditorView extends ItemView {
	private plugin: HTMLCSSEditorPlugin;
	private exportHandler: ExportHandler;
	private mainContainer: HTMLElement;
	private toolbar: HTMLElement;
	private contentContainer: HTMLElement;
	private editorPane: HTMLElement;
	private previewPane: HTMLElement;
	private htmlEditor: EditorView;
	private cssEditor: EditorView;
	private htmlEditorContainer: HTMLElement;
	private cssEditorContainer: HTMLElement;
	private previewFrame: HTMLIFrameElement;
	private resizeHandle: HTMLElement;
	private refreshButton: HTMLButtonElement;
	private saveButton: HTMLButtonElement;
	private copyButton: HTMLButtonElement;
	private isResizing: boolean = false;
	private viewState: ViewState;
	private updateTimeout: NodeJS.Timeout | null = null;
	private compilationTimeout: NodeJS.Timeout | null = null;
	private lastCompilationTime: number = 0;
	private compilationStatusEl: HTMLElement | null = null;

	// Enhanced preview features
	private previewToolbar: HTMLElement;
	private previewFrameContainer: HTMLElement;
	private previewFrameWrapper: HTMLElement;
	private zoomLevel: number = 100;
	private currentDevice: string = 'desktop';
	private pipContainer: HTMLElement | null = null;
	private pipFrame: HTMLIFrameElement | null = null;
	private fullscreenOverlay: HTMLElement | null = null;
	private isDragging: boolean = false;
	private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
	private animationPerformanceMonitor: AnimationPerformanceMonitor;
	private isPanning: boolean = false;
	private panStart: { x: number; y: number } = { x: 0, y: 0 };
	private panOffset: { x: number; y: number } = { x: 0, y: 0 };

	constructor(leaf: WorkspaceLeaf, plugin: HTMLCSSEditorPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.exportHandler = new ExportHandler(this.app, plugin);
		this.animationPerformanceMonitor = new AnimationPerformanceMonitor();
		this.initializeViewState();
	}

	getViewType() {
		return VIEW_TYPE_HTML_CSS_EDITOR;
	}

	getDisplayText() {
		return 'HTML/CSS Editor';
	}

	getIcon() {
		return 'code';
	}

	async onOpen() {
		try {
			const container = this.containerEl.children[1];
			container.empty();

			this.setupViewContainer(container);
			this.setupToolbar();
			this.setupContentLayout();
			this.setupEditorPane();
			this.setupPreviewPane();
			this.setupResizeHandle();
			this.enhanceLayoutTransitions();
			this.applySettings();
			this.restoreViewState();
			this.updateExportButtonStates();

			// HTML/CSS Editor view opened
		} catch (error) {
			this.handleError('Failed to open HTML/CSS Editor view', error);
		}
	}

	async onClose() {
		try {
			this.saveViewState();
			this.cleanup();
			// HTML/CSS Editor view closed
		} catch (error) {
			this.handleError('Error closing HTML/CSS Editor view', error);
		}
	}

	onSettingsChanged() {
		try {
			// Applying settings changes...

			// Store previous settings for comparison
			const previousLayout = this.viewState.layout;
			const previousRatio = this.viewState.editorRatio;

			// Apply new settings
			this.applySettings();
			this.updateLayout();
			this.applyThemeClasses();

			// Provide user feedback for significant changes
			if (previousLayout !== this.viewState.layout) {
				new Notice(`Layout changed to ${this.viewState.layout}`);
			}

			if (Math.abs(previousRatio - this.viewState.editorRatio) > 0.1) {
				new Notice('Editor ratio updated');
			}

			// Settings applied successfully
		} catch (error) {
			this.handleError('Error applying settings changes', error);
		}
	}

	private initializeViewState() {
		this.viewState = {
			htmlContent: '',
			cssContent: '',
			cursorPosition: 0,
			scrollPosition: 0,
			isPreviewVisible: true,
			layout: 'vertical', // Force vertical layout (code left, preview right)
			editorRatio: 0.6, // Force 60/40 split favoring code
			zoomLevel: 100,
			currentDevice: 'desktop',
			isPipMode: false,
			pipPosition: { x: 100, y: 100 },
			pipSize: { width: 400, height: 300 },
			isSassMode: false
		};
	}

	private setupViewContainer(container: Element) {
		this.mainContainer = container.createEl('div', {
			cls: 'html-css-editor-main-container'
		});

		// Add theme-specific classes for enhanced styling
		this.applyThemeClasses();

		// Add keyboard navigation support
		this.setupKeyboardNavigation();
	}

	private setupToolbar() {
		this.toolbar = this.mainContainer.createEl('div', {
			cls: 'html-css-editor-toolbar'
		});

		// Toolbar title
		// Title container with version
		const titleContainer = this.toolbar.createEl('div', {
			cls: 'html-css-editor-toolbar-title-container'
		});
		titleContainer.addClass('html-css-editor-toolbar-title-container');
		
		titleContainer.createEl('div', {
			cls: 'html-css-editor-toolbar-title',
			text: 'HTML/CSS Editor',
			attr: {
				role: 'heading',
				'aria-level': '2'
			}
		});
		
		// Version indicator removed for cleaner interface

		const toolbarActions = this.toolbar.createEl('div', {
			cls: 'html-css-editor-toolbar-actions'
		});

		// Clear button section
		const clearSection = toolbarActions.createEl('div', {
			cls: 'html-css-editor-toolbar-section clear-section'
		});

		const clearButton = clearSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn clear-btn',
			text: 'Clear',
			attr: {
				'aria-label': 'Clear all content',
				'title': 'Clear both HTML and CSS editors'
			}
		});

		clearButton.addEventListener('click', () => {
			this.clearAllContent();
		});

		// Sass Templates button
		const templatesBtn = clearSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn templates-btn',
			text: 'Templates',
			attr: {
				'aria-label': 'Insert Sass template',
				'title': 'Insert common Sass patterns'
			}
		});

		templatesBtn.addEventListener('click', (event) => {
			this.showTemplatesMenu(event);
		});

		// Animation Presets button
		const animationPresetsBtn = clearSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn animation-presets-btn',
			text: 'Animations',
			attr: {
				'aria-label': 'Insert animation presets',
				'title': 'Browse and insert animation presets'
			}
		});

		animationPresetsBtn.addEventListener('click', () => {
			this.showAnimationPresets();
		});

		// Animation Builder button
		const animationBuilderBtn = clearSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn animation-builder-btn',
			text: 'Builder',
			attr: {
				'aria-label': 'Open animation builder',
				'title': 'Create custom animations visually'
			}
		});

		animationBuilderBtn.addEventListener('click', () => {
			this.showAnimationBuilder();
		});

		// Save Project button
		const saveProjectBtn = clearSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn save-project-btn',
			text: 'Save Project',
			attr: {
				'aria-label': 'Save current work as a project',
				'title': 'Save HTML/CSS/Sass as a project file'
			}
		});

		saveProjectBtn.addEventListener('click', () => {
			this.saveProject();
		});

		// Load Project button
		const loadProjectBtn = clearSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn load-project-btn',
			text: 'Load Project',
			attr: {
				'aria-label': 'Load a saved project',
				'title': 'Open a saved project file'
			}
		});

		loadProjectBtn.addEventListener('click', () => {
			this.loadProject();
		});

		// Export buttons section
		const exportSection = toolbarActions.createEl('div', {
			cls: 'html-css-editor-toolbar-section export-section'
		});

		// Save as HTML File button
		this.saveButton = exportSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn export-btn save-btn',
			text: 'Save HTML+CSS File',
			attr: {
				'aria-label': 'Save combined HTML and CSS as a file in your vault root',
				'title': 'Save HTML+CSS File to vault root (Ctrl+S)\nFile will open automatically in new tab'
			}
		}) as HTMLButtonElement;
		this.saveButton.addEventListener('click', () => this.handleSaveAsHTML());

		// Export Sass button (only visible in Sass mode)
		const exportSassBtn = exportSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn export-btn export-sass-btn',
			text: 'Export Sass',
			attr: {
				'aria-label': 'Export Sass file',
				'title': 'Export .scss file to vault'
			}
		});
		exportSassBtn.addEventListener('click', () => this.handleExportSass());

		// Copy HTML+CSS to Clipboard button
		this.copyButton = exportSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn export-btn copy-btn',
			text: 'Copy HTML+CSS',
			attr: {
				'aria-label': 'Copy combined HTML and CSS to clipboard',
				'title': 'Copy HTML+CSS to Clipboard (Ctrl+Shift+C)'
			}
		}) as HTMLButtonElement;
		this.copyButton.addEventListener('click', () => this.handleCopyToClipboard());

		// View controls section
		const viewSection = toolbarActions.createEl('div', {
			cls: 'html-css-editor-toolbar-section view-section'
		});

		// Toggle preview button
		const togglePreviewBtn = viewSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn',
			text: 'Toggle Preview',
			attr: {
				'aria-label': 'Show or hide the preview pane',
				'title': 'Toggle Preview (Ctrl+P)'
			}
		});
		togglePreviewBtn.addEventListener('click', () => this.togglePreview());

		// Manual refresh button (only show when auto-refresh is disabled)
		this.refreshButton = viewSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn html-css-editor-refresh-btn',
			text: 'Refresh Preview',
			attr: {
				'aria-label': 'Manually refresh the preview pane',
				'title': 'Refresh Preview (F5)'
			}
		}) as HTMLButtonElement;
		this.refreshButton.addEventListener('click', () => this.manualRefreshPreview());

		// Update refresh button visibility based on settings
		this.updateRefreshButtonVisibility();

		// Compilation status indicator (only visible in Sass mode)
		this.compilationStatusEl = viewSection.createEl('div', {
			cls: 'html-css-editor-compilation-status',
			text: 'Ready'
		});
		this.compilationStatusEl.addClass('html-css-editor-hidden'); // Hidden by default

		// Show Compiled CSS button (only visible in Sass mode)
		const showCompiledBtn = viewSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn show-compiled-btn',
			text: 'Show Compiled CSS',
			attr: {
				'aria-label': 'View compiled CSS output',
				'title': 'Toggle compiled CSS view'
			}
		});
		showCompiledBtn.addEventListener('click', () => this.toggleCompiledView());
		showCompiledBtn.addClass('html-css-editor-hidden'); // Hidden by default

		// Animation Inspector button
		const animationInspectorBtn = viewSection.createEl('button', {
			cls: 'html-css-editor-toolbar-btn animation-inspector-btn',
			text: 'Inspector',
			attr: {
				'aria-label': 'Open animation inspector',
				'title': 'View animation performance metrics'
			}
		});
		animationInspectorBtn.addEventListener('click', () => this.showAnimationInspector());

		// Layout toggle removed - side-by-side is the only layout
	}

	private setupContentLayout() {
		this.contentContainer = this.mainContainer.createEl('div', {
			cls: 'html-css-editor-content-container'
		});

		this.updateLayoutClasses();
	}

	private setupEditorPane() {
		this.editorPane = this.contentContainer.createEl('div', {
			cls: 'html-css-editor-pane editor-pane'
		});

		// HTML Editor Section
		const htmlSection = this.editorPane.createEl('div', {
			cls: 'html-css-editor-section'
		});

		htmlSection.createEl('div', {
			cls: 'html-css-editor-label',
			text: 'HTML',
			attr: {
				'aria-label': 'HTML editor section - click to collapse/expand'
			}
		});

		this.htmlEditorContainer = htmlSection.createEl('div', {
			cls: 'html-css-editor-codemirror-container html-editor',
			attr: {
				'role': 'textbox',
				'aria-label': 'HTML code editor',
				'aria-multiline': 'true'
			}
		});

		// CSS Editor Section
		const cssSection = this.editorPane.createEl('div', {
			cls: 'html-css-editor-section'
		});

		const cssLabel = cssSection.createEl('div', {
			cls: 'html-css-editor-label',
			attr: {
				'aria-label': 'CSS editor section - click to collapse/expand'
			}
		});

		// CSS/Sass toggle
		const cssLabelContent = cssLabel.createEl('div', {
			cls: 'html-css-editor-label-content'
		});

		cssLabelContent.createEl('span', {
			text: 'CSS',
			cls: 'html-css-editor-label-text'
		});

		const sassToggle = cssLabelContent.createEl('div', {
			cls: 'html-css-editor-sass-toggle',
			attr: {
				'aria-label': 'Toggle between CSS and Sass',
				'title': 'Click to switch between CSS and Sass'
			}
		});

		// Create the toggle switch
		const toggleSwitch = sassToggle.createEl('div', {
			cls: 'sass-toggle-switch'
		});

		const cssOption = toggleSwitch.createEl('span', {
			cls: 'sass-toggle-option active',
			text: 'CSS'
		});

		const sassOption = toggleSwitch.createEl('span', {
			cls: 'sass-toggle-option',
			text: 'Sass'
		});

		sassToggle.addEventListener('click', (event) => {
			event.stopPropagation(); // Prevent triggering the label's collapse/expand
			this.toggleSassMode();
		});

		this.cssEditorContainer = cssSection.createEl('div', {
			cls: 'html-css-editor-codemirror-container css-editor',
			attr: {
				'role': 'textbox',
				'aria-label': 'CSS code editor',
				'aria-multiline': 'true'
			}
		});

		// Initialize CodeMirror editors
		this.initializeCodeMirrorEditors();

		// Set up advanced features
		this.setupFocusManagement();
		this.setupCollapsibleSections();
	}

	private setupPreviewPane() {
		this.previewPane = this.contentContainer.createEl('div', {
			cls: 'html-css-editor-pane preview-pane html-css-editor-preview-enhanced'
		});

		// Enhanced preview toolbar with controls
		this.previewToolbar = this.previewPane.createEl('div', {
			cls: 'html-css-editor-preview-toolbar'
		});

		// Preview title
		const previewTitle = this.previewToolbar.createEl('div', {
			cls: 'html-css-editor-preview-title',
			text: 'Live Preview'
		});

		// Preview controls container
		const previewControls = this.previewToolbar.createEl('div', {
			cls: 'html-css-editor-preview-controls'
		});

		// Zoom controls
		this.setupZoomControls(previewControls);

		// Device preset controls
		this.setupDeviceControls(previewControls);

		// Picture-in-picture button
		const pipBtn = previewControls.createEl('button', {
			cls: 'html-css-editor-preview-btn',
			text: 'PiP',
			attr: {
				'aria-label': 'Open picture-in-picture preview',
				'title': 'Picture-in-Picture Mode'
			}
		});
		pipBtn.addEventListener('click', () => this.togglePictureInPicture());

		// Fullscreen button
		const fullscreenBtn = previewControls.createEl('button', {
			cls: 'html-css-editor-preview-btn',
			text: 'Full',
			attr: {
				'aria-label': 'Open fullscreen preview',
				'title': 'Fullscreen Mode'
			}
		});
		fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

		// Enhanced preview container
		this.previewFrameContainer = this.previewPane.createEl('div', {
			cls: 'html-css-editor-preview-frame-container',
			attr: {
				'role': 'region',
				'aria-label': 'HTML/CSS preview area'
			}
		});

		// Preview frame wrapper for zoom and device simulation
		this.previewFrameWrapper = this.previewFrameContainer.createEl('div', {
			cls: 'html-css-editor-preview-frame-wrapper'
		});

		// Enhanced preview frame
		this.previewFrame = this.previewFrameWrapper.createEl('iframe', {
			cls: 'html-css-editor-preview-frame-enhanced',
			attr: {
				sandbox: 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals',
				title: 'HTML/CSS Preview - Live preview of your code',
				loading: 'lazy',
				'aria-label': 'Live preview of HTML and CSS code'
			}
		});

		// Initialize preview with empty content
		this.updatePreview();
		this.updatePreviewZoom();
		this.updateDevicePreset();
		
		// Setup pan/drag functionality
		this.setupPreviewPan();
	}

	private initializeCodeMirrorEditors() {
		// HTML Editor
		const htmlExtensions = [
			...this.createBaseExtensions('html'),
			html(),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					this.onContentChange();
				}
				if (update.geometryChanged) {
					this.onEditorScroll();
				}
			})
		];

		this.htmlEditor = new EditorView({
			state: EditorState.create({
				doc: this.viewState.htmlContent,
				extensions: htmlExtensions
			}),
			parent: this.htmlEditorContainer
		});

		// CSS Editor
		const cssExtensions = [
			...this.createBaseExtensions('css'),
			css(),
			colorPickerPlugin,
			animationInspectorPlugin,
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					this.onContentChange();
				}
			})
		];

		this.cssEditor = new EditorView({
			state: EditorState.create({
				doc: this.viewState.cssContent,
				extensions: cssExtensions
			}),
			parent: this.cssEditorContainer
		});
	}

	private createBaseExtensions(editorType: 'html' | 'css' = 'html'): Extension[] {
		const isDarkTheme = this.isDarkTheme();

		const extensions: Extension[] = [
			// Performance optimization: Limit viewport rendering for large documents
			EditorView.theme({}, { dark: isDarkTheme }),
			
			// Basic editor features
			highlightActiveLine(),
			highlightSelectionMatches(),
			bracketMatching(),
			indentOnInput(),

			// Syntax highlighting with performance optimization
			syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

			// History with performance limits for large files
			history({
				minDepth: 100,
				newGroupDelay: 500
			}),

			// Enhanced key bindings with advanced shortcuts
			keymap.of([
				...defaultKeymap,
				...historyKeymap,
				...completionKeymap,
				indentWithTab,
				// Custom shortcuts
				{
					key: 'Ctrl-S',
					run: () => {
						this.handleSaveAsHTML();
						return true;
					}
				},
				{
					key: 'F5',
					run: () => {
						this.manualRefreshPreview();
						return true;
					}
				}
			]),

			// Enhanced tooltips for better UX
			tooltips(),

			// Enhanced editor styling for smooth interactions
			EditorView.theme({
				'&': {
					fontSize: `${this.plugin.settings.fontSize}px`,
					lineHeight: `${this.plugin.settings.lineHeight}`
				},
				'.cm-content': {
					padding: '12px',
					minHeight: '200px',
					caretColor: 'var(--text-normal)'
				},
				'.cm-focused': {
					outline: 'none'
				},
				'.cm-editor': {
					borderRadius: '4px',
					border: '1px solid var(--background-modifier-border)',
					backgroundColor: 'var(--background-primary)',
					transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
				},
				'.cm-editor.cm-focused': {
					borderColor: 'var(--interactive-accent)',
					boxShadow: '0 0 0 1px var(--interactive-accent-hover)'
				},
				'.cm-scroller': {
					fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
					scrollBehavior: 'smooth'
				},
				'.cm-selectionBackground': {
					backgroundColor: 'var(--text-selection) !important'
				},
				'.cm-cursor': {
					borderLeftColor: 'var(--text-normal)',
					borderLeftWidth: '2px'
				},
				'.cm-line': {
					paddingLeft: '2px',
					paddingRight: '2px'
				},
				'.cm-gutters': {
					backgroundColor: 'var(--background-secondary)',
					borderRight: '1px solid var(--background-modifier-border)'
				},
				'.cm-lineNumbers': {
					color: 'var(--text-muted)'
				},
				'.cm-foldGutter': {
					width: '16px'
				},
				'.cm-foldPlaceholder': {
					backgroundColor: 'var(--background-modifier-hover)',
					border: '1px solid var(--background-modifier-border)',
					borderRadius: '3px',
					color: 'var(--text-muted)',
					padding: '0 4px',
					margin: '0 2px'
				},
				// Enhanced completion styling
				'.cm-tooltip-autocomplete': {
					backgroundColor: 'var(--background-primary)',
					border: '1px solid var(--background-modifier-border)',
					borderRadius: '6px',
					boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
					maxHeight: '200px',
					fontSize: '13px'
				},
				'.cm-completionLabel': {
					color: 'var(--text-normal)'
				},
				'.cm-completionDetail': {
					color: 'var(--text-muted)',
					fontStyle: 'italic'
				},
				'.cm-completionInfo': {
					backgroundColor: 'var(--background-secondary)',
					border: '1px solid var(--background-modifier-border)',
					borderRadius: '4px',
					padding: '8px',
					maxWidth: '300px'
				}
			})
		];

		// Conditional features based on settings
		if (this.plugin.settings.showLineNumbers) {
			extensions.push(lineNumbers());
		}

		if (this.plugin.settings.enableCodeFolding) {
			extensions.push(codeFolding(), foldGutter());
		}

		if (this.plugin.settings.enableAutocomplete) {
			const completionFunction = editorType === 'css'
				? this.createCSSCompletions.bind(this)
				: this.createHTMLCompletions.bind(this);

			extensions.push(
				autocompletion({
					activateOnTyping: true,
					closeOnBlur: true,
					maxRenderedOptions: 20,
					optionClass: () => 'html-css-completion-option',
					override: [completionFunction],
					// Professional editor behavior
					activateOnCompletion: () => true,
					interactionDelay: 75,
					// Don't auto-select first option
					selectOnOpen: false,
					// Keep default keymap for proper autocomplete navigation
					defaultKeymap: true
				})
			);
		}

		// Add dark theme if needed
		if (isDarkTheme) {
			extensions.push(oneDark);
		}

		return extensions;
	}

	private isDarkTheme(): boolean {
		// Check Obsidian's current theme
		const theme = this.plugin.settings.theme;
		if (theme === 'dark') return true;
		if (theme === 'light') return false;

		// Auto-detect from Obsidian's theme
		return document.body.classList.contains('theme-dark');
	}

	private setupResizeHandle() {
		this.resizeHandle = this.contentContainer.createEl('div', {
			cls: 'html-css-editor-resize-handle'
		});

		// Position the resize handle properly
		this.updateResizeHandlePosition();

		this.resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));
		document.addEventListener('mousemove', (e) => this.handleResize(e));
		document.addEventListener('mouseup', () => this.stopResize());
	}

	private applyThemeClasses() {
		// Detect current Obsidian theme and apply corresponding classes
		const body = document.body;
		const themeClasses = [
			'theme-minimal', 'minimal-theme',
			'theme-atom', 'theme-nord', 'theme-dracula',
			'theme-solarized', 'theme-california-coast', 'theme-things'
		];

		// Remove any existing theme classes
		this.mainContainer.removeClass(...themeClasses);

		// Apply current theme classes
		themeClasses.forEach(themeClass => {
			if (body.classList.contains(themeClass)) {
				this.mainContainer.addClass(themeClass);
			}
		});

		// Apply dark/light theme classes
		if (body.classList.contains('theme-dark')) {
			this.mainContainer.addClass('theme-dark');
		} else {
			this.mainContainer.addClass('theme-light');
		}
	}

	private setupKeyboardNavigation() {
		// Add keyboard navigation class for enhanced focus styles
		this.mainContainer.addClass('html-css-editor-keyboard-navigation');

		// Listen for keyboard navigation
		this.mainContainer.addEventListener('keydown', (e) => {
			if (e.key === 'Tab') {
				this.mainContainer.addClass('html-css-editor-keyboard-focus');
			}
		});

		this.mainContainer.addEventListener('mousedown', () => {
			this.mainContainer.removeClass('html-css-editor-keyboard-focus');
		});
	}

	private updateLayoutClasses() {
		// Always use vertical (side-by-side) layout
		this.contentContainer.removeClass('layout-horizontal');
		this.contentContainer.addClass('layout-vertical');
	}

	private applySettings() {
		const settings = this.plugin.settings;

		// Update layout from settings
		this.viewState.layout = 'vertical'; // Always use side-by-side layout
		this.viewState.editorRatio = settings.editorRatio;
		this.updateLayoutClasses();

		// Reconfigure CodeMirror editors if they exist
		if (this.htmlEditor && this.cssEditor) {
			this.reconfigureEditors();
		}

		// Apply preview background
		if (this.previewFrame) {
			this.previewFrame.removeClass('html-css-editor-preview-bg-white', 'html-css-editor-preview-bg-dark');
			if (settings.previewBackground === '#ffffff') {
				this.previewFrame.addClass('html-css-editor-preview-bg-white');
			} else if (settings.previewBackground === '#1e1e1e') {
				this.previewFrame.addClass('html-css-editor-preview-bg-dark');
			} else {
				// For custom colors, create a dynamic CSS rule
				const customBgClass = 'html-css-editor-preview-bg-custom';
				this.previewFrame.removeClass(customBgClass);
				this.previewFrame.addClass(customBgClass);
				
				// Create or update custom CSS rule
				let styleEl = document.getElementById('html-css-editor-custom-styles');
				if (!styleEl) {
					styleEl = document.createElement('style');
					styleEl.id = 'html-css-editor-custom-styles';
					document.head.appendChild(styleEl);
				}
				styleEl.textContent = `.${customBgClass} { background-color: ${settings.previewBackground} !important; }`;
			}
		}

		// Update refresh button visibility based on auto-refresh setting
		this.updateRefreshButtonVisibility();

		// Update pane ratios
		this.updatePaneRatios();

		// If auto-refresh is enabled and we have content, update preview
		if (settings.autoRefresh && (this.viewState.htmlContent || this.viewState.cssContent)) {
			this.clearUpdateTimeout();
			this.updateTimeout = setTimeout(() => {
				this.updatePreview();
			}, settings.refreshDelay);
		}
	}

	private reconfigureEditors() {
		// Save current content
		const htmlContent = this.htmlEditor.state.doc.toString();
		const cssContent = this.cssEditor.state.doc.toString();

		// Destroy existing editors
		this.htmlEditor.destroy();
		this.cssEditor.destroy();

		// Clear containers
		this.htmlEditorContainer.empty();
		this.cssEditorContainer.empty();

		// Recreate editors with new settings
		// HTML Editor
		const htmlExtensions = [
			...this.createBaseExtensions('html'),
			html(),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					this.onContentChange();
				}
			})
		];

		this.htmlEditor = new EditorView({
			state: EditorState.create({
				doc: htmlContent,
				extensions: htmlExtensions
			}),
			parent: this.htmlEditorContainer
		});

		// CSS Editor
		const cssExtensions = [
			...this.createBaseExtensions('css'),
			css(),
			colorPickerPlugin,
			animationInspectorPlugin,
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					this.onContentChange();
				}
			})
		];

		this.cssEditor = new EditorView({
			state: EditorState.create({
				doc: cssContent,
				extensions: cssExtensions
			}),
			parent: this.cssEditorContainer
		});
	}

	private updatePaneRatios() {
		if (!this.editorPane || !this.previewPane) return;

		const ratio = Math.max(0.1, Math.min(0.9, this.viewState.editorRatio));
		const editorPercent = ratio * 100;
		const previewPercent = (1 - ratio) * 100;

		// Use requestAnimationFrame for smooth updates
		requestAnimationFrame(() => {
			// Always use side-by-side (vertical) layout
			this.editorPane.style.width = `${editorPercent}%`;
			this.previewPane.style.width = `${previewPercent}%`;
			
			// Update resize handle position
			this.updateResizeHandlePosition();
		});
	}

	private updateResizeHandlePosition() {
		if (!this.resizeHandle) return;
		
		const ratio = this.viewState.editorRatio;
		const leftPercent = ratio * 100;
		this.resizeHandle.style.left = `${leftPercent}%`;
	}

	private lastButtonUpdateTime: number = 0;
	
	private onContentChange() {
		this.viewState.htmlContent = this.htmlEditor.state.doc.toString();
		this.viewState.cssContent = this.cssEditor.state.doc.toString();

		// Throttle export button updates to once per second for better performance
		const now = Date.now();
		if (now - this.lastButtonUpdateTime > 1000) {
			this.updateExportButtonStates();
			this.lastButtonUpdateTime = now;
		}

		if (this.plugin.settings.autoRefresh) {
			// Debounce the preview update with adaptive delay for large files
			this.clearUpdateTimeout();
			
			// Increase delay for larger files to improve performance
			const contentSize = this.viewState.htmlContent.length + this.viewState.cssContent.length;
			const adaptiveDelay = contentSize > 5000 
				? Math.min(this.plugin.settings.refreshDelay * 2, 1000) 
				: this.plugin.settings.refreshDelay;
			
			this.updateTimeout = setTimeout(() => {
				this.updatePreview();
			}, adaptiveDelay);
		}
	}

	private clearUpdateTimeout() {
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
			this.updateTimeout = null;
		}
	}

	private manualRefreshPreview() {
		// Force immediate preview update regardless of auto-refresh setting
		this.clearUpdateTimeout();
		
		// Show visual feedback
		if (this.refreshButton) {
			this.refreshButton.textContent = 'Refreshing...';
			this.refreshButton.disabled = true;
		}
		
		// Update preview
		this.updatePreview();
		
		// Reset button after a short delay
		setTimeout(() => {
			if (this.refreshButton) {
				this.refreshButton.textContent = 'Refresh Preview';
				this.refreshButton.disabled = false;
			}
		}, 500);
	}

	private updateRefreshButtonVisibility() {
		if (this.refreshButton) {
			if (this.plugin.settings.autoRefresh) {
				this.refreshButton.addClass('html-css-editor-hidden');
				this.refreshButton.removeClass('html-css-editor-visible');
			} else {
				this.refreshButton.removeClass('html-css-editor-hidden');
				this.refreshButton.addClass('html-css-editor-visible');
			}
		}
	}

	private onEditorScroll() {
		// Save scroll position for state persistence (using HTML editor as reference)
		if (this.htmlEditor && this.htmlEditor.scrollDOM) {
			this.viewState.scrollPosition = this.htmlEditor.scrollDOM.scrollTop;
		}
	}

	private updatePreview() {
		try {
			// Use requestAnimationFrame for smoother updates
			requestAnimationFrame(() => {
				const content = this.generatePreviewContent();
				this.renderPreviewContent(content);

				// Start animation performance monitoring (deferred for performance)
				setTimeout(() => {
					this.animationPerformanceMonitor.startMonitoring(this.previewFrame);
				}, 100);

				// Update PiP if active (deferred to not block main preview)
				if (this.pipFrame) {
					requestAnimationFrame(() => {
						this.renderPreviewContentToFrame(this.pipFrame, content);
					});
				}

				// Update fullscreen if active (deferred to not block main preview)
				if (this.fullscreenOverlay) {
					requestAnimationFrame(() => {
						const fullscreenFrame = this.fullscreenOverlay.querySelector('.html-css-editor-fullscreen-frame') as HTMLIFrameElement;
						if (fullscreenFrame) {
							this.renderPreviewContentToFrame(fullscreenFrame, content);
						}
					});
				}
			});
		} catch (error) {
			this.handleError('Failed to update preview', error);
			this.renderPreviewError(error);
		}
	}

	private renderPreviewContent(content: string) {
		try {
			const doc = this.previewFrame.contentDocument;
			if (doc) {
				doc.open();
				doc.write(content);
				doc.close();

				// Add error handling for the iframe content
				this.previewFrame.onload = () => {
					try {
						const iframeDoc = this.previewFrame.contentDocument;
						if (iframeDoc) {
							// Add error event listener to catch JavaScript errors in preview
							iframeDoc.defaultView?.addEventListener('error', (event) => {
								console.warn('Preview JavaScript error:', event.error);
							});
						}
					} catch (e) {
						// Ignore cross-origin errors
					}
				};
			}
		} catch (error) {
			this.renderPreviewError(error);
		}
	}

	private renderPreviewError(error: any) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorContent = this.generateErrorContent(errorMessage);

		try {
			const doc = this.previewFrame.contentDocument;
			if (doc) {
				doc.open();
				doc.write(errorContent);
				doc.close();
			}
		} catch (e) {
			console.error('Failed to render preview error:', e);
		}
	}

	private generateErrorContent(errorMessage: string): string {
		return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview Error</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${this.plugin.settings.previewBackground};
            color: #333;
        }
        .error-container {
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 4px;
            padding: 16px;
            margin: 16px 0;
        }
        .error-title {
            color: #c33;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .error-message {
            font-family: monospace;
            font-size: 14px;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-title">Preview Error</div>
        <div class="error-message">${this.escapeHtml(errorMessage)}</div>
    </div>
</body>
</html>`;
	}

	private escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.textContent || '';
	}

	private generatePreviewContent(): string {
		const htmlContent = this.viewState.htmlContent || '';
		let cssContent = this.viewState.cssContent || '';

		// Compile Sass if in Sass mode
		if (this.viewState.isSassMode) {
			cssContent = this.compileSass(cssContent);
		}

		// Validate and sanitize content
		const validatedHTML = this.validateAndSanitizeHTML(htmlContent);
		const validatedCSS = this.validateAndSanitizeCSS(cssContent);

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML/CSS Preview</title>
    <style>
        /* Base styles */
        body {
            margin: 0;
            padding: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${this.plugin.settings.previewBackground};
            line-height: 1.6;
            box-sizing: border-box;
            overflow: hidden; /* Prevent scrollbars on tiny frames */
        }
        
        /* User CSS */
        ${validatedCSS}
    </style>
</head>
<body>
    ${validatedHTML}
    
    <script>
        // Prevent navigation away from preview
        window.addEventListener('beforeunload', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Handle link clicks to prevent navigation
        document.addEventListener('click', function(e) {
            if (e.target.tagName === 'A' && e.target.href) {
                e.preventDefault();
                // Link clicked - prevented default
            }
        });
        
        // Error handling for the preview content
        window.addEventListener('error', function(e) {
            console.warn('Preview content error:', e.message);
        });
    </script>
</body>
</html>`;
	}

	private validateAndSanitizeHTML(html: string): string {
		if (!html.trim()) {
			return '<p><em>No HTML content to preview</em></p>';
		}

		// Basic HTML validation - check for potentially dangerous elements
		const dangerousPatterns = [
			/<script[^>]*>[\s\S]*?<\/script>/gi,
			/<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
			/<object[^>]*>[\s\S]*?<\/object>/gi,
			/<embed[^>]*>/gi,
			/<form[^>]*>[\s\S]*?<\/form>/gi
		];

		let sanitized = html;

		// Remove dangerous elements but show warning
		dangerousPatterns.forEach(pattern => {
			if (pattern.test(sanitized)) {
				console.warn('HTML/CSS Editor: Removed potentially unsafe HTML elements for security');
				sanitized = sanitized.replace(pattern, '<!-- Unsafe element removed for security -->');
			}
		});

		return sanitized;
	}

	private validateAndSanitizeCSS(css: string): string {
		if (!css.trim()) {
			return '/* No CSS content */';
		}

		// Basic CSS validation - remove potentially dangerous CSS
		const dangerousPatterns = [
			/@import\s+url\s*\([^)]*\)/gi,
			/javascript\s*:/gi,
			/expression\s*\(/gi,
			/behavior\s*:/gi
		];

		let sanitized = css;

		// Remove dangerous CSS patterns
		dangerousPatterns.forEach(pattern => {
			if (pattern.test(sanitized)) {
				console.warn('HTML/CSS Editor: Removed potentially unsafe CSS for security');
				sanitized = sanitized.replace(pattern, '/* Unsafe CSS removed */');
			}
		});

		return sanitized;
	}

	private togglePreview() {
		this.viewState.isPreviewVisible = !this.viewState.isPreviewVisible;
		
		if (this.viewState.isPreviewVisible) {
			this.previewPane.style.display = 'flex';
			this.previewPane.removeClass('html-css-editor-preview-hidden');
			this.resizeHandle.style.display = 'block';
		} else {
			this.previewPane.style.display = 'none';
			this.previewPane.addClass('html-css-editor-preview-hidden');
			this.resizeHandle.style.display = 'none';
			// Make editor take full width when preview is hidden
			this.editorPane.style.width = '100%';
		}
		
		if (this.viewState.isPreviewVisible) {
			this.updatePaneRatios();
		}
	}

	// Layout toggle removed - side-by-side is the only layout

	private updateLayout() {
		this.updateLayoutClasses();
		this.updatePaneRatios();
	}

	private startResize(e: MouseEvent) {
		this.isResizing = true;
		this.contentContainer.addClass('html-css-editor-resizing');
		document.body.addClass('html-css-editor-no-select');
		document.body.addClass('html-css-editor-cursor-col-resize'); // Always column resize for side-by-side
		e.preventDefault();
	}

	private handleResize(e: MouseEvent) {
		if (!this.isResizing) return;

		// Use requestAnimationFrame for smooth resizing
		requestAnimationFrame(() => {
			if (!this.isResizing) return;

			const containerRect = this.contentContainer.getBoundingClientRect();
			let newRatio: number;

			if (this.viewState.layout === 'vertical') {
				const x = e.clientX - containerRect.left;
				newRatio = x / containerRect.width;
			} else {
				const y = e.clientY - containerRect.top;
				newRatio = y / containerRect.height;
			}

			// Clamp ratio between 0.1 and 0.9 with smooth interpolation
			newRatio = Math.max(0.1, Math.min(0.9, newRatio));

			// Smooth the ratio change to prevent jankiness
			const currentRatio = this.viewState.editorRatio;
			const smoothedRatio = currentRatio + (newRatio - currentRatio) * 0.8;

			this.viewState.editorRatio = smoothedRatio;
			this.updatePaneRatios();
		});
	}

	private stopResize() {
		if (!this.isResizing) return;

		this.isResizing = false;
		this.contentContainer.removeClass('html-css-editor-resizing');
		document.body.removeClass('html-css-editor-no-select');
		document.body.removeClass('html-css-editor-cursor-col-resize');

		// Final update to ensure exact positioning
		this.updatePaneRatios();
	}

	private saveViewState() {
		try {
			// Save current state to plugin data
			const stateKey = `viewState_${this.getViewType()}`;
			this.plugin.saveData({ [stateKey]: this.viewState });
		} catch (error) {
			this.handleError('Failed to save view state', error);
		}
	}

	private async restoreViewState() {
		try {
			const stateKey = `viewState_${this.getViewType()}`;
			const data = await this.plugin.loadData();

			if (data && data[stateKey]) {
				const savedState = data[stateKey];
				this.viewState = { ...this.viewState, ...savedState };

				// Restore editor content
				if (this.htmlEditor && savedState.htmlContent) {
					this.htmlEditor.dispatch({
						changes: {
							from: 0,
							to: this.htmlEditor.state.doc.length,
							insert: savedState.htmlContent
						}
					});
				}

				if (this.cssEditor && savedState.cssContent) {
					this.cssEditor.dispatch({
						changes: {
							from: 0,
							to: this.cssEditor.state.doc.length,
							insert: savedState.cssContent
						}
					});
				}

				// Restore layout and ratios
				this.updateLayoutClasses();
				this.updatePaneRatios();

				// Restore preview visibility
				if (this.previewPane) {
					if (this.viewState.isPreviewVisible) {
						this.previewPane.removeClass('html-css-editor-preview-hidden');
						this.previewPane.addClass('html-css-editor-preview-flex');
					} else {
						this.previewPane.addClass('html-css-editor-preview-hidden');
						this.previewPane.removeClass('html-css-editor-preview-flex');
					}
				}

				// Restore preview settings
				if (savedState.zoomLevel) {
					this.zoomLevel = savedState.zoomLevel;
					this.viewState.zoomLevel = savedState.zoomLevel;
					this.updatePreviewZoom();
					this.updateZoomDisplay();
				}

				if (savedState.currentDevice) {
					this.currentDevice = savedState.currentDevice;
					this.viewState.currentDevice = savedState.currentDevice;
					this.updateDevicePreset();
					this.updateDeviceButtons();
				}

				if (savedState.pipPosition) {
					this.viewState.pipPosition = savedState.pipPosition;
				}

				if (savedState.pipSize) {
					this.viewState.pipSize = savedState.pipSize;
				}

				// Restore scroll position
				if (this.htmlEditor && this.htmlEditor.scrollDOM && this.viewState.scrollPosition) {
					this.htmlEditor.scrollDOM.scrollTop = this.viewState.scrollPosition;
				}

				// Update preview with restored content
				this.updatePreview();

				// Update export button states after content restoration
				this.updateExportButtonStates();
			}
		} catch (error) {
			this.handleError('Failed to restore view state', error);
		}
	}

	private cleanup() {
		// Clear any pending timeouts
		this.clearUpdateTimeout();

		// Stop animation performance monitoring
		this.animationPerformanceMonitor.stopMonitoring();

		// Close PiP and fullscreen if open
		if (this.pipContainer) {
			this.closePictureInPicture();
		}
		if (this.fullscreenOverlay) {
			this.closeFullscreen();
		}

		// Destroy CodeMirror editors
		if (this.htmlEditor) {
			this.htmlEditor.destroy();
		}
		if (this.cssEditor) {
			this.cssEditor.destroy();
		}

		// Remove event listeners
		document.removeEventListener('mousemove', (e) => this.handleResize(e));
		document.removeEventListener('mouseup', () => this.stopResize());
	}

	private async handleSaveAsHTML() {
		try {
			// Validate content before export
			const validation = this.exportHandler.canExport(this.viewState.htmlContent, this.viewState.cssContent);

			if (!validation.canExport) {
				new Notice(`Cannot export: ${validation.reason}`);
				return;
			}

			if (validation.reason) {
				new Notice(`Warning: ${validation.reason}`, 3000);
			}

			// Disable button during export
			this.saveButton.disabled = true;
			this.saveButton.textContent = 'Saving...';

			await this.exportHandler.saveAsHTMLFile(this.viewState.htmlContent, this.viewState.cssContent);

		} catch (error) {
			this.handleError('Failed to save HTML+CSS file', error);
		} finally {
			// Re-enable button
			this.saveButton.disabled = false;
			this.saveButton.textContent = 'Save HTML+CSS File';
		}
	}

	private async handleExportSass() {
		try {
			if (!this.viewState.isSassMode) {
				new Notice('Switch to Sass mode to export Sass files');
				return;
			}

			const sassContent = this.viewState.cssContent;
			if (!sassContent.trim()) {
				new Notice('No Sass content to export');
				return;
			}

			// Prompt user for filename
			const defaultName = `styles-${new Date().toISOString().slice(0, 10)}.scss`;
			const filename = await this.promptForFilename(defaultName);
			
			if (!filename) {
				return; // User cancelled
			}

			// Ensure .scss extension
			const finalFilename = filename.endsWith('.scss') ? filename : `${filename}.scss`;

			// Save to vault root
			await this.app.vault.create(finalFilename, sassContent);

			new Notice(`Sass file saved to: ${finalFilename}`, 5000);

			// Open the file
			const file = this.app.vault.getAbstractFileByPath(finalFilename);
			if (file && file instanceof TFile) {
				await this.app.workspace.getLeaf(false).openFile(file);
			}
		} catch (error) {
			console.error('Error exporting Sass:', error);
			new Notice(`Failed to export Sass: ${error.message}`);
		}
	}

	private async promptForFilename(defaultName: string): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Export Sass File');
			
			const contentEl = modal.contentEl;
			contentEl.createEl('p', { text: 'Enter filename for your Sass file:' });
			
			const input = contentEl.createEl('input', {
				type: 'text',
				value: defaultName
			});
			input.addClass('html-css-editor-full-width');
			input.addClass('html-css-editor-margin-bottom');
			
			const buttonContainer = contentEl.createEl('div');
			buttonContainer.addClass('html-css-editor-button-container');
			
			const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve(null);
			});
			
			const saveBtn = buttonContainer.createEl('button', { 
				text: 'Save',
				cls: 'mod-cta'
			});
			saveBtn.addEventListener('click', () => {
				const value = input.value.trim();
				modal.close();
				resolve(value || defaultName);
			});
			
			input.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					const value = input.value.trim();
					modal.close();
					resolve(value || defaultName);
				} else if (e.key === 'Escape') {
					modal.close();
					resolve(null);
				}
			});
			
			modal.open();
			input.focus();
			input.select();
		});
	}

	private async handleCopyToClipboard() {
		try {
			// Validate content before export
			const validation = this.exportHandler.canExport(this.viewState.htmlContent, this.viewState.cssContent);

			if (!validation.canExport) {
				new Notice(`Cannot copy: ${validation.reason}`);
				return;
			}

			if (validation.reason) {
				new Notice(`Warning: ${validation.reason}`, 3000);
			}

			// Disable button during copy
			this.copyButton.disabled = true;
			this.copyButton.textContent = 'Copying...';

			await this.exportHandler.copyToClipboard(this.viewState.htmlContent, this.viewState.cssContent);

		} catch (error) {
			this.handleError('Failed to copy HTML+CSS to clipboard', error);
		} finally {
			// Re-enable button
			this.copyButton.disabled = false;
			this.copyButton.textContent = 'Copy HTML+CSS';
		}
	}

	private updateExportButtonStates() {
		// Update button states based on content availability
		const hasContent = this.viewState.htmlContent.trim() || this.viewState.cssContent.trim();

		if (this.saveButton) {
			this.saveButton.disabled = !hasContent;
			this.saveButton.title = hasContent ?
				'Save HTML+CSS file to vault root (Ctrl+S)\nFile will open automatically in new tab' :
				'No content to export - add HTML or CSS first';
		}

		if (this.copyButton) {
			this.copyButton.disabled = !hasContent;
			this.copyButton.title = hasContent ? 'Copy combined HTML+CSS to clipboard' : 'No content to copy';
		}
	}

	private createHTMLCompletions(context: CompletionContext): CompletionResult | null {
		const { state, pos } = context;
		const line = state.doc.lineAt(pos);
		const lineText = line.text;
		const beforeCursor = lineText.slice(0, pos - line.from);

		// Better word matching that includes hyphens for CSS properties
		const word = context.matchBefore(/[\w-]*/);
		if (!word) return null;

		// HTML completions
		const htmlCompletions = [
			{ label: 'div', type: 'element', info: 'Generic container element' },
			{ label: 'span', type: 'element', info: 'Inline container element' },
			{ label: 'p', type: 'element', info: 'Paragraph element' },
			{ label: 'h1', type: 'element', info: 'Main heading' },
			{ label: 'h2', type: 'element', info: 'Secondary heading' },
			{ label: 'h3', type: 'element', info: 'Tertiary heading' },
			{ label: 'a', type: 'element', info: 'Anchor/link element' },
			{ label: 'img', type: 'element', info: 'Image element' },
			{ label: 'button', type: 'element', info: 'Interactive button element' },
			{ label: 'input', type: 'element', info: 'Form input element' },
			{ label: 'form', type: 'element', info: 'Form container element' },
			{ label: 'ul', type: 'element', info: 'Unordered list' },
			{ label: 'ol', type: 'element', info: 'Ordered list' },
			{ label: 'li', type: 'element', info: 'List item' },
			{ label: 'nav', type: 'element', info: 'Navigation section' },
			{ label: 'header', type: 'element', info: 'Header section' },
			{ label: 'footer', type: 'element', info: 'Footer section' },
			{ label: 'main', type: 'element', info: 'Main content area' },
			{ label: 'section', type: 'element', info: 'Document section' },
			{ label: 'article', type: 'element', info: 'Article content' }
		];

		let completions: any[] = [];

		// HTML context - check if we're in a tag
		if (beforeCursor.includes('<') && !beforeCursor.includes('>')) {
			completions = htmlCompletions;
		}

		if (completions.length === 0) return null;

		return {
			from: word.from,
			options: completions.map(comp => ({
				label: comp.label,
				type: comp.type,
				info: comp.info,
				detail: comp.detail || '',
				apply: comp.apply || comp.label
			}))
		};
	}

	private createCSSCompletions(context: CompletionContext): CompletionResult | null {
		const { state, pos } = context;
		const line = state.doc.lineAt(pos);
		const lineText = line.text;
		const beforeCursor = lineText.slice(0, pos - line.from);

		// Better word matching that includes hyphens and $ for Sass variables
		const word = context.matchBefore(/[\w$-]*/);
		if (!word) return null;

		// Detect if we're in CSS context
		const isInCSSBlock = beforeCursor.includes('{') && !beforeCursor.includes('}');
		const isAfterColon = beforeCursor.includes(':') && !beforeCursor.includes(';');

		// Extract Sass variables from the document if in Sass mode
		const sassVariables = this.viewState.isSassMode ? this.extractSassVariables(state.doc.toString()) : [];

		// CSS property completions
		const cssProperties = [
			{ label: 'background-color', type: 'property', info: 'Background color' },
			{ label: 'background-image', type: 'property', info: 'Background image' },
			{ label: 'background-size', type: 'property', info: 'Background size' },
			{ label: 'border', type: 'property', info: 'Border shorthand' },
			{ label: 'border-radius', type: 'property', info: 'Border radius' },
			{ label: 'box-shadow', type: 'property', info: 'Box shadow' },
			{ label: 'color', type: 'property', info: 'Text color' },
			{ label: 'display', type: 'property', info: 'Display type' },
			{ label: 'flex-direction', type: 'property', info: 'Flex direction' },
			{ label: 'font-family', type: 'property', info: 'Font family' },
			{ label: 'font-size', type: 'property', info: 'Font size' },
			{ label: 'font-weight', type: 'property', info: 'Font weight' },
			{ label: 'height', type: 'property', info: 'Element height' },
			{ label: 'justify-content', type: 'property', info: 'Flex justify content' },
			{ label: 'align-items', type: 'property', info: 'Flex align items' },
			{ label: 'line-height', type: 'property', info: 'Line height' },
			{ label: 'margin', type: 'property', info: 'Outer spacing' },
			{ label: 'margin-top', type: 'property', info: 'Top margin' },
			{ label: 'margin-right', type: 'property', info: 'Right margin' },
			{ label: 'margin-bottom', type: 'property', info: 'Bottom margin' },
			{ label: 'margin-left', type: 'property', info: 'Left margin' },
			{ label: 'padding', type: 'property', info: 'Inner spacing' },
			{ label: 'padding-top', type: 'property', info: 'Top padding' },
			{ label: 'padding-right', type: 'property', info: 'Right padding' },
			{ label: 'padding-bottom', type: 'property', info: 'Bottom padding' },
			{ label: 'padding-left', type: 'property', info: 'Left padding' },
			{ label: 'position', type: 'property', info: 'Positioning method' },
			{ label: 'text-align', type: 'property', info: 'Text alignment' },
			{ label: 'transform', type: 'property', info: 'CSS transform' },
			{ label: 'transition', type: 'property', info: 'CSS transition' },
			{ label: 'width', type: 'property', info: 'Element width' },
			{ label: 'z-index', type: 'property', info: 'Stacking order' }
		];

		// Get CSS values based on the property before the colon
		const getCSSValues = (propertyName: string): any[] => {
			const valueMap: { [key: string]: string[] } = {
				'display': ['block', 'inline', 'inline-block', 'flex', 'grid', 'none'],
				'position': ['static', 'relative', 'absolute', 'fixed', 'sticky'],
				'text-align': ['left', 'center', 'right', 'justify'],
				'font-weight': ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
				'background-size': ['cover', 'contain', 'auto', '100%'],
				'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
				'justify-content': ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
				'align-items': ['flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
				'background-color': ['transparent', '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff'],
				'color': ['inherit', '#000000', '#ffffff', '#333333', '#666666', '#999999']
			};

			const values = valueMap[propertyName] || [];
			return values.map(value => ({
				label: value,
				type: 'value',
				info: `${propertyName} value`,
				apply: value
			}));
		};

		let completions: any[] = [];

		// Check if typing a Sass variable
		if (this.viewState.isSassMode && beforeCursor.endsWith('$')) {
			// Show Sass variables
			completions = sassVariables.map(v => ({
				label: v.label,
				type: 'variable',
				info: `Value: ${v.value}`,
				detail: v.value,
				apply: v.label
			}));
		}
		// Check if typing a Sass function
		else if (this.viewState.isSassMode && beforeCursor.match(/[a-z-]+\($/)) {
			const sassFunctions = this.getSassFunctions();
			completions = sassFunctions.map(fn => ({
				label: fn,
				type: 'function',
				info: `Sass function: ${fn}()`,
				apply: `${fn}()`
			}));
		}
		// Regular CSS completions
		else if (isAfterColon) {
			// We're after a colon, show CSS values + Sass variables
			const propertyMatch = beforeCursor.match(/([\w-]+)\s*:\s*[\w-]*$/);
			if (propertyMatch) {
				const propertyName = propertyMatch[1];
				completions = getCSSValues(propertyName);
				
				// Add Sass variables as value options
				if (this.viewState.isSassMode && sassVariables.length > 0) {
					completions = completions.concat(sassVariables.map(v => ({
						label: v.label,
						type: 'variable',
						info: `Sass variable: ${v.value}`,
						detail: v.value,
						apply: v.label
					})));
				}
			}
		} else {
			// Show CSS properties
			completions = cssProperties;
			
			// Add Sass-specific completions
			if (this.viewState.isSassMode) {
				completions = completions.concat([
					{ label: '@mixin', type: 'keyword', info: 'Define a mixin' },
					{ label: '@include', type: 'keyword', info: 'Include a mixin' },
					{ label: '@function', type: 'keyword', info: 'Define a function' },
					{ label: '@return', type: 'keyword', info: 'Return from function' },
					{ label: '@if', type: 'keyword', info: 'Conditional statement' },
					{ label: '@else', type: 'keyword', info: 'Else clause' },
					{ label: '@for', type: 'keyword', info: 'For loop' },
					{ label: '@each', type: 'keyword', info: 'Each loop' },
					{ label: '@while', type: 'keyword', info: 'While loop' }
				]);
			}
		}

		if (completions.length === 0) return null;

		return {
			from: word.from,
			options: completions.map(comp => ({
				label: comp.label,
				type: comp.type,
				info: comp.info,
				detail: comp.detail || '',
				apply: comp.apply || comp.label
			}))
		};
	}

	private toggleSassMode() {
		this.viewState.isSassMode = !this.viewState.isSassMode;

		// Update toggle switch appearance
		const cssOption = this.contentContainer.querySelector('.sass-toggle-option:first-child');
		const sassOption = this.contentContainer.querySelector('.sass-toggle-option:last-child');

		if (cssOption && sassOption) {
			if (this.viewState.isSassMode) {
				cssOption.removeClass('active');
				sassOption.addClass('active');
			} else {
				cssOption.addClass('active');
				sassOption.removeClass('active');
			}
		}

		// Update label text to show current mode
		const labelText = this.contentContainer.querySelector('.html-css-editor-label-text');
		if (labelText) {
			labelText.textContent = this.viewState.isSassMode ? 'SASS' : 'CSS';
		}

		// Show/hide Export Sass button
		const exportSassBtn = this.toolbar.querySelector('.export-sass-btn') as HTMLElement;
		if (exportSassBtn) {
			if (this.viewState.isSassMode) {
				exportSassBtn.removeClass('html-css-editor-hidden');
			} else {
				exportSassBtn.addClass('html-css-editor-hidden');
			}
		}

		// Show/hide Show Compiled CSS button
		const showCompiledBtn = this.toolbar.querySelector('.show-compiled-btn') as HTMLElement;
		if (showCompiledBtn) {
			if (this.viewState.isSassMode) {
				showCompiledBtn.removeClass('html-css-editor-hidden');
			} else {
				showCompiledBtn.addClass('html-css-editor-hidden');
			}
		}

		// Show/hide Compilation Status indicator
		if (this.compilationStatusEl) {
			if (this.viewState.isSassMode) {
				this.compilationStatusEl.removeClass('html-css-editor-hidden');
				this.compilationStatusEl.textContent = 'Ready';
				this.compilationStatusEl.removeClass('compiling', 'success', 'error');
			} else {
				this.compilationStatusEl.addClass('html-css-editor-hidden');
			}
		}

		// Trigger preview update
		this.onContentChange();
	}

	private toggleCompiledView() {
		if (!this.viewState.isSassMode) {
			new Notice('Switch to Sass mode to view compiled CSS');
			return;
		}

		const sassContent = this.viewState.cssContent;
		const compiledCSS = this.compileSass(sassContent);

		// Create a modal to show compiled CSS
		const modal = new Modal(this.app);
		modal.titleEl.setText('Compiled CSS Output');
		
		const contentEl = modal.contentEl;
		contentEl.addClass('html-css-editor-modal-content');
		
		// Add copy button
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.addClass('html-css-editor-modal-button-container');
		
		const info = buttonContainer.createEl('span', {
			text: `${compiledCSS.split('\n').length} lines`,
			cls: 'text-muted'
		});
		
		const copyBtn = buttonContainer.createEl('button', {
			text: 'Copy to Clipboard',
			cls: 'mod-cta'
		});
		copyBtn.addEventListener('click', async () => {
			await navigator.clipboard.writeText(compiledCSS);
			new Notice('Compiled CSS copied to clipboard');
		});
		
		// Show compiled CSS in a code block
		const codeBlock = contentEl.createEl('pre');
		codeBlock.addClass('html-css-editor-code-block');
		
		const code = codeBlock.createEl('code');
		code.textContent = compiledCSS;
		code.addClass('html-css-editor-code');
		
		modal.open();
	}

	private sassCache: Map<string, string> = new Map();
	private lastSassContent: string = '';
	
	private compileSass(sassContent: string): string {
		if (!this.viewState.isSassMode || !sassContent.trim()) {
			return sassContent;
		}

		// Check cache first for performance
		if (this.sassCache.has(sassContent)) {
			return this.sassCache.get(sassContent)!;
		}

		try {
			const startTime = performance.now();

			// Update status
			if (this.compilationStatusEl) {
				this.compilationStatusEl.textContent = 'Compiling...';
				this.compilationStatusEl.removeClass('success', 'error');
				this.compilationStatusEl.addClass('compiling');
			}

			// Use the full Node.js Sass compiler
			const result = sass.compileString(sassContent, {
				style: 'expanded',
				sourceMap: false,
				alertColor: true,
				alertAscii: true
			});

			const endTime = performance.now();
			this.lastCompilationTime = endTime - startTime;

			// Cache the result (limit cache size to prevent memory issues)
			if (this.sassCache.size > 10) {
				const firstKey = this.sassCache.keys().next().value;
				this.sassCache.delete(firstKey);
			}
			this.sassCache.set(sassContent, result.css);

			// Update status
			if (this.compilationStatusEl) {
				this.compilationStatusEl.textContent = `Compiled (${this.lastCompilationTime.toFixed(0)}ms)`;
				this.compilationStatusEl.removeClass('compiling', 'error');
				this.compilationStatusEl.addClass('success');
			}

			// Sass compiled successfully
			return result.css;
		} catch (error) {
			// Log error quietly to console for debugging
			console.warn('Sass compilation error:', error);
			const errorMessage = error.message || 'Unknown error';

			// Update status indicator (no popup notification)
			if (this.compilationStatusEl) {
				this.compilationStatusEl.textContent = 'Error';
				this.compilationStatusEl.removeClass('compiling', 'success');
				this.compilationStatusEl.addClass('error');
				// Add error message as tooltip so users can see it on hover
				this.compilationStatusEl.setAttribute('title', errorMessage);
			}

			// Return original content with error comment (no popup)
			return `/* Sass compilation error: ${errorMessage} */\n${sassContent}`;
		}
	}

	private extractSassVariables(content: string): Array<{label: string, value: string}> {
		const variables: Array<{label: string, value: string}> = [];
		const regex = /\$([a-zA-Z_-]+)\s*:\s*([^;]+);/g;
		let match;
		
		while ((match = regex.exec(content)) !== null) {
			variables.push({
				label: `$${match[1]}`,
				value: match[2].trim()
			});
		}
		
		return variables;
	}

	private getSassFunctions(): string[] {
		return [
			'darken', 'lighten', 'saturate', 'desaturate', 'adjust-hue',
			'rgba', 'rgb', 'mix', 'complement', 'invert',
			'percentage', 'round', 'ceil', 'floor', 'abs',
			'min', 'max', 'random', 'unit', 'unitless'
		];
	}

	private showTemplatesMenu(event: MouseEvent) {
		const menu = new Menu();

		const templates = this.getSassTemplates();

		templates.forEach(template => {
			menu.addItem((item) => {
				item.setTitle(template.name);
				item.setIcon(template.icon || 'code');
				item.onClick(() => {
					this.insertTemplate(template.code);
				});
			});
		});

		menu.showAtMouseEvent(event);
	}

	private getSassTemplates() {
		return [
			{
				name: 'Variables - Colors',
				icon: 'palette',
				code: `// Color Variables
$primary: #3498db;
$secondary: #2ecc71;
$danger: #e74c3c;
$warning: #f39c12;
$dark: #2c3e50;
$light: #ecf0f1;

`
			},
			{
				name: 'Variables - Spacing',
				icon: 'layout',
				code: `// Spacing Variables
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 32px;

`
			},
			{
				name: 'Mixin - Button',
				icon: 'square',
				code: `// Button Mixin
@mixin button($bg-color, $text-color: white) {
  background: $bg-color;
  color: $text-color;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: darken($bg-color, 10%);
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
}

`
			},
			{
				name: 'Mixin - Flexbox Center',
				icon: 'align-center',
				code: `// Flexbox Center Mixin
@mixin flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

`
			},
			{
				name: 'Function - Rem Converter',
				icon: 'calculator',
				code: `// Rem Converter Function
@function rem($pixels, $base: 16) {
  @return ($pixels / $base) * 1rem;
}

// Usage: font-size: rem(24);
`
			},
			{
				name: 'Responsive Breakpoints',
				icon: 'smartphone',
				code: `// Responsive Breakpoints
$breakpoints: (
  mobile: 480px,
  tablet: 768px,
  desktop: 1024px,
  wide: 1200px
);

@mixin respond-to($breakpoint) {
  @if map-has-key($breakpoints, $breakpoint) {
    @media (min-width: map-get($breakpoints, $breakpoint)) {
      @content;
    }
  }
}

// Usage:
// .element {
//   @include respond-to(tablet) {
//     width: 50%;
//   }
// }
`
			},
			{
				name: 'Card Component',
				icon: 'file-text',
				code: `// Card Component
$card-padding: 20px;
$card-radius: 8px;
$card-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

.card {
  background: white;
  padding: $card-padding;
  border-radius: $card-radius;
  box-shadow: $card-shadow;
  
  .card-header {
    font-size: 1.5em;
    font-weight: bold;
    margin-bottom: 10px;
  }
  
  .card-body {
    color: #666;
    line-height: 1.6;
  }
}

`
			},
			{
				name: 'Grid System',
				icon: 'grid',
				code: `// Simple Grid System
$columns: 12;
$gutter: 20px;

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 $gutter;
}

.row {
  display: flex;
  flex-wrap: wrap;
  margin: 0 (-$gutter / 2);
}

@for $i from 1 through $columns {
  .col-#{$i} {
    flex: 0 0 percentage($i / $columns);
    padding: 0 ($gutter / 2);
  }
}

`
			}
		];
	}

	private insertTemplate(code: string) {
		if (this.cssEditor) {
			const currentContent = this.cssEditor.state.doc.toString();
			const newContent = currentContent + '\n' + code;

			this.cssEditor.dispatch({
				changes: {
					from: 0,
					to: this.cssEditor.state.doc.length,
					insert: newContent
				}
			});

			new Notice('Template inserted');
		}
	}

	private showAnimationPresets() {
		const modal = new AnimationPresetsModal(this.app, (preset) => {
			this.insertAnimationPreset(preset);
		});
		modal.open();
	}

	private showAnimationBuilder() {
		const modal = new AnimationBuilderModal(this.app, (css) => {
			this.insertTemplate(css);
		});
		modal.open();
	}

	private showAnimationInspector() {
		const performanceData = this.animationPerformanceMonitor.getPerformanceData();
		const modal = new AnimationInspectorModal(this.app, performanceData);
		modal.open();
	}

	private insertAnimationPreset(preset: any) {
		if (this.cssEditor) {
			const currentContent = this.cssEditor.state.doc.toString();
			let insertContent = '';

			// Add keyframes if they exist
			if (preset.keyframes && !preset.keyframes.includes('Use with :hover')) {
				insertContent += preset.keyframes + '\n\n';
			}

			// Add usage example as comment
			insertContent += `/* ${preset.name} - ${preset.category} */\n`;
			insertContent += `.${preset.key} {\n  ${preset.usage}\n}\n\n`;

			const newContent = currentContent + '\n' + insertContent;

			this.cssEditor.dispatch({
				changes: {
					from: 0,
					to: this.cssEditor.state.doc.length,
					insert: newContent
				}
			});

			new Notice(`${preset.name} animation inserted`);
		}
	}

	private async saveProject() {
		try {
			// Step 1: Ask user for project name
			const projectName = await this.promptForProjectName();
			if (!projectName) {
				return; // User cancelled
			}

			// Step 2: Ask user to select folder
			const selectedFolder = await this.promptForFolder();
			if (selectedFolder === null) {
				return; // User cancelled
			}

			// Step 3: Create the filename
			const filename = `${projectName}.md`;
			const fullPath = selectedFolder ? `${selectedFolder}/${filename}` : filename;

			// Check if file already exists
			const fileExists = await this.app.vault.adapter.exists(fullPath);
			if (fileExists) {
				const overwrite = await this.confirmOverwrite(filename);
				if (!overwrite) {
					return;
				}
			}

			// Step 4: Create markdown content with code blocks
			const mode = this.viewState.isSassMode ? 'scss' : 'css';
			const markdownContent = `---
created: ${new Date().toISOString()}
mode: ${mode}
---

# ${projectName}

Saved from HTML/CSS Editor plugin.

## HTML

\`\`\`html
${this.viewState.htmlContent || '<!-- No HTML content -->'}
\`\`\`

## ${this.viewState.isSassMode ? 'Sass' : 'CSS'}

\`\`\`${mode}
${this.viewState.cssContent || '/* No CSS content */'}
\`\`\`

---

To load this project: Open HTML/CSS Editor and click "Load Project"
`;

			// Step 5: Save the file
			if (fileExists) {
				const file = this.app.vault.getAbstractFileByPath(fullPath);
				if (file && file instanceof TFile) {
					await this.app.vault.modify(file, markdownContent);
				}
			} else {
				await this.app.vault.create(fullPath, markdownContent);
			}

			new Notice(`✓ Project saved: ${filename}`);

			// Open the saved file
			const file = this.app.vault.getAbstractFileByPath(fullPath);
			if (file && file instanceof TFile) {
				await this.app.workspace.getLeaf(false).openFile(file);
			}
		} catch (error) {
			console.error('Error saving project:', error);
			new Notice(`Failed to save project: ${error.message}`);
		}
	}

	private async promptForProjectName(): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new ProjectNameModal(this.app, (name) => {
				resolve(name);
			});
			modal.open();
		});
	}

	private async promptForFolder(): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new FolderSelectionModal(this.app, (folder) => {
				resolve(folder);
			});
			modal.open();
		});
	}

	private async confirmOverwrite(filename: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(
				this.app,
				'File Already Exists',
				`A file named "${filename}" already exists. Do you want to overwrite it?`,
				(confirmed) => resolve(confirmed)
			);
			modal.open();
		});
	}

	private async loadProject() {
		try {
			// Get all markdown files in the vault that contain HTML/CSS project markers
			const allFiles = this.app.vault.getMarkdownFiles();
			const projectFiles = [];

			// Search for files with the project marker in frontmatter or content
			for (const file of allFiles) {
				const content = await this.app.vault.read(file);
				// Check if it's a project file (has mode in frontmatter or HTML/CSS code blocks)
				if (content.includes('mode:') || (content.includes('```html') && content.includes('```css')) || 
				    (content.includes('```html') && content.includes('```scss'))) {
					projectFiles.push(file);
				}
			}
			
			if (projectFiles.length === 0) {
				new Notice('No saved projects found. Save a project first.');
				return;
			}

			// Show file picker with search
			const selectedFile = await this.promptForProjectFile(projectFiles);
			
			if (!selectedFile) {
				return; // User cancelled
			}

			// Read and parse markdown file
			const content = await this.app.vault.read(selectedFile);
			
			// Extract HTML from code block
			const htmlMatch = content.match(/```html\n([\s\S]*?)```/);
			const htmlContent = htmlMatch ? htmlMatch[1].trim() : '';

			// Extract CSS/Sass from code block
			const cssMatch = content.match(/```(?:css|scss)\n([\s\S]*?)```/);
			const cssContent = cssMatch ? cssMatch[1].trim() : '';

			// Check if it's Sass mode from frontmatter
			const modeMatch = content.match(/mode:\s*(scss|css)/);
			const isSassMode = modeMatch ? modeMatch[1] === 'scss' : false;

			// Load content into editors
			if (this.htmlEditor) {
				this.htmlEditor.dispatch({
					changes: {
						from: 0,
						to: this.htmlEditor.state.doc.length,
						insert: htmlContent
					}
				});
			}

			if (this.cssEditor) {
				this.cssEditor.dispatch({
					changes: {
						from: 0,
						to: this.cssEditor.state.doc.length,
						insert: cssContent
					}
				});
			}

			// Set Sass mode if needed
			if (isSassMode && !this.viewState.isSassMode) {
				this.toggleSassMode();
			} else if (!isSassMode && this.viewState.isSassMode) {
				this.toggleSassMode();
			}

			// Update view state
			this.viewState.htmlContent = htmlContent;
			this.viewState.cssContent = cssContent;

			// Trigger preview update
			this.onContentChange();

			new Notice(`✓ Project loaded: ${selectedFile.basename}`);
		} catch (error) {
			console.error('Error loading project:', error);
			new Notice(`Failed to load project: ${error.message}`);
		}
	}

	private async promptForProjectFile(files: any[]): Promise<any | null> {
		return new Promise((resolve) => {
			const modal = new ProjectFileModal(this.app, files, (file) => {
				resolve(file);
			});
			modal.open();
		});
	}

	private async showQuickPicker(items: string[], placeholder: string): Promise<number> {
		return new Promise((resolve) => {
			class ItemPickerModal extends FuzzySuggestModal<string> {
				constructor(app: App, private items: string[], private onSelect: (index: number) => void) {
					super(app);
					this.setPlaceholder(placeholder);
					this.setInstructions([{ command: '↑↓', purpose: 'Navigate' }, { command: '↵', purpose: 'Select' }, { command: 'esc', purpose: 'Cancel' }]);
				}

				getItems(): string[] {
					return this.items;
				}

				getItemText(item: string): string {
					return item;
				}

				onChooseItem(item: string): void {
					const index = this.items.indexOf(item);
					this.onSelect(index);
				}
			}

			const modal = new ItemPickerModal(this.app, items, resolve);
			
			// Override getSuggestions to return proper FuzzyMatch format
			modal.getSuggestions = (query: string) => {
				return items
					.filter(item => item.toLowerCase().includes(query.toLowerCase()))
					.map(item => ({
						item,
						match: { score: 1, matches: [] as any }
					}));
			};
			
			// Override renderSuggestion
			modal.renderSuggestion = (value: any, el: HTMLElement) => {
				el.createEl('div', { text: value.item });
			};
			
			// Override onChooseSuggestion
			modal.onChooseSuggestion = (value: any) => {
				resolve(value.index);
			};
			
			// Handle close without selection
			const originalClose = modal.close.bind(modal);
			modal.close = () => {
				originalClose();
				resolve(-1);
			};
			
			modal.open();
		});
	}

	// Removed old showProjectPicker - using SuggestModal instead

	private clearAllContent() {
		// Clear both editors
		if (this.htmlEditor) {
			this.htmlEditor.dispatch({
				changes: {
					from: 0,
					to: this.htmlEditor.state.doc.length,
					insert: ''
				}
			});
		}

		if (this.cssEditor) {
			this.cssEditor.dispatch({
				changes: {
					from: 0,
					to: this.cssEditor.state.doc.length,
					insert: ''
				}
			});
		}

		// Update view state
		this.viewState.htmlContent = '';
		this.viewState.cssContent = '';

		// Update preview
		this.onContentChange();

		// Show feedback
		new Notice('Content cleared');
	}

	private setupFocusManagement() {
		// Set up proper tab order and focus management
		const focusableElements = [
			this.htmlEditor.dom,
			this.cssEditor.dom,
			this.saveButton,
			this.copyButton,
			this.refreshButton
		].filter(Boolean);

		focusableElements.forEach((element, index) => {
			if (element) {
				element.setAttribute('tabindex', (index + 1).toString());
			}
		});

		// Debug and fix handler for Shift+1-6 issue
		const fixShiftNumberKeys = (e: KeyboardEvent) => {
			// Check if this is a Shift+number key
			if (e.shiftKey && e.code && e.code.match(/^Digit[1-6]$/)) {
				// Shift+number detected for device preset - logging key info
				// Key: e.key, Code: e.code, ShiftKey: e.shiftKey, DefaultPrevented: e.defaultPrevented
				
				// If the key is being blocked or wrong, we can't really fix it here
				// This is likely a keyboard layout or Obsidian-level issue
			}
		};
		
		this.htmlEditor.dom.addEventListener('keydown', fixShiftNumberKeys, { capture: true });
		this.cssEditor.dom.addEventListener('keydown', fixShiftNumberKeys, { capture: true });

		// Add keyboard navigation between editors
		this.htmlEditor.dom.addEventListener('keydown', (e) => {
			if (e.key === 'Tab' && e.ctrlKey) {
				e.preventDefault();
				this.cssEditor.focus();
			}
		});

		this.cssEditor.dom.addEventListener('keydown', (e) => {
			if (e.key === 'Tab' && e.ctrlKey) {
				e.preventDefault();
				this.htmlEditor.focus();
			}
		});
	}

	private setupCollapsibleSections() {
		// Add click handlers to section labels for collapsing
		const htmlSection = this.editorPane.querySelector('.html-css-editor-section:first-child');
		const cssSection = this.editorPane.querySelector('.html-css-editor-section:last-child');

		if (htmlSection) {
			const htmlLabel = htmlSection.querySelector('.html-css-editor-label');
			if (htmlLabel) {
				htmlLabel.addEventListener('click', () => this.toggleSection(htmlSection as HTMLElement, 'html'));
				htmlLabel.setAttribute('role', 'button');
				htmlLabel.setAttribute('aria-expanded', 'true');
				htmlLabel.setAttribute('tabindex', '0');

				// Keyboard support
				htmlLabel.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						this.toggleSection(htmlSection as HTMLElement, 'html');
					}
				});
			}
		}

		if (cssSection) {
			const cssLabel = cssSection.querySelector('.html-css-editor-label');
			if (cssLabel) {
				cssLabel.addEventListener('click', () => this.toggleSection(cssSection as HTMLElement, 'css'));
				cssLabel.setAttribute('role', 'button');
				cssLabel.setAttribute('aria-expanded', 'true');
				cssLabel.setAttribute('tabindex', '0');

				// Keyboard support
				cssLabel.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						this.toggleSection(cssSection as HTMLElement, 'css');
					}
				});
			}
		}
	}

	private toggleSection(section: HTMLElement, type: 'html' | 'css') {
		const isCollapsed = section.classList.contains('collapsed');
		const label = section.querySelector('.html-css-editor-label');

		if (isCollapsed) {
			// Expand section
			section.classList.remove('collapsed');
			if (label) {
				label.setAttribute('aria-expanded', 'true');
			}

			// Restore editor focus if it was the active one
			setTimeout(() => {
				if (type === 'html') {
					this.htmlEditor.focus();
				} else {
					this.cssEditor.focus();
				}
			}, 300); // Wait for animation to complete
		} else {
			// Collapse section
			section.classList.add('collapsed');
			if (label) {
				label.setAttribute('aria-expanded', 'false');
			}

			// Focus the other editor if this one is being collapsed
			if (type === 'html') {
				this.cssEditor.focus();
			} else {
				this.htmlEditor.focus();
			}
		}

		// Update layout after collapse/expand
		setTimeout(() => {
			this.updatePaneRatios();
		}, 50);
	}

	private enhanceLayoutTransitions() {
		// Add smooth transitions for layout changes
		this.contentContainer.addClass('html-css-editor-layout-transitions');
		this.editorPane.addClass('html-css-editor-layout-transitions');
		this.previewPane.addClass('html-css-editor-layout-transitions');

		// Add resize observer for responsive behavior
		const resizeObserver = new ResizeObserver(() => {
			this.handleResponsiveLayout();
		});

		resizeObserver.observe(this.contentContainer);
	}

	private handleResponsiveLayout() {
		const containerWidth = this.contentContainer.offsetWidth;

		// Adjust editor ratios for better UX on small screens
		if (containerWidth < 480) {
			// On very small screens, give more space to the editor
			this.viewState.editorRatio = 0.7;
			this.updatePaneRatios();
		}
	}

	// Enhanced Preview Methods

	private setupZoomControls(container: HTMLElement) {
		const zoomControls = container.createEl('div', {
			cls: 'html-css-editor-zoom-controls'
		});

		// Zoom out button
		const zoomOutBtn = zoomControls.createEl('button', {
			cls: 'html-css-editor-zoom-btn',
			text: '−',
			attr: {
				'aria-label': 'Zoom out',
				'title': 'Zoom Out'
			}
		});
		zoomOutBtn.addEventListener('click', () => this.adjustZoom(-5));

		// Zoom level display
		const zoomLevel = zoomControls.createEl('div', {
			cls: 'html-css-editor-zoom-level',
			text: '100%'
		});

		// Zoom in button
		const zoomInBtn = zoomControls.createEl('button', {
			cls: 'html-css-editor-zoom-btn',
			text: '+',
			attr: {
				'aria-label': 'Zoom in',
				'title': 'Zoom In'
			}
		});
		zoomInBtn.addEventListener('click', () => this.adjustZoom(5));

		// Fit to window button
		const fitBtn = zoomControls.createEl('button', {
			cls: 'html-css-editor-zoom-btn',
			text: '⊞',
			attr: {
				'aria-label': 'Fit to window',
				'title': 'Fit to Window'
			}
		});
		fitBtn.addEventListener('click', () => this.fitToWindow());

		// Store reference to zoom level display
		this.zoomLevelDisplay = zoomLevel;
	}

	private setupDeviceControls(container: HTMLElement) {
		const deviceControls = container.createEl('div', {
			cls: 'html-css-editor-responsive-controls'
		});

		// Device preset dropdown
		const deviceSelect = deviceControls.createEl('select', {
			cls: 'html-css-editor-device-select',
			attr: {
				'aria-label': 'Select device preset',
				'title': 'Choose device size'
			}
		});

		const devices = [
			{ key: 'desktop', label: 'Desktop', width: 1024, height: 768 },
			{ key: 'laptop', label: 'Laptop', width: 1366, height: 768 },
			{ key: 'tablet-landscape', label: 'Tablet Landscape', width: 1024, height: 768 },
			{ key: 'tablet', label: 'Tablet Portrait', width: 768, height: 1024 },
			{ key: 'mobile-landscape', label: 'Mobile Landscape', width: 667, height: 375 },
			{ key: 'mobile', label: 'Mobile Portrait', width: 375, height: 667 },
			{ key: 'iphone-14', label: 'iPhone 14', width: 390, height: 844 },
			{ key: 'iphone-14-pro-max', label: 'iPhone 14 Pro Max', width: 430, height: 932 },
			{ key: 'ipad-pro', label: 'iPad Pro', width: 1024, height: 1366 },
			{ key: 'custom', label: 'Custom Size', width: 800, height: 600 }
		];

		devices.forEach(device => {
			const option = deviceSelect.createEl('option', {
				value: device.key,
				text: `${device.label} (${device.width}×${device.height})`
			});
			if (device.key === this.currentDevice) {
				option.selected = true;
			}
		});

		deviceSelect.addEventListener('change', () => {
			const selectedDevice = devices.find(d => d.key === deviceSelect.value);
			if (selectedDevice) {
				if (selectedDevice.key === 'custom') {
					this.showCustomSizeDialog();
					// Reset dropdown to current device after showing dialog
					// This allows custom to be selected again
					setTimeout(() => {
						deviceSelect.value = this.currentDevice;
					}, 100);
				} else {
					// Handle all device types, not just the original 4
					this.setDevicePreset(selectedDevice.key, selectedDevice.width, selectedDevice.height);
				}
			}
		});

		// Rotate button
		const rotateBtn = deviceControls.createEl('button', {
			cls: 'html-css-editor-device-btn rotate-btn',
			text: 'Rotate',
			attr: {
				'aria-label': 'Rotate device orientation',
				'title': 'Rotate (swap width/height)'
			}
		});
		rotateBtn.addEventListener('click', () => this.rotateDevice());
	}

	private showCustomSizeDialog() {
		const modal = new CustomSizeModal(this.app, (width, height) => {
			if (width && height) {
				this.setCustomDeviceSize(width, height);
			}
		});
		modal.open();
	}

	private setupPreviewPan() {
		// Create compact help button instead of large hint
		const helpBtn = this.previewToolbar.createEl('button', {
			cls: 'html-css-editor-help-btn',
			text: '?',
			attr: {
				'aria-label': 'Show help',
				'title': 'Click for help and tips'
			}
		});
		
		helpBtn.addEventListener('click', () => {
			this.showHelpModal();
		});

		// Make preview container scrollable for panning
		this.previewFrameContainer.addClass('html-css-editor-preview-scrollable');
		
		// Center the preview wrapper
		if (this.previewFrameWrapper) {
			this.previewFrameWrapper.addClass('html-css-editor-preview-wrapper-centered');
		}

		// Create transparent overlay for capturing events over iframe
		const panOverlay = this.previewFrameContainer.createEl('div', {
			cls: 'html-css-editor-pan-overlay'
		});

		let isPanning = false;
		let spacePressed = false;
		let startX = 0;
		let startY = 0;
		let scrollLeft = 0;
		let scrollTop = 0;

		// Track spacebar state - only when preview area is focused
		const handleKeyDown = (e: KeyboardEvent) => {
			// Only enable spacebar pan when NOT typing in code editors
			const activeElement = document.activeElement;
			const isInCodeEditor = activeElement && (
				activeElement.closest('.cm-editor') || 
				activeElement.closest('.cm-content') ||
				activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA'
			);

			// Early return if in code editor - don't interfere with typing at all
			if (isInCodeEditor) {
				return;
			}

			if (e.code === 'Space' && !spacePressed && !isPanning) {
				spacePressed = true;
				// Show overlay to capture events over iframe
				panOverlay.addClass('html-css-editor-pan-overlay-active');
				this.previewFrameContainer.addClass('html-css-editor-cursor-grab');
				helpBtn.classList.add('active');
				e.preventDefault();
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			// Only handle spacebar release when NOT in code editors
			const activeElement = document.activeElement;
			const isInCodeEditor = activeElement && (
				activeElement.closest('.cm-editor') || 
				activeElement.closest('.cm-content') ||
				activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA'
			);

			// Early return if in code editor
			if (isInCodeEditor) {
				return;
			}

			if (e.code === 'Space') {
				spacePressed = false;
				if (!isPanning) {
					// Hide overlay
					panOverlay.removeClass('html-css-editor-pan-overlay-active');
					this.previewFrameContainer.removeClass('html-css-editor-cursor-grab');
					this.previewFrameContainer.addClass('html-css-editor-cursor-default');
					helpBtn.classList.remove('active');
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('keyup', handleKeyUp);

		// Mouse down - start panning (on overlay when spacebar pressed)
		panOverlay.addEventListener('mousedown', (e: MouseEvent) => {
			if (spacePressed) {
				isPanning = true;
				startX = e.clientX;
				startY = e.clientY;
				scrollLeft = this.previewFrameContainer.scrollLeft;
				scrollTop = this.previewFrameContainer.scrollTop;
				panOverlay.addClass('html-css-editor-cursor-grabbing');
				this.previewFrameContainer.addClass('html-css-editor-cursor-grabbing');
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// Also handle on container for areas outside iframe
		this.previewFrameContainer.addEventListener('mousedown', (e: MouseEvent) => {
			if (spacePressed && e.target !== this.previewFrame) {
				isPanning = true;
				startX = e.clientX;
				startY = e.clientY;
				scrollLeft = this.previewFrameContainer.scrollLeft;
				scrollTop = this.previewFrameContainer.scrollTop;
				this.previewFrameContainer.addClass('html-css-editor-cursor-grabbing');
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// Mouse move - pan the preview (on document for smooth panning)
		document.addEventListener('mousemove', (e: MouseEvent) => {
			if (isPanning && spacePressed) {
				e.preventDefault();
				
				const deltaX = e.clientX - startX;
				const deltaY = e.clientY - startY;
				
				this.previewFrameContainer.scrollLeft = scrollLeft - deltaX;
				this.previewFrameContainer.scrollTop = scrollTop - deltaY;
			}
		});

		// Mouse up - stop panning
		const stopPanning = () => {
			if (isPanning) {
				isPanning = false;
				panOverlay.removeClass('html-css-editor-cursor-grabbing');
				this.previewFrameContainer.removeClass('html-css-editor-cursor-grabbing');
				
				if (spacePressed) {
					panOverlay.addClass('html-css-editor-cursor-grab');
					this.previewFrameContainer.addClass('html-css-editor-cursor-grab');
				} else {
					panOverlay.addClass('html-css-editor-cursor-default');
					this.previewFrameContainer.addClass('html-css-editor-cursor-default');
					panOverlay.removeClass('html-css-editor-pip-overlay-visible');
					panOverlay.addClass('html-css-editor-hidden');
					helpBtn.classList.remove('active');
				}
			}
		};

		document.addEventListener('mouseup', stopPanning);

		// Ctrl+Scroll to zoom (industry standard) - on container
		this.previewFrameContainer.addEventListener('wheel', (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				e.stopPropagation();
				
				const delta = e.deltaY > 0 ? -10 : 10;
				this.adjustZoom(delta);
			}
		}, { passive: false });

		// Also add wheel listener to overlay for when it's visible
		panOverlay.addEventListener('wheel', (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				e.stopPropagation();
				
				const delta = e.deltaY > 0 ? -10 : 10;
				this.adjustZoom(delta);
			}
		}, { passive: false });

		// Double-click to reset pan (center the preview)
		this.previewFrameContainer.addEventListener('dblclick', (e: MouseEvent) => {
			e.preventDefault();
			// Smooth scroll to center
			const maxScrollLeft = this.previewFrameContainer.scrollWidth - this.previewFrameContainer.clientWidth;
			const maxScrollTop = this.previewFrameContainer.scrollHeight - this.previewFrameContainer.clientHeight;
			
			this.previewFrameContainer.scrollTo({
				left: maxScrollLeft / 2,
				top: maxScrollTop / 2,
				behavior: 'smooth'
			});
			new Notice('Preview centered');
		});

		// Keyboard shortcut - reset pan with Ctrl+0
		document.addEventListener('keydown', (e: KeyboardEvent) => {
			// Only handle when NOT in code editors
			const activeElement = document.activeElement;
			const isInCodeEditor = activeElement && (
				activeElement.closest('.cm-editor') || 
				activeElement.closest('.cm-content') ||
				activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA'
			);

			if (isInCodeEditor) {
				return;
			}

			if ((e.ctrlKey || e.metaKey) && e.key === '0') {
				e.preventDefault();
				const maxScrollLeft = this.previewFrameContainer.scrollWidth - this.previewFrameContainer.clientWidth;
				const maxScrollTop = this.previewFrameContainer.scrollHeight - this.previewFrameContainer.clientHeight;
				
				this.previewFrameContainer.scrollTo({
					left: maxScrollLeft / 2,
					top: maxScrollTop / 2,
					behavior: 'smooth'
				});
				new Notice('Preview centered');
			}
		});

		// Cleanup on view close
		this.register(() => {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('keyup', handleKeyUp);
		});
	}

	private rotateDevice() {
		// Get current dimensions
		const deviceDimensions = this.getCurrentDeviceDimensions();
		
		// Swap width and height
		const newWidth = deviceDimensions.height;
		const newHeight = deviceDimensions.width;
		
		// Apply to preview frame wrapper
		if (this.previewFrameWrapper) {
			this.previewFrameWrapper.style.width = `${newWidth}px`;
			this.previewFrameWrapper.style.height = `${newHeight}px`;
		}
		
		// Apply to preview frame itself
		if (this.previewFrame) {
			this.previewFrame.style.width = `${newWidth}px`;
			this.previewFrame.style.height = `${newHeight}px`;
		}
		
		// Update device to custom with new dimensions
		this.currentDevice = 'custom';
		this.viewState.currentDevice = 'custom';
		
		new Notice(`Device rotated: ${newWidth}×${newHeight}px`);
	}

	private setCustomDeviceSize(width: number, height: number) {
		this.currentDevice = 'custom';
		this.viewState.currentDevice = 'custom';
		
		if (this.previewFrameWrapper) {
			this.previewFrameWrapper.style.width = `${width}px`;
			this.previewFrameWrapper.style.height = `${height}px`;
			// Ensure custom sizes don't shrink below their set dimensions
			this.previewFrameWrapper.style.minWidth = `${width}px`;
			this.previewFrameWrapper.style.minHeight = `${height}px`;
		}
		
		// Also set the iframe size to match
		if (this.previewFrame) {
			this.previewFrame.style.width = `${width}px`;
			this.previewFrame.style.height = `${height}px`;
		}
		
		this.updateDevicePreset();
		this.updatePreviewZoom(); // Ensure zoom is applied correctly
		new Notice(`Custom size: ${width}×${height}px`);
	}

	private getCurrentDeviceDimensions(): { width: number; height: number } {
		// Get current device dimensions based on selected device
		const devices = {
			'desktop': { width: 1024, height: 768 },
			'laptop': { width: 1366, height: 768 },
			'tablet-landscape': { width: 1024, height: 768 },
			'tablet': { width: 768, height: 1024 },
			'mobile-landscape': { width: 667, height: 375 },
			'mobile': { width: 375, height: 667 },
			'iphone-14': { width: 390, height: 844 },
			'iphone-14-pro-max': { width: 430, height: 932 },
			'ipad-pro': { width: 1024, height: 1366 },
			'custom': { width: 800, height: 600 }
		};

		// If custom size, try to get from preview frame
		if (this.currentDevice === 'custom' && this.previewFrameWrapper) {
			const width = parseInt(this.previewFrameWrapper.style.width) || 800;
			const height = parseInt(this.previewFrameWrapper.style.height) || 600;
			return { width, height };
		}

		return devices[this.currentDevice as keyof typeof devices] || devices['desktop'];
	}

	private adjustZoom(delta: number) {
		this.zoomLevel = Math.max(25, Math.min(200, this.zoomLevel + delta));
		this.viewState.zoomLevel = this.zoomLevel;
		this.updatePreviewZoom();
		this.updateZoomDisplay();
	}

	private fitToWindow() {
		// Get current device dimensions
		const deviceDimensions = this.getCurrentDeviceDimensions();
		const targetWidth = deviceDimensions.width;
		const targetHeight = deviceDimensions.height;

		// Calculate optimal zoom to fit content in container
		const containerWidth = this.previewFrameContainer.offsetWidth;
		const containerHeight = this.previewFrameContainer.offsetHeight;

		// Calculate scale to fit both dimensions with padding
		const scaleX = (containerWidth - 80) / targetWidth;
		const scaleY = (containerHeight - 80) / targetHeight;
		const optimalScale = Math.min(scaleX, scaleY, 1);

		// Set zoom level (minimum 10%, maximum 100%)
		this.zoomLevel = Math.max(10, Math.min(100, Math.round(optimalScale * 100)));
		this.viewState.zoomLevel = this.zoomLevel;
		this.updatePreviewZoom();
		
		// Center the preview after fitting
		setTimeout(() => {
			const maxScrollLeft = this.previewFrameContainer.scrollWidth - this.previewFrameContainer.clientWidth;
			const maxScrollTop = this.previewFrameContainer.scrollHeight - this.previewFrameContainer.clientHeight;
			
			this.previewFrameContainer.scrollTo({
				left: maxScrollLeft / 2,
				top: maxScrollTop / 2,
				behavior: 'smooth'
			});
		}, 100);
		
		new Notice(`Fit to window: ${this.zoomLevel}%`);
	}

	private setDevicePreset(device: string, width?: number, height?: number) {
		this.currentDevice = device;
		this.viewState.currentDevice = device;
		
		if (width && height && this.previewFrameWrapper) {
			// Set the frame wrapper size
			this.previewFrameWrapper.style.width = `${width}px`;
			this.previewFrameWrapper.style.height = `${height}px`;
			// Ensure dimensions don't shrink below set size
			this.previewFrameWrapper.style.minWidth = `${width}px`;
			this.previewFrameWrapper.style.minHeight = `${height}px`;
			
			// Also set the iframe size to match
			if (this.previewFrame) {
				this.previewFrame.style.width = `${width}px`;
				this.previewFrame.style.height = `${height}px`;
			}
		}
		
		this.updateDevicePreset();
		this.updatePreviewZoom(); // Ensure zoom is applied correctly
	}

	private updatePreviewZoom() {
		if (this.previewFrameWrapper) {
			// Preserve existing device class when updating zoom
			const deviceClass = this.currentDevice;
			this.previewFrameWrapper.className = `html-css-editor-preview-frame-wrapper ${deviceClass} zoom-${this.zoomLevel}`;
			// Apply zoom via transform
			const scale = this.zoomLevel / 100;
			this.previewFrameWrapper.style.transform = `scale(${scale})`;
			this.previewFrameWrapper.style.transformOrigin = 'center center';
		}

		// Update PiP if active
		if (this.pipFrame && this.pipContainer) {
			this.pipFrame.style.transform = `scale(${this.zoomLevel / 100})`;
			this.pipFrame.style.transformOrigin = 'center center';
		}
		
		// Update zoom display
		this.updateZoomDisplay();
	}

	private updateDevicePreset() {
		if (this.previewFrameWrapper) {
			// Remove all existing device classes
			const allDeviceClasses = ['mobile', 'tablet', 'desktop', 'custom', 'laptop', 'tablet-landscape', 'tablet-portrait', 'mobile-landscape', 'mobile-portrait', 'iphone-14', 'iphone-14-pro-max', 'ipad-pro'];
			this.previewFrameWrapper.classList.remove(...allDeviceClasses);
			this.previewFrameWrapper.classList.add(this.currentDevice);
		}
	}

	private updateZoomDisplay() {
		if (this.zoomLevelDisplay) {
			this.zoomLevelDisplay.textContent = `${this.zoomLevel}%`;
		}
	}

	private updateDeviceButtons() {
		const deviceButtons = this.previewPane.querySelectorAll('.html-css-editor-device-btn');
		deviceButtons.forEach((btn, index) => {
			const devices = ['mobile', 'tablet', 'desktop'];
			btn.classList.toggle('active', devices[index] === this.currentDevice);
		});
	}

	private togglePictureInPicture() {
		if (this.viewState.isPipMode) {
			this.closePictureInPicture();
		} else {
			this.openPictureInPicture();
		}
	}

	private openPictureInPicture() {
		if (this.pipContainer) {
			return; // Already open
		}

		// Get current device dimensions
		const deviceDimensions = this.getCurrentDeviceDimensions();
		const scale = 0.4; // Scale down to 40% for PiP
		const pipWidth = Math.max(300, deviceDimensions.width * scale);
		const pipHeight = Math.max(200, deviceDimensions.height * scale + 40); // +40 for header

		// Create PiP container in the Obsidian workspace
		const workspaceEl = this.app.workspace.containerEl;
		this.pipContainer = workspaceEl.createEl('div', {
			cls: 'html-css-editor-pip-container'
		});

		// Set position and size based on current device
		this.pipContainer.addClass('html-css-editor-pip-container-positioned');
		
		// Create dynamic CSS for custom size
		const customSizeClass = `html-css-editor-pip-size-${pipWidth}x${pipHeight}`;
		this.pipContainer.addClass(customSizeClass);
		
		// Create or update custom CSS rule
		let styleEl = document.getElementById('html-css-editor-custom-styles');
		if (!styleEl) {
			styleEl = document.createElement('style');
			styleEl.id = 'html-css-editor-custom-styles';
			document.head.appendChild(styleEl);
		}
		const existingContent = styleEl.textContent || '';
		const newRule = `.${customSizeClass} { width: ${pipWidth}px !important; height: ${pipHeight}px !important; }`;
		if (!existingContent.includes(newRule)) {
			styleEl.textContent = existingContent + newRule;
		}

		// Create PiP header
		const pipHeader = this.pipContainer.createEl('div', {
			cls: 'html-css-editor-pip-header'
		});

		const pipTitle = pipHeader.createEl('div', {
			cls: 'html-css-editor-pip-title',
			text: 'Live Preview'
		});

		const pipControls = pipHeader.createEl('div', {
			cls: 'html-css-editor-pip-controls'
		});

		// Close button
		const closeBtn = pipControls.createEl('button', {
			cls: 'html-css-editor-pip-btn close',
			text: '×',
			attr: { 'title': 'Close' }
		});
		closeBtn.addEventListener('click', () => this.closePictureInPicture());

		// Create PiP content
		const pipContent = this.pipContainer.createEl('div', {
			cls: 'html-css-editor-pip-content'
		});

		// Make PiP content scrollable for panning
		pipContent.addClass('html-css-editor-pip-content');
		pipContent.addClass('html-css-editor-cursor-grab');

		// Create PiP iframe wrapper for proper sizing
		const pipFrameWrapper = pipContent.createEl('div', {
			cls: 'html-css-editor-pip-frame-wrapper'
		});
		pipFrameWrapper.addClass('html-css-editor-pip-frame-wrapper');

		// Create PiP iframe
		this.pipFrame = pipFrameWrapper.createEl('iframe', {
			cls: 'html-css-editor-pip-frame',
			attr: {
				sandbox: 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals',
				title: 'Picture-in-Picture Preview'
			}
		});

		// Set up dragging and resizing
		this.setupPipDragging(pipHeader);
		
		// Set up PiP panning
		this.setupPipPan(pipContent);

		// Update state
		this.viewState.isPipMode = true;

		// Hide main preview
		this.previewPane.addClass('html-css-editor-preview-pane-hidden');

		// Update PiP content
		this.updatePipPreview();

		new Notice('Picture-in-Picture mode enabled');
	}

	private closePictureInPicture() {
		if (!this.pipContainer) return;

		// Save position and size
		const rect = this.pipContainer.getBoundingClientRect();
		this.viewState.pipPosition = { x: rect.left, y: rect.top };
		this.viewState.pipSize = { width: rect.width, height: rect.height };

		// Remove PiP container
		this.pipContainer.remove();
		this.pipContainer = null;
		this.pipFrame = null;

		// Update state
		this.viewState.isPipMode = false;

		// Show main preview
		this.previewPane.removeClass('html-css-editor-preview-pane-hidden');
		this.previewPane.addClass('html-css-editor-display-flex');

		new Notice('Picture-in-Picture mode disabled');
	}

	private minimizePiP() {
		if (!this.pipContainer) return;

		const isMinimized = this.pipContainer.style.height === '32px';

		if (isMinimized) {
			// Restore
			this.pipContainer.style.height = `${this.viewState.pipSize.height}px`;
			this.pipContainer.querySelector('.html-css-editor-pip-content')?.setAttribute('style', 'display: block');
		} else {
			// Minimize
			this.pipContainer.style.height = '32px';
			this.pipContainer.querySelector('.html-css-editor-pip-content')?.setAttribute('style', 'display: none');
		}
	}

	private setupPipPan(pipContent: HTMLElement) {
		let isPanning = false;
		let spacePressed = false;
		let startX = 0;
		let startY = 0;
		let scrollLeft = 0;
		let scrollTop = 0;

		// Create overlay for PiP to capture events over iframe
		const pipOverlay = pipContent.createEl('div', {
			cls: 'html-css-editor-pip-overlay'
		});
		pipOverlay.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 1000;
			pointer-events: none;
			display: none;
		`;

		// Track spacebar for PiP - only when NOT typing in code editors
		const handleKeyDown = (e: KeyboardEvent) => {
			// Only enable spacebar pan when NOT typing in code editors
			const activeElement = document.activeElement;
			const isInCodeEditor = activeElement && (
				activeElement.closest('.cm-editor') || 
				activeElement.closest('.cm-content') ||
				activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA'
			);

			// Early return if in code editor - don't interfere with typing at all
			if (isInCodeEditor) {
				return;
			}

			if (e.code === 'Space' && !spacePressed && !isPanning) {
				spacePressed = true;
				pipOverlay.style.display = 'block';
				pipOverlay.style.pointerEvents = 'all';
				pipOverlay.style.cursor = 'grab';
				pipContent.style.cursor = 'grab';
				e.preventDefault();
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			// Only handle spacebar release when NOT in code editors
			const activeElement = document.activeElement;
			const isInCodeEditor = activeElement && (
				activeElement.closest('.cm-editor') || 
				activeElement.closest('.cm-content') ||
				activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA'
			);

			// Early return if in code editor
			if (isInCodeEditor) {
				return;
			}

			if (e.code === 'Space') {
				spacePressed = false;
				if (!isPanning) {
					pipOverlay.style.display = 'none';
					pipOverlay.style.pointerEvents = 'none';
					pipContent.style.cursor = 'default';
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('keyup', handleKeyUp);

		// Mouse down - start panning on overlay
		pipOverlay.addEventListener('mousedown', (e: MouseEvent) => {
			if (spacePressed) {
				isPanning = true;
				startX = e.clientX;
				startY = e.clientY;
				scrollLeft = pipContent.scrollLeft;
				scrollTop = pipContent.scrollTop;
				pipOverlay.style.cursor = 'grabbing';
				pipContent.style.cursor = 'grabbing';
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// Also handle on content for areas outside iframe
		pipContent.addEventListener('mousedown', (e: MouseEvent) => {
			if (spacePressed && e.target !== this.pipFrame) {
				isPanning = true;
				startX = e.clientX;
				startY = e.clientY;
				scrollLeft = pipContent.scrollLeft;
				scrollTop = pipContent.scrollTop;
				pipContent.style.cursor = 'grabbing';
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// Mouse move - pan the content (on document)
		document.addEventListener('mousemove', (e: MouseEvent) => {
			if (isPanning && spacePressed) {
				e.preventDefault();
				
				const deltaX = e.clientX - startX;
				const deltaY = e.clientY - startY;
				
				pipContent.scrollLeft = scrollLeft - deltaX;
				pipContent.scrollTop = scrollTop - deltaY;
			}
		});

		// Mouse up - stop panning
		const stopPanning = () => {
			if (isPanning) {
				isPanning = false;
				pipOverlay.style.cursor = spacePressed ? 'grab' : 'default';
				pipContent.style.cursor = spacePressed ? 'grab' : 'default';
				if (!spacePressed) {
					pipOverlay.style.display = 'none';
					pipOverlay.style.pointerEvents = 'none';
				}
			}
		};

		document.addEventListener('mouseup', stopPanning);

		// Ctrl+Scroll to zoom in PiP - on content
		pipContent.addEventListener('wheel', (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				e.stopPropagation();
				
				const delta = e.deltaY > 0 ? -10 : 10;
				this.adjustZoom(delta);
			}
		}, { passive: false });

		// Also on overlay
		pipOverlay.addEventListener('wheel', (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				e.stopPropagation();
				
				const delta = e.deltaY > 0 ? -10 : 10;
				this.adjustZoom(delta);
			}
		}, { passive: false });

		// Double-click to center
		pipContent.addEventListener('dblclick', (e: MouseEvent) => {
			e.preventDefault();
			const maxScrollLeft = pipContent.scrollWidth - pipContent.clientWidth;
			const maxScrollTop = pipContent.scrollHeight - pipContent.clientHeight;
			
			pipContent.scrollTo({
				left: maxScrollLeft / 2,
				top: maxScrollTop / 2,
				behavior: 'smooth'
			});
			new Notice('PiP centered');
		});

		// Cleanup
		this.register(() => {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('keyup', handleKeyUp);
		});
	}

	private setupPipDragging(header: HTMLElement) {
		let isDragging = false;
		let startX = 0;
		let startY = 0;
		let startLeft = 0;
		let startTop = 0;
		let animationFrame: number | null = null;

		const handleMouseMove = (e: MouseEvent) => {
			if (!isDragging || !this.pipContainer) return;

			// Use requestAnimationFrame for smooth dragging
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}

			animationFrame = requestAnimationFrame(() => {
				if (!this.pipContainer) return;

				const deltaX = e.clientX - startX;
				const deltaY = e.clientY - startY;

				// Get current container dimensions for better boundary checking
				const containerRect = this.pipContainer.getBoundingClientRect();
				const maxLeft = window.innerWidth - containerRect.width;
				const maxTop = window.innerHeight - containerRect.height;

				const newLeft = Math.max(0, Math.min(maxLeft, startLeft + deltaX));
				const newTop = Math.max(0, Math.min(maxTop, startTop + deltaY));

				// Use transform for better performance
				this.pipContainer.style.transform = `translate(${newLeft - startLeft}px, ${newTop - startTop}px)`;
			});
		};

		const handleMouseUp = () => {
			if (isDragging && this.pipContainer) {
				isDragging = false;

				// Apply final position and remove transform
				const currentTransform = this.pipContainer.style.transform;
				const transformMatch = currentTransform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);

				if (transformMatch) {
					const deltaX = parseFloat(transformMatch[1]);
					const deltaY = parseFloat(transformMatch[2]);

					this.pipContainer.style.left = `${startLeft + deltaX}px`;
					this.pipContainer.style.top = `${startTop + deltaY}px`;
					this.pipContainer.style.transform = '';
				}

				this.pipContainer.classList.remove('dragging');
				document.body.style.userSelect = '';
				document.body.style.cursor = '';

				// Clean up event listeners
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);

				if (animationFrame) {
					cancelAnimationFrame(animationFrame);
					animationFrame = null;
				}
			}
		};

		header.addEventListener('mousedown', (e) => {
			// Only allow dragging from header, not resize handles or buttons
			const target = e.target as HTMLElement;
			if (target.classList.contains('pip-resize-handle') ||
				target.classList.contains('html-css-editor-pip-btn')) {
				return;
			}

			isDragging = true;
			startX = e.clientX;
			startY = e.clientY;

			const rect = this.pipContainer!.getBoundingClientRect();
			startLeft = rect.left;
			startTop = rect.top;

			this.pipContainer!.classList.add('dragging');
			document.body.style.userSelect = 'none';
			document.body.style.cursor = 'grabbing';

			// Add event listeners
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);

			e.preventDefault();
			e.stopPropagation();
		});

		// Add resize handles
		this.setupPipResizeHandles();
	}

	private setupPipResizeHandles() {
		if (!this.pipContainer) return;

		// Create resize handles for all sides and corners
		const handles = [
			{ name: 'n', cursor: 'n-resize', position: 'top: -4px; left: 8px; right: 8px; height: 8px;' },
			{ name: 's', cursor: 's-resize', position: 'bottom: -4px; left: 8px; right: 8px; height: 8px;' },
			{ name: 'w', cursor: 'w-resize', position: 'left: -4px; top: 8px; bottom: 8px; width: 8px;' },
			{ name: 'e', cursor: 'e-resize', position: 'right: -4px; top: 8px; bottom: 8px; width: 8px;' },
			{ name: 'nw', cursor: 'nw-resize', position: 'top: -4px; left: -4px; width: 12px; height: 12px;' },
			{ name: 'ne', cursor: 'ne-resize', position: 'top: -4px; right: -4px; width: 12px; height: 12px;' },
			{ name: 'sw', cursor: 'sw-resize', position: 'bottom: -4px; left: -4px; width: 12px; height: 12px;' },
			{ name: 'se', cursor: 'se-resize', position: 'bottom: -4px; right: -4px; width: 12px; height: 12px;' }
		];

		handles.forEach(handle => {
			const resizeHandle = this.pipContainer!.createEl('div', {
				cls: `pip-resize-handle pip-resize-${handle.name}`,
				attr: {
					style: `position: absolute; ${handle.position} cursor: ${handle.cursor}; z-index: 10;`
				}
			});

			this.setupPipResizeHandle(resizeHandle, handle.name);
		});
	}

	private setupPipResizeHandle(handle: HTMLElement, direction: string) {
		let isResizing = false;
		let startX = 0;
		let startY = 0;
		let startWidth = 0;
		let startHeight = 0;
		let startLeft = 0;
		let startTop = 0;

		handle.addEventListener('mousedown', (e) => {
			if (!this.pipContainer) return;

			isResizing = true;
			startX = e.clientX;
			startY = e.clientY;

			const rect = this.pipContainer.getBoundingClientRect();
			startWidth = rect.width;
			startHeight = rect.height;
			startLeft = rect.left;
			startTop = rect.top;

			this.pipContainer.classList.add('resizing');
			document.body.style.userSelect = 'none';
			document.body.style.cursor = handle.style.cursor;
			e.preventDefault();
			e.stopPropagation();
		});

		document.addEventListener('mousemove', (e) => {
			if (!isResizing || !this.pipContainer) return;

			const deltaX = e.clientX - startX;
			const deltaY = e.clientY - startY;

			let newWidth = startWidth;
			let newHeight = startHeight;
			let newLeft = startLeft;
			let newTop = startTop;

			// Handle different resize directions
			if (direction.includes('e')) {
				newWidth = Math.max(250, Math.min(window.innerWidth - startLeft, startWidth + deltaX));
			}
			if (direction.includes('w')) {
				const maxDelta = startWidth - 250;
				const constrainedDelta = Math.max(-maxDelta, Math.min(startLeft, deltaX));
				newWidth = startWidth - constrainedDelta;
				newLeft = startLeft + constrainedDelta;
			}
			if (direction.includes('s')) {
				newHeight = Math.max(200, Math.min(window.innerHeight - startTop, startHeight + deltaY));
			}
			if (direction.includes('n')) {
				const maxDelta = startHeight - 200;
				const constrainedDelta = Math.max(-maxDelta, Math.min(startTop, deltaY));
				newHeight = startHeight - constrainedDelta;
				newTop = startTop + constrainedDelta;
			}

			// Apply new dimensions and position
			this.pipContainer.style.width = `${newWidth}px`;
			this.pipContainer.style.height = `${newHeight}px`;
			this.pipContainer.style.left = `${newLeft}px`;
			this.pipContainer.style.top = `${newTop}px`;

			// Update view state
			this.viewState.pipSize = { width: newWidth, height: newHeight };
			this.viewState.pipPosition = { x: newLeft, y: newTop };
		});

		document.addEventListener('mouseup', () => {
			if (isResizing && this.pipContainer) {
				isResizing = false;
				this.pipContainer.classList.remove('resizing');
				document.body.style.userSelect = '';
				document.body.style.cursor = '';
			}
		});
	}

	private updatePipPreview() {
		if (!this.pipFrame) return;

		const content = this.generatePreviewContent();
		this.renderPreviewContentToFrame(this.pipFrame, content);
		
		// Apply device-specific scaling to PiP
		const deviceDimensions = this.getCurrentDeviceDimensions();
		const pipContent = this.pipContainer?.querySelector('.html-css-editor-pip-content') as HTMLElement;
		
		if (pipContent) {
			const containerWidth = pipContent.offsetWidth;
			const containerHeight = pipContent.offsetHeight;
			
			// Calculate scale to fit device dimensions in PiP
			const scaleX = containerWidth / deviceDimensions.width;
			const scaleY = containerHeight / deviceDimensions.height;
			const scale = Math.min(scaleX, scaleY, 1);
			
			this.pipFrame.style.transform = `scale(${scale})`;
			this.pipFrame.style.width = `${deviceDimensions.width}px`;
			this.pipFrame.style.height = `${deviceDimensions.height}px`;
		}
	}

	private toggleFullscreen() {
		if (this.fullscreenOverlay) {
			this.closeFullscreen();
		} else {
			this.openFullscreen();
		}
	}

	private openFullscreen() {
		if (this.fullscreenOverlay) return;

		// Create fullscreen overlay
		this.fullscreenOverlay = document.body.createEl('div', {
			cls: 'html-css-editor-fullscreen-overlay'
		});

		// Create fullscreen header
		const fullscreenHeader = this.fullscreenOverlay.createEl('div', {
			cls: 'html-css-editor-fullscreen-header'
		});

		const fullscreenTitle = fullscreenHeader.createEl('div', {
			cls: 'html-css-editor-fullscreen-title',
			text: 'Fullscreen Preview'
		});

		const fullscreenControls = fullscreenHeader.createEl('div', {
			cls: 'html-css-editor-fullscreen-controls'
		});

		// Zoom controls in fullscreen
		const zoomOutBtn = fullscreenControls.createEl('button', {
			cls: 'html-css-editor-fullscreen-btn',
			text: 'Zoom Out',
		});
		zoomOutBtn.addEventListener('click', () => this.adjustZoom(-5));

		const zoomInBtn = fullscreenControls.createEl('button', {
			cls: 'html-css-editor-fullscreen-btn',
			text: 'Zoom In',
		});
		zoomInBtn.addEventListener('click', () => this.adjustZoom(5));

		const fitBtn = fullscreenControls.createEl('button', {
			cls: 'html-css-editor-fullscreen-btn',
			text: 'Fit to Screen',
		});
		fitBtn.addEventListener('click', () => this.fitToWindow());

		// Close button
		const closeBtn = fullscreenControls.createEl('button', {
			cls: 'html-css-editor-fullscreen-btn close',
			text: 'Close Fullscreen'
		});
		closeBtn.addEventListener('click', () => this.closeFullscreen());

		// Create fullscreen content
		const fullscreenContent = this.fullscreenOverlay.createEl('div', {
			cls: 'html-css-editor-fullscreen-content'
		});

		// Create fullscreen iframe
		const fullscreenFrame = fullscreenContent.createEl('iframe', {
			cls: 'html-css-editor-fullscreen-frame',
			attr: {
				sandbox: 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals',
				title: 'Fullscreen Preview'
			}
		});

		// Show overlay
		setTimeout(() => {
			this.fullscreenOverlay!.classList.add('active');
		}, 10);

		// Update fullscreen content
		const content = this.generatePreviewContent();
		this.renderPreviewContentToFrame(fullscreenFrame, content);

		// ESC key to close
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				this.closeFullscreen();
				document.removeEventListener('keydown', handleEscape);
			}
		};
		document.addEventListener('keydown', handleEscape);

		new Notice('Fullscreen mode enabled (Press ESC to exit)');
	}

	private closeFullscreen() {
		if (!this.fullscreenOverlay) return;

		this.fullscreenOverlay.classList.remove('active');

		setTimeout(() => {
			if (this.fullscreenOverlay) {
				this.fullscreenOverlay.remove();
				this.fullscreenOverlay = null;
			}
		}, 300);

		new Notice('Fullscreen mode disabled');
	}

	private renderPreviewContentToFrame(frame: HTMLIFrameElement, content: string) {
		try {
			const doc = frame.contentDocument;
			if (doc) {
				doc.open();
				doc.write(content);
				doc.close();
			}
		} catch (error) {
			console.error('Failed to render preview content to frame:', error);
		}
	}

	// Store reference to zoom level display
	private zoomLevelDisplay: HTMLElement | null = null;

	private handleError(context: string, error: any) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`HTML/CSS Editor View Error [${context}]:`, error);

		// Show user-friendly notice
		if (this.app && this.app.workspace) {
			new Notice(`HTML/CSS Editor: ${errorMessage}`);
		}
	}

	private showHelpModal() {
		const modal = new Modal(this.app);
		modal.titleEl.setText('HTML/CSS Editor - Quick Guide');
		
		const { contentEl } = modal;
		contentEl.empty();
		contentEl.style.maxHeight = '70vh';
		contentEl.style.overflowY = 'auto';
		
		// Intro
		contentEl.createEl('p', { 
			text: 'Welcome to the HTML/CSS Editor! Here\'s everything you need to know to get the most out of it.',
			cls: 'help-intro'
		}).style.cssText = 'margin-bottom: 20px; color: var(--text-muted);';
		
		// Basics
		const basicsSection = contentEl.createDiv();
		basicsSection.createEl('h3', { text: 'The Basics' }).style.marginTop = '0';
		basicsSection.createEl('p', { text: 'Write HTML in the top editor, CSS in the bottom editor. Your changes show up instantly in the preview on the right.' });
		
		// Sass
		const sassSection = contentEl.createDiv();
		sassSection.createEl('h3', { text: 'Sass Support' });
		sassSection.createEl('p', { text: 'Toggle the CSS/Sass switch to use Sass. You get variables, mixins, nesting - all the good stuff. Click "Templates" for common patterns, or "Show Compiled CSS" to see the output.' });
		
		// Colors
		const colorSection = contentEl.createDiv();
		colorSection.createEl('h3', { text: 'Color Picker' });
		colorSection.createEl('p', { text: 'Click any color swatch in your CSS to open a color picker. No more guessing hex codes.' });
		
		// Animations
		const animSection = contentEl.createDiv();
		animSection.createEl('h3', { text: 'Animations' });
		const animList = animSection.createEl('ul');
		animList.createEl('li', { text: 'Animations: Browse 20+ ready-made animations' });
		animList.createEl('li', { text: 'Builder: Create custom animations visually' });
		animList.createEl('li', { text: 'Inspector: Check animation performance' });
		
		// Responsive
		const respSection = contentEl.createDiv();
		respSection.createEl('h3', { text: 'Responsive Testing' });
		respSection.createEl('p', { text: 'Use the device dropdown to test different screen sizes. Click "Rotate" to flip between portrait and landscape.' });
		
		// Navigation
		const navSection = contentEl.createDiv();
		navSection.createEl('h3', { text: 'Preview Navigation' });
		const navList = navSection.createEl('ul');
		navList.createEl('li', { text: 'Spacebar + Drag: Pan around (when not typing)' });
		navList.createEl('li', { text: 'Ctrl + Scroll: Zoom in/out' });
		navList.createEl('li', { text: 'Double-click: Center the preview' });
		navList.createEl('li', { text: '+/- buttons: Precise zoom control' });
		
		// Saving
		const saveSection = contentEl.createDiv();
		saveSection.createEl('h3', { text: 'Saving Your Work' });
		const saveList = saveSection.createEl('ul');
		saveList.createEl('li', { text: 'Save Project: Save as a markdown file in your vault' });
		saveList.createEl('li', { text: 'Load Project: Open any saved project' });
		saveList.createEl('li', { text: 'Save HTML+CSS File: Export to a single HTML file' });
		saveList.createEl('li', { text: 'Copy HTML+CSS: Copy to clipboard' });
		
		// Shortcuts
		const shortcutSection = contentEl.createDiv();
		shortcutSection.createEl('h3', { text: 'Keyboard Shortcuts' });
		const shortcutList = shortcutSection.createEl('ul');
		shortcutList.createEl('li', { text: 'Ctrl+S: Save as HTML file' });
		shortcutList.createEl('li', { text: 'F5: Refresh preview' });
		
		// Tips
		const tipsSection = contentEl.createDiv();
		tipsSection.createEl('h3', { text: 'Pro Tips' });
		const tipsList = tipsSection.createEl('ul');
		tipsList.createEl('li', { text: 'Drag the divider between editors to resize panels' });
		tipsList.createEl('li', { text: 'Use PiP mode to keep the preview visible while coding' });
		tipsList.createEl('li', { text: 'Projects are just markdown files - edit them like any other note' });
		tipsList.createEl('li', { text: 'The preview updates as you type with a small delay' });
		
		// Close button
		const closeBtn = contentEl.createEl('button', { 
			text: 'Got it!',
			cls: 'mod-cta'
		});
		closeBtn.style.cssText = 'margin-top: 20px; width: 100%;';
		closeBtn.addEventListener('click', () => modal.close());
		
		modal.open();
	}
}

// Modal for entering project name
class ProjectNameModal extends Modal {
	private result: string = '';
	private onSubmit: (result: string | null) => void;

	constructor(app: App, onSubmit: (result: string | null) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Save Project' });

		new Setting(contentEl)
			.setName('Project name')
			.setDesc('Enter a name for your project')
			.addText(text => {
				text.setPlaceholder('my-awesome-project')
					.onChange(value => {
						this.result = value;
					});
				text.inputEl.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						this.submit();
					}
				});
				// Focus the input
				setTimeout(() => text.inputEl.focus(), 10);
			});

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
					this.onSubmit(null);
				}))
			.addButton(btn => btn
				.setButtonText('Next')
				.setCta()
				.onClick(() => {
					this.submit();
				}));
	}

	private submit() {
		if (this.result.trim()) {
			this.close();
			this.onSubmit(this.result.trim());
		} else {
			new Notice('Please enter a project name');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Modal for selecting folder
class FolderSelectionModal extends FuzzySuggestModal<TFolder | null> {
	private onSubmit: (result: string | null) => void;

	constructor(app: App, onSubmit: (result: string | null) => void) {
		super(app);
		this.onSubmit = onSubmit;
		this.setPlaceholder('Select folder');
		this.setInstructions([
			{ command: '↑↓', purpose: 'Navigate' },
			{ command: '↵', purpose: 'Select' },
			{ command: 'esc', purpose: 'Cancel' }
		]);
	}

	getItems(): (TFolder | null)[] {
		const folders = this.app.vault.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder);
		
		// Add vault root as first option
		return [null, ...folders];
	}

	getItemText(item: TFolder | null): string {
		if (item === null) {
			return '📁 Vault Root';
		}
		return `📁 ${item.path}`;
	}

	onChooseItem(item: TFolder | null): void {
		this.onSubmit(item ? item.path : '');
	}
}

// Modal for confirming overwrite
class ConfirmModal extends Modal {
	private title: string;
	private message: string;
	private onSubmit: (result: boolean) => void;

	constructor(app: App, title: string, message: string, onSubmit: (result: boolean) => void) {
		super(app);
		this.title = title;
		this.message = message;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: this.title });
		contentEl.createEl('p', { text: this.message });

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
					this.onSubmit(false);
				}))
			.addButton(btn => btn
				.setButtonText('Overwrite')
				.setWarning()
				.onClick(() => {
					this.close();
					this.onSubmit(true);
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Modal for selecting project file to load
class ProjectFileModal extends FuzzySuggestModal<TFile> {
	private files: TFile[];
	private onSubmit: (result: TFile | null) => void;

	constructor(app: App, files: TFile[], onSubmit: (result: TFile | null) => void) {
		super(app);
		this.files = files;
		this.onSubmit = onSubmit;
		this.setPlaceholder('Search for a project to load...');
		this.setInstructions([
			{ command: '↑↓', purpose: 'Navigate' },
			{ command: '↵', purpose: 'Load project' },
			{ command: 'esc', purpose: 'Cancel' }
		]);
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(item: TFile): string {
		return `${item.basename} (${item.parent?.path || 'root'})`;
	}

	onChooseItem(item: TFile): void {
		this.onSubmit(item);
	}

	onClose() {
		super.onClose();
	}
}


// Modal for custom device size
class CustomSizeModal extends Modal {
	private width: number = 800;
	private height: number = 600;
	private onSubmit: (width: number | null, height: number | null) => void;

	constructor(app: App, onSubmit: (width: number | null, height: number | null) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Custom Device Size' });
		contentEl.createEl('p', { text: 'Enter custom width and height for the preview' });

		new Setting(contentEl)
			.setName('Width (px)')
			.addText(text => {
				text.setPlaceholder('800')
					.setValue('800')
					.onChange(value => {
						const num = parseInt(value);
						if (!isNaN(num) && num > 0) {
							this.width = num;
						}
					});
			});

		new Setting(contentEl)
			.setName('Height (px)')
			.addText(text => {
				text.setPlaceholder('600')
					.setValue('600')
					.onChange(value => {
						const num = parseInt(value);
						if (!isNaN(num) && num > 0) {
							this.height = num;
						}
					});
			});

		// Common presets
		contentEl.createEl('p', { 
			text: 'Quick presets:', 
			cls: 'setting-item-description' 
		});

		const presetsContainer = contentEl.createEl('div');
		presetsContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px;';

		const presets = [
			{ label: '4K', width: 3840, height: 2160 },
			{ label: 'Full HD', width: 1920, height: 1080 },
			{ label: 'HD', width: 1280, height: 720 },
			{ label: 'iPad', width: 1024, height: 768 },
			{ label: 'iPhone', width: 375, height: 667 }
		];

		presets.forEach(preset => {
			const btn = presetsContainer.createEl('button', {
				text: `${preset.label} (${preset.width}×${preset.height})`,
				cls: 'mod-cta'
			});
			btn.style.cssText = 'padding: 4px 8px; font-size: 12px;';
			btn.addEventListener('click', () => {
				this.width = preset.width;
				this.height = preset.height;
				this.close();
				this.onSubmit(this.width, this.height);
			});
		});

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
					this.onSubmit(null, null);
				}))
			.addButton(btn => btn
				.setButtonText('Apply')
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit(this.width, this.height);
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
