import { Modal, App, Setting, FuzzySuggestModal } from 'obsidian';
import { ANIMATION_PRESETS, EASING_FUNCTIONS } from './animationSystem';

// Animation presets modal - Simplified for better visibility
export class AnimationPresetsModal extends Modal {
	private onSubmit: (preset: any) => void;
	private presets: any[];

	constructor(app: App, onSubmit: (preset: any) => void) {
		super(app);
		this.onSubmit = onSubmit;
		this.presets = Object.entries(ANIMATION_PRESETS).map(([key, preset]) => ({
			key,
			...preset
		}));
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		
		contentEl.createEl('h2', { text: 'Animation Presets' });
		
		// Search input
		const searchContainer = contentEl.createDiv({ cls: 'animation-search-container' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search animations...',
			cls: 'animation-search-input'
		});
		searchInput.style.cssText = `
			width: 100%;
			padding: 8px 12px;
			margin-bottom: 16px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 6px;
			background: var(--background-primary);
			color: var(--text-normal);
			font-size: 14px;
		`;
		
		// Presets container
		const presetsContainer = contentEl.createDiv({ cls: 'animation-presets-grid' });
		presetsContainer.style.cssText = `
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
			gap: 12px;
			max-height: 500px;
			overflow-y: auto;
			padding: 4px;
		`;
		
		// Render all presets
		const renderPresets = (filter: string = '') => {
			presetsContainer.empty();
			
			const filtered = this.presets.filter(preset => 
				preset.name.toLowerCase().includes(filter.toLowerCase()) ||
				preset.category.toLowerCase().includes(filter.toLowerCase())
			);
			
			filtered.forEach(preset => {
				const item = presetsContainer.createDiv({ cls: 'animation-preset-card' });
				item.style.cssText = `
					padding: 12px;
					border: 1px solid var(--background-modifier-border);
					border-radius: 8px;
					background: var(--background-primary);
					cursor: pointer;
					transition: all 0.2s ease;
				`;
				
				item.addEventListener('mouseenter', () => {
					item.style.background = 'var(--background-modifier-hover)';
					item.style.transform = 'translateY(-2px)';
					item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
				});
				
				item.addEventListener('mouseleave', () => {
					item.style.background = 'var(--background-primary)';
					item.style.transform = 'translateY(0)';
					item.style.boxShadow = 'none';
				});
				
				// Name
				const name = item.createEl('div', { 
					text: preset.name,
					cls: 'animation-preset-name'
				});
				name.style.cssText = `
					font-weight: 600;
					font-size: 14px;
					color: var(--text-normal);
					margin-bottom: 6px;
				`;
				
				// Category badge
				const category = item.createEl('div', { 
					text: preset.category,
					cls: 'animation-preset-category'
				});
				category.style.cssText = `
					display: inline-block;
					font-size: 10px;
					padding: 3px 8px;
					border-radius: 12px;
					background: var(--interactive-accent);
					color: var(--text-on-accent);
					text-transform: uppercase;
					margin-bottom: 8px;
				`;
				
				// Usage
				const usage = item.createEl('code', { 
					text: preset.usage,
					cls: 'animation-usage-code'
				});
				usage.style.cssText = `
					display: block;
					font-size: 11px;
					color: var(--text-muted);
					background: var(--background-secondary);
					padding: 4px 6px;
					border-radius: 4px;
					margin-top: 8px;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				`;
				
				item.addEventListener('click', () => {
					this.onSubmit(preset);
					this.close();
				});
			});
			
			if (filtered.length === 0) {
				presetsContainer.createEl('div', {
					text: 'No animations found',
					cls: 'animation-no-results'
				}).style.cssText = `
					grid-column: 1 / -1;
					text-align: center;
					padding: 40px;
					color: var(--text-muted);
				`;
			}
		};
		
		// Initial render
		renderPresets();
		
		// Search functionality
		searchInput.addEventListener('input', () => {
			renderPresets(searchInput.value);
		});
		
		// Focus search input
		searchInput.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Animation builder modal
export class AnimationBuilderModal extends Modal {
	private onSubmit: (css: string) => void;
	private animationName: string = 'myAnimation';
	private duration: number = 1;
	private easing: string = 'ease';
	private delay: number = 0;
	private iterations: string = '1';
	private direction: string = 'normal';
	private fillMode: string = 'none';
	private keyframes: Array<{ percent: number; properties: string }> = [
		{ percent: 0, properties: 'transform: translateX(0);' },
		{ percent: 100, properties: 'transform: translateX(100px);' }
	];

	constructor(app: App, onSubmit: (css: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('animation-builder-modal');

		contentEl.createEl('h2', { text: 'Animation Builder' });

		// Animation properties
		this.createAnimationSettings(contentEl);
		
		// Keyframes editor
		this.createKeyframesEditor(contentEl);
		
		// Preview area
		this.createPreviewArea(contentEl);
		
		// Buttons
		this.createButtons(contentEl);

		// Add styles
		this.addBuilderStyles();
	}

	private createAnimationSettings(container: HTMLElement) {
		const settingsSection = container.createDiv({ cls: 'animation-settings' });
		settingsSection.createEl('h3', { text: 'Animation Properties' });

		// Animation name
		new Setting(settingsSection)
			.setName('Animation Name')
			.setDesc('Name for your animation')
			.addText(text => {
				text.setValue(this.animationName)
					.onChange(value => {
						this.animationName = value || 'myAnimation';
						this.updatePreview();
					});
			});

		// Duration
		const durationSetting = new Setting(settingsSection)
			.setName('Duration')
			.setDesc('Animation duration in seconds');
		
		durationSetting.addSlider(slider => {
			slider.setLimits(0.1, 10, 0.1)
				.setValue(this.duration)
				.onChange(value => {
					this.duration = value;
					durationSetting.setName(`Duration: ${value.toFixed(1)}s`);
					this.updatePreview();
				})
				.showTooltip();
			// Set initial display
			durationSetting.setName(`Duration: ${this.duration.toFixed(1)}s`);
		});

		// Easing
		new Setting(settingsSection)
			.setName('Easing')
			.setDesc('Animation timing function')
			.addDropdown(dropdown => {
				Object.entries(EASING_FUNCTIONS).forEach(([name, value]) => {
					dropdown.addOption(value, name);
				});
				dropdown.setValue(this.easing)
					.onChange(value => {
						this.easing = value;
						this.updatePreview();
					});
			});

		// Delay
		const delaySetting = new Setting(settingsSection)
			.setName('Delay')
			.setDesc('Delay before animation starts (seconds)');
		
		delaySetting.addSlider(slider => {
			slider.setLimits(0, 5, 0.1)
				.setValue(this.delay)
				.onChange(value => {
					this.delay = value;
					delaySetting.setName(`Delay: ${value.toFixed(1)}s`);
					this.updatePreview();
				})
				.showTooltip();
			// Set initial display
			delaySetting.setName(`Delay: ${this.delay.toFixed(1)}s`);
		});

		// Iterations
		new Setting(settingsSection)
			.setName('Iterations')
			.setDesc('Number of times to repeat (or "infinite")')
			.addDropdown(dropdown => {
				dropdown.addOption('1', '1 time')
					.addOption('2', '2 times')
					.addOption('3', '3 times')
					.addOption('5', '5 times')
					.addOption('infinite', 'Infinite')
					.setValue(this.iterations)
					.onChange(value => {
						this.iterations = value;
						this.updatePreview();
					});
			});

		// Direction
		new Setting(settingsSection)
			.setName('Direction')
			.setDesc('Animation direction')
			.addDropdown(dropdown => {
				dropdown.addOption('normal', 'Normal')
					.addOption('reverse', 'Reverse')
					.addOption('alternate', 'Alternate')
					.addOption('alternate-reverse', 'Alternate Reverse')
					.setValue(this.direction)
					.onChange(value => {
						this.direction = value;
						this.updatePreview();
					});
			});

		// Fill mode
		new Setting(settingsSection)
			.setName('Fill Mode')
			.setDesc('How animation applies styles before/after execution')
			.addDropdown(dropdown => {
				dropdown.addOption('none', 'None')
					.addOption('forwards', 'Forwards')
					.addOption('backwards', 'Backwards')
					.addOption('both', 'Both')
					.setValue(this.fillMode)
					.onChange(value => {
						this.fillMode = value;
						this.updatePreview();
					});
			});
	}

	private createKeyframesEditor(container: HTMLElement) {
		const keyframesSection = container.createDiv({ cls: 'keyframes-editor' });
		keyframesSection.createEl('h3', { text: 'Keyframes' });

		const keyframesContainer = keyframesSection.createDiv({ cls: 'keyframes-container' });
		
		this.renderKeyframes(keyframesContainer);

		// Add keyframe button
		const addButton = keyframesSection.createEl('button', {
			text: '+ Add Keyframe',
			cls: 'mod-cta'
		});
		addButton.addEventListener('click', () => {
			this.keyframes.push({ percent: 50, properties: 'transform: scale(1.1);' });
			this.keyframes.sort((a, b) => a.percent - b.percent);
			this.renderKeyframes(keyframesContainer);
			this.updatePreview();
		});
	}

	private renderKeyframes(container: HTMLElement) {
		container.empty();

		this.keyframes.forEach((keyframe, index) => {
			const keyframeEl = container.createDiv({ cls: 'keyframe-item' });
			
			// Percent input
			const percentInput = keyframeEl.createEl('input', {
				type: 'number',
				value: keyframe.percent.toString(),
				attr: { min: '0', max: '100', step: '1' }
			});
			percentInput.style.cssText = 'width: 60px; margin-right: 10px;';
			percentInput.addEventListener('input', () => {
				keyframe.percent = parseInt(percentInput.value) || 0;
				this.keyframes.sort((a, b) => a.percent - b.percent);
				this.renderKeyframes(container);
				this.updatePreview();
			});

			// Percent label
			keyframeEl.createSpan({ text: '% { ', cls: 'keyframe-syntax' });

			// Properties input
			const propertiesInput = keyframeEl.createEl('input', {
				type: 'text',
				value: keyframe.properties,
				placeholder: 'transform: translateX(50px); opacity: 0.5;'
			});
			propertiesInput.style.cssText = 'flex: 1; margin: 0 10px;';
			propertiesInput.addEventListener('input', () => {
				keyframe.properties = propertiesInput.value;
				this.updatePreview();
			});

			// Closing brace
			keyframeEl.createSpan({ text: ' }', cls: 'keyframe-syntax' });

			// Delete button
			if (this.keyframes.length > 2) {
				const deleteBtn = keyframeEl.createEl('button', {
					text: '×',
					cls: 'keyframe-delete'
				});
				deleteBtn.style.cssText = 'margin-left: 10px; color: var(--text-error);';
				deleteBtn.addEventListener('click', () => {
					this.keyframes.splice(index, 1);
					this.renderKeyframes(container);
					this.updatePreview();
				});
			}
		});
	}

	private createPreviewArea(container: HTMLElement) {
		const previewSection = container.createDiv({ cls: 'animation-preview-section' });
		previewSection.createEl('h3', { text: 'Preview' });

		const previewContainer = previewSection.createDiv({ cls: 'animation-preview-container' });
		previewContainer.style.cssText = `
			width: 100%;
			height: 100px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			position: relative;
			background: var(--background-secondary);
			overflow: hidden;
		`;

		const previewElement = previewContainer.createDiv({ cls: 'animation-preview-element' });
		previewElement.style.cssText = `
			width: 40px;
			height: 40px;
			background: var(--interactive-accent);
			border-radius: 4px;
			position: absolute;
			top: 30px;
			left: 20px;
		`;

		// Control buttons
		const controls = previewSection.createDiv({ cls: 'animation-controls' });
		controls.style.cssText = 'display: flex; gap: 10px; margin-top: 10px;';

		const playBtn = controls.createEl('button', { text: 'Play', cls: 'mod-cta' });
		const pauseBtn = controls.createEl('button', { text: 'Pause' });
		const resetBtn = controls.createEl('button', { text: 'Reset' });

		playBtn.addEventListener('click', () => {
			// Reset and play animation
			previewElement.style.animation = 'none';
			setTimeout(() => {
				if (this.previewElement) {
					this.previewElement.style.animation = `${this.animationName} ${this.duration}s ${this.easing} ${this.delay}s ${this.iterations} ${this.direction} ${this.fillMode}`;
					this.previewElement.style.animationPlayState = 'running';
				}
			}, 10);
		});

		pauseBtn.addEventListener('click', () => {
			previewElement.style.animationPlayState = 'paused';
		});

		resetBtn.addEventListener('click', () => {
			previewElement.style.animation = 'none';
			setTimeout(() => this.updatePreview(), 10);
		});

		this.previewElement = previewElement;
		this.updatePreview();
	}

	private previewElement: HTMLElement | null = null;

	private updatePreview() {
		if (!this.previewElement) return;

		const css = this.generateAnimationCSS();
		
		// Add keyframes to document
		const styleId = 'animation-builder-preview';
		let style = document.getElementById(styleId) as HTMLStyleElement;
		if (!style) {
			style = document.createElement('style');
			style.id = styleId;
			document.head.appendChild(style);
		}
		
		style.textContent = css;
		
		// Apply animation
		this.previewElement.style.animation = 'none';
		setTimeout(() => {
			if (this.previewElement) {
				this.previewElement.style.animation = `${this.animationName} ${this.duration}s ${this.easing} ${this.delay}s ${this.iterations} ${this.direction} ${this.fillMode}`;
			}
		}, 10);
	}

	private generateAnimationCSS(): string {
		const keyframesCSS = this.keyframes
			.map(kf => `  ${kf.percent}% { ${kf.properties} }`)
			.join('\n');

		return `@keyframes ${this.animationName} {
${keyframesCSS}
}

.${this.animationName} {
  animation: ${this.animationName} ${this.duration}s ${this.easing} ${this.delay}s ${this.iterations} ${this.direction} ${this.fillMode};
}`;
	}

	private createButtons(container: HTMLElement) {
		const buttonContainer = container.createDiv({ cls: 'animation-builder-buttons' });
		buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;';

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const insertBtn = buttonContainer.createEl('button', { text: 'Insert Animation', cls: 'mod-cta' });
		insertBtn.addEventListener('click', () => {
			const css = this.generateAnimationCSS();
			this.onSubmit(css);
			this.close();
		});
	}

	private addBuilderStyles() {
		const style = document.createElement('style');
		style.textContent = `
			.animation-builder-modal {
				max-width: 800px;
				max-height: 80vh;
				overflow-y: auto;
			}
			
			.animation-settings, .keyframes-editor, .animation-preview-section {
				margin-bottom: 20px;
				padding: 15px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 6px;
			}
			
			.keyframe-item {
				display: flex;
				align-items: center;
				margin-bottom: 10px;
				padding: 8px;
				background: var(--background-secondary);
				border-radius: 4px;
			}
			
			.keyframe-syntax {
				color: var(--text-muted);
				font-family: monospace;
			}
			
			.keyframe-delete {
				background: none;
				border: none;
				cursor: pointer;
				font-size: 16px;
				font-weight: bold;
			}
			
			.animation-preset-item {
				padding: 8px;
			}
			
			.animation-preset-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 4px;
			}
			
			.animation-preset-name {
				font-weight: 500;
			}
			
			.animation-preset-category {
				font-size: 11px;
				padding: 2px 6px;
				border-radius: 3px;
				background: var(--background-modifier-border);
			}
			
			.category-entrance { background: #e3f2fd; color: #1976d2; }
			.category-attention { background: #fff3e0; color: #f57c00; }
			.category-loading { background: #f3e5f5; color: #7b1fa2; }
			.category-hover { background: #e8f5e8; color: #388e3c; }
			
			.animation-usage-code {
				font-size: 11px;
				background: var(--background-modifier-border);
				padding: 2px 4px;
				border-radius: 2px;
			}
		`;
		document.head.appendChild(style);
	}

	onClose() {
		// Clean up preview styles
		const style = document.getElementById('animation-builder-preview');
		if (style) {
			style.remove();
		}
		
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Animation inspector modal
export class AnimationInspectorModal extends Modal {
	private performanceData: Array<{ name: string; fps: number; duration: number }> = [];

	constructor(app: App, performanceData: Array<{ name: string; fps: number; duration: number }>) {
		super(app);
		this.performanceData = performanceData;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Animation Inspector' });

		if (this.performanceData.length === 0) {
			contentEl.createEl('p', { text: 'No animations detected in the preview.' });
			return;
		}

		// Performance table
		const table = contentEl.createEl('table', { cls: 'animation-performance-table' });
		table.style.cssText = 'width: 100%; border-collapse: collapse;';

		// Header
		const header = table.createEl('thead');
		const headerRow = header.createEl('tr');
		headerRow.createEl('th', { text: 'Animation' });
		headerRow.createEl('th', { text: 'FPS' });
		headerRow.createEl('th', { text: 'Duration' });
		headerRow.createEl('th', { text: 'Status' });

		// Body
		const body = table.createEl('tbody');
		this.performanceData.forEach(data => {
			const row = body.createEl('tr');
			row.createEl('td', { text: data.name });
			
			const fpsCell = row.createEl('td', { text: data.fps.toString() });
			if (data.fps < 30) {
				fpsCell.style.color = 'var(--text-error)';
			} else if (data.fps < 50) {
				fpsCell.style.color = 'var(--text-warning)';
			} else {
				fpsCell.style.color = 'var(--text-success)';
			}
			
			row.createEl('td', { text: `${(data.duration / 1000).toFixed(1)}s` });
			
			const statusCell = row.createEl('td');
			if (data.fps >= 50) {
				statusCell.createSpan({ text: '✅ Smooth', cls: 'status-good' });
			} else if (data.fps >= 30) {
				statusCell.createSpan({ text: '⚠️ Acceptable', cls: 'status-warning' });
			} else {
				statusCell.createSpan({ text: '❌ Choppy', cls: 'status-error' });
			}
		});

		// Add table styles
		const style = document.createElement('style');
		style.textContent = `
			.animation-performance-table th,
			.animation-performance-table td {
				padding: 8px 12px;
				text-align: left;
				border-bottom: 1px solid var(--background-modifier-border);
			}
			
			.animation-performance-table th {
				background: var(--background-secondary);
				font-weight: 500;
			}
			
			.status-good { color: var(--text-success); }
			.status-warning { color: var(--text-warning); }
			.status-error { color: var(--text-error); }
		`;
		document.head.appendChild(style);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}