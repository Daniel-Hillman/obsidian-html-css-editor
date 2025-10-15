# Feature Guide

## Color Picker

So you know how annoying it is to type hex codes? Yeah, I fixed that.

### How it works
Write some CSS with colors, and little colored squares appear next to them. Click the square, pick a new color, done. 

```css
.button {
  background: #3498db; /* 🔵 Click this blue dot */
  color: white;
}
```

It works with any color format - hex, rgb, hsl, named colors, whatever. Change one color and it updates everywhere it's used.

### Quick workflow
1. Write CSS with colors
2. Click the colored dot that appears
3. Pick a new color (or type one)
4. Hit apply
5. All instances change


## Responsive Testing

Testing responsive designs used to suck. Not anymore.

### Device presets
Pick from a bunch of real device sizes:
- iPhone 14, iPhone 14 Pro Max
- iPad Pro, regular tablets
- Desktop, laptop sizes
- Or make your own custom size

### How to use it
1. Pick a device from the dropdown
2. Your preview resizes to that exact size
3. Click the rotate button to flip portrait/landscape
4. Test your breakpoints

### Custom sizes
Need to test a weird size? Click "Custom Size" and type in whatever dimensions you want. There are quick presets for common ones like 4K, Full HD, etc.

### Navigation tricks
- **Spacebar + drag** to pan around (when you're not typing)
- **Ctrl + scroll** to zoom in/out
- **Double-click** to center everything
- **+/-** buttons for precise zoom control

## Animations

Got 20+ ready-made animations you can just drop in. Fade, bounce, slide, spin - the usual suspects.

### Animation presets
Click "Animations" to browse them. Each one shows a little preview so you know what you're getting. Click one and it drops the CSS right into your editor.

### Custom animations
Want something specific? Click "Builder" to make your own. You get a visual timeline where you can set keyframes and see it animate in real-time. Way easier than writing keyframes by hand.

### Performance checking
Click "Inspector" to see how smooth your animations are running. It shows FPS and tells you if something's choppy.

## Numeric Value Scrubbing

Adjust numbers in your CSS without typing. Just use arrow keys.

### How it works
Put your cursor on any number in your CSS (like `100px`, `1.5em`, `45deg`, `0.8`) and use arrow keys to change it. You see the changes live in the preview.

```css
.box {
  width: 100px;        /* Cursor here, press ↑ to make it 101px */
  transform: rotate(45deg);  /* ↑↓ to adjust rotation */
  opacity: 0.8;        /* Alt+↑↓ for small decimal changes */
}
```

### Keyboard shortcuts
- **↑/↓** - Increment/decrement by 1
- **Shift + ↑/↓** - Change by 10 (faster adjustments)
- **Alt + ↑/↓** - Change by 0.1 (fine-tuning decimals)

### What it handles
Works with any CSS value:
- Pixels: `100px` → `101px`
- Percentages: `50%` → `51%`
- Ems/Rems: `1.5em` → `1.6em`
- Degrees: `45deg` → `46deg`
- Unitless: `1.5` → `1.6`
- Negative values: `-10px` → `-9px`

### Quick workflow
1. Write CSS with a numeric value
2. Click to place cursor on the number
3. Press ↑/↓ to adjust
4. Watch the preview update in real-time
5. Use Shift or Alt for bigger/smaller steps

Perfect for tweaking transforms, animations, spacing, and sizing until it looks just right.

## Sass Support

Yeah, it does Sass. Variables, mixins, nesting, functions.

### Getting started
Toggle the CSS/Sass switch and start writing Sass. You get autocomplete for variables and functions. Click "Templates" for common patterns like mixins and grid systems.

### Seeing the output
Click "Show Compiled CSS" to see what your Sass compiles to. Useful for debugging or if you need the plain CSS.

## Project Management

### Saving your work
Hit "Save Project", give it a name, pick where to save it. It gets saved as a markdown file with your HTML and CSS in code blocks.

### Loading projects
Click "Load Project" and search for any project you've saved. They show up no matter where you saved them in your vault.

### Heads up
Since projects are just markdown files, you can edit them like any other note. Add comments, link to other notes, whatever.

## Common Workflows

### Testing a responsive design
1. Write your HTML/CSS with media queries
2. Start with mobile (375×667)
3. Check how it looks
4. Rotate to landscape to test that too
5. Jump to tablet size
6. Finally test desktop
7. Use custom sizes for your specific breakpoints

### Matching brand colors
1. Write CSS with a placeholder color
2. Click the color dot
3. Paste your brand color in the text field
4. Hit apply
5. Every instance of that color updates

### Quick button styling
```css
.button {
  background: #21465fff; /* Click this to try different blues */
  color: white;
  padding: 12px 24px;
  border-radius: 6px;
}
```

Click the blue dot, try different shades, see it update live.

## Troubleshooting

### Color picker not working?
Make sure you're in CSS mode and the color format is valid. Click directly on the little colored square, not the text.

### Device sizes acting weird?
Try the "Fit to Window" button or refresh with F5. For custom sizes, make sure you're using reasonable numbers. or try reselecting your desired template from the picker, then zoom out/in. 

## Tips

- Drag the divider between code and preview to resize
- Use Picture-in-Picture to keep the preview visible while working
- Projects are just markdown files - you can edit them normally
- The preview updates as you type (with a small delay so it's not crazy)
- Hover over the compilation status to see any Sass errors
- Use arrow keys on numbers for quick adjustments - way faster than typing
- Combine numeric scrubbing with live preview for instant visual feedback

---

That's pretty much it. 


