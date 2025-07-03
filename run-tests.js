#!/usr/bin/env node

// Simple test runner to verify our Jest setup
const { execSync } = require('child_process');

try {
    console.log('Running Jest tests...');
    const result = execSync('npx jest --verbose', { 
        encoding: 'utf8',
        stdio: 'inherit'
    });
    console.log('Tests completed successfully!');
} catch (error) {
    console.error('Tests failed:', error.message);
    process.exit(1);
}