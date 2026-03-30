/**
 * Tests for ThemeManager — matches actual API:
 * applyTheme(), getEffectiveTheme(), getUserPreference(), getSystemTheme()
 */

describe('ThemeManager', () => {
    let ThemeManager, themeManager;

    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.removeAttribute('data-bs-theme');
        document.body.className = '';
        localStorage.clear();

        window.matchMedia = jest.fn().mockReturnValue({
            matches: false, // light system theme
            addEventListener: jest.fn(),
        });

        jest.resetModules();
        ThemeManager = require('../../src/renderer/themeManager');
    });

    describe('Constructor', () => {
        test('should initialize with auto theme', () => {
            themeManager = new ThemeManager();
            expect(themeManager.currentTheme).toBe('auto');
        });

        test('should detect system theme', () => {
            themeManager = new ThemeManager();
            expect(themeManager.systemTheme).toBe('light');
        });

        test('should load cached theme from localStorage', () => {
            localStorage.setItem('app-theme-preference', 'dark');
            themeManager = new ThemeManager();
            expect(themeManager.currentTheme).toBe('dark');
        });

        test('should apply theme to document on init', () => {
            themeManager = new ThemeManager();
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });
    });

    describe('applyTheme()', () => {
        beforeEach(() => { themeManager = new ThemeManager(); });

        test('should apply light theme', () => {
            themeManager.applyTheme('light');
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
        });

        test('should apply dark theme', () => {
            themeManager.applyTheme('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        test('should resolve auto to system theme', () => {
            themeManager.systemTheme = 'dark';
            themeManager.applyTheme('auto');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        test('should update currentTheme', () => {
            themeManager.applyTheme('dark');
            expect(themeManager.currentTheme).toBe('dark');
        });

        test('should add body class', () => {
            themeManager.applyTheme('dark');
            expect(document.body.classList.contains('theme-dark')).toBe(true);
        });

        test('should remove previous body class', () => {
            themeManager.applyTheme('dark');
            themeManager.applyTheme('light');
            expect(document.body.classList.contains('theme-dark')).toBe(false);
            expect(document.body.classList.contains('theme-light')).toBe(true);
        });

        test('should dispatch themeChanged event', () => {
            const handler = jest.fn();
            window.addEventListener('themeChanged', handler);
            themeManager.applyTheme('dark');
            expect(handler).toHaveBeenCalled();
            expect(handler.mock.calls[0][0].detail).toEqual({ theme: 'dark', userPreference: 'dark' });
            window.removeEventListener('themeChanged', handler);
        });
    });

    describe('getEffectiveTheme()', () => {
        beforeEach(() => { themeManager = new ThemeManager(); });

        test('should return light when auto and system is light', () => {
            themeManager.applyTheme('auto');
            themeManager.systemTheme = 'light';
            expect(themeManager.getEffectiveTheme()).toBe('light');
        });

        test('should return dark when explicitly set', () => {
            themeManager.applyTheme('dark');
            expect(themeManager.getEffectiveTheme()).toBe('dark');
        });
    });

    describe('getUserPreference()', () => {
        test('should return auto by default', () => {
            themeManager = new ThemeManager();
            expect(themeManager.getUserPreference()).toBe('auto');
        });

        test('should return set preference', () => {
            themeManager = new ThemeManager();
            themeManager.applyTheme('dark');
            expect(themeManager.getUserPreference()).toBe('dark');
        });
    });

    describe('getSystemTheme()', () => {
        test('should return system theme', () => {
            themeManager = new ThemeManager();
            expect(themeManager.getSystemTheme()).toBe('light');
        });
    });
});
