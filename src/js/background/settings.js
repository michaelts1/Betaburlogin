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
const SETTINGS_VERSION = 24

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
.betabot-hidden {
	display: none !important;
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
	margin-left: 3px;
}
#betabot-next-to-name a {
	line-height: 10px;
}
#betabot-next-to-name button {
	margin-left: 3px;
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
	if (ports.main || ports.alt.length > 0) { // If there are either alts or main connected
		if (ports.main?.name !== settings.mainUsername) {
			// Move old `main` into `alts`:
			if (ports.main !== null) {
				ports.alt.push(ports.main)
				ports.main = null
			}

			// Find new `main` in `alts`:
			for (const port of ports.alt) {
				if (port.name === settings.mainUsername) {
					ports.main = port
					ports.alt.splice(ports.alt.indexOf(port), 1)
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
	const deletedSettings = []
	/**
	 * Changes a setting name, and uses a default value if the old setting does not exist
	 * @function changeSettingName
	 * @param {string} oldName Old setting name
	 * @param {string} newName New setting name
	 * @param {*} defaultValue Default value that will be used if the old setting is not defined
	 * @memberof settings
	 * @private
	 */
	function changeSettingName(oldName, newName, defaultValue) {
		if (settings.hasOwnProperty(oldName)) {
			settings[newName] = settings[oldName]
			deleteSettings(oldName)
		} else {
			settings[newName] = defaultValue
		}
	}

	/**
	 * Deletes settings from storage if they exist
	 * @function deleteSettings
	 * @param {...String} names
	 * @memberof settings
	 * @private
	 */
	function deleteSettings(...names) {
		for (const name of names) {
			if (settings.hasOwnProperty(name)) {
				deletedSettings.push(name)
			}
		}
	}

	switch (settings.version) {
		case SETTINGS_VERSION:
			break
		case 0: // If no Settings are set
			settings.altBaseName = ""
			settings.altsNumber = 0
			settings.dailyCrystals = 50
			settings.mainAccount = ""
			settings.mainUsername = ""

			// Currency send settings:
			settings.currencySend = {}
			for (const currency of ["crystals", "platinum", "gold",
				"crafting_materials", "gem_fragments"]) {
				settings.currencySend[currency] = {
					sendRequest: true,
					sendSpread: true,
					minimumAmount: 100,
					keepAmount: 0,
				}
			}
			// Override some of the previously set values:
			settings.currencySend.crystals.minimumAmount = 0
			settings.currencySend.gold.minimumAmount = 10_000

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
					keepAmount: 100_000_000,
				}
			}
		case 5:
			// No changes here anymore
		case 6:
			settings.verbose = false
		case 7:
			settings.containers = {
				list: [],
				useAll: true,
			}
			// Deprecation:
			if (settings.pattern === "romanCaps") {
				settings.pattern = "roman"
			}
		case 8:
			changeSettingName("doQuests", "autoQuests", true)
			changeSettingName("doBuildingAndHarvy", "autoHouse", true)
			changeSettingName("doCraftQueue", "autoCraft", true)
			// Other updates:
			settings.minStamina = 5
			settings.autoStamina = true
			settings.addCustomBuild = true
			settings.addUsername = true
		case 9:
			settings.attackAt = 3
			settings.eventChannelID = 3262
			settings.addOpenTabs = true
			settings.addLoginAlts = false
			settings.removeEffects = false
		case 10:
			// No changes here anymore
		case 11:
			settings.autoHarvestron = true
		case 12:
			settings.removeBanner = false
		case 13:
			settings.addSocketX5 = false
		case 14:
			changeSettingName("joinEvents", "joinGauntlets", true)
			// Deletions:
			deleteSettings("buttonDelay", "actionsPending", "questCompleting", "startActionsDelay")
			// Reset:
			settings.loginPassword = ""
		case 15:
			changeSettingName("resumeCrafting", "resumeQueue", true)
			// Addition:
			settings.autoCarve = true
		case 16:
			if (settings.css === undefined) {
				settings.css = {
					addon: ADDON_CSS,
					custom: {
						code: CUSTOM_CSS,
						default: CUSTOM_CSS,
					},
				}
			} else {
				settings.css.custom = {
					code: settings.css.custom,
					default: CUSTOM_CSS,
				}
			}
		case 17:
			// Refactoring (Array => Object):
			if (Array.isArray(settings.currencySend)) {
				const tmp = {}
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
			if (settings.addRequestMoney === undefined) {
				settings.buttonNextToName = ""
			} else {
				settings.buttonNextToName = settings.addRequestMoney ? "request" : ""
				deleteSettings("addRequestMoney")
			}
		case 19:
			// No changes here anymore
		case 20:
			changeSettingName("addAdvertCalendar", "addAdventCalendar", true)

			// Merging:
			settings.minQueue = Math.max(settings.minCraftingQueue ?? 0, settings.minCarvingQueue ?? 0) || 5
			deleteSettings("minCraftingQueue", "minCarvingQueue")

			// Auto climb:
			if (settings.autoClimb === undefined) {
				settings.autoClimb = {
					climb: false,
					jumpAmountMain: 11,
					jumpAmountAlts: 1,
					maximumWinrate: 100,
					minimumActions: 100,
					minimumWinrate: 99,
				}
			}
			deleteSettings("addJumpMobs")
		case 21:
			// `autoWire` is now part of `wireFrequency`:
			settings.wireFrequency = +(settings.autoWire ?? 0)*60 // 60 if `autoWire` is true, 0 otherwise
			deleteSettings("autoWire")

			// `send` is now two separate properties:
			if ("send" in settings.currencySend.crystals) {
				for (const currency of Object.keys(settings.currencySend)) {
					const send = settings.currencySend[currency].send
					settings.currencySend[currency].sendRequest = send
					settings.currencySend[currency].sendSpread = send
					delete settings.currencySend[currency].send
				}
			}
		case 22:
			deleteSettings("addSpawnGems")
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

	for (const key in changes) {
		if (!helpers.objectEquals(changes[key].oldValue, changes[key].newValue)) {
			log(key, "changed from", changes[key].oldValue, "to", changes[key].newValue)
		}
	}
}
browser.storage.onChanged.addListener(logSettingsChanges)
