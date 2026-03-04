/**
 * Tests for ThemeManager
 */

describe('ThemeManager', () => {
    let ThemeManager;
    let themeManager;
    let mockElectronAPI;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        document.documentElement.removeAttribute('data-theme');
        
        // Mock localStorage
        Storage.prototype.getItem = jest.fn();
        Storage.prototype.setItem = jest.fn();
        
        // Mock electron API
        mockElectronAPI = {
            getTheme: jest.fn().mockResolvedValue('light'),
            setTheme: jest.fn().mockResolvedValue(true)
        };
        window.electronAPI = mockElectronAPI;

        // Clear module cache and require fresh
        jest.resetModules();
        ThemeManager = require('../../src/renderer/themeManager');
    });

    describe('Constructor', () => {
        test('should initialize with default theme', () => {
            themeManager = new ThemeManager();
            expect(themeManager.currentTheme).toBe('light');
        });

        test('should load theme from localStorage if available', () => {
            Storage.prototype.getItem.mockReturnValue('dark');
            themeManager = new ThemeManager();
            expect(themeManager.currentTheme).toBe('dark');
        });

        test('should apply theme to document', () => {
            themeManager = new ThemeManager();
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });
    });

    describe('setTheme()', () => {
        beforeEach(() => {
            themeManager = new ThemeManager();
        });

        test('should change theme to dark', async () => {
            await themeManager.setTheme('dark');
            expect(themeManager.currentTheme).toBe('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        test('should save theme to localStorage', async () => {
            await themeManager.setTheme('dark');
            expect(Storage.prototype.setItem).toHaveBeenCalledWith('theme', 'dark');
        });

        test('should save theme via electron API', async () => {
            await themeManager.setTheme('dark');
            expect(mockElectronAPI.setTheme).toHaveBeenCalledWith('dark');
        });

        test('should handle invalid theme gracefully', async () => {
            await themeManager.setTheme('invalid');
            expect(themeManager.currentTheme).toBe('light');
        });
    });

    describe('toggleTheme()', () => {
        beforeEach(() => {
            themeManager = new ThemeManager();
        });

        test('should toggle from light to dark', async () => {
            await themeManager.toggleTheme();
            expect(themeManager.currentTheme).toBe('dark');
        });

        test('should toggle from dark to light', async () => {
            await themeManager.setTheme('dark');
            await themeManager.toggleTheme();
            expect(themeManager.currentTheme).toBe('light');
        });
    });

    describe('getTheme()', () => {
        test('should return current theme', () => {
            themeManager = new ThemeManager();
            expect(themeManager.getTheme()).toBe('light');
        });
    });

    describe('applyTheme()', () => {
        beforeEach(() => {
            themeManager = new ThemeManager();
        });

        test('should apply theme to document element', () => {
            themeManager.applyTheme('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        test('should update CSS variables for dark theme', () => {
            themeManager.applyTheme('dark');
            const style = document.documentElement.style;
            expect(style.getPropertyValue('--bg-color')).toBeTruthy();
        });

        test('should update CSS variables for light theme', () => {
            themeManager.applyTheme('light');
            const style = document.documentElement.style;
            expect(style.getPropertyValue('--bg-color')).toBeTruthy();
        });
    });

    describe('System Theme Detection', () => {
        test('should detect system dark mode preference', () => {
            window.matchMedia = jest.fn().mockImplementation(query => ({
                matches: query === '(prefers-color-scheme: dark)',
                media: query,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn()
            }));

            themeManager = new ThemeManager();
            const systemTheme = themeManager.getSystemTheme();
            expect(systemTheme).toBe('dark');
        });

        test('should detect system light mode preference', () => {
            window.matchMedia = jest.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn()
            }));

            themeManager = new ThemeManager();
            const systemTheme = themeManager.getSystemTheme();
            expect(systemTheme).toBe('light');
        });
    });

    describe('Error Handling', () => {
        test('should handle electron API errors gracefully', async () => {
            mockElectronAPI.setTheme.mockRejectedValue(new Error('API error'));
            themeManager = new ThemeManager();
            
            await expect(themeManager.setTheme('dark')).resolves.not.toThrow();
            expect(themeManager.currentTheme).toBe('dark');
        });

        test('should handle localStorage errors gracefully', async () => {
            Storage.prototype.setItem.mockImplementation(() => {
                throw new Error('Storage error');
            });
            themeManager = new ThemeManager();
            
            await expect(themeManager.setTheme('dark')).resolves.not.toThrow();
        });
    });
});
