/**
 * Modal Manager - Robust modal handling with error recovery
 * Ensures modals can always be dismissed and don't block the application
 */

class ModalManager {
    constructor(modalId) {
        this.modalId = modalId;
        this.modalElement = document.getElementById(modalId);
        this.modal = null;
        this.isShowing = false;
        
        if (!this.modalElement) {
            console.error(`Modal element with id "${modalId}" not found`);
            return;
        }
        
        // Initialize Bootstrap modal
        this.modal = new bootstrap.Modal(this.modalElement, {
            backdrop: 'static',
            keyboard: false
        });
        
        // Track modal state
        this.modalElement.addEventListener('shown.bs.modal', () => {
            this.isShowing = true;
        });
        
        this.modalElement.addEventListener('hidden.bs.modal', () => {
            this.isShowing = false;
        });
    }
    
    /**
     * Show the modal
     */
    show() {
        if (!this.modal) return;
        
        try {
            this.modal.show();
            this.isShowing = true;
        } catch (error) {
            console.error('Error showing modal:', error);
            this.forceCleanup();
        }
    }
    
    /**
     * Hide the modal safely
     */
    hide() {
        if (!this.modal) return;
        
        try {
            this.modal.hide();
            this.isShowing = false;
        } catch (error) {
            console.error('Error hiding modal:', error);
            this.forceCleanup();
        }
    }
    
    /**
     * Force cleanup of modal and backdrop
     * Use this when normal hide() fails
     */
    forceCleanup() {
        try {
            // Hide the modal element
            if (this.modalElement) {
                this.modalElement.classList.remove('show');
                this.modalElement.style.display = 'none';
                this.modalElement.setAttribute('aria-hidden', 'true');
                this.modalElement.removeAttribute('aria-modal');
                this.modalElement.removeAttribute('role');
            }
            
            // Remove all backdrops
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());
            
            // Clean up body classes and styles
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
            
            this.isShowing = false;
        } catch (error) {
            console.error('Error in force cleanup:', error);
        }
    }
    
    /**
     * Update modal content (title and message)
     */
    updateContent(title, message) {
        try {
            const titleElement = this.modalElement.querySelector('.modal-title');
            const messageElement = this.modalElement.querySelector('.modal-message, .modal-body p');
            
            if (titleElement && title) {
                titleElement.textContent = title;
            }
            
            if (messageElement && message) {
                messageElement.textContent = message;
            }
        } catch (error) {
            console.error('Error updating modal content:', error);
        }
    }
    
    /**
     * Show error state in modal with dismiss button
     */
    showError(errorMessage) {
        try {
            const modalBody = this.modalElement.querySelector('.modal-body');
            if (!modalBody) return;
            
            // Create error content with dismiss button
            modalBody.innerHTML = `
                <div class="text-center py-4">
                    <div class="text-danger mb-3">
                        <i class="bi bi-exclamation-circle" style="font-size: 3rem;"></i>
                    </div>
                    <h5 class="modal-title mb-3 text-danger">
                        <i class="bi bi-x-circle me-2"></i>Error Occurred
                    </h5>
                    <div class="alert alert-danger text-start mb-3" role="alert">
                        <strong>Error:</strong> ${this.escapeHtml(errorMessage)}
                    </div>
                    <p class="text-muted mb-3">
                        You can dismiss this dialog and continue working.
                    </p>
                    <button type="button" class="btn btn-primary" id="dismissErrorBtn">
                        <i class="bi bi-x-lg me-2"></i>Dismiss
                    </button>
                </div>
            `;
            
            // Add dismiss button handler
            const dismissBtn = modalBody.querySelector('#dismissErrorBtn');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    this.hide();
                    this.forceCleanup();
                });
            }
            
            // Enable keyboard dismiss
            this.modalElement.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.hide();
                    this.forceCleanup();
                }
            });
            
        } catch (error) {
            console.error('Error showing error state:', error);
            this.forceCleanup();
        }
    }
    
    /**
     * Restore modal to loading state
     */
    restoreLoadingState(title = 'Processing', message = 'Please wait...') {
        try {
            const modalBody = this.modalElement.querySelector('.modal-body');
            if (!modalBody) return;
            
            modalBody.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <h5 class="modal-title mb-2">${this.escapeHtml(title)}</h5>
                    <p class="text-muted mb-0 modal-message">${this.escapeHtml(message)}</p>
                </div>
            `;
        } catch (error) {
            console.error('Error restoring loading state:', error);
        }
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Check if modal is currently showing
     */
    isVisible() {
        return this.isShowing;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
}
