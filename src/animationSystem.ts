import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, Range } from '@codemirror/state';

// Animation presets library
export const ANIMATION_PRESETS = {
	// Entrance animations
	fadeIn: {
		name: 'Fade In',
		category: 'entrance',
		keyframes: `@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}`,
		usage: 'animation: fadeIn 0.5s ease-out;'
	},
	slideInUp: {
		name: 'Slide In Up',
		category: 'entrance',
		keyframes: `@keyframes slideInUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}`,
		usage: 'animation: slideInUp 0.6s ease-out;'
	},
	slideInDown: {
		name: 'Slide In Down',
		category: 'entrance',
		keyframes: `@keyframes slideInDown {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}`,
		usage: 'animation: slideInDown 0.6s ease-out;'
	},
	slideInLeft: {
		name: 'Slide In Left',
		category: 'entrance',
		keyframes: `@keyframes slideInLeft {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}`,
		usage: 'animation: slideInLeft 0.6s ease-out;'
	},
	slideInRight: {
		name: 'Slide In Right',
		category: 'entrance',
		keyframes: `@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}`,
		usage: 'animation: slideInRight 0.6s ease-out;'
	},
	zoomIn: {
		name: 'Zoom In',
		category: 'entrance',
		keyframes: `@keyframes zoomIn {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}`,
		usage: 'animation: zoomIn 0.5s ease-out;'
	},
	bounceIn: {
		name: 'Bounce In',
		category: 'entrance',
		keyframes: `@keyframes bounceIn {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); opacity: 1; }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); }
}`,
		usage: 'animation: bounceIn 0.8s ease-out;'
	},
	rotateIn: {
		name: 'Rotate In',
		category: 'entrance',
		keyframes: `@keyframes rotateIn {
  from { transform: rotate(-200deg); opacity: 0; }
  to { transform: rotate(0); opacity: 1; }
}`,
		usage: 'animation: rotateIn 0.6s ease-out;'
	},

	// Attention seekers
	bounce: {
		name: 'Bounce',
		category: 'attention',
		keyframes: `@keyframes bounce {
  0%, 20%, 53%, 80%, 100% { transform: translateY(0); }
  40%, 43% { transform: translateY(-30px); }
  70% { transform: translateY(-15px); }
  90% { transform: translateY(-4px); }
}`,
		usage: 'animation: bounce 1s ease-in-out;'
	},
	pulse: {
		name: 'Pulse',
		category: 'attention',
		keyframes: `@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}`,
		usage: 'animation: pulse 2s ease-in-out infinite;'
	},
	shake: {
		name: 'Shake',
		category: 'attention',
		keyframes: `@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
  20%, 40%, 60%, 80% { transform: translateX(10px); }
}`,
		usage: 'animation: shake 0.8s ease-in-out;'
	},
	wobble: {
		name: 'Wobble',
		category: 'attention',
		keyframes: `@keyframes wobble {
  0% { transform: translateX(0%); }
  15% { transform: translateX(-25%) rotate(-5deg); }
  30% { transform: translateX(20%) rotate(3deg); }
  45% { transform: translateX(-15%) rotate(-3deg); }
  60% { transform: translateX(10%) rotate(2deg); }
  75% { transform: translateX(-5%) rotate(-1deg); }
  100% { transform: translateX(0%); }
}`,
		usage: 'animation: wobble 1s ease-in-out;'
	},
	swing: {
		name: 'Swing',
		category: 'attention',
		keyframes: `@keyframes swing {
  20% { transform: rotate(15deg); }
  40% { transform: rotate(-10deg); }
  60% { transform: rotate(5deg); }
  80% { transform: rotate(-5deg); }
  100% { transform: rotate(0deg); }
}`,
		usage: 'animation: swing 1s ease-in-out; transform-origin: top center;'
	},
	flash: {
		name: 'Flash',
		category: 'attention',
		keyframes: `@keyframes flash {
  0%, 50%, 100% { opacity: 1; }
  25%, 75% { opacity: 0; }
}`,
		usage: 'animation: flash 1s ease-in-out;'
	},

	// Loading animations
	spin: {
		name: 'Spin',
		category: 'loading',
		keyframes: `@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}`,
		usage: 'animation: spin 1s linear infinite;'
	},
	spinReverse: {
		name: 'Spin Reverse',
		category: 'loading',
		keyframes: `@keyframes spinReverse {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}`,
		usage: 'animation: spinReverse 1s linear infinite;'
	},
	loading: {
		name: 'Loading Dots',
		category: 'loading',
		keyframes: `@keyframes loading {
  0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}`,
		usage: 'animation: loading 1.4s ease-in-out infinite both;'
	},
	progress: {
		name: 'Progress Bar',
		category: 'loading',
		keyframes: `@keyframes progress {
  0% { width: 0%; }
  100% { width: 100%; }
}`,
		usage: 'animation: progress 2s ease-out;'
	},

	// Hover effects
	hoverGrow: {
		name: 'Hover Grow',
		category: 'hover',
		keyframes: `/* Use with :hover pseudo-class */`,
		usage: 'transition: transform 0.3s ease; /* Add to base element */\n:hover { transform: scale(1.1); }'
	},
	hoverShrink: {
		name: 'Hover Shrink',
		category: 'hover',
		keyframes: `/* Use with :hover pseudo-class */`,
		usage: 'transition: transform 0.3s ease; /* Add to base element */\n:hover { transform: scale(0.95); }'
	},
	hoverFloat: {
		name: 'Hover Float',
		category: 'hover',
		keyframes: `/* Use with :hover pseudo-class */`,
		usage: 'transition: transform 0.3s ease; /* Add to base element */\n:hover { transform: translateY(-10px); }'
	},
	hoverShadow: {
		name: 'Hover Shadow',
		category: 'hover',
		keyframes: `/* Use with :hover pseudo-class */`,
		usage: 'transition: box-shadow 0.3s ease; /* Add to base element */\n:hover { box-shadow: 0 10px 25px rgba(0,0,0,0.2); }'
	}
};

// Animation detection patterns
const ANIMATION_PATTERNS = [
	// @keyframes declarations
	/@keyframes\s+([a-zA-Z0-9_-]+)\s*\{/g,
	// animation property
	/animation\s*:\s*([^;]+);/g,
	// animation-name property
	/animation-name\s*:\s*([^;]+);/g,
	// transition property
	/transition\s*:\s*([^;]+);/g
];

// Animation widget for timeline scrubber
class AnimationTimelineWidget extends WidgetType {
	constructor(readonly animationName: string, readonly duration: string) {
		super();
	}

	toDOM() {
		const container = document.createElement('div');
		container.className = 'cm-animation-timeline';
		container.style.cssText = `
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 4px 8px;
			background: var(--background-secondary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			margin: 0 4px;
			font-size: 11px;
			color: var(--text-muted);
		`;

		// Play/pause button
		const playBtn = document.createElement('button');
		playBtn.innerHTML = 'Play';
		playBtn.style.cssText = `
			background: none;
			border: none;
			cursor: pointer;
			font-size: 12px;
			padding: 2px;
		`;
		playBtn.title = 'Play/Pause animation';
		
		// Timeline scrubber
		const timeline = document.createElement('input');
		timeline.type = 'range';
		timeline.min = '0';
		timeline.max = '100';
		timeline.value = '0';
		timeline.style.cssText = `
			width: 80px;
			height: 4px;
			cursor: pointer;
		`;
		timeline.title = `Scrub ${this.animationName} timeline`;

		// Duration label
		const durationLabel = document.createElement('span');
		durationLabel.textContent = this.duration;
		durationLabel.style.cssText = 'font-size: 10px; color: var(--text-muted);';

		container.appendChild(playBtn);
		container.appendChild(timeline);
		container.appendChild(durationLabel);

		// Add event listeners
		let isPlaying = false;
		playBtn.addEventListener('click', () => {
			isPlaying = !isPlaying;
			playBtn.innerHTML = isPlaying ? 'Pause' : 'Play';
			// TODO: Control animation playback
		});

		timeline.addEventListener('input', () => {
			// TODO: Scrub animation to specific time
		});

		return container;
	}

	eq(other: AnimationTimelineWidget) {
		return other.animationName === this.animationName && other.duration === this.duration;
	}

	ignoreEvent() {
		return false;
	}
}

// Find animations in CSS
function findAnimations(text: string): Array<{ from: number; to: number; name: string; duration: string }> {
	const animations: Array<{ from: number; to: number; name: string; duration: string }> = [];
	
	// Find @keyframes
	const keyframesRegex = /@keyframes\s+([a-zA-Z0-9_-]+)/g;
	let match;
	while ((match = keyframesRegex.exec(text)) !== null) {
		animations.push({
			from: match.index,
			to: match.index + match[0].length,
			name: match[1],
			duration: 'keyframes'
		});
	}

	// Find animation properties
	const animationRegex = /animation\s*:\s*([a-zA-Z0-9_-]+)\s+([0-9.]+s)/g;
	while ((match = animationRegex.exec(text)) !== null) {
		animations.push({
			from: match.index,
			to: match.index + match[0].length,
			name: match[1],
			duration: match[2]
		});
	}

	return animations;
}

// Create decorations for animations
function createAnimationDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const text = view.state.doc.toString();
	const animations = findAnimations(text);

	animations.forEach(({ from, to, name, duration }) => {
		if (duration !== 'keyframes') {
			decorations.push(
				Decoration.widget({
					widget: new AnimationTimelineWidget(name, duration),
					side: 1
				}).range(to)
			);
		}
	});

	return Decoration.set(decorations);
}

// Animation inspector plugin
export const animationInspectorPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = createAnimationDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = createAnimationDecorations(update.view);
			}
		}
	},
	{
		decorations: v => v.decorations,
		eventHandlers: {
			mousedown: (e, view) => {
				const target = e.target as HTMLElement;
				if (target.closest('.cm-animation-timeline')) {
					e.preventDefault();
					return true;
				}
				return false;
			}
		}
	}
);

// Animation performance monitor
export class AnimationPerformanceMonitor {
	private animations: Map<string, { startTime: number; frameCount: number }> = new Map();
	private rafId: number | null = null;

	startMonitoring(previewFrame: HTMLIFrameElement) {
		if (!previewFrame.contentWindow) return;

		const monitor = () => {
			try {
				const doc = previewFrame.contentDocument;
				if (!doc) return;

				// Get all animated elements
				const animatedElements = doc.querySelectorAll('[style*="animation"], .animated, [class*="animate"]');
				
				animatedElements.forEach((el: Element) => {
					const computedStyle = previewFrame.contentWindow!.getComputedStyle(el);
					const animationName = computedStyle.animationName;
					
					if (animationName && animationName !== 'none') {
						if (!this.animations.has(animationName)) {
							this.animations.set(animationName, {
								startTime: performance.now(),
								frameCount: 0
							});
						}
						
						const anim = this.animations.get(animationName)!;
						anim.frameCount++;
					}
				});

				this.rafId = requestAnimationFrame(monitor);
			} catch (error) {
				// Ignore cross-origin errors
			}
		};

		this.rafId = requestAnimationFrame(monitor);
	}

	stopMonitoring() {
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}

	getPerformanceData() {
		const data: Array<{ name: string; fps: number; duration: number }> = [];
		const now = performance.now();

		this.animations.forEach((anim, name) => {
			const duration = now - anim.startTime;
			const fps = Math.round((anim.frameCount / duration) * 1000);
			data.push({ name, fps, duration });
		});

		return data;
	}

	reset() {
		this.animations.clear();
	}
}

// Easing functions for animation builder
export const EASING_FUNCTIONS = {
	linear: 'linear',
	ease: 'ease',
	easeIn: 'ease-in',
	easeOut: 'ease-out',
	easeInOut: 'ease-in-out',
	easeInSine: 'cubic-bezier(0.12, 0, 0.39, 0)',
	easeOutSine: 'cubic-bezier(0.61, 1, 0.88, 1)',
	easeInOutSine: 'cubic-bezier(0.37, 0, 0.63, 1)',
	easeInQuad: 'cubic-bezier(0.11, 0, 0.5, 0)',
	easeOutQuad: 'cubic-bezier(0.5, 1, 0.89, 1)',
	easeInOutQuad: 'cubic-bezier(0.45, 0, 0.55, 1)',
	easeInCubic: 'cubic-bezier(0.32, 0, 0.67, 0)',
	easeOutCubic: 'cubic-bezier(0.33, 1, 0.68, 1)',
	easeInOutCubic: 'cubic-bezier(0.65, 0, 0.35, 1)',
	easeInQuart: 'cubic-bezier(0.5, 0, 0.75, 0)',
	easeOutQuart: 'cubic-bezier(0.25, 1, 0.5, 1)',
	easeInOutQuart: 'cubic-bezier(0.76, 0, 0.24, 1)',
	easeInQuint: 'cubic-bezier(0.64, 0, 0.78, 0)',
	easeOutQuint: 'cubic-bezier(0.22, 1, 0.36, 1)',
	easeInOutQuint: 'cubic-bezier(0.83, 0, 0.17, 1)',
	easeInExpo: 'cubic-bezier(0.7, 0, 0.84, 0)',
	easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
	easeInOutExpo: 'cubic-bezier(0.87, 0, 0.13, 1)',
	easeInCirc: 'cubic-bezier(0.55, 0, 1, 0.45)',
	easeOutCirc: 'cubic-bezier(0, 0.55, 0.45, 1)',
	easeInOutCirc: 'cubic-bezier(0.85, 0, 0.15, 1)',
	easeInBack: 'cubic-bezier(0.36, 0, 0.66, -0.56)',
	easeOutBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
	easeInOutBack: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)'
};