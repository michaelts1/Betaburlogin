"use strict"

/**
 * @file Browser action window code
 */
/**
 * @namespace browser-action
 */

let settings = null

/**
 * Gets the settings from the storage, and updates the displayed settings accordingly
 * @async
 * @function getVars
 * @memberof browser-action
 */
async function getVars() {
	settings = await browser.storage.sync.get()

	for (const item of $("input")) {
		$(item).prop("checked", settings[getSettingsID(item.id)])
	}
}

/**
 * Returns the settings name for a given element id, e.g. auto-house => autoHouse
 * @function getSettingsID
 * @const
 * @param {string} name HTML Element id
 * @returns {string} name of a setting
 * @memberof browser-action
 */
const getSettingsID = name => name.replaceAll(/-(.)/g, (match, group1) => match.replace(match, group1.toUpperCase()))

/**
 * Toggles a setting on/off, and saves the new value to the storage
 * @async
 * @function toggle
 * @memberof browser-action
 */
async function toggle(event) {
	const id = event.target.id
	settings[getSettingsID(id)] = $(`#${id}`).prop("checked")
	await browser.storage.sync.set(settings)
}

$(getVars)

$("input").on("change", toggle)
$("#settings-icon").click( () => {
	browser.runtime.openOptionsPage()
})

browser.storage.onChanged.addListener(getVars)
