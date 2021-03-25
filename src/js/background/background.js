"use strict"

/**
 * @file Background processes
 */
/**
 * @namespace background
 */

/* global getSettings, settings */

/**
 * @typedef {helpers.runtimePort} runtimePort
 * @memberof background
 */

/**
 * Stores the different ports
 * @const ports
 * @enum {null|runtimePort|runtimePort[]}
 * @property {?runtimePort} live Live Login Page port
 * @property {?runtimePort} main Beta game page main port
 * @property {runtimePort[]} alt Beta game page alt ports
 * @property {runtimePort[]} login Beta Login Page port
 * @memberof background
 */
const ports = {
	live : null,
	main : null,
	alt : [],
	login: [],
}

/**
 * Wrapper class for {runtimePort} objects
 */
class Port {
	constructor(runtimePort) {
		// Split `name` back to name and role:
		const [name, role] = runtimePort.name.split(" ")
		this.name = name
		this.role = role

		// Define properties and methods:
		this.originalPortObject = runtimePort
		this.postMessage = runtimePort.postMessage
		this.cookieStoreId = runtimePort.sender.tab.cookieStoreId

		/**
		 * Logs in with a given Username
		 * @param {String} username
		 */
		this.login = username => {
			this.postMessage({
				text: "login",
				username,
			})
		}

		/**
		 * Listens for a message from the runtime port and triggers the handler when the message is received
		 * @param {String} trigger A String that will trigger the handler when received from the runtime port
		 * @param {Function} handler A function that will run when triggered
		 */
		this.listen = (trigger, handler) => {
			this.originalPortObject.onMessage.addListener(message => {
				if (message.text === trigger) handler()
			})
		}

		// Store port inside `ports`:
		Array.isArray(ports[role])
			? ports[role].push(this)
			: ports[role] = this

		// Attach listeners:
		switch (role) {
			case "live":
				this.listen("open alt tabs", openTabs)
				break
			case "login":
				this.listen("requesting login", login)
				break
			case "main":
				// Fall through
			case "alt":
				this.listen("banner closed", () => {
					sendMessage({text: "close banners"})
				})

				this.listen("requesting currency", () => {
					sendMessage({text: "send currency", recipient: this.name})
				})

				this.listen("receive advent calendar awards", () => {
					sendMessage({text: "open advent calendar"})
				})

				this.listen("requesting a list of active alts", () => {
					this.postMessage({
						text: "list of active alts",
						alts: [ports.main.name, ...ports.alt.map(alt => alt.name)],
					})
				})
		}

		// Disconnect event handler:
		this.originalPortObject.onDisconnect.addListener(() => {
			// When a port disconnects, forget it:
			if (Array.isArray(ports[role])) {
				const index = ports[role].indexOf(this)
				delete ports[role][index]
				if (index !== -1) ports[role].splice(index, 1)
			} else {
				delete ports[role]
				ports[role] = null
			}

			log(`${role}${name ? ` (${name})` : ""} disconnected`)
		})
	}
}

browser.runtime.onConnect.addListener(runtimePort => {
	const port = new Port(runtimePort)
	log(`${port.role}${port.name ? ` (${port.name})` : ""} connected`)
})

/**
 * Returns a list of containers for use by Betaburlogin
 * @async
 * @function getContainers
 * @memberof background
 * @returns {Promise<Array>} A promise that resolves to an array of {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/contextualIdentities/ContextualIdentity|Contextual Identities}
 */
async function getContainers() {
	return new Promise(resolve => {
		if (settings.containers.useAll) {
			// Return the default container and all other containers:
			browser.contextualIdentities.query({}).then(containers => {
				resolve(["firefox-default", ...containers.map(e=>e.cookieStoreId)])
			})
		} else {
			// Return the selected containers only:
			resolve(settings.containers.list)
		}
	})
}

/**
 * Opens Beta Login tabs according to the amount of alts
 * @async
 * @function openTabs
 * @memberof background
 */
async function openTabs() {
	let containers = await getContainers()

	// Number of alts, including main:
	const altsNumber = 1 + (settings.pattern === "unique" ? settings.namesList.length : settings.altsNumber)

	for (let i = 0; i < Math.min(containers.length, altsNumber); i++) {
		setTimeout(() => {
			browser.tabs.create({
				cookieStoreId: containers[i],
				url: "https://beta.avabur.com",
			})
		}, 10 * i+1)
	}
}

/**
 * Logs in all the currently open Beta Login pages
 * @async
 * @function login
 * @memberof background
 */
async function login() {
	const containers = await getContainers()

	for (const port of ports.login) {
		// Login alts based on container id:
		const index = containers.indexOf(port.cookieStoreId)
		// Login main account
		if (index === 0) {
			port.login(settings.mainAccount)
			continue
		}

		// Login alts:
		if (settings.pattern === "roman") {
			port.login(settings.altBaseName + helpers.romanize(index))
		} else {
			// Use `index-1` since namesList[0] is #1st alt's name:
			port.login(settings.namesList[index-1])
		}
	}
}

/**
 * Sends a message to all ports inside an array at once
 * @function sendMessage
 * @param {object} message A message to be sent
 * @param {runtimePort[]} [users=[...ports.alt, ports.main]] An array of `runtimePort` objects. If omitted, defaults to `[...ports.alt, ports.main]`
 * @memberof background
 */
function sendMessage(message, users=[...ports.alt, ports.main]) {
	for (const user of users) {
		user.postMessage(message)
	}
}

getSettings()

log("background script finished evaluating")
