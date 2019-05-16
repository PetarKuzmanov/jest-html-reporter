/* eslint no-restricted-syntax: ["error"] */

const fs = require('fs');
const dateFormat = require('dateformat');
const stripAnsi = require('strip-ansi');
const utils = require('./utils');
const sorting = require('./sorting');
const prettyPrintJson = require('pretty-print-json');
const xmlbuilder = require('xmlbuilder');
const Chart = require('chart.js');

class ReportGenerator {
	constructor(config) {
		this.config = config;
	}

	/**
	 * Generates and writes HTML report to a given path
	 * @param  {Object} data   Jest test information data
	 * @return {Promise}
	 */
	generate({ data, ignoreConsole }) {
		const fileDestination = this.config.getOutputFilepath();

		const framework = fileDestination.includes('mocha') ? 'mocha' : 'jest';
		return this.getStylesheetContent()
			.then(stylesheet => this.renderHtmlReport({
				data,
				stylesheet,
				framework,
			}))
			.then(xmlBuilderOutput => utils.writeFile({
				filePath: fileDestination,
				content: xmlBuilderOutput,
			}))
			.then(() => utils.logMessage({
				type: 'success',
				msg: `Report generated (${fileDestination})`,
				ignoreConsole,
			}))
			.catch(error => utils.logMessage({
				type: 'error',
				msg: error,
				ignoreConsole,
			}));
	}

	/**
	 * Returns the stylesheet to be required in the test report.
	 * If styleOverridePath is not defined, it will return the defined theme file.
	 * @return {Promise}
	 */
	getStylesheetContent() {
		const pathToStylesheet = this.config.getStylesheetFilepath();
		return new Promise((resolve, reject) => {
			fs.readFile(pathToStylesheet, 'utf8', (err, content) => {
				if (err) {
					return reject(new Error(`Could not locate the stylesheet: '${pathToStylesheet}': ${err}`));
				}
				return resolve(content);
			});
		});
	}

	/**
	 * Returns a HTML containing the test report.
	 * @param  {String} stylesheet
	 * @param  {Object} data		The test result data
	 * @return {xmlbuilder}
	 */
	renderHtmlReport({ data, stylesheet, framework }) {
		return new Promise((resolve, reject) => {
			// Make sure that test data was provided
			if (!data) { return reject(new Error('Test data missing or malformed')); }

			// Fetch Page Title from config
			const pageTitle = this.config.getPageTitle();

			// Create an xmlbuilder object with HTML and Body tags

			const htmlOutput = utils.createHtmlBase({
				pageTitle,
				stylesheet,
			});

			// HEADER
			const header = htmlOutput.ele('header');

			// Page Title
			header.ele('h1', { id: 'title' }, pageTitle);
			// Logo
			const logo = this.config.getLogo();
			if (logo) {
				header.ele('img', { id: 'logo', src: logo });
			}

			// METADATA
			const metaDataContainer = htmlOutput.ele('div', { id: 'metadata-container' });
			// Timestamp
			const timestamp = new Date(data.startTime);
			metaDataContainer.ele('div', { id: 'timestamp' }, `Start: ${dateFormat(timestamp, this.config.getDateFormat())}`);
			// Test Summary
			metaDataContainer.ele('div', { id: 'summary' }, `
				${data.numTotalTests} tests --
				${data.numPassedTests} passed /
				${data.numFailedTests} failed /
				${data.numPendingTests} pending
			`);

			// const chartElement = metaDataContainer.ele('canvas').att('style', 'width:400;height:400;');
			// const myDoughnutChart = new Chart(chartElement, {
			// 	type: 'doughnut',
			// 	data: {
			// 		datasets: [{
			// 			data: [data.numPassedTests, data.numFailedTests, data.numPendingTests],
			// 		}],
			// 		labels: ['Passed', 'Failed', 'Pending'],
			// 	},
			// });

			// Apply the configured sorting of test data
			const sortedTestData = sorting.sortSuiteResults({
				testData: data.testResults,
				sortMethod: this.config.getSort(),
			});

			// Test Suites
			let index = 0;
			let suiteIndex = 0;
			if (framework === 'mocha') {
				suiteIndex = 9999;
				index = 9999999;
			}
			const allSuites = htmlOutput.ele('div', { class: 'allSuites' });
			sortedTestData.forEach((suite) => {
				if (!suite.testResults || suite.testResults.length <= 0) { return; }
				if (!suite.testResults.find(test => test.status === 'failed')) { return; }

				const suiteElement = allSuites.ele('div', { class: 'suiteElement' });
				const suiteTableId = `suite-table-${suiteIndex}`;
				const arrowSuiteTableId = `arrow-${suiteIndex}`;
				const suiteConsoleLogId = `suite-consolelog-${suiteIndex}`;
				suiteIndex += 1;
				// Suite Information
				const suiteInfo = suiteElement.ele('div', {
					class: 'suite-info',
				});
				const arrow = xmlbuilder.create('div')
					.ele('div', {
						class: 'circleArrow',
						onclick: `showHideSuite('${suiteTableId}','${suiteConsoleLogId}', '${arrowSuiteTableId}')`,
					})
					.ele('arrow', {
						id: `${arrowSuiteTableId}`,
						class: 'arrowRight',
					});
				const space = xmlbuilder.create('div').ele('pre', {}, ' ');
				suiteInfo.importDocument(arrow);
				suiteInfo.importDocument(space);
				// Suite Path
				suiteInfo.ele('div', { class: 'suite-path' }, suite.testFilePath);
				// Suite execution time
				let executionTime = 0;
				if (suite.perfStats.start === 0 && suite.perfStats.end === 0 && suite.duration) {
					executionTime = suite.duration / 1000;
				} else {
					executionTime = (suite.perfStats.end - suite.perfStats.start) / 1000;
				}
				suiteInfo.ele('div', { class: `suite-time${executionTime > 5 ? ' warn' : ''}` }, `${executionTime}s`);

				// Suite Test Table
				const suiteTable = suiteElement.ele('table', {
					class: 'suite-table', cellspacing: '0', cellpadding: '0', id: `${suiteTableId}`,
				});

				// Test Results
				const testsInConsoleLog = suite.console.filter(log =>
					typeof log.message === 'string' && log.message.includes('*** test started ***'));
				let failedTests = suite.testResults.map(test => test.status === 'failed');
				let testsTitles = suite.testResults.map(test => test.title);
				if (testsInConsoleLog.length < failedTests.length) {
					failedTests = suite.testResults.filter(test => test.status === 'failed' && test.title.includes('@'));
					failedTests = failedTests.map(test => test.status === 'failed');
					testsTitles = testsTitles.filter(title => title.includes('@'));
				}
				suite.testResults.forEach((test) => {
					if (test.status !== 'failed') { return; }

					const testTr = suiteTable.ele('tr', { class: test.status });

					// Suite Name(s)
					testTr.ele('td', { class: 'suite' }, test.ancestorTitles.join(' > '));

					// Test name
					const testTitleTd = testTr.ele('td', { class: 'test' }, test.title);

					// Test Failure Messages
					if (test.failureMessages && (this.config.shouldIncludeFailureMessages())) {
						const failureMsgDiv = testTitleTd.ele('div', { class: 'failureMessages' });
						test.failureMessages.forEach((failureMsg) => {
							failureMsgDiv.ele('pre', { class: 'failureMsg' }, stripAnsi(failureMsg));
						});
					}

					// Append data to <tr>
					testTr.ele('td', { class: 'result' }, (test.status === 'passed') ? `${test.status} in ${test.duration / 1000}s` : test.status);
				});

				// Test Suite console.logs
				if (suite.console && suite.console.length > 0 && (this.config.shouldIncludeConsoleLog())) {
					let beforeAllHook = false;
					let skipDesc = true;
					const skipDescribes = [];
					let testCouter = 0;
					const beforeAllHooks = suite.console.filter(log =>
						typeof log.message === 'string' && log.message.includes('*** before all start ***'));
					if (beforeAllHooks.length > 1) {
						for (const log of suite.console) {
							const isMessageString = typeof log.message === 'string';
							if (isMessageString && log.message.includes('*** before all start ***')) {
								beforeAllHook = true;
							}
							if (beforeAllHook && isMessageString && log.message.includes('*** test started ***')) {
								skipDesc = !failedTests[testCouter];
								testCouter += 1;
							}
							if (isMessageString && log.message.includes('*** after all end ***')) {
								beforeAllHook = false;
								skipDescribes.push(skipDesc);
							}
						}
					} else {
						skipDescribes.push(false);
					}

					// Console Log Container
					const consoleLogContainer = suiteElement.ele('div', { class: 'suite-consolelog', id: `${suiteConsoleLogId}` });
					// Console Log Header
					const consoleLogHeader = consoleLogContainer.ele('div', { class: 'suite-consolelog-header' }, 'Console Log');
					consoleLogHeader.ele('button', { class: 'suite-consolelog-show-hide-all', onclick: 'showHideAll()' }, stripAnsi('Show/Hide All'));

					// Logs
					let counter = 0;
					let skipLog = false;
					let logGroup;
					let logInnerGroup;
					let hookCounter = 0;
					let skipDescribe = false;
					const suiteTitles = [];
					suite.console.forEach((log) => {
						const isMessageString = typeof log.message === 'string';
						if (isMessageString && log.message.includes('*** describe ***')) {
							suiteTitles.push(log.message.replace('*** describe *** ', ''));
							return;
						}
						if (isMessageString && log.message.includes('*** before all start ***')) {
							skipDescribe = skipDescribes[hookCounter];
							hookCounter += 1;
						}
						if (isMessageString && log.message === '*** test started ***') {
							skipLog = !failedTests[counter];
							counter += 1;
						}
						if (skipDescribe) {
							if (isMessageString && log.message === '*** test ended ***') {
								skipLog = failedTests[counter - 1];
							}
							return;
						}
						if (!skipLog) {
							if (isMessageString && (log.message.includes('*** before') || log.message.includes('*** after'))) {
								const logStartEnd = consoleLogContainer.ele('div', { class: 'suite-consolelog-hooks' });
								logStartEnd.ele(
									'pre', { class: 'suite-consolelog-item-message' },
									stripAnsi(`${log.message}: ${suiteTitles[hookCounter - 1] === undefined ? '' : suiteTitles[hookCounter - 1]}`),
								);
								return;
							}
							if (isMessageString && (log.message.includes('*** test started ***') || log.message.includes('*** test ended ***'))) {
								const logStartEnd = consoleLogContainer.ele('div', { class: 'suite-consolelog-test' });
								logStartEnd.ele(
									'pre', { class: 'suite-consolelog-item-message' },
									stripAnsi(`${log.message}: ${testsTitles[counter - 1]}`),
								);
								return;
							}
							if (isMessageString && log.message.includes('***h3 INFO')) {
								const logInfo = consoleLogContainer.ele('div', { class: 'suite-consolelog-info' });
								logInfo.ele('pre', {
									class: 'suite-consolelog-info-message',
									style: 'background-color:#42F500;font-size:12px;margin:0px 10px;',
								}, log.message.replace('***h3', ''));
								return;
							}
							if (isMessageString && log.message.includes('URL: ')) {
								logGroup = consoleLogContainer.ele('div', { class: 'suite-consolelog-group' });
								const id = `item-message-${index}`;
								const arrowUrlId = `arrowUrl-${index}`;
								const arrowUrl = xmlbuilder.create('div')
									.ele('div', {
										class: 'circleArrow',
										onclick: `showHideUrlData('${id}', '${arrowUrlId}')`,
									})
									.ele('arrow', {
										id: `${arrowUrlId}`,
										class: 'arrowRight',
									});
								const urlElement = xmlbuilder.create('div').att('style', 'display:flex;background-color:lightcyan;');
								urlElement.importDocument(arrowUrl);
								urlElement.ele('pre').att('class', 'suite-consolelog-group-show-hide').txt(stripAnsi(log.message));
								logGroup.importDocument(urlElement);

								logInnerGroup = logGroup.ele('div', { class: 'suite-consolelog-inner-group', id: `${id}` });
								index += 1;
								return;
							}
							if (logInnerGroup) {
								const logElement = logInnerGroup.ele('div', { class: 'suite-consolelog-item' });
								const logElementPrev = logElement.ele('pre');
								let c;
								try {
									c = JSON.parse(log.message);
								} catch (e) {
									//
								}

								if (c) {
									logElementPrev.raw(prettyPrintJson.toHtml(c || log.message));
								} else if (log.message && isMessageString && log.message.includes('**h1')) {
									logElementPrev.ele('pre', {
										class: 'suite-consolelog-item-message',
										style: 'background-color:#eca2a2;font-size:20px;',
									}, log.message.replace('**h1', ''));
								} else if (log.message && isMessageString && log.message.includes('**h2')) {
									logElementPrev.ele('pre', {
										class: 'suite-consolelog-item-message',
										style: 'background-color:#9d9dd0;font-size:17px;',
									}, log.message.replace('**h2', ''));
								} else {
									logElementPrev.ele('pre', { class: 'suite-consolelog-item-message' }, log.message);
								}
							} else {
								const logElement = consoleLogContainer.ele('div', { class: 'suite-consolelog-item' });
								logElement.ele('pre', { class: 'suite-consolelog-item-message' }, stripAnsi(log.message));
							}
						}
						if (isMessageString && log.message === '*** test ended ***') {
							skipLog = failedTests[counter - 1];
						}
					});
				}
			});
			// Custom Javascript
			const customScript = this.config.getCustomScriptFilepath();
			if (customScript) {
				htmlOutput.raw(`<script src="${customScript}"></script>`);
			}
			htmlOutput.raw('<script src="https://cdn.jsdelivr.net/npm/pretty-print-json@0.0/dist/pretty-print-json.min.js"></script>');

			return resolve(htmlOutput);
		});
	}
}

module.exports = ReportGenerator;
