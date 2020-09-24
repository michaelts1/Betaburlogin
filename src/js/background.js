"use strict"

/**
 * @file Background processes
 */
/**
 * @namespace background
 */

/**
 * - Current settings version
 * - Bump this number when adding or removing settings, and when changing ADDON_CSS
 * - If the number isn't bumped, the new settings will only have effect after resetting settings
 * @constant SETTINGS_VERSION
 * @type {number}
 * @memberof background
 */
const SETTINGS_VERSION = 17

/**
 * - CSS code for Betaburlogin interface changes
 * - If you change ADDON_CSS value, make sure to also bump SETTINGS_VERSION
 * @constant ADDON_CSS
 * @type {string}
 * @memberof background
 */
const ADDON_CSS =
`#betabot-clear-username {
	color: yellow;
	font-size: 25px;
	line-height: 10px;
}
#betabot-clear-username::before {
	content: ": ";
	font-size: 14px;
}
#betabot-request-currency {
	margin-left: 10px;
}
#betabot-request-currency a {
	line-height: 10px;
	padding: 3px;
	text-decoration: none;
}
#betabot-mob-jump-button {
	font-size: 14px;
	padding: 6.5px;
}
#betabot-spawn-gem[disabled] {
	opacity: 0.5;
}
#betabot-socket-5 {
	padding: 6.5px;
	margin-left: 10px;
}`

/**
 * - Default value for CSS code that affects page elements that aren't part of Betaburlogin interface changes
 * - Can be changed by the user in the Advanced section of the Settings page
 * @const CUSTOM_CSS
 * @type {string}
 * @memberof background
 */
const CUSTOM_CSS =
`#areaContent {
	height: 350px;
}
#questInfo {
	font-size: 0.95em;
}
.navSection li {
	line-height: 25px;
}`

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

let settings = null

browser.runtime.onConnect.addListener(async port => {
	// Split `name` back to name and role
	const [name, role] = port.name.split(" ")
	port.name = name
	port.role = role

	log(`${port.role}${port.name ? ` (${port.name})` : ""} connected`)

	if (port.role === "live") { // If live login
		ports.live = port
		port.onMessage.addListener(message => {
			if (message.text === "open alt tabs") {
				openTabs()
			}
		})
	} else if (port.role === "login") { // Else, if beta login
		ports.logins.push(port)
		port.onMessage.addListener(message => {
			if (message.text === "requesting login") {
				login()
			}
		})
	} else if (port.role === "main") { // Else, if beta main
		ports.main = port
	} else if (port.role === "alt") { // Else, if beta alt
		ports.alts.push(port)
		port.onMessage.addListener(message => {
			if (message.text === "move to mob") {
				log(`moving all alts to mob ${message.number}`)
				jumpMobs(message.number)
			}
			if (message.text === "spawnGem") {
				log(`${port.name} requested to spawn gems: ${message}`)
				spawnGem(message.type, message.splice, message.tier, message.amount)
			}
		})
	}

	if (["main", "alt"].includes(port.role)) { // If beta account
		port.onMessage.addListener(message => {
			if (message.text === "requesting currency") { // Send currency
				log(`${port.name} requested currency`)
				sendCurrency(port.name)
			}
			if (message.text === "banner closed") {
				closeBanners()
			}
		})
	}

	// When a port disconnects, forget it
	port.onDisconnect.addListener( () => {
		if (port.role === "live") {
			ports.live = null
		} else if (port.role === "login") {
			const index = ports.logins.indexOf(port)
			if (index !== -1) ports.logins.splice(index, 1)
		} else if (port.role === "main") {
			ports.main = null
		} else if (port.role === "alt") {
			const index = ports.alts.indexOf(port)
			if (index !== -1) ports.alts.splice(index, 1)
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
	if (settings.containers.useAll === false) {
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
		}, 500*(i+1))
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
	 * Converts a Latin numeral to Roman numeral (e.g. 9 => "IX")
	 * @function romanize
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

/**
 * - Gets the settings from the storage, Using default values if none are saved, and then calls updateSettings
 * - When adding or removing settings, make sure to also update updateSettings accordingly and bump SETTINGS_VERSION
 * @async
 * @function getSettings
 * @memberof background
 */
async function getSettings() {
	settings = await browser.storage.sync.get()
	// If not set, create with default settings
	if (Object.keys(settings).length === 0) {
		settings = {
			version          : SETTINGS_VERSION,
			eventChannelID   : 3202,
			wireFrequency    : 60,
			dailyCrystals    : 50,
			minCraftingQueue : 5,
			minCarvingQueue  : 5,
			minStamina       : 5,
			attackAt         : 3,
			altsNumber       : 0,
			autoStamina      : true,
			autoQuests       : true,
			autoHouse        : true,
			autoCraft        : true,
			autoCarve        : true,
			autoHarvestron   : true,
			joinGauntlets    : true,
			addCustomBuild   : true,
			addUsername      : true,
			addJumpMobs      : true,
			addSpawnGems     : true,
			addRequestMoney  : true,
			addOpenTabs      : true,
			addLoginAlts     : true,
			addSocketX5      : true,
			resumeQueue      : true,
			removeEffects    : false,
			autoWire         : false,
			verbose          : false,
			removeBanner     : false,
			mainAccount      : "",
			mainUsername     : "",
			loginPassword    : "",
			pattern          : "",
			altBaseName      : "",
			namesList        : [],
			containers       : {
				useAll: true,
				list  : [],
			},
			tradesList      : {
				fishing     : [],
				woodcutting : [],
				mining      : [],
				stonecutting: [],
				crafting    : [],
				carving     : [],
			},
			css: {
				addon : ADDON_CSS,
				custom: {
					code: CUSTOM_CSS,
					default: CUSTOM_CSS,
				},
			},
			currencySend: [
				{
					name         : "crystals",
					send         : true,
					minimumAmount: 0,
					keepAmount   : 0,
				},
				{
					name         : "platinum",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 0,
				},
				{
					name         : "gold",
					send         : true,
					minimumAmount: 10000,
					keepAmount   : 0,
				},
				{
					name         : "crafting_materials",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 0,
				},
				{
					name         : "gem_fragments",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 0,
				},
				{
					name         : "food",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
				{
					name         : "wood",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
				{
					name         : "iron",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
				{
					name         : "stone",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
			],
		}
		await browser.storage.sync.set(settings)
	}
	updateSettings()
}
getSettings()

/**
 * Checks settings version and updates the settings if needed
 * @async
 * @function updateSettings
 * @memberof background
 */
async function updateSettings() {
	if (typeof settings.version !== "number") {
		log("Resetting settings - current settings are too old")
		await browser.storage.sync.clear()
		getSettings()
		return
	}

	switch (settings.version) {
		case SETTINGS_VERSION:
			break
		/* eslint-disable no-fallthrough */ // Falling through to update properly
		case 2:
			settings.pattern = ""
			settings.namesList = []
		case 3:
			settings.tradesList = {
				fishing      : [],
				woodcutting  : [],
				mining       : [],
				stonecutting : [],
				crafting     : [],
				carving      : [],
			}
		case 4:
			for (const trade of ["food", "wood", "iron", "stone"]) {
				settings.currencySend.push({
					name : trade,
					send : true,
					minimumAmount : 100,
					keepAmount : 10000000,
				})
			}
		case 5:
			settings.autoWire = false
		case 6:
			settings.css = {
				addon : ADDON_CSS,
				custom: CUSTOM_CSS,
			},
			settings.verbose = false
			settings.containers = ["betabot-default"]
			settings.wireFrequency = 60
		case 7:
			settings.containers = {
				useAll: true,
				list  : [],
			}
			if (settings.pattern === "romanCaps") settings.pattern = "roman" // Deprecated
		case 8:
			// Name Change:
			settings.autoQuests = settings.doQuests
			settings.autoHouse  = settings.doBuildingAndHarvy
			settings.autoCraft  = settings.doCraftQueue
			delete settings.doQuests
			delete settings.doBuildingAndHarvy
			delete settings.doCraftQueue
			browser.storage.sync.remove(["doQuests", "doBuildingAndHarvy", "doCraftQueue"])
			// Other updates:
			settings.minStamina      = 5
			settings.autoStamina     = true
			settings.joinEvents      = true
			settings.addCustomBuild  = true
			settings.addUsername     = true
			settings.addJumpMobs     = true
			settings.addSpawnGems    = true
			settings.addRequestMoney = true
		case 9:
			settings.attackAt       = 3
			settings.eventChannelID = 3202
			settings.addOpenTabs    = true
			settings.addLoginAlts   = true
			settings.removeEffects  = true
		case 10:
			settings.resumeCrafting = false
		case 11:
			settings.autoHarvestron = true
		case 12:
			settings.removeBanner = false
		case 13:
			settings.addSocketX5 = true
		case 14:
			// Name Change:
			settings.joinGauntlets = settings.joinEvents
			delete settings.joinEvents
			browser.storage.sync.remove("joinEvents")
			// Deletions:
			delete settings.buttonDelay
			delete settings.actionsPending
			delete settings.questCompleting
			delete settings.startActionsDelay
			browser.storage.sync.remove(["buttonDelay", "actionsPending", "questCompleting", "startActionsDelay"])
			// Necessary due to algorithm change:
			settings.loginPassword = ""
		case 15:
			// Name Change:
			settings.resumeQueue = settings.resumeCrafting
			delete settings.resumeCrafting
			browser.storage.sync.remove("resumeCrafting")
			// Addition:
			settings.autoCarve       = true
			settings.minCarvingQueue = 5
		case 16:
			settings.css.custom = {
				code: settings.css.custom,
				default: CUSTOM_CSS,
			}
		default:
			// Update internal CSS:
			if (settings.css.addon !== ADDON_CSS) {
				settings.css.addon = ADDON_CSS
			}
			// Update external CSS, but only if the user didn't modify it:
			if (settings.css.custom.default !== CUSTOM_CSS) {
				// If the the code is equal to the previous version code, update it:
				if (settings.css.custom.code === settings.css.custom.default) {
					settings.css.custom.code = CUSTOM_CSS
				}
				// Update the previous version default to the new default
				settings.css.custom.default = CUSTOM_CSS
			}
			// Update settings version
			log(`Updated settings from version ${settings.version} to version ${SETTINGS_VERSION}`)
			settings.version = SETTINGS_VERSION
			browser.storage.sync.set(settings)
		/* eslint-enable no-fallthrough */
	}
}

browser.storage.onChanged.addListener(changes => {
	getSettings()

	function objectEquals(object1, object2) { // https://stackoverflow.com/a/6713782
		if (object1 === object2) return true
		if (!(object1 instanceof Object) || !(object2 instanceof Object)) return false
		if (object1.constructor !== object2.constructor) return false
		for (const p in object1) {
			if (!{}.hasOwnProperty.call(object1, p)) continue
			if (!{}.hasOwnProperty.call(object2, p)) return false
			if (object1[p] === object2[p]) continue
			if (typeof(object1[p]) !== "object") return false
			if (!objectEquals(object1[p], object2[p])) return false
		}
		for (const p in object2) {
			if ({}.hasOwnProperty.call(object2, p) && !{}.hasOwnProperty.call(object1, p)) return false
		}
		return true
	}

	const values = Object.values(changes)
	const keys   = Object.keys(changes)
	for (let i = 0; i < Object.values(changes).length; i++) {
		if (objectEquals(values[i].oldValue, values[i].newValue) === false) {
			log(keys[i], "changed from", values[i].oldValue, "to", values[i].newValue)
		}
	}
})

log("background script finished evaluating")
