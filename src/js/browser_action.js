"use strict"

/**
 * @file Browser action window code
 */

let settings = null

/**
 * Gets the settings from the storage, and updates the displayed settings accordingly
 * @async
 * @function getVars
 */
async function getVars() {
	settings = await browser.storage.sync.get()

	$("#auto-quests")    .prop("checked", settings.autoQuests)
	$("#auto-house")     .prop("checked", settings.autoHouse)
	$("#auto-craft")     .prop("checked", settings.autoCraft)
	$("#auto-harvestron").prop("checked", settings.autoHarvestron)
}

/**
 * Toggles a setting on/off, and saves the new value to the storage
 * @async
 * @function toggle
 */
async function toggle(event) {
	const id = event.target.id
	const setting = id.replaceAll(/-(.)/g, (match, group1) => match.replace(match, group1.toUpperCase())) // auto-house => autoHouse
	settings[setting] = $(`#${id}`).prop("checked")
	await browser.storage.sync.set(settings)
}

$(getVars)

$("input").on("change", toggle)
$("#settings-icon").click( () => {
	browser.runtime.openOptionsPage()
})

browser.storage.onChanged.addListener(getVars)
