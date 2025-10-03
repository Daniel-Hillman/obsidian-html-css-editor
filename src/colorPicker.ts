import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, Range } from '@codemirror/state';

// Color regex patterns
const COLOR_PATTERNS = [
	// Hex colors
	/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
	// RGB/RGBA
	/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g,
	// HSL/HSLA
	/hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([\d.]+)\s*)?\)/g,
	// Named colors (common ones)
	/\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|brown|cyan|magenta|lime|navy|teal|olive|maroon|aqua|fuchsia|silver|gold)\b/gi
];

// Color swatch widget
class ColorSwatchWidget extends WidgetType {
	constructor(readonly color: string) {
		super();
	}

	toDOM() {
		const swatch = document.createElement('span');
		swatch.className = 'cm-color-swatch';
		swatch.style.cssText = `
			display: inline-block;
			width: 12px;
			height: 12px;
			border-radius: 2px;
			border: 1px solid rgba(0,0,0,0.2);
			margin: 0 2px 0 4px;
			vertical-align: middle;
			cursor: pointer;
			background-color: ${this.color};
			position: relative;
			z-index: 1;
		`;
		swatch.title = `Click to edit color: ${this.color}`;
		return swatch;
	}

	eq(other: ColorSwatchWidget) {
		return other.color === this.color;
	}

	ignoreEvent() {
		return false;
	}
}

// Find colors in text
function findColors(text: string): Array<{ from: number; to: number; color: string }> {
	const colors: Array<{ from: number; to: number; color: string }> = [];
	
	COLOR_PATTERNS.forEach(pattern => {
		const regex = new RegExp(pattern.source, pattern.flags);
		let match;
		while ((match = regex.exec(text)) !== null) {
			colors.push({
				from: match.index,
				to: match.index + match[0].length,
				color: match[0]
			});
		}
	});

	return colors;
}

// Create decorations for colors
function createColorDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const text = view.state.doc.toString();
	const colors = findColors(text);

	colors.forEach(({ from, to, color }) => {
		decorations.push(
			Decoration.widget({
				widget: new ColorSwatchWidget(color),
				side: 1,
				block: false
			}).range(to)
		);
	});

	return Decoration.set(decorations);
}

// Color picker plugin with better persistence
export const colorPickerPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		private updateTimeout: any = null;

		constructor(view: EditorView) {
			this.decorations = createColorDecorations(view);
		}

		update(update: ViewUpdate) {
			// Update decorations immediately when document changes
			if (update.docChanged || update.viewportChanged) {
				// Clear any pending timeout
				if (this.updateTimeout) {
					clearTimeout(this.updateTimeout);
					this.updateTimeout = null;
				}
				// Update decorations immediately for better responsiveness
				this.decorations = createColorDecorations(update.view);
			}
		}

		destroy() {
			if (this.updateTimeout) {
				clearTimeout(this.updateTimeout);
			}
		}
	},
	{
		decorations: v => v.decorations,
		eventHandlers: {
			click: (e, view) => {
				const target = e.target as HTMLElement;
				if (target.classList.contains('cm-color-swatch')) {
					e.preventDefault();
					e.stopPropagation();
					
					// Get the color from the title attribute (more reliable)
					const titleMatch = target.title.match(/Click to edit color: (.+)/);
					const color = titleMatch ? titleMatch[1] : target.style.backgroundColor;
					
					showColorPicker(view, color, target);
					return true;
				}
				return false;
			}
		}
	}
);

// Show color picker modal
function showColorPicker(view: EditorView, currentColor: string, swatchEl: HTMLElement) {
	// Create color picker overlay
	const overlay = document.createElement('div');
	overlay.className = 'cm-color-picker-overlay';
	overlay.style.cssText = `
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0,0,0,0.3);
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
	`;

	const picker = document.createElement('div');
	picker.className = 'cm-color-picker';
	picker.style.cssText = `
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 8px 24px rgba(0,0,0,0.3);
		min-width: 280px;
	`;

	// Title
	const title = document.createElement('h3');
	title.textContent = 'Pick a Color';
	title.style.cssText = 'margin: 0 0 15px 0; color: var(--text-normal);';
	picker.appendChild(title);

	// Color input
	const colorInput = document.createElement('input');
	colorInput.type = 'color';
	colorInput.value = normalizeColorToHex(currentColor);
	colorInput.style.cssText = `
		width: 100%;
		height: 50px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		margin-bottom: 15px;
	`;
	picker.appendChild(colorInput);

	// Text input for manual entry
	const textInput = document.createElement('input');
	textInput.type = 'text';
	textInput.value = currentColor;
	textInput.style.cssText = `
		width: 100%;
		padding: 8px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-family: monospace;
		margin-bottom: 15px;
	`;
	picker.appendChild(textInput);

	// Sync inputs
	colorInput.addEventListener('input', () => {
		textInput.value = colorInput.value;
	});

	textInput.addEventListener('input', () => {
		try {
			const normalized = normalizeColorToHex(textInput.value);
			colorInput.value = normalized;
		} catch (e) {
			// Invalid color, ignore
		}
	});

	// Buttons
	const buttons = document.createElement('div');
	buttons.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

	const cancelBtn = document.createElement('button');
	cancelBtn.textContent = 'Cancel';
	cancelBtn.style.cssText = `
		padding: 8px 16px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
	`;
	cancelBtn.addEventListener('click', () => overlay.remove());

	const applyBtn = document.createElement('button');
	applyBtn.textContent = 'Apply';
	applyBtn.style.cssText = `
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		cursor: pointer;
		font-weight: 500;
	`;
	applyBtn.addEventListener('click', () => {
		replaceColorInEditor(view, currentColor, textInput.value);
		overlay.remove();
	});

	buttons.appendChild(cancelBtn);
	buttons.appendChild(applyBtn);
	picker.appendChild(buttons);

	overlay.appendChild(picker);
	document.body.appendChild(overlay);

	// Close on overlay click
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) {
			overlay.remove();
		}
	});

	// Focus text input
	textInput.focus();
	textInput.select();
}

// Replace color in editor
function replaceColorInEditor(view: EditorView, oldColor: string, newColor: string) {
	const text = view.state.doc.toString();
	const regex = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
	
	let match;
	const changes = [];
	while ((match = regex.exec(text)) !== null) {
		changes.push({
			from: match.index,
			to: match.index + match[0].length,
			insert: newColor
		});
	}

	if (changes.length > 0) {
		view.dispatch({ changes });
	}
}

// Normalize color to hex
function normalizeColorToHex(color: string): string {
	// Create a temporary element to let the browser parse the color
	const temp = document.createElement('div');
	temp.style.color = color;
	document.body.appendChild(temp);
	const computed = getComputedStyle(temp).color;
	document.body.removeChild(temp);

	// Parse rgb(r, g, b) or rgba(r, g, b, a)
	const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (match) {
		const r = parseInt(match[1]).toString(16).padStart(2, '0');
		const g = parseInt(match[2]).toString(16).padStart(2, '0');
		const b = parseInt(match[3]).toString(16).padStart(2, '0');
		return `#${r}${g}${b}`;
	}

	return '#000000';
}
