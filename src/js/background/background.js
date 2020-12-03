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
 * @property {runtimePort[]} alts Beta game page alt ports
 * @property {runtimePort[]} logins Beta Login Page port
 * @memberof background
 */
const ports = {
	live  : null,
	main  : null,
	alts  : [],
	logins: [],
}

browser.runtime.onConnect.addListener(async port => {
	// Split `name` back to name and role
	const [name, role] = port.name.split(" ")
	port.name = name
	port.role = role

	log(`${port.role}${port.name ? ` (${port.name})` : ""} connected`)

	switch (port.role) {
		case "live":
			ports.live = port
			port.onMessage.addListener(message => {
				if (message.text === "open alt tabs") {
					openTabs()
				}
			})
			break
		case "login":
			ports.logins.push(port)
			port.onMessage.addListener(message => {
				if (message.text === "requesting login") {
					login()
				}
			})
			break
		case "main":
			ports.main = port
			break
		case "alt":
			ports.alts.push(port)
			port.onMessage.addListener(message => {
				switch (message.text) {
					case "move to mob":
						jumpMobs(message.number)
						break
					case "spawnGem":
						spawnGem(message.type, message.splice, message.tier, message.amount)
				}
			})
	}

	if (["main", "alt"].includes(port.role)) { // If beta account
		port.onMessage.addListener(message => {
			switch (message.text) {
				case "requesting currency":
					sendCurrency(port.name)
					break
				case "banner closed":
					closeBanners()
					break
				case "requesting a list of active alts":
					port.postMessage({
						text: "list of active alts",
						alts: [ports.main.name, ...ports.alts.map(alt => alt.name)],
					})
					break
				case "receive advent calendar awards":
					sendMessage({text: "open advent calendar"})
			}
		})
	}

	// When a port disconnects, forget it:
	port.onDisconnect.addListener( () => {
		if (["live", "main"].includes(port.role)) {
			ports[port.role] = null
		} else if (["alt", "login"].includes(port.role)) {
			const index = ports[port.role + "s"].indexOf(port)
			if (index !== -1) ports[port.role + "s"].splice(index, 1)
		}
		log(`${port.role}${port.name ? ` (${port.name})` : ""} disconnected`)
	})
})

/**
 * Opens Beta Login tabs according to the amount of alts
 * @async
 * @function openTabs
 * @memberof background
 */
async function openTabs() {
	let containers = await browser.contextualIdentities.query({}) // Get all containers
	if (!settings.containers.useAll) {
		containers = containers.filter(e => settings.containers.list.includes(e.name)) // Filter according to settings
	}

	const altsNumber = settings.pattern === "unique" ? settings.namesList.length : settings.altsNumber

	browser.tabs.create({url: "https://beta.avabur.com"})
	for (let i = 0; i < Math.min(containers.length, altsNumber); i++) {
		setTimeout( () => {
			browser.tabs.create({
				cookieStoreId: containers[i].cookieStoreId,
				url: "https://beta.avabur.com",
			})
		}, 10 * (i + 1))
	}
}

/**
 * Logins all the currently open Beta Login pages
 * @async
 * @function login
 * @memberof background
 */
function login() {
	/**
	 * Converts a Latin numeral to Roman numeral
	 * @function romanize
	 * @example
	 * // Returns "IX"
	 * romanize(9)
	 * @param {number} num Latin numeral
	 * @returns {string} String containing a roman numeral
	 * @private
	 * @memberof background
	 */
	function romanize(num) {
		if (num === 0) return ""
		const roman = {
			L : 50,
			XL: 40,
			X : 10,
			IX: 9,
			V : 5,
			IV: 4,
			I : 1,
		}
		let str = ""
		for (const key of Object.keys(roman)) {
			const q = Math.floor(num / roman[key])
			num -= q * roman[key]
			str += key.repeat(q)
		}
		return str
	}

	/**
	 * Sends a message to a login port containing a username
	 * @function sendLogin
	 * @param {number} i Index of a port inside `ports.logins`
	 * @param {string} username Username to send to the port
	 * @private
	 * @memberof background
	 */
	function sendLogin(i, username) {
		ports.logins[i].postMessage({
			text: "login",
			username: username,
		})
	}

	// Sort `ports.logins` to get a consistent login order (For example, `firefox-default` will always login with the main account):
	ports.logins = ports.logins.sort((el1, el2) => {
		const n1 = parseInt(el1.sender.tab.cookieStoreId.match(/\d+/)) || 0
		const n2 = parseInt(el2.sender.tab.cookieStoreId.match(/\d+/)) || 0
		return n1 - n2
	})

	sendLogin(0, settings.mainAccount)
	if (settings.pattern === "roman") {
		for (let i = 1; i <= settings.altsNumber; i++) {
			sendLogin(i, settings.altBaseName+romanize(i))
		}
	} else if (settings.pattern === "unique") {
		for (let i = 0; i < settings.namesList.length; i++) {
			sendLogin(i+1, settings.namesList[i])
		}
	}
}

/**
 * Sends a message to all ports inside an array at once
 * @function sendMessage
 * @param {object} message A message to be sent
 * @param {runtimePort[]} [users=[...ports.alts, ports.main]] An array of `runtimePort` objects. If omitted, defaults to `[...ports.alts, ports.main]`
 * @memberof background
 */
function sendMessage(message, users=[...ports.alts, ports.main]) {
	for (const user of users) {
		user.postMessage(message)
	}
}

/**
 * Spawns the gems specified by the parameters for all alts
 * @function spawnGem
 * @param {number} type ID of a gem type for the main gem
 * @param {number} splice ID of a gem type for the spliced gem
 * @param {number} tier
 * @param {number} amount
 * @memberof background
 */
function spawnGem(type, splice, tier, amount) {
	sendMessage({
		text  : "spawn gems",
		type  : type,
		splice: splice,
		tier  : tier,
		amount: amount,
	}, ports.alts)
}

/**
 * Jumps all alts to mob with a given ID
 * @function jumpMobs
 * @param {number} number Mob ID
 * @memberof background
 */
function jumpMobs(number) {
	sendMessage({text: "jump mobs", number: number}, ports.alts)
}

/**
 * - Causes all users to send their currency to the given name.
 * - Exact settings can be changed by the user under the Currency Send section of the Options Page.
 * @function sendCurrency
 * @param {string} name Username
 * @memberof background
 */
function sendCurrency(name) {
	sendMessage({text: "send currency", recipient: name})
}

/**
 * Closes the banners on all users
 * @function closeBanners
 * @memberof background
 */
function closeBanners(){
	sendMessage({text: "close banners"})
}

getSettings()

log("background script finished evaluating")
