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
		$(item).prop("checked", settings[item.dataset.setting])
	}
}

/**
 * Toggles a setting on/off, and saves the new value to the storage
 * @async
 * @function toggle
 * @param {event} event `change` event
 * @param {HTMLInputElement} event.target
 * @memberof browser-action
 */
async function toggle({target}) {
	browser.storage.sync.set({
		[target.dataset.setting]: target.prop("checked"),
	})
}

$(getVars)

$("input").on("change", toggle)
$("#settings-icon").click(browser.runtime.openOptionsPage)

browser.storage.onChanged.addListener(getVars)
