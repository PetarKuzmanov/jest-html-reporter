/* eslint no-restricted-syntax: ["error", "FunctionExpression", "WithStatement", "BinaryExpression[operator='in']"] */
/* eslint prefer-destructuring: ["error", {AssignmentExpression: {array: true}}] */

const Base = require('mocha').reporters.Base;
const ReportGenerator = require('./reportGenerator');
const config = require('./config');

function JestHtmlReporter(globalConfig, options) {
	// Initiate the config and setup the Generator class
	config.setup();
	const reportGenerator = new ReportGenerator(config);

	/**
	 * If the first parameter has a property named 'testResults',
	 * the script is being run as a 'testResultsProcessor'.
	 * We then need to return the test results as they were received from Jest
	 * https://facebook.github.io/jest/docs/en/configuration.html#testresultsprocessor-string
	 */
	if (Object.prototype.hasOwnProperty.call(globalConfig, 'testResults')) {
		// Generate Report
		reportGenerator.generate({ data: globalConfig });
		// Return the results as required by Jest
		return globalConfig;
	}

	/**
	 * The default behaviour - run as Custom Reporter, in parallel with Jest.
	 * This should eventually be turned into a proper class (whenever the testResultsProcessor option is phased out)
	 * https://facebook.github.io/jest/docs/en/configuration.html#reporters-array-modulename-modulename-options
	 */
	this.jestConfig = globalConfig;
	this.jestOptions = options;
	if (!this.jestOptions) {
		this.jestOptions = {
			framework: 'jest',
		};
	}

	const startTime = Date.now();
	if (this.jestOptions.framework && this.jestOptions.framework === 'jest') {
		this.onRunComplete = (contexts, testResult) => {
			// Apply the configuration within jest.config.json to the current config
			config.setConfigData(this.jestOptions);
			// Apply the updated config
			reportGenerator.config = config;
			// Generate Report
			return reportGenerator.generate({ data: testResult });
		};
	} else {
		// if the framework is mocha
		Base.call(this, this.jestConfig);
		if (!this.jestOptions.outputPath) {
			this.jestOptions.outputPath = 'test-report-mocha.html';
		}

		this.jestConfig.on('end', () => {
			const testResult = {
				numFailedTests: 0,
				numFailedTestSuites: 0,
				numPassedTests: 0,
				numPassedTestSuites: 0,
				numPendingTests: 0,
				numPendingTestSuites: 0,
				numRuntimeErrorTestSuites: 0,
				numTodoTests: 0,
				numTotalTests: 0,
				numTotalTestSuites: 0,
				openHandles: [],
				snapshot: {},
				startTime,
				success: false,
				testResults: [],
				wasInterrupted: false,
			};

			const suites = this.jestConfig.suite.suites;
			for (const suite of suites) {
				const suitItem = {
					console: [],
					coverage: undefined,
					displayName: undefined,
					failureMessage: null,
					leaks: false,
					numFailingTests: 0,
					numPassingTests: 0,
					numPendingTests: 0,
					numTodoTests: 0,
					perfStats: { end: 0, start: 0 },
					skipped: true,
					snapshot: {},
					sourceMaps: {},
					testFilePath: '',
					testResults: [],
					duration: 0,
				};
				for (const test of suite.tests) {
					if (test.ctx.console) {
						suitItem.console = test.ctx.console;
					}
					const testItem = {
						ancestorTitles: [suite.title],
						duration: 0,
						failureMessages: [],
						fullName: suite.title + test.title,
						location: null,
						numPassingAsserts: 0,
						status: !test.state ? 'pending' : test.state,
						title: test.title,
					};
					if (!test.state) {
						testResult.numPendingTests += 1;
					} else if (test.state === 'passed') {
						testResult.numPassedTests += 1;
					} else if (test.state === 'failed') {
						testResult.numFailedTests += 1;
						testItem.failureMessages.push(test.err.stack);
					}
					testResult.numTotalTests += 1;
					suitItem.duration += test.duration;
					suitItem.testResults.push(testItem);
					suitItem.testFilePath = test.file;
				}
				testResult.numTotalTestSuites += 1;
				testResult.testResults.push(suitItem);
			}
			testResult.success = testResult.numFailedTests === 0;

			// Apply the configuration within jest.config.json to the current config
			config.setConfigData(this.jestOptions);
			// Apply the updated config
			reportGenerator.config = config;
			// Generate Report
			return reportGenerator.generate({ data: testResult });
		});
	}
}

module.exports = JestHtmlReporter;
