"use strict"

/**
 * @file Code to run when on Beta Login page
 */
/**
 * @namespace beta-login
 */

/**
 * @async
 * @function betaLogin
 * @memberof beta-login
 */
async function betaLogin() {
	/**
	 * @typedef {helpers.runtimePort} runtimePort
	 * @memberof beta-login
	 */

	/**
	 * Stores the connection to the background script
	 * @type {runtimePort}
	 * @memberof beta-login
	 */
	const port = browser.runtime.connect({name: " login"})
	const settings = await browser.storage.sync.get(["verbose", "addLoginAlts", "loginPassword"])

	/**
	 * Logs in with a given username
	 * @async
	 * @function login
	 * @param {string} username
	 * @private
	 * @memberof beta-login
	 */
	async function login(username) {
		$("#acctname").val(username)
		$("#password").val(await insecureCrypt.decrypt(settings.loginPassword, "betabot Totally-not-secure Super NOT secret key!"))
		$("#login").click()
		if (settings.verbose) log(`Logging in with username ${username}`)
		await delay(7500)
		if ($("#login_notification").text() === "Your location is making too many requests too quickly.  Try again later.") {
			if (settings.verbose) log("Rate limited, trying again")
			login(username)
		}
	}

	if (settings.verbose) log("Starting up (Beta Login)")

	if (settings.addLoginAlts) {
		port.onMessage.addListener(message => {
			if (settings.verbose) log(`Received message with text: ${message.text}`)
			if (message.text === "login") login(message.username)
		})

		$("#login_notification").html(`<button id="login-alts">Login All Alts</button>`)
		$("#login-alts").click(() => { port.postMessage({text: "requesting login"}) })
	}
}

betaLogin()
