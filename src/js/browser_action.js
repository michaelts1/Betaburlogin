"use strict"

/**
 * @type {object} Stores the settings
 */
let vars = null

/**
 * @async
 * @function Gets the settings from the storage, and updates the displayed settings accordingly
 */
async function getVars() {
	vars = await browser.storage.sync.get()

	$("#auto-quests")    .prop("checked", vars.autoQuests)
	$("#auto-house")     .prop("checked", vars.autoHouse)
	$("#auto-craft")     .prop("checked", vars.autoCraft)
	$("#auto-harvestron").prop("checked", vars.autoHarvestron)
}

/**
 * @async
 * @function Toggles a setting on/off, and saves the new value to the storage
 */
async function toggle(event) {
	const id = event.target.id
	const setting = id.replaceAll(/-(.)/g, (match, group1) => match.replace(match, group1.toUpperCase())) // auto-house => autoHouse
	vars[setting] = $(`#${id}`).prop("checked")
	await browser.storage.sync.set(vars)
}

$(getVars)

$("input").on("change", toggle)
$("#settings-icon").click( () => {
	browser.runtime.openOptionsPage()
})

browser.storage.onChanged.addListener(getVars)
