import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, Range } from '@codemirror/state';

// Comprehensive color regex patterns - matches ALL valid CSS color formats
const COLOR_PATTERNS = [
	// Hex colors (3, 6, or 8 digits)
	/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
	// RGB/RGBA with any whitespace
	/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi,
	// HSL/HSLA with any whitespace
	/hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*[\d.]+\s*)?\)/gi,
	// Named colors (comprehensive list)
	/\b(aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgrey|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|grey|green|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgrey|lightgreen|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen|transparent)\b/gi
];

// Color swatch widget
class ColorSwatchWidget extends WidgetType {
	constructor(readonly color: string) {
		super();
	}

	toDOM() {
		const swatch = document.createElement('span');
		swatch.className = 'cm-color-swatch';
		swatch.style.backgroundColor = this.color;
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
		updateTimeout: NodeJS.Timeout | null = null;

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
	// Styles moved to CSS class

	const picker = document.createElement('div');
	picker.className = 'cm-color-picker';
	// Styles moved to CSS class

	// Title
	const title = document.createElement('h3');
	title.textContent = 'Pick a Color';
	// Styles moved to CSS class
	picker.appendChild(title);

	// Color input
	const colorInput = document.createElement('input');
	colorInput.type = 'color';
	colorInput.value = normalizeColorToHex(currentColor);
	colorInput.className = 'cm-color-picker-color-input';
	picker.appendChild(colorInput);

	// Text input for manual entry
	const textInput = document.createElement('input');
	textInput.type = 'text';
	textInput.value = currentColor;
	textInput.className = 'cm-color-picker-text-input';
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
	buttons.className = 'cm-color-picker-buttons';

	const cancelBtn = document.createElement('button');
	cancelBtn.textContent = 'Cancel';
	cancelBtn.className = 'cm-color-picker-cancel-btn';
	cancelBtn.addEventListener('click', () => overlay.remove());

	const applyBtn = document.createElement('button');
	applyBtn.textContent = 'Apply';
	applyBtn.className = 'cm-color-picker-apply-btn';
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
	temp.className = 'cm-color-picker-temp-element';
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
