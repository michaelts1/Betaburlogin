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
	$("#auto-climb").prop("checked", settings.autoClimb.climb)
}

/**
 * Toggles a setting on/off, and saves the new value to the storage
 * @function toggle
 * @param {event} event `change` event
 * @param {HTMLInputElement} event.target
 * @memberof browser-action
 */
function toggle({target}) {
	if (target.dataset.setting === "autoClimb.climb") {
		settings.autoClimb.climb = target.checked
		browser.storage.sync.set({"autoClimb": settings.autoClimb})
	} else {
		browser.storage.sync.set({
			[target.dataset.setting]: target.checked,
		})
	}
}

$(getVars)

$("input").on("change", toggle)
$("#settings-icon").click( () => {
	browser.runtime.openOptionsPage()
})

browser.storage.onChanged.addListener(getVars)
