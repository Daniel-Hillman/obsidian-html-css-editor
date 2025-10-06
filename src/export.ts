import { App, Notice, TFile, normalizePath } from 'obsidian';
import HTMLCSSEditorPlugin from './main';

export class ExportHandler {
	private app: App;
	private plugin: HTMLCSSEditorPlugin;

	constructor(app: App, plugin: HTMLCSSEditorPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	/**
	 * Save the combined HTML/CSS content as an HTML file in the vault
	 */
	async saveAsHTMLFile(htmlContent: string, cssContent: string): Promise<void> {
		try {
			const completeHTML = this.generateCompleteHTML(htmlContent, cssContent);
			
			// Generate a unique filename
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const filename = `html-css-export-${timestamp}.html`;
			const filePath = normalizePath(filename);

			// Create the file in the vault root
			const file = await this.app.vault.create(filePath, completeHTML);
			
			// Show detailed success message with location
			const vaultName = this.app.vault.getName();
			new Notice(`✅ HTML+CSS file saved!\n📁 Location: ${vaultName}/${file.name}\n🔗 File opened in new tab`, 6000);
			
			// Open the file in a new tab for immediate viewing
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.openFile(file);
			
		} catch (error) {
			this.handleError('Failed to save HTML+CSS file', error);
		}
	}

	/**
	 * Copy the combined HTML/CSS content to clipboard
	 */
	async copyToClipboard(htmlContent: string, cssContent: string): Promise<void> {
		try {
			const completeHTML = this.generateCompleteHTML(htmlContent, cssContent);
			
			// Use the Clipboard API if available, fallback to legacy method
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(completeHTML);
			} else {
				// Fallback for older browsers or restricted contexts
				this.fallbackCopyToClipboard(completeHTML);
			}
			
			const htmlLines = htmlContent.split('\n').length;
			const cssLines = cssContent.split('\n').length;
			new Notice(`✅ HTML+CSS copied to clipboard!\n📄 ${htmlLines} lines of HTML + ${cssLines} lines of CSS\n📋 Ready to paste anywhere`, 4000);
			
		} catch (error) {
			this.handleError('Failed to copy to clipboard', error);
		}
	}

	/**
	 * Generate a complete, standalone HTML document combining HTML and CSS
	 */
	private generateCompleteHTML(htmlContent: string, cssContent: string): string {
		// Clean and validate content
		const cleanHTML = this.sanitizeHTML(htmlContent);
		const cleanCSS = this.sanitizeCSS(cssContent);
		
		// Generate timestamp for metadata
		const timestamp = new Date().toISOString();
		
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="Obsidian HTML/CSS Editor Plugin">
    <meta name="created" content="${timestamp}">
    <title>HTML/CSS Export</title>
    <style>
        /* Base styles for better rendering */
        * {
            box-sizing: border-box;
        }
        
        body {
            margin: 0;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #fff;
        }
        
        /* User CSS */
        ${cleanCSS}
    </style>
</head>
<body>
    ${cleanHTML}
</body>
</html>`;
	}

	/**
	 * Sanitize HTML content for export
	 */
	private sanitizeHTML(html: string): string {
		if (!html || !html.trim()) {
			return '<p><em>No HTML content</em></p>';
		}
		
		// Remove potentially dangerous elements for export
		let sanitized = html;
		
		// Remove script tags but preserve content as comments
		sanitized = sanitized.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, content) => {
			return `<!-- Script removed for security: ${content.trim()} -->`;
		});
		
		// Remove iframe tags
		sanitized = sanitized.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '<!-- Iframe removed for security -->');
		
		// Remove object and embed tags
		sanitized = sanitized.replace(/<(object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '<!-- $1 removed for security -->');
		sanitized = sanitized.replace(/<embed[^>]*>/gi, '<!-- Embed removed for security -->');
		
		return sanitized;
	}

	/**
	 * Sanitize CSS content for export
	 */
	private sanitizeCSS(css: string): string {
		if (!css || !css.trim()) {
			return '/* No CSS content */';
		}
		
		let sanitized = css;
		
		// Remove potentially dangerous CSS
		sanitized = sanitized.replace(/@import\s+url\s*\([^)]*\)/gi, '/* @import removed for security */');
		sanitized = sanitized.replace(/javascript\s*:/gi, '/* javascript: removed */');
		sanitized = sanitized.replace(/expression\s*\(/gi, '/* expression() removed */');
		sanitized = sanitized.replace(/behavior\s*:/gi, '/* behavior: removed */');
		
		return sanitized;
	}

	/**
	 * Fallback method for copying to clipboard in environments where Clipboard API is not available
	 */
	private fallbackCopyToClipboard(text: string): void {
		// Create a temporary textarea element
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.className = 'html-css-editor-clipboard-helper';
		
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		
		try {
			document.execCommand('copy');
		} catch (err) {
			throw new Error('Clipboard operation failed');
		} finally {
			document.body.removeChild(textArea);
		}
	}

	/**
	 * Save content to a specific file path in the vault
	 */
	async saveToSpecificPath(htmlContent: string, cssContent: string, filePath: string): Promise<void> {
		try {
			const completeHTML = this.generateCompleteHTML(htmlContent, cssContent);
			const normalizedPath = normalizePath(filePath);
			
			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(normalizedPath);
			
			if (existingFile instanceof TFile) {
				// File exists, ask user for confirmation or modify it
				await this.app.vault.modify(existingFile, completeHTML);
				new Notice(`HTML file updated: ${existingFile.name}`);
			} else {
				// Create new file
				const file = await this.app.vault.create(normalizedPath, completeHTML);
				new Notice(`HTML file created: ${file.name}`);
			}
			
		} catch (error) {
			this.handleError('Failed to save to specific path', error);
		}
	}

	/**
	 * Export content with user-specified filename
	 */
	async saveWithCustomName(htmlContent: string, cssContent: string, filename: string): Promise<void> {
		try {
			// Ensure filename has .html extension
			let finalFilename = filename;
			if (!finalFilename.toLowerCase().endsWith('.html')) {
				finalFilename += '.html';
			}
			
			// Sanitize filename
			finalFilename = finalFilename.replace(/[<>:"/\\|?*]/g, '-');
			
			await this.saveToSpecificPath(htmlContent, cssContent, finalFilename);
			
		} catch (error) {
			this.handleError('Failed to save with custom name', error);
		}
	}

	/**
	 * Get a preview of the generated HTML (first 500 characters)
	 */
	getHTMLPreview(htmlContent: string, cssContent: string): string {
		const completeHTML = this.generateCompleteHTML(htmlContent, cssContent);
		return completeHTML.length > 500 
			? completeHTML.substring(0, 500) + '...'
			: completeHTML;
	}

	/**
	 * Validate if the content can be exported
	 */
	canExport(htmlContent: string, cssContent: string): { canExport: boolean; reason?: string } {
		if (!htmlContent.trim() && !cssContent.trim()) {
			return { canExport: false, reason: 'No content to export' };
		}
		
		// Check for basic HTML structure issues
		if (htmlContent.trim()) {
			const openTags = (htmlContent.match(/<[^/][^>]*>/g) || []).length;
			const closeTags = (htmlContent.match(/<\/[^>]*>/g) || []).length;
			
			// Allow some flexibility in tag matching (self-closing tags, etc.)
			if (Math.abs(openTags - closeTags) > 5) {
				return { 
					canExport: true, // Still allow export but warn
					reason: 'HTML may have unmatched tags' 
				};
			}
		}
		
		return { canExport: true };
	}

	private handleError(context: string, error: Error | string): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`HTML/CSS Editor Export Error [${context}]:`, error);
		
		// Show user-friendly notice
		new Notice(`Export failed: ${errorMessage}`);
	}
}