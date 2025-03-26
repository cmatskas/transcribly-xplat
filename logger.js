const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = 'logs';
        this.currentLogFile = null;
        this.currentMonth = null;
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir);
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
        
        // Check if we need to rotate to a new file
        const logFile = this.getLogFileName();
        if (this.currentLogFile !== logFile) {
            this.currentLogFile = logFile;
        }
        
        // Write to log file
        fs.appendFileSync(this.currentLogFile, logEntry);
        
        // Also output to original console
        this.originalConsole[level.toLowerCase()](...args);
    }
}

// Create singleton instance
const logger = new Logger();
module.exports = logger;