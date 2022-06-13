#!/usr/bin/env node

import fetch from 'node-fetch';
import path from 'path';
import url from 'url';
import findChromeVersion from "find-chrome-version";
import { exec } from 'child_process';

function findBrowserVersion(browserName: string): Promise<string> {
	if (browserName === 'chrome') {
		return findChromeVersion().then(chromeVersion => {
			const c = chromeVersion.substring(0, chromeVersion.lastIndexOf('.'));
			return fetch(`https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${c}`).then(res => res.text());
		});
	}
	return Promise.resolve("false");
}

function getWebdriverManagerCommand(browserVersions: {[name: string]: string}): string {
	const cmd = ["webdriver-manager update"];
	["standalone", "gecko", "chrome"].forEach(defaultBrowserName => {
		if (!(defaultBrowserName in browserVersions)) {
			cmd.push(`--${defaultBrowserName}`, "false");
		}
	});
	for (const browserName in browserVersions) {
		if (browserVersions.hasOwnProperty(browserName)) {
			cmd.push(`--versions.${browserName}`, browserVersions[browserName]);
		}
	}
	return cmd.join(" ");
}

const args = process.argv.slice(2);
const protractorConfigPath = url.pathToFileURL(path.resolve(process.cwd(), (args.length < 1) ? './e2e/protractor.conf.js' : args[0])).href;
console.log(`Update browser drivers from protractor config at ${protractorConfigPath}`);
import(protractorConfigPath).then(c => c.config).then(protractorConfig => {
	const browsers = [];
	if (protractorConfig.capabilities) {
		browsers.push(protractorConfig.capabilities.browserName);
	}
	if (protractorConfig.multiCapabilities) {
		browsers.push(protractorConfig.multiCapabilities.map(c => c.browserName));
	}

	Promise.all(browsers.map(browser => findBrowserVersion(browser)))
			.then(versions => {
				const browserVersions = {};
				browsers.forEach((browser, index) => browserVersions[browser] = versions[index]);
				return browserVersions;
			})
			.then(browserVersions => {
				const cmdLine = getWebdriverManagerCommand(browserVersions);
				console.log(`Executing '${cmdLine}' to update browser drivers`);
				const c = exec(cmdLine);
				c.stdout.on('data', (data) => console.log(data));
			});
});
