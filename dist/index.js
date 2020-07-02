"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const htmlreporter_1 = __importDefault(require("./htmlreporter"));
/**
 * Setup Jest HTML Reporter and generate a report with the given data
 */
const setupAndRun = (testResults, options, jestConfig, logs) => {
    const reporter = new htmlreporter_1.default(testResults, options, jestConfig, logs);
    return reporter.generate();
};
/**
 * The test runner function passed to Jest
 */
function JestHtmlReporter(globalConfig, options) {
    const consoleLogs = [];
    /**
     * If the first parameter has a property named 'testResults',
     * the script is being run as a 'testResultsProcessor'.
     * We then need to return the test results as they were received from Jest
     * https://facebook.github.io/jest/docs/en/configuration.html#testresultsprocessor-string
     */
    if (Object.prototype.hasOwnProperty.call(globalConfig, "testResults")) {
        // @ts-ignore
        setupAndRun(globalConfig.testResults, options, globalConfig);
        // Return the results as required by Jest
        return globalConfig;
    }
    /**
     * The default behaviour - run as Custom Reporter, in parallel with Jest.
     * https://facebook.github.io/jest/docs/en/configuration.html#reporters-array-modulename-modulename-options
     */
    this.onTestResult = (data, result) => {
        // Catch console logs per test
        // TestResult will only contain console logs if Jest is run with verbose=false
        if (result.console) {
            consoleLogs.push({
                filePath: result.testFilePath,
                logs: result.console,
            });
        }
    };
    this.onRunComplete = (contexts, testResult) => setupAndRun(testResult, options, globalConfig, consoleLogs);
}
exports.default = JestHtmlReporter;
//# sourceMappingURL=index.js.map