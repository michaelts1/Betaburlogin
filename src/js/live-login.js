"use strict"

/**
 * @file Code to run when on Live Login page
 */
/**
 * @namespace live-login
 */

/**
 * @async
 * @function liveLogin
 * @memberof live-login
 */
async function liveLogin() {
	/**
	 * @typedef {helpers.runtimePort} runtimePort
	 * @memberof live-login
	 */

	/**
	 * Stores the connection to the background script
	 * @type {runtimePort}
	 * @memberof live-login
	 */
	const port = browser.runtime.connect({name: "live"})
	const settings = await browser.storage.sync.get(["verbose", "addOpenTabs"])

	if (settings.verbose) log("Starting up (Live Login)")

	if (settings.addOpenTabs) {
		$("#login_notification").html(`<button id="open-alt-tabs">Open Beta Tabs</button>`)
		$("#open-alt-tabs").click(() => {
			port.postMessage({text: "open alt tabs"})
			if (settings.verbose) log("Requesting background script to open alt tabs")
		})
	}
}

liveLogin()
