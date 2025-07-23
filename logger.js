const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
    constructor() {
        // Use user data directory for logs
        const userDataPath = (app || require('@electron/remote').app).getPath('userData');
        this.logDir = path.join(userDataPath, 'logs');
        this.currentLogFile = null;
        this.currentMonth = null;
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        
        // Intercept console methods
        this.originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error
        };
        
        // Override console methods
        console.log = (...args) => this.log('LOG', ...args);
        console.info = (...args) => this.log('INFO', ...args);
        console.warn = (...args) => this.log('WARN', ...args);
        console.error = (...args) => this.log('ERROR', ...args);
    }

    getLogFileName() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        return path.join(this.logDir, `${year}-${month.toString().padStart(2, '0')}.log`);
    }

    log(level, ...args) {
        const now = new Date();
        const timestamp = now.toISOString();
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;
        
        try {
            // Check if we need to rotate to a new file
            const logFile = this.getLogFileName();
            if (this.currentLogFile !== logFile) {
                this.currentLogFile = logFile;
            }
            
            // Write to log file
            fs.appendFileSync(this.currentLogFile, logEntry);
        } catch (error) {
            // If we can't write to the log file, at least show in console
            this.originalConsole.error('Failed to write to log file:', error);
        }
        
        // Also output to original console
        this.originalConsole[level.toLowerCase()](...args);
    }
}

// Create singleton instance
const logger = new Logger();
module.exports = logger;
