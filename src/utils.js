const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const xmlbuilder = require('xmlbuilder');

/**
 * Logs a message of a given type in the terminal
 * @param {String} type
 * @param {String} msg
 * @return {Object}
 */
const logMessage = ({ type, msg, ignoreConsole }) => {
	const logTypes = {
		default: '\x1b[37m%s\x1b[0m',
		success: '\x1b[32m%s\x1b[0m',
		error: '\x1b[31m%s\x1b[0m',
	};
	const logColor = (!logTypes[type]) ? logTypes.default : logTypes[type];
	const logMsg = `jest-html-reporter >> ${msg}`;
	if (!ignoreConsole) {
		console.log(logColor, logMsg); // eslint-disable-line
	}
	return { logColor, logMsg }; // Return for testing purposes
};

/**
 * Creates a file at the given destination
 * @param  {String} filePath
 * @param  {Any} 	content
 */
const writeFile = ({ filePath, content }) => new Promise((resolve, reject) => {
	mkdirp(path.dirname(filePath), (mkdirpError) => {
		if (mkdirpError) {
			return reject(new Error(`Something went wrong when creating the folder: ${mkdirpError}`));
		}
		return fs.writeFile(filePath, content.toString(), (writeFileError) => {
			if (writeFileError) {
				return reject(new Error(`Something went wrong when creating the file: ${writeFileError}`));
			}
			return resolve(filePath);
		});
	});
});

/**
 * Sets up a basic HTML page to apply the content to
 * @return {xmlbuilder}
 */
const createHtmlBase = ({ pageTitle, stylesheet }) => {
	const htmlBase = {
		html: {
			head: {
				meta: { '@charset': 'utf-8' },
				title: { '#text': pageTitle },
			},
		},
	};


	const styleSheet = stylesheet.replace(/(\r\n|\n|\r)/gm, '');
	htmlBase.html.head.style = { '@type': 'text/css', '#text': styleSheet };

	htmlBase.html.head.link = {
		'@rel': 'stylesheet', '@type': 'text/css', '@href': 'https://cdn.jsdelivr.net/npm/pretty-print-json@0.0/dist/pretty-print-json.css',
	};

	htmlBase.html.script = {
		'#text': 'function showHide(item){' +
		'var element = document.getElementById(item); ' +
		'if (element.style.display === "block")' +
		'{ element.style.display = "none";' +
		'} else { ' +
		'element.style.display = "block"; }}' +
		'function showHideAll(){' +
		'var elements = document.getElementsByClassName("suite-consolelog-inner-group");' +
		'for(let element of elements){' +
		'if (element.style.display === "block")' +
		'{ element.style.display = "none";' +
		'} else { ' +
		'element.style.display = "block"; }}}' +
		'function showHideSuite(tableId, consoleLogId, arrowId){' +
		'showHide(tableId); showHide(consoleLogId); switchArrow(arrowId);}' +
		'function switchArrow(id){' +
			'var element = document.getElementById(id);' +
			'if (element.classList.contains("arrowDown")){' +
				'element.classList.remove("arrowDown");' +
				'element.classList.add("arrowRight");' +
			'} else {' +
				'element.classList.remove("arrowRight");' +
				'element.classList.add("arrowDown");}}' +
		'function showHideUrlData(item, arrowId) {' +
			'showHide(item); switchArrow(arrowId); }',
	};

	return xmlbuilder.create(htmlBase);
};

const sortAlphabetically = ({ a, b, reversed }) => {
	if ((!reversed && a < b) || (reversed && a > b)) {
		return -1;
	} else if ((!reversed && a > b) || (reversed && a < b)) {
		return 1;
	}
	return 0;
};

module.exports = {
	logMessage,
	writeFile,
	createHtmlBase,
	sortAlphabetically,
};
