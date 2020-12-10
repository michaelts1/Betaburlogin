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
	let deletedSettings = []

	switch (settings.version) {
		case SETTINGS_VERSION:
			break
		case 0: // If no Settings are set
			// Settings that are equal to `true` by default:
			for (const setting of ["addAdventCalendar", "addCustomBuild",
				"addJumpMobs", "addOpenTabs", "addSpawnGems", "addUsername",
				"autoCarve", "autoCraft", "autoHarvestron", "autoHouse",
				"autoQuests", "autoStamina", "joinGauntlets", "resumeQueue"]) {
				settings[setting] = true
			}

			// Settings that are equal to `false` by default:
			for (const setting of ["addSocketX5", "addLoginAlts", "autoWire",
				"removeBanner", "removeEffects", "verbose"]) {
				settings[setting] = false
			}

			// Settings that are equal to `""` (empty string) by default:
			for (const setting of ["buttonNextToName", "altBaseName",
				"loginPassword", "mainAccount", "mainUsername", "pattern"]) {
				settings[setting] = ""
			}

			// Currency send settings:
			settings.currencySend = {}
			for (const currency of ["crystals", "platinum", "gold",
				"crafting_materials", "gem_fragments", "food", "wood",
				"iron", "stone"]) {
				settings.currencySend[currency] = {
					send: true,
					minimumAmount: 100,
					keepAmount: 0,
				}
			}
			// Override some of the previously set values:
			settings.currencySend.crystals.minimumAmount = 0
			settings.currencySend.gold.minimumAmount = 10000
			for (const name of ["food", "wood", "iron", "stone"]) {
				settings.currencySend[name].keepAmount = 100000000
			}

			// Numeric settings:
			settings.altsNumber     = 0
			settings.attackAt       = 3
			settings.dailyCrystals  = 50
			settings.eventChannelID = 3202
			settings.minQueue       = 5
			settings.minStamina     = 5
			settings.wireFrequency  = 60

			// Misc settings:
			settings.namesList = []

			// Containers settings:
			settings.containers = {
				list: [],
				useAll: true,
			}

			// Event trades settings:
			settings.tradesList = {}
			for (const ts of ["fishing", "woodcutting", "mining",
				"stonecutting", "crafting", "carving"]) {
				settings.tradesList[ts] = []
			}

			// CSS settings:
			settings.css = {
				addon: ADDON_CSS,
				custom: {
					code: CUSTOM_CSS,
					default: CUSTOM_CSS,
				},
			}

			// Finalizing settings:
			settings.version = SETTINGS_VERSION
			browser.storage.sync.set(settings)
			log("Created settings with default values")
			break
		case 2:
			settings.pattern = ""
			settings.namesList = []
			/* eslint-disable no-fallthrough */ // Falling through to update properly
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
			deletedSettings.push("doQuests", "doBuildingAndHarvy", "doCraftQueue")
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
			deletedSettings.push("joinEvents")
			// Deletions:
			deletedSettings.push("buttonDelay", "actionsPending", "questCompleting", "startActionsDelay")
			// Necessary due to algorithm change:
			settings.loginPassword = ""
		case 15:
			// Name Change:
			settings.resumeQueue = settings.resumeCrafting
			deletedSettings.push("resumeCrafting")
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
			deletedSettings.push("addRequestMoney")
		case 19:
			settings.addAdvertCalendar = true
		case 20:
			// Name change:
			settings.addAdventCalendar = settings.addAdvertCalendar
			// Merging:
			settings.minQueue = Math.max(settings.minCraftingQueue, settings.minCarvingQueue)
			deletedSettings.push("addAdvertCalendar", "minCraftingQueue", "minCarvingQueue")
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
				// Update the previous version default to the new default:
				settings.css.custom.default = CUSTOM_CSS
			}
			// Update settings version:
			log(`Updated settings from version ${settings.version} to version ${SETTINGS_VERSION}`)
			settings.version = SETTINGS_VERSION

			// Update settings storage:
			for (const setting of deletedSettings) delete settings[setting]
			browser.storage.sync.set(settings)
			browser.storage.sync.remove(deletedSettings)
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

	for (let key in changes) {
		if (!objectEquals(changes[key].oldValue, changes[key].newValue)) {
			log(`${key} changed from ${changes[key].oldValue} to ${changes[key].newValue}`)
		}
	}
}
browser.storage.onChanged.addListener(logSettingsChanges)
