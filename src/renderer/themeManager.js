// Theme Management System
class ThemeManager {
    constructor() {
        this.currentTheme = 'auto';
        this.systemTheme = 'light';
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Listen for system theme changes
        this.mediaQuery.addEventListener('change', (e) => {
            this.systemTheme = e.matches ? 'dark' : 'light';
            if (this.currentTheme === 'auto') {
                this.applyTheme('auto');
            }
        });
        
        // Initialize system theme immediately
        this.systemTheme = this.mediaQuery.matches ? 'dark' : 'light';
        
        // Apply initial theme immediately to prevent flash
        this.applyInitialTheme();
    }

    /**
     * Apply initial theme immediately to prevent flash
     */
    applyInitialTheme() {
        // Try to get cached theme from localStorage first (synchronous)
        let cachedTheme = 'auto';
        try {
            const cached = localStorage.getItem('app-theme-preference');
            if (cached && ['light', 'dark', 'auto'].includes(cached)) {
                cachedTheme = cached;
            }
        } catch (error) {
            // localStorage might not be available, use auto
        }
        
        // Apply the theme immediately
        this.applyTheme(cachedTheme);
    }

    /**
     * Apply theme to the document
     * @param {string} theme - 'light', 'dark', or 'auto'
     */
    applyTheme(theme) {
        this.currentTheme = theme;
        
        let effectiveTheme;
        if (theme === 'auto') {
            effectiveTheme = this.systemTheme;
        } else {
            effectiveTheme = theme;
        }
        
        // Apply to document
        document.documentElement.setAttribute('data-theme', effectiveTheme);
        document.documentElement.setAttribute('data-bs-theme', effectiveTheme);
        
        // Update body class for additional styling if needed
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${effectiveTheme}`);
        
        // Dispatch custom event for other components to listen
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme: effectiveTheme, userPreference: theme }
        }));
        
        console.log(`Theme applied: ${effectiveTheme} (user preference: ${theme})`);
    }

    /**
     * Get the current effective theme (resolves 'auto' to actual theme)
     */
    getEffectiveTheme() {
        if (this.currentTheme === 'auto') {
            return this.systemTheme;
        }
        return this.currentTheme;
    }

    /**
     * Get the user's theme preference (may be 'auto')
     */
    getUserPreference() {
        return this.currentTheme;
    }

    /**
     * Get the system's preferred theme
     */
    getSystemTheme() {
        return this.systemTheme;
    }

    /**
     * Initialize theme from settings
     */
    async initializeFromSettings() {
        try {
            const settings = await window.electronAPI.invokeAsync('load-settings');
            const theme = settings.defaultTheme || 'auto';
            
            // Cache the theme preference for immediate access on next load
            try {
                localStorage.setItem('app-theme-preference', theme);
            } catch (error) {
                // localStorage might not be available
            }
            
            // Only apply if different from current theme to avoid unnecessary updates
            if (theme !== this.currentTheme) {
                this.applyTheme(theme);
            }
        } catch (error) {
            console.error('Error loading theme from settings:', error);
            this.applyTheme('auto'); // Fallback to auto
        }
    }

    /**
     * Save theme preference to settings
     */
    async saveThemePreference(theme) {
        try {
            const settings = await window.electronAPI.invokeAsync('load-settings');
            settings.defaultTheme = theme;
            await window.electronAPI.invokeAsync('save-settings', settings);
            
            // Cache immediately for next page load
            try {
                localStorage.setItem('app-theme-preference', theme);
            } catch (error) {
                // localStorage might not be available
            }
            
            this.applyTheme(theme);
        } catch (error) {
            console.error('Error saving theme preference:', error);
            throw error;
        }
    }
}

// Create global theme manager instance
window.themeManager = new ThemeManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}