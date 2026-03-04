/**
 * Tests for ModalManager
 */

describe('ModalManager', () => {
    let ModalManager;
    let modalManager;
    let mockModal;
    let mockBootstrapModal;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Create mock modal
        mockModal = document.createElement('div');
        mockModal.id = 'testModal';
        mockModal.className = 'modal';
        mockModal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Test Modal</h2>
                <p>Test content</p>
            </div>
        `;
        document.body.appendChild(mockModal);

        // Mock Bootstrap Modal
        mockBootstrapModal = {
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        };
        
        global.bootstrap = {
            Modal: jest.fn().mockImplementation(() => mockBootstrapModal)
        };

        // Clear module cache and require fresh
        jest.resetModules();
        ModalManager = require('../../src/renderer/modalManager');
        modalManager = new ModalManager('testModal');
    });

    afterEach(() => {
        if (modalManager) {
            modalManager.destroy();
        }
        delete global.bootstrap;
    });

    describe('Constructor', () => {
        test('should initialize with modal element', () => {
            expect(modalManager.modalElement).toBe(mockModal);
            expect(modalManager.isShowing).toBe(false);
        });

        test('should handle modal not found gracefully', () => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            const manager = new ModalManager('nonexistent');
            expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('not found'));
            consoleError.mockRestore();
        });

        test('should initialize Bootstrap modal', () => {
            expect(global.bootstrap.Modal).toHaveBeenCalledWith(
                mockModal,
                expect.objectContaining({
                    backdrop: 'static',
                    keyboard: false
                })
            );
        });
    });

    describe('show()', () => {
        test('should call Bootstrap modal show', () => {
            modalManager.show();
            expect(mockBootstrapModal.show).toHaveBeenCalled();
        });

        test('should handle errors gracefully', () => {
            mockBootstrapModal.show.mockImplementation(() => {
                throw new Error('Show error');
            });
            expect(() => modalManager.show()).not.toThrow();
        });
    });

    describe('hide()', () => {
        test('should call Bootstrap modal hide', () => {
            modalManager.hide();
            expect(mockBootstrapModal.hide).toHaveBeenCalled();
        });

        test('should handle errors gracefully', () => {
            mockBootstrapModal.hide.mockImplementation(() => {
                throw new Error('Hide error');
            });
            expect(() => modalManager.hide()).not.toThrow();
        });
    });

    describe('setContent()', () => {
        test('should update modal body content', () => {
            const newContent = '<p>New content</p>';
            modalManager.setContent(newContent);
            const body = mockModal.querySelector('.modal-body');
            if (body) {
                expect(body.innerHTML).toBe(newContent);
            }
        });
    });

    describe('setTitle()', () => {
        test('should update modal title', () => {
            mockModal.innerHTML = '<div class="modal-header"><h5 class="modal-title">Old Title</h5></div>';
            modalManager.setTitle('New Title');
            const title = mockModal.querySelector('.modal-title');
            if (title) {
                expect(title.textContent).toBe('New Title');
            }
        });
    });

    describe('destroy()', () => {
        test('should dispose Bootstrap modal', () => {
            modalManager.destroy();
            expect(mockBootstrapModal.dispose).toHaveBeenCalled();
        });

        test('should handle errors during disposal', () => {
            mockBootstrapModal.dispose.mockImplementation(() => {
                throw new Error('Dispose error');
            });
            expect(() => modalManager.destroy()).not.toThrow();
        });
    });

    describe('Event Listeners', () => {
        test('should track modal shown state', () => {
            const event = new Event('shown.bs.modal');
            mockModal.dispatchEvent(event);
            expect(modalManager.isShowing).toBe(true);
        });

        test('should track modal hidden state', () => {
            modalManager.isShowing = true;
            const event = new Event('hidden.bs.modal');
            mockModal.dispatchEvent(event);
            expect(modalManager.isShowing).toBe(false);
        });
    });
});
