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
