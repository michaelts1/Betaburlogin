"use strict"

/**
 * @file Code to run when on Beta Game page
 * @todo {@link https://github.com/michaelts1/Betaburlogin/projects}
 */
/**
 * @namespace beta-game
 */

/**
 * @async
 * @function betaGame
 * @memberof beta-game
 */
async function betaGame() {
	let settings = await browser.storage.sync.get()

	/**
	 * - Stores variables and constants to avoid polluting the global space
	 * - Using a constructor to refer to `this.username` during initialization
	 * @constant vars
	 * @enum {any}
	 * @memberof beta-game
	 */
	const vars = new function() {
		this.buttonDelay        = 500
		this.startActionsDelay  = 1000
		this.questCompleting    = null
		this.gauntletID         = null
		this.mainEvent          = false
		this.gauntletInProgress = false
		this.motdReceived       = false
		this.actionsPending     = false
		this.staminaCooldown    = false
		this.houseItemQueued    = false
		this.username           = $("#username").text()
		this.mainTrade          = getTrade(this.username)
		this.isAlt              = this.username !== settings.mainUsername.toLowerCase()
		this.autoWireID         = settings.autoWire ? setInterval(wire, settings.wireFrequency*60*1000, settings.mainUsername) : null
	}

	if (settings.verbose) log(`Starting up (Beta Game)\nUsername: ${vars.username}\nAlt: ${vars.isAlt ? "yes" : "no"}
Gauntlet: ${settings.joinGauntlets ? "Join" : "Don't join"}, ${vars.mainTrade}\nAuto Wire: ${vars.autoWireID ? "on" : "off"}`)

	/**
	 * @typedef {helpers.runtimePort} runtimePort
	 * @memberof beta-game
	 */

	/**
	 * Stores the connection to the background script
	 * @type {runtimePort}
	 * @memberof beta-game
	 */
	const port = browser.runtime.connect({name: vars.username + " " + (vars.isAlt ? "alt" : "main")})
	port.onMessage.addListener(message => {
		if (settings.verbose) log("Received message:", message)

		if (message.text === "send currency") wire(message.recipient)
		if (message.text === "jump mobs") jumpMobs(message.number)
		if (message.text === "spawn gems") spawnGems(message.tier, message.type, message.splice, message.amount)
		if (message.text === "list of active alts") spreadCurrency(message.alts)
		if (message.text === "close banners") closeBanner()
	})

	/**
	 * Loads new settings from storage
	 * @function refreshSettings
	 * @param {object} changes See {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/onChanged#Parameters|storage.onChanged}
	 * @memberof beta-game
	 */
	async function refreshSettings(changes) {
		for (const [name, {newValue}] of Object.entries(changes)) settings[name] = newValue

		if ("mainTrade" in changes) {
			vars.mainTrade = getTrade(vars.username)
		}
		if ("mainUsername" in changes) {
			vars.isAlt = vars.username !== settings.mainUsername.toLowerCase()
		}
		if ("wireFrequency" in changes || "mainUsername" in changes || vars.autoWireID && !settings.autoWire) {
			clearInterval(vars.autoWireID)
			vars.autoWireID = null
		}
		if (!vars.autoWireID && settings.autoWire) {
			vars.autoWireID = setInterval(wire, settings.wireFrequency*60*1000, settings.mainUsername)
		}

		vars.actionsPending = false
		toggleInterfaceChanges(true)
	}
	browser.storage.onChanged.addListener(refreshSettings)

	/* Event listeners that are currently always on (might change in the future) are below
	   Event listeners that will be turned on/off as needed are inside toggleInterfaceChanges() */

	// Toggle vars.motdReceived on for a short time after receiving motd message
	eventListeners.toggle("roa-ws:motd", motd, true)
	// Advice the user to update the options page after a name change:
	eventListeners.toggle("roa-ws:page:username_change", usernameChange, true)
	// Don't start new quests/harvestron jobs for 60 seconds after manually cancelling one:
	eventListeners.toggle("roa-ws:page:quest_forfeit roa-ws:page:house_harvest_job_cancel", questOrHarvestronCancelled, true)

	/**
	 * Advises the user to update settings when changing name
	 * @function usernameChange
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game
	 */
	function usernameChange(_, data) {
		if (data.s === 0) return // Unsuccessful name change

		if (settings.verbose) log(`User has changed name from ${vars.username} to ${data.u}`)
		$.alert(`It looks like you have changed your username from ${vars.username} to ${data.u}.
			If you used the old username in BetaburLogin settings page, you might want to
			update these settings`, "Name Changed")
		vars.username = data.u
	}

	/**
	 * Creates a drop down list in the house page, allowing the user to select a custom build instead of always building the fastest
	 * @function getCustomBuild
	 * @memberof beta-game
	 */
	async function getCustomBuild() {
		vars.actionsPending = true
		$("#modalBackground, #modal2Wrapper").prop("style", "display: none !important;") // Hide the interface for the duration of this process
		$("#allHouseUpgrades")[0].click()

		const {data} = await eventListeners.waitFor("roa-ws:page:house_all_builds")
		const items = []
		data.q_b.map(el1 => items.filter(el2 => el2.i == el1.i).length > 0 ? null : items.push(el1)) // Filter duplicates - https://stackoverflow.com/a/53543804

		// Create the dropdown list:
		let select = `<div id="betabot-custom-build">Build a specific item: <select id="betabot-select-build"><option value="" selected>None (Build Fastest)</option>`
		for (const item of items) select += `<option value="${item.i}">${item.n}</option>`
		$("#houseQuickBuildWrapper").append(select + "</select></div>")

		$("#modalBackground, #modal2Wrapper").prop("style", "") // Return to normal
		if (settings.verbose) log("Added Custom Build select menu")
		completeTask()
	}

	/**
	 * Creates a "Spawn For All Alts" button on the Spawn Gems interface
	 * @function addAltsSpawn
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game
	 */
	function addAltsSpawn(_, data) {
		if (data.title === "Spawn Gems") {
			$("#gemSpawnConfirm").after(`<input id="betabot-spawn-gem" type="button" style="padding:6.5px; margin: 0 -.5em 0 .5em;" value="Spawn For All Alts">`)

			$("#betabot-spawn-gem").click(() => {
				const msg = {
					text  : "spawnGem",
					tier  : parseInt($("#spawnGemLevel").val()),
					type  : parseInt($("#gemSpawnType").val()),
					splice: parseInt($("#gemSpawnSpliceType").val()),
					amount: parseInt($("#gemSpawnCount").val()),
				}
				port.postMessage(msg)
				if (settings.verbose) log(`Requested to spawn ${msg.amount} tier ${msg.tier} gems with type value of ${msg.type} and splice value of ${msg.splice}`)
			})
		}
	}

	/**
	 * Appends the username to the room name
	 * @function appendName
	 * @memberof beta-game
	 */
	function appendName() {
		if (!$("#betabot-clear-username")[0]) {
			$("#roomName").append(`<span id="betabot-clear-username">${vars.username}</span>`)
			if (settings.verbose) log("Appended username to room name")
		}
	}
	/**
	 * MutationObserver for appendName
	 * @constant {MutationObserver} keepUsernameVisible
	 * @memberof beta-game
	 */
	const keepUsernameVisible = new MutationObserver(appendName)

	/**
	 * Jumps to a mob with a given ID
	 * @async
	 * @function jumpMobs
	 * @param {number} number Mob ID
	 * @memberof beta-game
	 */
	async function jumpMobs(number) {
		if (settings.verbose) log(`Jumping to mob number ${number}`)
		await delay(vars.startActionsDelay)
		$("#battleGrounds").click()

		await eventListeners.waitFor("roa-ws:page:town_battlegrounds")
		$(`#enemyList>option[value|=${number}]`).attr("selected", "selected")
		await delay(vars.buttonDelay)
		$("#autoEnemy").click()
	}

	$("#close_general_notification").click(event => {
		// Don't run due to closeBanner()
		if (event.originalEvent.isTrusted && settings.removeBanner) port.postMessage({text: "banner closed"})
	})

	/**
	 * Closes the banner
	 * @function closeBanner
	 * @memberof beta-game
	 */
	function closeBanner() {
		if (!$("#close_general_notification")[0]) return // Don't run if the banner is already closed
		$("#close_general_notification")[0].click()
		if (settings.verbose) log("Banner closed")
	}

	/**
	 * Spawns gems
	 * @async
	 * @function spawnGems
	 * @param {number} type ID of a gem type for the main gem
	 * @param {number} splice ID of a gem type for the spliced gem
	 * @param {number} tier
	 * @param {number} amount
	 * @memberof beta-game
	 */
	async function spawnGems(tier, type, splice, amount) {
		if (settings.verbose) log(`Spawning ${amount} level ${tier*10} gems with type value of ${type} and splice value of ${splice}`)

		if (tier > parseInt($("#level").text()) * 10 || amount > 60 || type === 65535 || splice === 65535 || type === splice) {
			if (settings.verbose) log("Invalid request. Aborting spawn")
			return
		}

		$("#chatMessage").text("/spawngem")
		$("#chatSendMessage").click()

		await eventListeners.waitFor("roa-ws:modalContent")
		$("#spawnGemLevel").val(tier)
		$("#gemSpawnType").val(type)
		$("#gemSpawnSpliceType").val(splice)
		$("#gemSpawnCount").val(amount)

		await delay(vars.startActionsDelay)
		$("#gemSpawnConfirm").click()

		await eventListeners.waitFor("roa-ws:page:gem_spawn")
		$("#betabot-spawn-gem").prop("disabled", true)
		await delay(60*1000)
		$("#betabot-spawn-gem").prop("disabled", false)
		$("#confirmButtons>a.green")[0].click()
	}

	/**
	 * - Sends currency to another user (according to the user's currency send settings)
	 * @function wire
	 * @param {string} target Wire recipient
	 * @memberof beta-game
	 */
	function wire(target) {
		if (target === vars.username) return
		if (settings.verbose) log(`Wiring ${target}`)

		let sendMessage = `/wire ${target}`

		for (const [name, sendSettings] of Object.entries(settings.currencySend)) {
			if (!sendSettings.send) continue

			const amount   = $(`.${name}`).attr("title").replace(/,/g, "")
			const sellable = $(`.${name}`).attr("data-personal").replace(/,/g, "")
			let amountToSend = amount - sendSettings.keepAmount // Keep this amount

			// Don't send more than you can
			if (amountToSend > sellable) amountToSend = sellable

			// Only send if you have enough
			if (amountToSend > sendSettings.minimumAmount) {
				sendMessage += ` ${amountToSend} ${name},`
			}
		}

		if (sendMessage !== `/wire ${target}`) {
			$("#chatMessage").text(sendMessage)
			$("#chatSendMessage").click()
		}
	}

	/**
	 * Spreads all currencies evenly across all alts (according to the user's currency send settings)
	 * @function spreadCurrency
	 * @param {string[]} alts Alt names to spread the currency across (e.g. `["altI", "altII"]`)
	 */
	function spreadCurrency(alts) {
		// Don't spread to yourself:
		alts.filter(name => name !== vars.username)

		let sendMessage = ""

		// Calculate the amounts:
		for (const [currencyName, sendSettings] of Object.entries(settings.currencySend)) {
			const totalAmount = $(`.${currencyName}`).attr("title").replace(/,/g, "")
			const marketable = $(`.${currencyName}`).attr("data-personal").replace(/,/g, "")

			// Keep the specified amount to yourself:
			let amountToSend = totalAmount - sendSettings.keepAmount
			// Only send what you can:
			if (amountToSend > marketable) amountToSend = marketable
			// Divide what you can send by the amount of alts:
			amountToSend = amountToSend / alts.length
			// Only continue if you have enough to send:
			if (amountToSend > sendSettings.minimumAmount) {
				sendMessage += ` ${amountToSend} ${currencyName},`
			}
		}

		for (let i = 0; i < alts.length; i++) {
			// Wait for 6 seconds between each wire, since wiring is limited to 5 wires per 30 seconds:
			setTimeout( () => {
				$("#chatMessage").text(`/wire ${alts[i]} ${sendMessage}`)
				$("#chatSendMessage").click()
			}, 6000*i)
		}
	}

	// Using an IIFE to avoid polluting the global space
	(function() {
		if ($("#betabot-ws")[0] !== undefined) $("#betabot-ws").remove() // Re-inject the script

		/**
		 * A script that will be injected to the page. Used to broadcast events to the content script
		 * @constant elm
		 * @private
		 * @memberof beta-game
		 */
		const elm = document.createElement("script")
		elm.innerHTML =
`betabotChannel = new MessageChannel()
window.postMessage("betabot-ws message", "*", [betabotChannel.port2])
$(document).on("roa-ws:all", function(_, data) {
	betabotChannel.port1.postMessage(JSON.parse(data))
})`
		elm.id = "betabot-ws"
		document.head.appendChild(elm)

		/**
		 * Broadcasts events from the page to the content script
		 * @function roaWS
		 * @param {event} event Event object
		 * @author {@link https://github.com/edvordo/RoA-WSHookUp|Edvordo}
		 * @license MIT License
		 * @private
		 * @memberof beta-game
		 */
		function roaWS(event) {
			const data = event.data
			let etype = "roa-ws:"
			for (let i = 0; i < data.length; i++) {
				const item = data[i]
				let etypepage = ""
				etype = "roa-ws:"
				if ({}.hasOwnProperty.call(item, "type")) {
					etype = etype + item.type
					// In case its a "page" type message create additional event, e.g. "roa-ws:page:boosts"
					if (item.type === "page" && {}.hasOwnProperty.call(item, "page") && "string" === typeof item.page) {
						etypepage = etype + ":" + item.page
					}
				}
				else {
					etype = etype + "general"
				}

				$(document).trigger(etype, item)
				if (etypepage.length > 0) {
					$(document).trigger(etypepage, item)
				}
			}
			$(document).trigger("roa-ws:all", data)
		}

		$(window).on("message", message => {
			const origin = message.originalEvent.origin
			const data = message.originalEvent.data
			/* Make sure we are connecting to the right port
			   No need to be absolutely sure about it since we don't send sensitive data */
			if (origin === "https://beta.avabur.com" && data === "betabot-ws message") {
				message.originalEvent.ports[0].onmessage = roaWS
			}
		})
	})()

	/**
	 * Auto quests, house, craft, stamina, `checkResults()`, and `completeTask()` were originally based on a private distribution of @Batosi's bot
	 * @author {@link https://github.com/Isotab|Isotab}
	 * @name "Betabot Credits"
	 * @memberof beta-game
	 */

	/**
	 * Closes the modal and sets `vars.actionsPending` to false
	 * @async
	 * @function completeTask
	 * @memberof beta-game
	 */
	async function completeTask() {
		await delay(vars.startActionsDelay)
		vars.actionsPending = false
		$(".closeModal").click()
	}

	/**
	 * Stops tracking Harvestron/Quests for 60 seconds after manually cancelling
	 * @async
	 * @function questOrHarvestronCancelled
	 * @param {event} event Event object
	 * @memberof beta-game
	 */
	async function questOrHarvestronCancelled(event) {
		const type = event.type.replace("roa-ws:page:", "")
		let key = null
		if (type === "quest_forfeit") {
			if (settings.verbose) log("Quest forfeited. Waiting 60 seconds before checking for quests again")
			key = "autoQuest"
		} else if (type === "house_harvest_job_cancel") {
			if (settings.verbose) log("Harvestron job cancelled. Waiting 60 seconds before checking the Harvestron again")
			key = "autoHarvestron"
		}

		if (settings[key]) {
			settings[key] = false
			await delay(60*1000)
			settings[key] = (await browser.storage.sync.get(key))[key]
		}
	}

	/**
	 * Buys daily crystals for gold
	 * @async
	 * @function buyCrys
	 * @memberof beta-game
	 */
	async function buyCrys() {
		if (settings.dailyCrystals === 0) return

		vars.actionsPending = true
		await delay(vars.startActionsDelay)
		$("#premiumShop").click()

		await eventListeners.waitFor("roa-ws:page:boosts")
		const leftToBuy = settings.dailyCrystals - parseInt($("#premium_purchased_today").text()) // Amount of crystals left to buy
		if (leftToBuy > 0) { // Don't purchase if there is nothing to purchase
			await delay(vars.buttonDelay)
			$("#goldCrystalButton").click()

			await delay(vars.buttonDelay)
			$("#premium_purchase_gold_count").val(leftToBuy)
			$("#premium_purchase_gold_button").click()
			if (settings.verbose) log(`Bought ${leftToBuy} daily crystals`)
		}
		completeTask()
	}
	setInterval(buyCrys, 1000 * 60 * 60 * 24) // Once a day

	/**
	 * Finishes a quest and starts a new one
	 * @async
	 * @function finishQuest
	 * @memberof beta-game
	 */
	async function finishQuest() {
		await delay(vars.startActionsDelay)
		if (settings.verbose) log(`Completing a ${vars.questCompleting} quest`)
		$(`input.completeQuest[data-questtype=${vars.questCompleting}]`).click() // Complete the quest

		await eventListeners.waitFor("roa-ws:page:quests")
		await delay(vars.buttonDelay)
		if (settings.verbose) log(`Starting a ${vars.questCompleting} quest`)
		$(`input.questRequest[data-questtype=${vars.questCompleting}][value="Begin Quest"]`).click() // Start new quest

		await eventListeners.waitFor("roa-ws:page:quests")
		await delay(vars.buttonDelay)
		vars.questCompleting = null
		completeTask()
	}

	/**
	 * Selects the next item to build
	 * @async
	 * @function selectBuild
	 * @memberof beta-game
	 */
	async function selectBuild() {
		const itemId = parseInt($("#betabot-select-build").val())

		await delay(vars.startActionsDelay)
		if (!isNaN(itemId)) { // If a custom build is specified, upgrade it
			$("#allHouseUpgrades")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_all_builds")
			customBuild(itemId)
		} else if ($("#houseRoomCanBuild").is(":visible")) { // Else, if new room is available, build it
			if (settings.verbose) log("Building a new room")
			$("#houseBuildRoom")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_build_room")
			completeTask()
		} else if ($("#houseQuickBuildList li:first .houseViewRoom").length === 1) { // Else, if new item is available, build it
			$("#houseQuickBuildList li:first .houseViewRoom")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_room")
			buildItem()
		} else { // Else, upgrade existing item
			$("#houseQuickBuildList li:first .houseViewRoomItem")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_room_item")
			upgradeItem()
		}
	}

	/**
	 * Builds a custom item based on its ID
	 * @async
	 * @function customBuild
	 * @param {number} itemId ID of a house item
	 * @memberof beta-game
	 */
	async function customBuild(itemId) {
		if (settings.verbose) log(`Upgrading custom item with id ${itemId}`)
		await delay(vars.buttonDelay)
		$(`#modal2Content a[data-itemtype=${itemId}]`)[0].click()

		await eventListeners.waitFor("roa-ws:page:house_room_item")
		await delay(vars.buttonDelay)
		$("#houseRoomItemUpgradeLevel").click()

		await eventListeners.waitFor("roa-ws:page:house_room_item_upgrade_level")
		completeTask()
	}

	/**
	 * Builds a new item
	 * @async
	 * @function buildItem
	 * @memberof beta-game
	 */
	async function buildItem() {
		if (settings.verbose) log("Building a new item")
		await delay(vars.startActionsDelay)
		$("#houseBuildRoomItem").click()
		await eventListeners.waitFor("roa-ws:page:house_build_room_item")
		completeTask()
	}

	/**
	 * Upgrades an existing item tier or level
	 * @async
	 * @function upgradeItem
	 * @memberof beta-game
	 */
	async function upgradeItem() {
		await delay(vars.startActionsDelay)
		if ($("#houseRoomItemUpgradeTier").is(":visible")) { // If tier upgrade is available, upgrade it
			if (settings.verbose) log("Upgrading item tier")
			$("#houseRoomItemUpgradeTier").click()
		} else { // Else do a regular upgrade
			if (settings.verbose) log("Upgrading fastest item")
			$("#houseRoomItemUpgradeLevel").click()
		}
		await eventListeners.waitFor("roa-ws:page:house_room_item_upgrade_tier roa-ws:page:house_room_item_upgrade_level")
		completeTask()
	}

	/**
	 * Starts a new Harvestron job
	 * @async
	 * @function startHarvestron
	 * @memberof beta-game
	 */
	async function startHarvestron() {
		if (settings.verbose) log("Starting Harvestron job")
		$("#houseHarvestingJobStart").click()
		await eventListeners.waitFor("roa-ws:page:house_harvest_job")
		completeTask()
	}

	/**
	 * Fills the crafting queue
	 * @async
	 * @function fillCraftingQueue
	 * @memberof beta-game
	 */
	async function fillCraftingQueue() {
		vars.actionsPending = true
		await delay(vars.startActionsDelay)
		// For some weird reason, .click() does not work here ¯\_(ツ)_/¯
		$(".craftingTableLink")[0].dispatchEvent(new Event("click"))

		await eventListeners.waitFor("roa-ws:page:house_room_item")
		await delay(vars.buttonDelay)
		$("#craftingVetoUnselectAll").click()
		$("#craftingItemLevelMax").click()
		$("#craftingQuality").val(0)
		$("#craftingJobFillQueue").attr("checked", "true")

		await delay(vars.buttonDelay)
		$("#craftingJobStart").click()

		await eventListeners.waitFor("roa-ws:page:craft_item")
		completeTask()
	}

	/**
	 * Checks whether or not the crafting queue should be filled
	 * @function checkCraftingQueue
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game
	 */
	function checkCraftingQueue(_, data) {
		if (vars.actionsPending) return

		if (data.type === "craft" && data.results.a.cq < settings.minCraftingQueue) {
			if (settings.verbose) log(`There are less than ${settings.minCraftingQueue} items in the crafting queue. Refilling now`)
			fillCraftingQueue()
		} else if (data.type === "notification" && settings.resumeCrafting) {
			// Means the user has not manually stopped crafting:
			if (/You completed your crafting queue and began (Battling|Fishing|Woodcutting|Mining|Stonecutting) automatically./.test(data.m)) {
				if (settings.verbose) log("Crafting queue is empty. Refilling now")
				fillCraftingQueue()
			}
		}
	}

	/**
	 * Fills the carving queue
	 * @async
	 * @function fillCarvingQueue
	 * @memberof beta-game
	 */
	async function fillCarvingQueue() {
		vars.actionsPending = true
		await delay(vars.startActionsDelay)
		$(".carvingBenchLink")[0].click()

		await eventListeners.waitFor("roa-ws:page:house_room_item")
		await delay(vars.buttonDelay)
		$("#carvingItemLevel").val($("#carvingItemLevel option:last").val())
		$("#carvingType").val(65535)
		$("#carvingJobCountMax").click()

		await delay(vars.buttonDelay)
		$("#carvingJobStart").click()

		await eventListeners.waitFor("roa-ws:page:carve_item")
		completeTask()
	}

	/**
	 * Checks whether or not the carving queue should be filled
	 * @function checkCarvingQueue
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game
	 */
	function checkCarvingQueue(_, data) {
		if (vars.actionsPending) return

		if (data.type === "carve" && data.results.a.cq < settings.minCarvingQueue) {
			if (settings.verbose) log(`There are less than ${settings.minCarvingQueue} gems in the carving queue. Refilling now`)
			fillCarvingQueue()
		} else if (data.type === "notification" && settings.resumeCrafting) {
			// Means the user has not manually stopped carving:
			if (/You completed your carving queue and began (Battling|Fishing|Woodcutting|Mining|Stonecutting) automatically./.test(data.m)) {
				if (settings.verbose) log("Carving queue is empty. Refilling now")
				fillCarvingQueue()
			}
		}
	}

	/**
	 * Adds a "Socket Gem x5" button to the Item Options interface
	 * @function addSocket5Button
	 * @memberof beta-game
	 */
	function addSocket5Button() {
		if (!$("#betabot-socket-5")[0]) {
			$("#socketThisGem").after(`<button id="betabot-socket-5">Socket Gem x5</button>`)
			$("#betabot-socket-5").click(socketGems)
		}
	}

	/**
	 * Socket gems into an item
	 * @async
	 * @function socketGems
	 * @memberof beta-game
	 */
	async function socketGems() {
		vars.actionsPending = true
		let firstGemName = null

		// Until there are no more empty slots, or until the user closes the modal:
		while ($("#socketableGems option").eq(0).is(":visible")) {
			$("#socketThisGem").click()

			// Wait for `roa-ws:page:gem_socket_to_item` event:
			const {data} = await eventListeners.waitFor("roa-ws:page:gem_socket_to_item")

			/* If this is the first gem socketed, assign `firstGemName` the name of this gem.
			   Since `data.m` contains a very long html string, we need to extract the gem name.
			   `firstGemName` should look like "Tier 200 Diamond of Agile Mastery" */
			firstGemName = firstGemName ?? (new DOMParser()).parseFromString(data.m, "text/html").body.children[0].textContent

			// If `$("#socketableGems option")` length is `0`, use `null`:
			const nextGemName = ($("#socketableGems option").filter(":selected").text().match(/.*?(?= \()/) ?? [null])[0]

			// Only socket the next gem if it the same type as the first socketed gem:
			if (nextGemName !== firstGemName) break

			// Add a small pause before the next iteration:
			await delay(settings.startActionsDelay)
		}

		vars.actionsPending = false
		if (settings.verbose) log("Finished socketing gems")
	}

	/**
	 * Checks action results for needed actions
	 * @async
	 * @function checkResults
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game
	 */
	async function checkResults(_, data) {
		data = data.results.p

		// Stamina:
		if (settings.autoStamina && data.autos_remaining < settings.minStamina && !vars.staminaCooldown) {
			if (settings.verbose) log("Replenishing stamina")
			$("#replenishStamina").click()
			vars.staminaCooldown = true
			await delay(2500)
			vars.staminaCooldown = false
			return
		}

		// Actions that should always be performed go before this line:
		if (vars.actionsPending) return

		// Quests:
		if (settings.autoQuests) {
			if (data.bq_info2?.c >= data.bq_info2.r) {
				vars.questCompleting = "kill"
			} else if (data.tq_info2?.c >= data.tq_info2.r) {
				vars.questCompleting = "tradeskill"
			} else if (data.pq_info2?.c >= data.pq_info2.r) {
				vars.questCompleting = "profession"
			}

			if (vars.questCompleting != null) {
				vars.actionsPending = true
				await delay(vars.buttonDelay)
				$("a.questCenter")[0].click()
				await eventListeners.waitFor("roa-ws:page:quests")
				finishQuest()
				return
			}
		}
		// Construction:
		if (settings.autoHouse) {
			switch (true) {
				case data.house_timers[0]?.next < 1800 && !vars.houseItemQueued:
					if (settings.verbose) log("House timer less than 30 minutes, queuing another item")
					vars.houseItemQueued = true
					setTimeout( () => vars.houseItemQueued = false, 30*60*1000)
					// Fall through
				case data.can_build_house:
					vars.actionsPending = true
					$("li#housing").click()
					await eventListeners.waitFor("roa-ws:page:house")
					selectBuild()
					return
			}
		}
		// Harvestron:
		if (settings.autoHarvestron && data.can_house_harvest) {
			vars.actionsPending = true
			$("#harvestronNotifier")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_room_item")
			startHarvestron()
			return
		}
	}

	/**
	 * Auto Gauntlet was originally based on {@link https://github.com/dragonminja24/betaburCheats/blob/master/betaburCheatsHeavyWeight.js|BetaburCheats}
	 * @author {@link https://github.com/dragonminja24|dragonminja24}
	 * @name "Auto Gauntlet Credits"
	 * @memberof beta-game
	 */

	/**
	 * Enum for the gauntlet buttons
	 * @const BUTTONS
	 * @enum {HTMLElement}
	 * @memberof beta-game
	 */
	const BUTTONS = {
		battle      : $(".bossFight.btn.btn-primary")[0],
		fishing     : $(".bossHarvest.btn")[4],
		woodcutting : $(".bossHarvest.btn")[5],
		mining      : $(".bossHarvest.btn")[6],
		stonecutting: $(".bossHarvest.btn")[7],
		crafting    : $(".bossCraft.btn")[0],
		carving     : $(".bossCarve.btn")[0],
	}

	/**
	 * - Gets the Trade Skill of a user
	 * - If the user's Trade Skill is not found, returns `"mining"`
	 * @function getTrade
	 * @param {string} username Username to search
	 * @returns {string} Name of the Trade Skill
	 * @memberof beta-game
	 */
	function getTrade(username) {
		for (const trade of Object.keys(settings.tradesList)) {
			if (settings.tradesList[trade].includes(username.toLowerCase())) {
				return trade
			}
		}
		return "mining"
	}

	/**
	 * Attacks in gauntlets when the criteria are met
	 * @function changeTrade
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game
	 */
	function changeTrade(_, data) {
		data = data.results
		if (data.carvingTier > 2500 && !vars.mainEvent) {
			if (settings.verbose) log("Attacking gauntlet boss (carving tier)")
			BUTTONS.battle.click()
		} else if (data.time_remaining < settings.attackAt * 60) {
			if (!vars.isAlt || (vars.isAlt && !vars.mainEvent)) {
				if (settings.verbose) log("Attacking gauntlet boss (time)")
				BUTTONS.battle.click()
			}
		} else { // Don't execute the rest of the function
			return
		}
		finishGauntlet()
	}

	/**
	 * Joins the gauntlet if the criteria are met
	 * @async
	 * @function joinGauntlet
	 * @param {string} msgContent Contents of the chat message
	 * @param {string} msgID ID of the chat message
	 * @memberof beta-game
	 */
	async function joinGauntlet(msgContent, msgID) {
		if (vars.gauntletID === msgID || vars.gauntletInProgress || !["InitEvent", "MainEvent"].includes(msgContent)) return

		vars.gauntletID = msgID
		vars.mainEvent = msgContent === "MainEvent"
		vars.gauntletInProgress = true

		if (settings.verbose) log(`Joining ${vars.mainEvent ? "main" : "regular"} gauntlet due to message #${msgID}`)
		BUTTONS[vars.mainTrade].click()
		eventListeners.toggle("roa-ws:event_action", changeTrade, true)

		// If we are still tracking the same gauntlet after 16 minutes, stop tracking it:
		await delay(16*60*1000)
		if (vars.gauntletID === msgID) finishGauntlet()
	}

	/**
	 * Checks chat message and listens to gauntlet commands
	 * @async
	 * @function checkGauntletMessage
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game
	 */
	async function checkGauntletMessage(_, data) {
		if (data.c_id === settings.eventChannelID) {
			await delay(vars.startActionsDelay)
			/* Wait to see if the message is received together with a message of the day,
			   which means it was only sent due to a chat reconnection, and we should not join the gauntlet. */
			if (!vars.motdReceived) {
				joinGauntlet(data.m, data.m_id)
			}
		}
	}

	/**
	 * Sets vars.motdReceived to true for a short time after receiving a message of the day
	 * @async
	 * @function motd
	 * @memberof beta-game
	 */
	async function motd() {
		vars.motdReceived = true
		await delay(vars.startActionsDelay * 5)
		vars.motdReceived = false
	}

	/**
	 * Resets gauntlet trackers
	 * @function finishGauntlet
	 * @memberof beta-game
	 */
	function finishGauntlet() {
		vars.mainEvent = false
		vars.gauntletInProgress = false
		eventListeners.toggle("roa-ws:event_action", changeTrade, false)
	}

	/**
	 * @async
	 * @function toggleInterfaceChanges
	 * @param {boolean} refresh Should be true when called by refreshSettings and false otherwise
	 * @memberof beta-game
	 */
	async function toggleInterfaceChanges(refresh) {
		// Add an empty div after the username:
		if(!refresh) $("#username").after(`<div id="betabot-next-to-name"></div>`)

		// Button next to name:
		{
			if (settings.buttonNextToName === "request" && !$("#betabot-request-currency")[0]) {
				$("betabot-next-to-name").empty()
				$("#betabot-next-to-name").append(`<button id="betabot-request-currency"><a>Request Currency</a></button>`)
				$("#betabot-request-currency").click(() => port.postMessage({text: "requesting currency"}) )
			} else if (settings.buttonNextToName === "spread" && !$("#betabot-spread-button")[0]) {
				$("betabot-next-to-name").empty()
				$("#betabot-next-to-name").append(`<button id="betabot-spread-button"><a>Spread Currency</a></button>`)
				$("#betabot-spread-button").click(() => port.postMessage({text: "requesting a list of active alts"}) )
			} else if (!settings.buttonNextToName) {
				$("betabot-next-to-name").empty()
			}
		}

		// Make it easier to see what alt it is:
		if (settings.addUsername) {
			appendName()
			keepUsernameVisible.observe($("#roomName")[0], {attributes: true, childList: true, subtree: true})
		} else {
			keepUsernameVisible.disconnect()
			$("#betabot-clear-username")?.remove()
		}

		// Custom style:
		const cssChanged = `data:text/css;base64,${btoa(settings.css.addon + settings.css.custom.code)}` !== $("#betabot-css")?.prop("href")
		if (cssChanged) { // If the code has changed, or if it was never injected
			$("#betabot-css")?.remove() //only remove the element if it exists
			// Decode CSS into base64 and use it as a link to avoid script injections:
			$("head").append(`<link id="betabot-css" rel="stylesheet" href="data:text/css;base64,${btoa(settings.css.addon + settings.css.custom.code)}">`)
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
			// Don't activate immediately on page load:
			if (refresh) {
				getCustomBuild()
			} else {
				eventListeners.waitFor("roa-ws:motd").then(() => { // Wait for the page to load
					getCustomBuild()
				})
			}
		} else if (!settings.addCustomBuild && $("#betabot-custom-build")[0]) {
			$("#betabot-custom-build").remove()
		}

		// Auto Gauntlets:
		if (refresh) { // Don't activate immediately on page load
			eventListeners.toggle("roa-ws:message", checkGauntletMessage, settings.joinGauntlets)
		} else {
			eventListeners.waitFor("roa-ws:motd").then(() => { // Start after a delay to avoid being triggered by old messages
				eventListeners.toggle("roa-ws:message", checkGauntletMessage, settings.joinGauntlets)
			})
		}

		// Auto Craft:
		eventListeners.toggle("roa-ws:craft roa-ws:notification", checkCraftingQueue, settings.autoCraft)
		// Auto Carve:
		eventListeners.toggle("roa-ws:carve roa-ws:notification", checkCarvingQueue, settings.autoCarve)
		// Auto Stamina/Quests/House/Harvestron:
		eventListeners.toggle("roa-ws:battle roa-ws:harvest roa-ws:carve roa-ws:craft roa-ws:event_action",
			checkResults, settings.autoStamina || settings.autoQuests || settings.autoHouse || settings.autoHarvestron)
		// Socket Gem x5:
		eventListeners.toggle(
			"roa-ws:page:" +
			["item_options", "gem_unsocket_from_item", "gem_unsocket_all_from_item", "gem_socket_to_item", "item_rename", "item_own"]
				.join(" roa-ws:page:"),
			addSocket5Button, settings.addSocketX5)

		// Spawn Gems For All Alts:
		eventListeners.toggle("roa-ws:modalContent", addAltsSpawn, vars.isAlt && settings.addSpawnGems)

		// Jump mobs:
		if (vars.isAlt && settings.addJumpMobs && !$("#betabot-mob-jump")[0]) {
			$("#autoEnemy").after(`
			<div class="mt10" id="betabot-mob-jump" style="display: block;">
				<input id="betabot-mob-jump-number" type="number" size=1>
				<input id="betabot-mob-jump-button" type="button" value="Jump Mobs">
			</div>`)

			$("#betabot-mob-jump-button").click(() => {
				const number = parseInt($("#enemyList>option:selected").val()) + parseInt($("#betabot-mob-jump-number").val())
				const maxNumber = parseInt($(`#enemyList>option:last-child`).val())
				if (number > maxNumber) {
					$("#areaName").text("The mob you chose is not in the list!")
					return
				}
				port.postMessage({text: "move to mob", number: number})
				if (settings.verbose) log(`Requested to move all alts ${number} mobs up`)
			})
		} else if ((!settings.addJumpMobs || !vars.isAlt) && $("#betabot-mob-jump")[0]) {
			$("#betabot-mob-jump").remove()
		}
	}
	toggleInterfaceChanges(false)
}

betaGame()
