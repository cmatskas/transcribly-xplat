# Test Suite for Bedrock Media Transcribe App

This directory contains comprehensive unit tests for the Electron application.

## Test Structure

- `tests/renderer/index.test.js` - Tests for the main renderer process JavaScript file
- `tests/setup.js` - Jest configuration and global test utilities

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npx jest tests/renderer/index.test.js
```

## Test Coverage

The test suite covers:

### Toast Functions
- `showSuccessToast()` - Success notification display
- `showErrorToast()` - Error notification display  
- `showInfoToast()` - Info notification display
- `showWarningToast()` - Warning notification display

### Navigation Functions
- `showTranscribePage()` - Switch to transcription view
- `showAnalyzePage()` - Switch to analysis view

### File Operations
- `downloadAnalysis()` - Download analysis results
- `copyAnalysis()` - Copy analysis to clipboard
- `uploadFile()` - File upload and transcription handling

### Bedrock Integration
- Bedrock model invocation with/without knowledge base
- Prompt validation and error handling
- Knowledge base selection and validation

### Knowledge Base Functions
- `loadKnowledgeBases()` - Load available knowledge bases
- localStorage caching and API fallback
- Error handling for API failures

### Utility Functions
- `simpleCitationParser()` - Parse citation data from Bedrock responses
- `formatText()` - Format text with markdown support
- `cleanupAnalysisText()` - Clean up analysis text formatting

### Event Listeners
- File input change events
- Drag and drop functionality
- Template selection changes
- Knowledge base configuration changes

### Code Structure
- Verification of recent code changes (test comment)
- Variable initialization checks

## Mocking Strategy

The tests use comprehensive mocking for:
- `window.electronAPI` - Electron IPC communication
- `fetch` - HTTP requests for transcription API
- `localStorage` - Browser storage
- `navigator.clipboard` - Clipboard operations
- DOM elements and events

## Test Environment

- **Framework**: Jest with jsdom environment
- **DOM Testing**: jsdom for browser environment simulation
- **Async Testing**: Proper handling of promises and async operations
- **Timer Mocking**: Fake timers for polling operations

## Adding New Tests

When adding new functionality to `src/renderer/index.js`:

1. Add corresponding test cases in `tests/renderer/index.test.js`
2. Mock any new external dependencies
3. Expose new functions in the window object for testing
4. Test both success and error scenarios
5. Include edge cases and validation logic

## Coverage Goals

- **Functions**: 100% coverage of all exported functions
- **Branches**: Cover all conditional logic paths
- **Lines**: Aim for >90% line coverage
- **Error Handling**: Test all error scenarios and edge cases