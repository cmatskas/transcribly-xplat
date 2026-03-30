/**
 * Tests for ModalManager — matches actual API:
 * constructor(modalId), show(), hide(), forceCleanup(), updateContent()
 */

const ModalManager = require('../../src/renderer/modalManager');

describe('ModalManager', () => {
    let modalManager, mockModal, mockBootstrapModal;

    beforeEach(() => {
        mockBootstrapModal = { show: jest.fn(), hide: jest.fn(), dispose: jest.fn() };
        global.bootstrap = { Modal: jest.fn(() => mockBootstrapModal) };

        mockModal = document.createElement('div');
        mockModal.id = 'testModal';
        mockModal.innerHTML = '<div class="modal-title"></div><div class="modal-body"><p></p></div>';
        document.body.appendChild(mockModal);

        modalManager = new ModalManager('testModal');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete global.bootstrap;
    });

    describe('Constructor', () => {
        test('should initialize with modal element', () => {
            expect(modalManager.modalElement).toBe(mockModal);
            expect(modalManager.isShowing).toBe(false);
        });

        test('should handle modal not found', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const mm = new ModalManager('nonexistent');
            expect(mm.modalElement).toBeNull();
            consoleSpy.mockRestore();
        });

        test('should create Bootstrap modal instance', () => {
            expect(global.bootstrap.Modal).toHaveBeenCalledWith(mockModal, expect.any(Object));
        });
    });

    describe('show()', () => {
        test('should call Bootstrap modal show', () => {
            modalManager.show();
            expect(mockBootstrapModal.show).toHaveBeenCalled();
            expect(modalManager.isShowing).toBe(true);
        });

        test('should handle errors gracefully', () => {
            mockBootstrapModal.show.mockImplementation(() => { throw new Error('Show error'); });
            expect(() => modalManager.show()).not.toThrow();
        });

        test('should no-op if modal not initialized', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const mm = new ModalManager('nonexistent');
            expect(() => mm.show()).not.toThrow();
            consoleSpy.mockRestore();
        });
    });

    describe('hide()', () => {
        test('should call Bootstrap modal hide', () => {
            modalManager.hide();
            expect(mockBootstrapModal.hide).toHaveBeenCalled();
            expect(modalManager.isShowing).toBe(false);
        });

        test('should handle errors gracefully', () => {
            mockBootstrapModal.hide.mockImplementation(() => { throw new Error('Hide error'); });
            expect(() => modalManager.hide()).not.toThrow();
        });
    });

    describe('forceCleanup()', () => {
        test('should remove show class and backdrop', () => {
            mockModal.classList.add('show');
            document.body.classList.add('modal-open');
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            document.body.appendChild(backdrop);

            modalManager.forceCleanup();

            expect(mockModal.classList.contains('show')).toBe(false);
            expect(mockModal.style.display).toBe('none');
            expect(document.body.classList.contains('modal-open')).toBe(false);
            expect(document.querySelectorAll('.modal-backdrop')).toHaveLength(0);
            expect(modalManager.isShowing).toBe(false);
        });
    });

    describe('updateContent()', () => {
        test('should update title and message', () => {
            modalManager.updateContent('New Title', 'New Message');
            expect(mockModal.querySelector('.modal-title').textContent).toBe('New Title');
            expect(mockModal.querySelector('.modal-body p').textContent).toBe('New Message');
        });
    });

    describe('Event tracking', () => {
        test('should track shown state via event', () => {
            mockModal.dispatchEvent(new Event('shown.bs.modal'));
            expect(modalManager.isShowing).toBe(true);
        });

        test('should track hidden state via event', () => {
            modalManager.isShowing = true;
            mockModal.dispatchEvent(new Event('hidden.bs.modal'));
            expect(modalManager.isShowing).toBe(false);
        });
    });
});
