"use strict"

/**
 * @file Settings management
 */
/**
 * @namespace settings
 */

/* global ports */

/**
 * - Current settings version
 * - Bump this number when adding or removing settings, and when changing ADDON_CSS
 * - If the number isn't bumped, the new settings will only have effect after resetting settings
 * @constant SETTINGS_VERSION
 * @type {number}
 * @memberof settings
 */
const SETTINGS_VERSION = 20

/**
 * - CSS code for Betaburlogin interface changes
 * - If you change ADDON_CSS value, make sure to also bump SETTINGS_VERSION
 * @constant ADDON_CSS
 * @type {string}
 * @memberof settings
 */
const ADDON_CSS =
`.betabot a {
	padding: 3px;
	text-decoration: none;
}
#betabot-clear-username {
	color: yellow;
	font-size: 25px;
	line-height: 10px;
}
#betabot-clear-username::before {
	content: ": ";
	font-size: 14px;
}
#betabot-next-to-name {
	margin-left: 10px;
}
#betabot-next-to-name a {
	line-height: 10px;
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
 * @memberof settings
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

let settings = null

/**
 * - Gets the settings from the storage, Using default values if none are saved, and then calls updateSettings
 * - When adding or removing settings, make sure to also update updateSettings accordingly and bump SETTINGS_VERSION
 * @async
 * @function getSettings
 * @memberof settings
 */
async function getSettings() {
	settings = await browser.storage.sync.get()
	if (!settings.version) settings.version = 0
	updateSettings()

	// Update `ports`:
	if (ports.main || ports.alts.length > 0) { // If there are either alts or main connected
		if (ports.main?.name !== settings.mainUsername) {
			// Move old `main` into `alts`:
			if (ports.main !== null) {
				ports.alts.push(ports.main)
				ports.main = null
			}

			// Find new `main` in `alts`:
			for (const port of ports.alts) {
				if (port.name === settings.mainUsername) {
					ports.main = port
					ports.alts.splice(ports.alts.indexOf(port), 1)
				}
			}
		}
	}
}

/**
 * Checks settings version and updates the settings if needed
 * @async
 * @function updateSettings
 * @memberof settings
 */
function updateSettings() {
	switch (settings.version) {
		case SETTINGS_VERSION:
			break
		case 0: // If no Settings are set
			settings.eventChannelID    = 3202
			settings.wireFrequency     = 60
			settings.dailyCrystals     = 50
			settings.minCarvingQueue   = 5
			settings.minCraftingQueue  = 5
			settings.minStamina        = 5
			settings.attackAt          = 3
			settings.altsNumber        = 0
			settings.addAdvertCalendar = true
			settings.addCustomBuild    = true
			settings.addJumpMobs       = true
			settings.addOpenTabs       = true
			settings.addSpawnGems      = true
			settings.addUsername       = true
			settings.autoCarve         = true
			settings.autoCraft         = true
			settings.autoHarvestron    = true
			settings.autoHouse         = true
			settings.autoQuests        = true
			settings.autoStamina       = true
			settings.joinGauntlets     = true
			settings.resumeQueue       = true
			settings.addSocketX5       = false
			settings.addLoginAlts      = false
			settings.autoWire          = false
			settings.removeBanner      = false
			settings.removeEffects     = false
			settings.verbose           = false
			settings.buttonNextToName  = ""
			settings.altBaseName       = ""
			settings.loginPassword     = ""
			settings.mainAccount       = ""
			settings.mainUsername      = ""
			settings.pattern           = ""
			settings.namesList         = []
			settings.containers        = {
				useAll: true,
				list  : [],
			}
			settings.tradesList = {
				fishing     : [],
				woodcutting : [],
				mining      : [],
				stonecutting: [],
				crafting    : [],
				carving     : [],
			}
			settings.css = {
				addon : ADDON_CSS,
				custom: {
					code: CUSTOM_CSS,
					default: CUSTOM_CSS,
				},
			}
			settings.currencySend = {
				crystals: {
					send         : true,
					minimumAmount: 0,
					keepAmount   : 0,
				},
				platinum: {
					send         : true,
					minimumAmount: 100,
					keepAmount   : 0,
				},
				gold: {
					send         : true,
					minimumAmount: 10000,
					keepAmount   : 0,
				},
				crafting_materials: {
					send         : true,
					minimumAmount: 100,
					keepAmount   : 0,
				},
				gem_fragments: {
					send         : true,
					minimumAmount: 100,
					keepAmount   : 0,
				},
				food: {
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
				wood: {
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
				iron: {
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
				stone: {
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
			}

			settings.css.addon = ADDON_CSS
			settings.css.custom.code = CUSTOM_CSS
			settings.css.custom.default = CUSTOM_CSS
			settings.version = SETTINGS_VERSION

			browser.storage.sync.set(settings)
			log("Created settings with default values")
			break
			/* eslint-disable no-fallthrough */ // Falling through to update properly
		case 2:
			settings.pattern = ""
			settings.namesList = []
		case 3:
			settings.tradesList = {
				fishing: [],
				woodcutting: [],
				mining: [],
				stonecutting: [],
				crafting: [],
				carving: [],
			}
		case 4:
			for (const trade of ["food", "wood", "iron", "stone"]) {
				settings.currencySend[trade] = {
					send: true,
					minimumAmount: 100,
					keepAmount: 10000000,
				}
			}
		case 5:
			settings.autoWire = false
		case 6:
			settings.css = {
				addon: ADDON_CSS,
				custom: CUSTOM_CSS,
			},
			settings.verbose = false
			settings.containers = ["betabot-default"]
			settings.wireFrequency = 60
		case 7:
			settings.containers = {
				useAll: true,
				list: [],
			}
			if (settings.pattern === "romanCaps")
				settings.pattern = "roman" // Deprecated
		case 8:
			// Name Change:
			settings.autoQuests = settings.doQuests
			settings.autoHouse = settings.doBuildingAndHarvy
			settings.autoCraft = settings.doCraftQueue
			delete settings.doQuests
			delete settings.doBuildingAndHarvy
			delete settings.doCraftQueue
			browser.storage.sync.remove(["doQuests", "doBuildingAndHarvy", "doCraftQueue"])
			// Other updates:
			settings.minStamina = 5
			settings.autoStamina = true
			settings.joinEvents = true
			settings.addCustomBuild = true
			settings.addUsername = true
			settings.addJumpMobs = true
			settings.addSpawnGems = true
			settings.addRequestMoney = true
		case 9:
			settings.attackAt = 3
			settings.eventChannelID = 3202
			settings.addOpenTabs = true
			settings.addLoginAlts = true
			settings.removeEffects = true
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
			settings.autoCarve = true
			settings.minCarvingQueue = 5
		case 16:
			settings.css.custom = {
				code: settings.css.custom,
				default: CUSTOM_CSS,
			}
		case 17: {
			// Format change (Array => Object):
			let tmp = {}
			for (const currency of settings.currencySend) {
				tmp[currency.name] = {
					keepAmount: currency.keepAmount,
					minimumAmount: currency.minimumAmount,
					send: currency.send,
				}
			}
			settings.currencySend = tmp
		}
		case 18:
			// `addRequestMoney` is now one of the options in `buttonNextToName`:
			settings.buttonNextToName = settings.addRequestMoney ? "request" : ""
			delete settings.addRequestMoney
			browser.storage.sync.remove("addRequestMoney")
		case 19:
			settings.addAdvertCalendar = true
		default:
			// Update internal CSS:
			if (settings.css.addon !== ADDON_CSS) {
				settings.css.addon = ADDON_CSS
			}
			// Update external CSS, but only if the user didn't modify it:
			if (settings.css.custom.default !== CUSTOM_CSS) {
				// If the the code is equal to the previous version default, update it:
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

/**
 * Logs changes in `settings` to the console
 * @function logSettingsChanges
 * @memberof settings
 * @param {object} changes
 */
function logSettingsChanges(changes) {
	getSettings()

	// Log changes:
	if (!settings.verbose) return

	const values = Object.values(changes)
	const keys   = Object.keys(changes)
	for (let i = 0; i < Object.values(changes).length; i++) {
		if (!objectEquals(values[i].oldValue, values[i].newValue)) {
			log(keys[i], "changed from", values[i].oldValue, "to", values[i].newValue)
		}
	}
}
browser.storage.onChanged.addListener(logSettingsChanges)
