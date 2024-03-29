"use strict"

/**
 * @file Code to run when on Beta Game page
 * @todo {@link https://github.com/michaelts1/Betaburlogin/projects}
 */
/**
 * @namespace beta-game
 */

// Defined in beta-game-functions.js:
/*
	global betabot, calendar, closeBanner, gauntlet, gems, house, mobClimbing, eventListeners,
		port:writable, professionQueues, settings:writable, username, vars, wiring
*/

/**
 * @async
 * @function toggleInterfaceChanges
 * @param {boolean} refresh Should be true when called by refreshSettings and false otherwise
 * @memberof beta-game
 */
async function toggleInterfaceChanges(refresh) {
	// Button next to name:
	switch (settings.buttonNextToName) {
		case "request":
			$("#betabot-request-button").removeClass("betabot-hidden")
			$("#betabot-spread-button").addClass("betabot-hidden")
			break
		case "spread":
			$("#betabot-request-button").addClass("betabot-hidden")
			$("#betabot-spread-button").removeClass("betabot-hidden")
			break
		case "both":
			$("#betabot-request-button, #betabot-spread-button").removeClass("betabot-hidden")
			break
		default:
			$("#betabot-request-button, #betabot-spread-button").addClass("betabot-hidden")
	}

	// Make it easier to see what alt it is:
	if (settings.addUsername) {
		username.appendName()
		username.keepUsernameVisible.observe($("#roomName")[0], {attributes: true, childList: true, subtree: true})
	} else {
		username.keepUsernameVisible.disconnect()
		$("#betabot-clear-username")?.remove()
	}

	// Check CSS for changes:
	const cssChanged = `data:text/css;base64,${btoa(settings.css.addon + settings.css.custom.code)}` !== $("#betabot-css")?.prop("href")

	// If the code has changed, or if it was never injected:
	if (cssChanged) {
		//only remove the element if it exists:
		$("#betabot-css")?.remove()
		// Decode CSS into base64 and use it as a link to avoid script injections:
		$("head").append(`<link id="betabot-css" class="betabot" rel="stylesheet" href="data:text/css;base64,${btoa(settings.css.addon + settings.css.custom.code)}">`)
	}

	// Hide Effects Box:
	const effectsInfo = $("#effectInfo")[0]
	if (settings.removeEffects && !Array.from(effectsInfo.classList).includes("betabot-hidden")) {
		$("#effectInfo").addClass("betabot-hidden")
	} else if (!settings.removeEffects && Array.from(effectsInfo.classList).includes("betabot-hidden")) {
		$("#effectInfo").removeClass("betabot-hidden")
	}

	// Option to build a specific item:
	if (settings.addCustomBuild && !$("#betabot-custom-build")[0] && $("#housing").is(":visible") && $("#house_level").text() !== "None" && refresh) {
		house.addCustomBuild()
	} else if (!settings.addCustomBuild && $("#betabot-custom-build")[0]) {
		$("#betabot-custom-build").remove()
	}

	// Auto Gauntlets:
	if (refresh) { // Don't run on page load
		eventListeners.toggle("roa-ws:message", gauntlet.checkGauntletMessage, settings.joinGauntlets)
	}

	// Auto Craft/Carve:
	eventListeners.toggle("roa-ws:craft roa-ws:carve roa-ws:notification", professionQueues.checkQueue, settings.autoCraft || settings.autoCarve)

	// Auto Stamina/Quests/House/Harvestron:
	eventListeners.toggle("roa-ws:battle roa-ws:harvest roa-ws:carve roa-ws:craft roa-ws:event_action",
		betabot.checkResults, settings.autoStamina || settings.autoQuests || settings.autoHouse || settings.autoHarvestron)

	// Socket Gem x5:
	eventListeners.toggle(
		["", "item_options", "gem_unsocket_from_item", "gem_unsocket_all_from_item", "gem_socket_to_item", "item_rename", "item_own"]
			.join(" roa-ws:page:").trim(),
		gems.addSocket5Button, settings.addSocketX5)

	// Advent Calendar:
	eventListeners.toggle("roa-ws:page:event_calendar", calendar.addAdventCalendar, settings.addAdventCalendar)

	// Auto Mob Climbing:
	eventListeners.toggle("roa-ws:battle", mobClimbing.checkClimbing, settings.autoClimb.climb)
}

/**
 * Updates `settings` after changes
 * @async
 * @function refreshSettings
 * @param {object} changes See {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/onChanged#Parameters|storage.onChanged}
 * @memberof beta-game
 */
async function refreshSettings(changes) {
	// Update `settings`:
	for (const [name, {newValue}] of Object.entries(changes)) settings[name] = newValue

	// Restart auto wire:
	if ("wireFrequency" in changes && settings.wireFrequency > 0) {
		setTimeout(wiring.wire, settings.wireFrequency*60_000)
	}

	// Reset `actionsPending` and call `toggleInterfaceChanges`:
	vars.actionsPending = false
	toggleInterfaceChanges(true)
}
browser.storage.onChanged.addListener(refreshSettings)

browser.storage.sync.get().then(result => {
	settings = result

	port = browser.runtime.connect({ name: username.name + " " + (username.isAlt() ? "alt" : "main") })
	port.onMessage.addListener(message => {
		if (settings.verbose) log("Received message:", message)

		if (message.text === "close banners") closeBanner()
		if (message.text === "open advent calendar") calendar.receiveAdventCalendar()
		if (message.text === "send currency") wiring.wire(message.recipient)
	})

	if (settings.verbose) {
		log(`Starting up (Beta Game)\nUsername: ${username.name}\nAlt: ${username.isAlt() ? "yes" : "no"}` +
			`\nGauntlet: ${settings.joinGauntlets ? "Join" : "Don't join"}`)
	} else {
		log("Starting up")
	}

	// Hookup to the websocket:
	if ($("#betabot-ws")[0]) $("#betabot-ws").remove() // Re-inject the script if it already exists

	$("head").append(`<script id="betabot-ws" class="betabot">
betabotChannel = new MessageChannel()
window.postMessage("betabot-ws message", "*", [betabotChannel.port2])
$(document).on("roa-ws:all", (_, data) => betabotChannel.port1.postMessage(JSON.parse(data)))
</script>`)

	/** @todo Maybe we can use `$(window).one()` here? */
	$(window).on("message", ({originalEvent: {origin, data, ports}}) => {
		/* Make sure we are connecting to the right port. No need to be
		   absolutely sure about it since we don't send sensitive data */
		if (origin !== "https://beta.avabur.com" || data !== "betabot-ws message") return

		/**
		 * Broadcasts events from the page to the content script. Based on RoA-WSHookUp
		 * @author {@link https://github.com/edvordo/RoA-WSHookUp|Edvordo}
		 * @license MIT License
		 */
		ports[0].onmessage = ({data}) => {
			for (const item of data) {
				const etype = "roa-ws:" + (item.type ?? "general")
				if (item.type === "page" && typeof item.page === "string") {
					$(document).trigger(etype + ":" + item.page, item)
				}
				$(document).trigger(etype, item)
			}
			$(document).trigger("roa-ws:all", data)
		}
	})

	// Create a `span` for buttons next to the username:
	if (!$("#betabot-next-to-name")[0]) {
		$("#username").after(`<span id="betabot-next-to-name" class="betabot"></span>`)
		$("#betabot-next-to-name").append(`<button id="betabot-request-button" class="betabot"><a>Request Currency</a></button>`)
		$("#betabot-next-to-name").append(`<button id="betabot-spread-button" class="betabot"><a>Spread Currency</a></button>`)
		$("#betabot-request-button").click(() => browser.runtime.sendMessage({text: "requesting currency"}))
		$("#betabot-spread-button").click(() => browser.runtime.sendMessage({text: "requesting a list of active alts"})).then(wiring.spreadCurrency)
	}

	// Start up auto wire:
	setTimeout(wiring.wire, settings.wireFrequency*60_000)

	// Wait for the page to load:
	eventListeners.waitFor("roa-ws:motd").then(async () => {
		// Set up auto gauntlet:
		eventListeners.toggle("roa-ws:message", gauntlet.checkGauntletMessage, settings.joinGauntlets)

		// Hide the interface:
		$("#modalBackground, #modalWrapper").addClass("betabot-hidden")

		// Option to build a specific item (if the player has a house):
		if ($("#housing").is(":visible") && $("#house_level").text() !== "None") {
			$("#modal2Wrapper").addClass("betabot-hidden")

			await house.addCustomBuild()

			// Reshow some of the interface:
			await delay(999)
			$("#modal2Wrapper").removeClass("betabot-hidden")
		}

		// Daily Crystals:
		await betabot.buyCrys()

		// Reshow the rest of the interface:
		$("#modalBackground, #modalWrapper").removeClass("betabot-hidden")
	})

	// On click, close banners on all alts:
	$("#close_general_notification").click(event => {
		// Don't run due to closeBanner():
		if (event.originalEvent.isTrusted && settings.removeBanner) browser.runtime.sendMessage({text: "banner closed"})
	})

	/* Event listeners that are currently always on (might change in the future) are
	   here. Event listeners that will be turned on/off as needed are inside `toggleInterfaceChanges` */

	// Toggle vars.motdReceived on for a short time after receiving motd message:
	eventListeners.toggle("roa-ws:motd", gauntlet.motd, true)
	// Advice the user to update the options page after a name change:
	eventListeners.toggle("roa-ws:page:username_change", username.usernameChange, true)
	// Don't start new quests/harvestron jobs for 60 seconds after manually cancelling one:
	eventListeners.toggle("roa-ws:page:quest_forfeit roa-ws:page:house_harvest_job_cancel", betabot.questOrHarvestronCancelled, true)

	// Call `toggleInterfaceChanges`:
	toggleInterfaceChanges(false)
})
