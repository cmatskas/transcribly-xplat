/**
 * @jest-environment jsdom
 */

// Test file for Jest setup configuration
// This ensures the setup file loads correctly and global utilities work

describe('Jest Setup Configuration', () => {
    beforeEach(() => {
        // Reset any mocks before each test
        jest.clearAllMocks();
    });

    describe('Module Loading', () => {
        test('setup file loads without errors', () => {
            // If we reach this point, the setup file loaded successfully
            expect(true).toBe(true);
        });

        test('@testing-library/jest-dom matchers are available', () => {
            // Create a simple DOM element to test jest-dom matchers
            const element = document.createElement('div');
            element.textContent = 'Hello World';
            document.body.appendChild(element);

            // These matchers should be available from jest-dom
            expect(element).toBeInTheDocument();
            expect(element).toHaveTextContent('Hello World');

            // Cleanup
            document.body.removeChild(element);
        });
    });

    describe('Global Console Mocks', () => {
        test('console object is properly configured', () => {
            expect(global.console).toBeDefined();
            expect(typeof global.console).toBe('object');
            
            // Should have all standard console methods
            expect(typeof global.console.log).toBe('function');
            expect(typeof global.console.error).toBe('function');
            expect(typeof global.console.warn).toBe('function');
            expect(typeof global.console.info).toBe('function');
            expect(typeof global.console.debug).toBe('function');
        });

        test('console methods work without throwing errors', () => {
            expect(() => {
                global.console.log('test message');
                global.console.error('test error');
                global.console.warn('test warning');
                global.console.info('test info');
                global.console.debug('test debug');
            }).not.toThrow();
        });
    });

    describe('Global Test Utilities', () => {
        test('createMockFile utility is available', () => {
            expect(global.createMockFile).toBeDefined();
            expect(typeof global.createMockFile).toBe('function');
        });

        test('createMockFile creates valid File objects with defaults', () => {
            const file = global.createMockFile();
            
            expect(file).toBeInstanceOf(File);
            expect(file.name).toBe('test.mp4');
            expect(file.type).toBe('video/mp4');
            expect(file.size).toBeGreaterThan(0);
        });

        test('createMockFile accepts custom parameters', () => {
            const customFile = global.createMockFile('custom.mp3', 'audio/mp3', 'custom content');
            
            expect(customFile).toBeInstanceOf(File);
            expect(customFile.name).toBe('custom.mp3');
            expect(customFile.type).toBe('audio/mp3');
        });

        test('createMockFile handles edge cases', () => {
            // Test with empty content
            const emptyFile = global.createMockFile('empty.txt', 'text/plain', '');
            expect(emptyFile).toBeInstanceOf(File);
            expect(emptyFile.size).toBe(0);

            // Test with special characters in filename
            const specialFile = global.createMockFile('test file (1).mp4', 'video/mp4');
            expect(specialFile.name).toBe('test file (1).mp4');
        });
    });

    describe('Browser API Mocks', () => {
        test('IntersectionObserver mock is available', () => {
            expect(global.IntersectionObserver).toBeDefined();
            expect(typeof global.IntersectionObserver).toBe('function');
        });

        test('IntersectionObserver can be instantiated', () => {
            const observer = new global.IntersectionObserver();
            
            expect(observer).toBeInstanceOf(global.IntersectionObserver);
            expect(typeof observer.disconnect).toBe('function');
            expect(typeof observer.observe).toBe('function');
            expect(typeof observer.unobserve).toBe('function');
        });

        test('IntersectionObserver methods work without errors', () => {
            const observer = new global.IntersectionObserver();
            const element = document.createElement('div');
            
            expect(() => {
                observer.observe(element);
                observer.unobserve(element);
                observer.disconnect();
            }).not.toThrow();
        });

        test('ResizeObserver mock is available', () => {
            expect(global.ResizeObserver).toBeDefined();
            expect(typeof global.ResizeObserver).toBe('function');
        });

        test('ResizeObserver can be instantiated', () => {
            const observer = new global.ResizeObserver();
            
            expect(observer).toBeInstanceOf(global.ResizeObserver);
            expect(typeof observer.disconnect).toBe('function');
            expect(typeof observer.observe).toBe('function');
            expect(typeof observer.unobserve).toBe('function');
        });

        test('ResizeObserver methods work without errors', () => {
            const observer = new global.ResizeObserver();
            const element = document.createElement('div');
            
            expect(() => {
                observer.observe(element);
                observer.unobserve(element);
                observer.disconnect();
            }).not.toThrow();
        });
    });

    describe('Module Compatibility', () => {
        test('CommonJS require syntax works correctly', () => {
            // This test validates that the change from import to require works
            // If the setup file loaded without errors, this test passes
            expect(() => {
                // The setup file uses require('@testing-library/jest-dom')
                // If there were syntax issues, Jest would have failed to load
                require('../tests/setup.js');
            }).not.toThrow();
        });

        test('jest-dom integration works with CommonJS', () => {
            // Test that jest-dom matchers work after CommonJS import
            const button = document.createElement('button');
            button.disabled = true;
            button.setAttribute('aria-label', 'Test button');
            
            expect(button).toBeDisabled();
            expect(button).toHaveAttribute('aria-label', 'Test button');
        });
    });

    describe('Test Environment Validation', () => {
        test('jsdom environment is properly configured', () => {
            expect(typeof window).toBe('object');
            expect(typeof document).toBe('object');
            expect(typeof navigator).toBe('object');
        });

        test('File constructor is available in test environment', () => {
            expect(typeof File).toBe('function');
            
            const testFile = new File(['content'], 'test.txt', { type: 'text/plain' });
            expect(testFile).toBeInstanceOf(File);
        });

        test('DOM manipulation works in test environment', () => {
            const div = document.createElement('div');
            div.id = 'test-element';
            div.textContent = 'Test content';
            
            document.body.appendChild(div);
            
            const found = document.getElementById('test-element');
            expect(found).toBe(div);
            expect(found.textContent).toBe('Test content');
            
            // Cleanup
            document.body.removeChild(div);
        });
    });
});