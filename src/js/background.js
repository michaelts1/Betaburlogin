"use strict"
/**
 * @constant VARS_VERSION
 * @type {number}
 * @description
 * - Current settings version
 * - Bump this number when adding or removing settings, and when changing ADDON_CSS
 * - If the number isn't bumped, the new settings will only have effect on new users
 * @default
 */
const VARS_VERSION = 14

/**
 * @constant ADDON_CSS
 * @type {string}
 * @description
 * - CSS code for Betaburlogin interface changes
 * - If you change ADDON_CSS value, make sure to also bump VARS_VERSION, or the changes will only have effect on new users
 * @default
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
}`

/**
 * @const CUSTOM_CSS
 * @type {string}
 * @description
 * - Default value for CSS code that affects page elements that aren't part of Betaburlogin interface changes
 * - Can be changed by the user in the Advanced section of the Settings page
 * @default
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
 * @typedef {object} runtimePort
 * @description See [MDN Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port)
 * @property {string=} name Name of the sender
 * @property {object} sender Contains information about the sender of the port
 * @property {object} onMessage
 * @property {object} onDisconnect
 */

/**
 * @type {runtimePort}
 * @description Live Login page port
 */
let live = null

/**
 * @type {runtimePort}
 * @description Main account Beta Game page port
 */
let main = null

/**
 * @type {runtimePort[]}
 * @description Alt accounts Beta Game page ports
 */
const alts = []

/**
 * @type {runtimePort[]}
 * @description Beta Login page port
 */
const logins = []

/**
 * @type {object} Stores the settings
 */
let vars = null

browser.runtime.onConnect.addListener(async port => {
	console.log(port.name, " connected")
	const mainUsername = (await browser.storage.sync.get("mainUsername")).mainUsername

	// If live login
	if (port.name === "live") {
		live = port
		live.onMessage.addListener(message => {
			if (message.text === "open alt tabs") {
				openTabs()
			}
		})
	} else if (port.name === "login") { // Else, if beta login
		logins.push(port)
		port.onMessage.addListener(message => {
			if (message.text === "requesting login") {
				login()
			}
		})
	} else if (port.name === mainUsername) { // Else, if beta main
		main = port
	} else { // Else, it's a beta alt
		alts.push(port)
		port.onMessage.addListener(message => {
			if (message.text === "move to mob") {
				console.log(`moving all alts to mob ${message.number}`)
				jumpMobs(message.number)
			}
			if (message.text === "spawnGem") {
				console.log("${port.name} requested to spawn gems:", message)
				spawnGem(message.type, message.splice, message.tier, message.amount)
			}
		})
	}

	if (port.name !== "live" || port.name !== "login") { // If beta account
		port.onMessage.addListener(message => {
			if (message.text === "requesting currency") { // Send currency
				console.log(`${port.name} requested currency`)
				sendCurrency(port.name)
			}
			if (message.text === "banner closed") {
				closeBanners()
			}
		})
	}

	// When a port disconnects, forget it
	port.onDisconnect.addListener( () => {
		if (port.name === "live") {
			live = null
		} else if (port.name === "login") {
			const index = logins.indexOf(port)
			if (index !== -1) logins.splice(index, 1)
		} else if (port.name === mainUsername) {
			main = null
		} else {
			const index = alts.indexOf(port)
			if (index !== -1) alts.splice(index, 1)
		}
		console.log(port.name, " disconnected!")
	})
})

/**
 * @async
 * @function openTabs Opens Beta Login tabs according to the amount of alts
 */
async function openTabs() {
	let containers = await browser.contextualIdentities.query({}) // Get all containers
	if (vars.containers.useAll === false) {
		containers = containers.filter(e => vars.containers.list.includes(e.name)) // Filter according to settings
	}

	let altsNumber = 0
	if (vars.pattern === "unique") {
		altsNumber += vars.namesList.length
	}
	else {
		altsNumber += vars.altsNumber
	}

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
 * @async
 * @function login Logins all the currently open Beta Login pages
 */
function login() {
	/**
	 * @function sendLogin Sends a message to login[i] containing a username
	 * @param {number} i Index of port inside logins[], that the message will be sent to
	 * @param {string} username Username that will be sent to the port
	 * @private
	 */
	function sendLogin(i, username) {
		logins[i].postMessage({
			text: "login",
			username: username,
		})
	}

	/**
	 * @function romanize Converts a latin numeral to Roman numeral
	 * @param {number} num Latin numeral
	 * @returns {string} String containing a roman numeral (e.g. "IX")
	 * @private
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

	if (vars.pattern === "roman") {
		sendLogin(0, vars.mainAccount)
		for (let i = 1; i <= vars.altsNumber; i++) {
			sendLogin(i, vars.altBaseName+romanize(i))
		}
	} else if (vars.pattern === "unique") {
		sendLogin(0, vars.mainAccount)
		for (let i = 0; i < vars.namesList.length; i++) {
			sendLogin(i+1, vars.namesList[i])
		}
	}
}

/**
 * @typedef {runtimePort[]} runtimePorts
 * @description An array containing multiple runtimePort objects
 */

/**
 * @function sendMessage Sends a message to all ports inside an array at once
 * @param {object} message A message to be sent
 * @param {runtimePorts=} users An array of runtimePorts. Defaults to alts.concat(main)
 */
function sendMessage(message, users=alts.concat(main)) {
	for (const user of users) {
		user.postMessage(message)
	}
}

/**
 * @function spawnGem Spawns gems as specified by the parameters for all alts
 * @param {number} type ID of a gem type for the main gem
 * @param {number} splice ID of a gem type for the spliced gem
 * @param {number} tier
 * @param {number} amount
 */
function spawnGem(type, splice, tier, amount) {
	sendMessage({
		text  : "spawn gems",
		type  : type,
		splice: splice,
		tier  : tier,
		amount: amount,
	}, alts)
}

/**
 * @function jumpMobs Jumps all alts to mob with a given ID
 * @param {number} number Mob ID
 */
function jumpMobs(number) {
	sendMessage({text: "jump mobs", number: number}, alts)
}

/**
 * @function sendCurrency
 * - Causes all users to send their currency to the given name.
 * - Exact settings can be changed by the user under the Currency Send section of the Options Page.
 * @param {string} name Username
 */
function sendCurrency(name) {
	sendMessage({text: "send currency", recipient: name})
}

/**
 * @function closeBanners Closes the banners on all users
 */
function closeBanners(){
	sendMessage({text: "close banners"})
}

// Get settings from storage:
/**
 * @async
 * @function getVars Gets the settings from the storage, Using default values if none are saved, and then calls updateVars
 */
async function getVars() {
	vars = await browser.storage.sync.get()
	// If not set, create with default settings
	if (Object.keys(vars).length === 0) {
		vars = {
			version          : VARS_VERSION,
			eventChannelID   : 3202,
			startActionsDelay: 1000,
			buttonDelay      : 500,
			wireFrequency    : 60,
			dailyCrystals    : 50,
			minCraftingQueue : 5,
			minStamina       : 5,
			attackAt         : 3,
			altsNumber       : 0,
			autoStamina      : true,
			autoQuests       : true,
			autoHouse        : true,
			autoCraft        : true,
			autoHarvestron   : true,
			joinEvents       : true,
			addCustomBuild   : true,
			addUsername      : true,
			addJumpMobs      : true,
			addSpawnGems     : true,
			addRequestMoney  : true,
			addOpenTabs      : true,
			addLoginAlts     : true,
			addSocketX5      : true,
			resumeCrafting   : true,
			removeEffects    : false,
			actionsPending   : false,
			autoWire         : false,
			verbose          : false,
			removeBanner     : false,
			questCompleting  : null,
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
				custom: CUSTOM_CSS,
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
		await browser.storage.sync.set(vars)
	}
	updateVars()
}
getVars()

/**
 * @async
 * @function updateVars Checks settings version and updates the settings if needed
 */
async function updateVars() {
	if (typeof vars.version !== "number") {
		console.log("Resetting settings - current settings are too old")
		await browser.storage.sync.clear()
		getVars()
		return
	}

	switch (vars.version) {
		case VARS_VERSION:
			break
		case 2: /* eslint-disable no-fallthrough */ // Falling through to update properly
			vars.pattern = ""
			vars.namesList = []
		case 3:
			vars.tradesList = {
				fishing      : [],
				woodcutting  : [],
				mining       : [],
				stonecutting : [],
				crafting     : [],
				carving      : [],
			}
		case 4:
			for (const trade of ["food", "wood", "iron", "stone"]) {
				vars.currencySend.push({
					name : trade,
					send : true,
					minimumAmount : 100,
					keepAmount : 10000000,
				})
			}
		case 5:
			vars.autoWire = false
		case 6:
			vars.css = {
				addon : ADDON_CSS,
				custom: CUSTOM_CSS,
			},
			vars.verbose = false
			vars.containers = ["betabot-default"]
			vars.wireFrequency = 60
		case 7:
			vars.containers = {
				useAll: true,
				list  : [],
			}
			if (vars.pattern === "romanCaps") vars.pattern = "roman" // Deprecated
		case 8:
			// Name Change:
			vars.autoQuests = vars.doQuests
			vars.autoHouse  = vars.doBuildingAndHarvy
			vars.autoCraft  = vars.doCraftQueue
			delete vars.doQuests
			delete vars.doBuildingAndHarvy
			delete vars.doCraftQueue
			browser.storage.sync.remove(["doQuests", "doBuildingAndHarvy", "doCraftQueue",])
			// Other updates:
			vars.minStamina      = 5
			vars.autoStamina     = true
			vars.joinEvents      = true
			vars.addCustomBuild  = true
			vars.addUsername     = true
			vars.addJumpMobs     = true
			vars.addSpawnGems    = true
			vars.addRequestMoney = true
		case 9:
			vars.attackAt       = 3
			vars.eventChannelID = 3202
			vars.addOpenTabs    = true
			vars.addLoginAlts   = true
			vars.removeEffects  = true
		case 10:
			vars.resumeCrafting = false
		case 11:
			vars.autoHarvestron = true
		case 12:
			vars.removeBanner = false
		case 13:
			vars.addSocketX5 = true
		default:
			if (vars.css.addon !== ADDON_CSS) {
				vars.css.addon = ADDON_CSS
			}
			vars.version = VARS_VERSION
			browser.storage.sync.set(vars) /* eslint-enable no-fallthrough */
	}
}

browser.storage.onChanged.addListener(changes => {
	getVars()

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
			console.log(keys[i], "changed from", values[i].oldValue, "to", values[i].newValue)
		}
	}
})

console.log("background script finished evaluating")
