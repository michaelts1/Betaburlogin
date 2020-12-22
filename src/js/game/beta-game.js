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
	global betabot, calendar, closeBanner, gauntlet, gems, house, mobClimbing,
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
			if (!$("#betabot-request-currency")[0]) {
				$("#betabot-next-to-name").empty()
				$("#betabot-next-to-name").append(`<button id="betabot-request-currency" class="betabot"><a>Request Currency</a></button>`)
				$("#betabot-request-currency").click(() => port.postMessage({text: "requesting currency"}) )
			}
			break
		case "spread":
			if (!$("#betabot-spread-button")[0]) {
				$("#betabot-next-to-name").empty()
				$("#betabot-next-to-name").append(`<button id="betabot-spread-button" class="betabot"><a>Spread Currency</a></button>`)
				$("#betabot-spread-button").click(() => port.postMessage({text: "requesting a list of active alts"}) )
			}
			break
		default:
			$("#betabot-next-to-name").empty()
	}

	// Make it easier to see what alt it is:
	if (settings.addUsername) {
		username.appendName()
		username.keepUsernameVisible.observe($("#roomName")[0], {attributes: true, childList: true, subtree: true})
	} else {
		username.keepUsernameVisible.disconnect()
		$("#betabot-clear-username")?.remove()
	}

	// Custom style:
	const cssChanged = `data:text/css;base64,${btoa(settings.css.addon + settings.css.custom.code)}` !== $("#betabot-css")?.prop("href")
	if (cssChanged) { // If the code has changed, or if it was never injected
		$("#betabot-css")?.remove() //only remove the element if it exists
		// Decode CSS into base64 and use it as a link to avoid script injections:
		$("head").append(`<link id="betabot-css" class="betabot" rel="stylesheet" href="data:text/css;base64,${btoa(settings.css.addon + settings.css.custom.code)}">`)
	}

	// Remove Effects Box:
	if (settings.removeEffects && $("#effectInfo")[0]) {
		$("#effectInfo").remove()
	} else if (!settings.removeEffects && !$("#effectInfo")[0]) {
		$("#gauntletInfo").after(`
		<div id="effectInfo" style="display: block;">
			<div class="ui-element border2">
				<h5 class="toprounder center"><a id="effectUpgradeTable">Effects</a></h5>
				<div class="row" id="effectTable"></div>
			</div>
		</div>`)
	}

	// Option to build a specific item:
	if (settings.addCustomBuild && !$("#betabot-custom-build")[0]) {
		// Don't activate immediately on page load, nor if there is no house:
		if (refresh && !$("#housing").is(":visible")) {
			house.addCustomBuild()
		} else {
			eventListeners.waitFor("roa-ws:motd").then(() => { // Wait for the page to load
				house.addCustomBuild()
			})
		}
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
		"roa-ws:page:" +
		["item_options", "gem_unsocket_from_item", "gem_unsocket_all_from_item", "gem_socket_to_item", "item_rename", "item_own"]
			.join(" roa-ws:page:"),
		gems.addSocket5Button, settings.addSocketX5)

	// Spawn Gems For All Alts:
	eventListeners.toggle("roa-ws:modalContent", gems.addAltsSpawn, username.isAlt() && settings.addSpawnGems)

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
	if ("wireFrequency" in changes && settings.autoWire) {
		setTimeout(wiring.wire, settings.wireFrequency*60*1000)
	}

	// Reset `actionsPending` and call `toggleInterfaceChanges`:
	vars.actionsPending = false
	toggleInterfaceChanges(true)
}
browser.storage.onChanged.addListener(refreshSettings)

browser.storage.sync.get().then(result => {
	settings = result

	port = browser.runtime.connect({name: username.name + " " + (username.isAlt() ? "alt" : "main")})
	port.onMessage.addListener(message => {
		if (settings.verbose) log("Received message:", message)

		if (message.text === "close banners") closeBanner()
		if (message.text === "list of active alts") wiring.spreadCurrency(message.alts)
		if (message.text === "open advent calendar") calendar.receiveAdventCalendar()
		if (message.text === "send currency") wiring.wire(message.recipient)
		if (message.text === "spawn gems") gems.spawnGems(message.tier, message.type, message.splice, message.amount)
	})

	if (settings.verbose) {
		log(`Starting up (Beta Game)\nUsername: ${username.name}\nAlt: ${username.isAlt() ? "yes" : "no"}` +
			`\nGauntlet: ${settings.joinGauntlets ? "Join" : "Don't join"}`)
	} else {
		log("Starting up")
	}

	// Hookup to the websocket:
	if ($("#betabot-ws")[0]) $("#betabot-ws").remove() // Re-inject the script if it already exists

	$("head").after(`<script id="betabot-ws" class="betabot">
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
				let etype = "roa-ws:" + (item.type ?? "general")
				if (item.type === "page" && typeof item.page === "string") {
					$(document).trigger(etype + ":" + item.page, item)
				}
				$(document).trigger(etype, item)
			}
			$(document).trigger("roa-ws:all", data)
		}
	})

	// Create an empty `span` next to the username:
	if (!$("#betabot-next-to-name")[0]) {
		$("#username").after(`<span id="betabot-next-to-name" class="betabot"></span>`)
	}

	// Start up auto wire:
	setTimeout(wiring.wire, settings.wireFrequency*60*1000)

	// Set up auto gauntlet:
	eventListeners.waitFor("roa-ws:motd").then(() => { // Start after a delay to avoid being triggered by old messages
		eventListeners.toggle("roa-ws:message", gauntlet.checkGauntletMessage, settings.joinGauntlets)
	})

	// On click, close banners on all alts:
	$("#close_general_notification").click(event => {
		// Don't run due to closeBanner():
		if (event.originalEvent.isTrusted && settings.removeBanner) port.postMessage({text: "banner closed"})
	})

	// Buy crystals every 24 hours:
	setTimeout(betabot.buyCrys, 1000*60*60*24)

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
