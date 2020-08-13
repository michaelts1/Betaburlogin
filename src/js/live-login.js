"use strict"

/**
 * @file Code to run when on Live Login page
 */

/**
 * @async
 * @function liveLogin
 */
async function liveLogin() {
	/**
	 * @typedef {helpers.runtimePort} runtimePort
	 */

	/**
	 * Stores the connection to the background script
	 * @type {runtimePort}
	 */
	const port = browser.runtime.connect({name: "live"})

	/**
	 * Stores the settings
	 * @constant vars
	 * @type {object}
	 */
	const vars = await browser.storage.sync.get(["verbose", "addOpenTabs"])

	if (vars.verbose) log("Starting up (Live Login)")

	if (vars.addOpenTabs) {
		$("#login_notification").html(`<button id="open-alt-tabs">Open Beta Tabs</button>`)
		$("#open-alt-tabs").click(() => {
			port.postMessage({text: "open alt tabs"})
			if (vars.verbose) log("Requesting background script to open alt tabs")
		})
	}
}

liveLogin()
