"use strict"

/**
 * @file Functions for beta-game.js
 */
/**
 * @namespace beta-game-functions
 */

/**
 * Auto Gauntlet was originally based on {@link https://github.com/dragonminja24/betaburCheats/blob/master/betaburCheatsHeavyWeight.js|BetaburCheats}
 * @author {@link https://github.com/dragonminja24|dragonminja24}
 * @name "Auto Gauntlet Credits"
 * @memberof beta-game-functions
 */
/**
 * Auto quests, house, craft, and stamina were originally based on a private distribution of @Batosi's bot
 * @author {@link https://github.com/Isotab|Isotab}
 * @name "Betabot Credits"
 * @memberof beta-game-functions
 */

/* eslint-disable no-unused-vars */ // Defined in this file, used in beta-game.js

/**
 * - Stores variables and constants to avoid polluting the global space
 * - Using a constructor to refer to `this.username` during initialization
 * @constant vars
 * @enum {any}
 * @memberof beta-game-functions
 */
const vars = {
	buttonDelay: 500,
	startActionsDelay: 1000,
	actionsPending: false,
}

/**
 * Contains the settings. Filled with values after the rest of the code is initialized.
 * @memberof beta-game-functions
 */
let settings = {}

/**
 * @typedef {helpers.runtimePort} runtimePort
 * @memberof beta-game-functions
 */

/**
 * Stores the connection to the background script
 * @type {runtimePort?}
 * @memberof beta-game-functions
 */
let port = null

/**
 * Username related functions and variables
 * @const username
 * @property {MutationObserver} keepUsernameVisible MutationObserver for appendName
 * @property {string} name Current username
 * @property {function} isAlt Return `true` if current user is an alt
 * @property {function} usernameChange Advises the user to update settings when changing name
 * @property {function} appendName Appends the username to the room name
 * @memberof beta-game-functions
 */
const username = {
	name: $("#username").text(),

	keepUsernameVisible: new MutationObserver(this.appendName),

	/**
	 * Returns `true` if the current user is an alt, and returns `false` otherwise
	 * @function username.isAlt
	 * @returns {boolean}
	 * @memberof beta-game-functions
	 */
	isAlt: () => username !== settings.mainUsername,

	/**
	 * Advises the user to update settings when changing name
	 * @function username.usernameChange
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game-functions
	 */
	usernameChange(_, data) {
		if (data.s === 0) return // Unsuccessful name change

		if (settings.verbose) log(`User has changed name from ${username.name} to ${data.u}`)
		$.alert(`It looks like you have changed your username from ${username.name} to ${data.u}.
			If you used the old username in BetaburLogin settings page, you might want to
			update these settings`, "Name Changed")
		username.name = data.u
	},

	/**
	 * Appends the username to the room name
	 * @function username.appendName
	 * @memberof beta-game-functions
	 */
	appendName() {
		if (!$("#betabot-clear-username")[0]) {
			$("#roomName").append(`<span id="betabot-clear-username" class="betabot">${username.name}</span>`)
		}
	},
}

/**
 * House related functions and variables
 * @const house
 * @property {boolean} houseItemQueued Wether or not a house item has been queued in the last 30 minutes
 * @property {function} addCustomBuild Adds the custom build menu
 * @property {function} selectBuild Selects the next item to build
 * @property {function} customBuild Upgrades an item based on the custom build list
 * @property {function} buildItem Builds a new item
 * @property {function} upgradeItem upgrades the fastest item
 * @memberof beta-game-functions
 */
const house = {
	houseItemQueued: false,

	/**
	 * Creates a drop down list in the house page, allowing the user to select a custom build instead of always building the fastest
	 * @async
	 * @function house.addCustomBuild
	 * @memberof beta-game-functions
	 */
	async addCustomBuild() {
		vars.actionsPending = true
		$("#modalBackground, #modal2Wrapper").prop("style", "display: none !important;") // Hide the interface for the duration of this process
		$("#housing").click()

		// Only run if the user has bought a house (needed in case the user's level >= 10):
		if ($("#allHouseUpgrades").is(":visible")) {
			$("#allHouseUpgrades")[0].click()

			const {data: {q_b}} = await eventListeners.waitFor("roa-ws:page:house_all_builds")
			const items = []
			q_b.map(el1 => items.filter(el2 => el2.i == el1.i).length > 0 ? null : items.push(el1)) // Filter duplicates - https://stackoverflow.com/a/53543804

			// Create the dropdown list:
			let select = `<div id="betabot-custom-build" class="betabot">Build a specific item: <select id="betabot-select-build" class="betabot"><option value="" selected>None (Build Fastest)</option>`
			for (const item of items) select += `<option value="${item.i}">${item.n}</option>`
			$("#houseQuickBuildWrapper").append(select + "</select></div>")

			if (settings.verbose) log("Added Custom Build select menu")
		}

		$("#modalBackground, #modal2Wrapper").prop("style", "") // Return to normal
		completeTask()
	},

	/**
	 * Selects the next item to build
	 * @async
	 * @function house.selectBuild
	 * @memberof beta-game-functions
	 */
	async selectBuild() {
		const itemId = parseInt($("#betabot-select-build").val())
		await delay(vars.startActionsDelay)

		/* If a custom build is specified, upgrade it. Else, if new room
			is available, build it. Else, if new item is available,
			build it. Else, upgrade existing item */
		if (!isNaN(itemId)) {
			$("#allHouseUpgrades")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_all_builds")
			this.customBuild(itemId)
		} else if ($("#houseRoomCanBuild").is(":visible")) {
			if (settings.verbose) log("Building a new room")
			$("#houseBuildRoom")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_build_room")
			completeTask()
		} else if ($("#houseQuickBuildList li:first .houseViewRoom").length === 1) {
			$("#houseQuickBuildList li:first .houseViewRoom")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_room")
			this.buildItem()
		} else {
			$("#houseQuickBuildList li:first .houseViewRoomItem")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_room_item")
			this.upgradeItem()
		}
	},

	/**
	 * Builds a custom item based on its ID
	 * @async
	 * @function house.customBuild
	 * @param {number} itemId ID of a house item
	 * @memberof beta-game-functions
	 */
	async customBuild(itemId) {
		if (settings.verbose) log(`Upgrading custom item with id ${itemId}`)
		await delay(vars.buttonDelay)
		$(`#modal2Content a[data-itemtype=${itemId}]`)[0].click()

		await eventListeners.waitFor("roa-ws:page:house_room_item")
		await delay(vars.buttonDelay)
		$("#houseRoomItemUpgradeLevel").click()

		await eventListeners.waitFor("roa-ws:page:house_room_item_upgrade_level")
		completeTask()
	},

	/**
	 * Builds a new item
	 * @async
	 * @function house.buildItem
	 * @memberof beta-game-functions
	 */
	async buildItem() {
		if (settings.verbose) log("Building a new item")

		await delay(vars.startActionsDelay)
		$("#houseBuildRoomItem").click()

		await eventListeners.waitFor("roa-ws:page:house_build_room_item")
		completeTask()
	},

	/**
	 * Upgrades an existing item tier or level
	 * @async
	 * @function house.upgradeItem
	 * @memberof beta-game-functions
	 */
	async upgradeItem() {
		await delay(vars.startActionsDelay)

		// If tier upgrade is available, upgrade it. Else, do a regular upgrade:
		if ($("#houseRoomItemUpgradeTier").is(":visible")) {
			if (settings.verbose) log("Upgrading item tier")
			$("#houseRoomItemUpgradeTier").click()
		} else {
			if (settings.verbose) log("Upgrading fastest item")
			$("#houseRoomItemUpgradeLevel").click()
		}

		await eventListeners.waitFor("roa-ws:page:house_room_item_upgrade_tier roa-ws:page:house_room_item_upgrade_level")
		completeTask()
	},
}

/**
 * - Gauntlet related functions and variables
 * - Auto Gauntlet was originally based on {@link https://github.com/dragonminja24/betaburCheats/blob/master/betaburCheatsHeavyWeight.js|BetaburCheats}
 * @author {@link https://github.com/dragonminja24|dragonminja24}
 * @const gauntlet
 * @property {object.<HTMLButtonElement>} BUTTONS Enum for the gauntlet buttons
 * @property {object.<boolean, number?>} gauntVars various variables
 * @property {function} motd Tracks motd messages
 * @property {function} getTrade Gets the main tradeskill of the current account
 * @property {function} checkGauntletMessage Listens to gauntlet commands
 * @property {function} joinGauntlet Joins current gauntlet
 * @property {function} changeTrade Attacks in gauntlets when the criteria are met
 * @property {function} finishGauntlet Exits current gauntlet
 * @memberof beta-game-functions
 */
const gauntlet = {
	BUTTONS: {
		battle      : $(".bossFight.btn.btn-primary")[0],
		fishing     : $(".bossHarvest.btn")[4],
		woodcutting : $(".bossHarvest.btn")[5],
		mining      : $(".bossHarvest.btn")[6],
		stonecutting: $(".bossHarvest.btn")[7],
		crafting    : $(".bossCraft.btn")[0],
		carving     : $(".bossCarve.btn")[0],
	},

	gauntVars: {
		gauntletID: null,
		gauntletInProgress: false,
		mainGauntlet: false,
		motdReceived: false,
	},

	/**
	 * Sets `motdReceived` to `true` for a short time after receiving a message of the day
	 * @async
	 * @function gauntlet.motd
	 * @memberof beta-game-functions
	 */
	async motd() {
		this.gauntVars.motdReceived = true
		await delay(5000)
		this.gauntVars.motdReceived = false
	},

	/**
	 * - Gets the Trade Skill of a user
	 * - If the user's Trade Skill is not found, returns `"mining"`
	 * @function gauntlet.getTrade
	 * @param {string} username Username to search
	 * @returns {string} Name of the Trade Skill
	 * @memberof beta-game-functions
	 */
	getTrade(username) {
		for (const trade of Object.keys(settings.tradesList)) {
			if (settings.tradesList[trade].includes(username.toLowerCase())) {
				return trade
			}
		}
		return "mining"
	},

	/**
	 * Checks chat message and listens to gauntlet commands
	 * @async
	 * @function gauntlet.checkGauntletMessage
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game-functions
	 */
	async checkGauntletMessage(_, data) {
		if (data.c_id === settings.eventChannelID) {
			/* Wait to see if the message is received together with a
				message of the day, which means it was only sent due to
				a chat reconnection, and we should not join the gauntlet */
			await delay(vars.startActionsDelay)
			if (!this.gauntVars.motdReceived) {
				if (this.gauntVars.gauntletID !== data.m_id || !this.gauntVars.gauntletInProgress ||
					["InitEvent", "MainEvent"].includes(data.m)) {
					this.joinGauntlet(data.m, data.m_id)
				}
			}
		}
	},

	/**
	 * Joins the gauntlet if the criteria are met
	 * @async
	 * @function gauntlet.joinGauntlet
	 * @param {string} msgContent Contents of the chat message
	 * @param {string} msgID ID of the chat message
	 * @memberof beta-game-functions
	 */
	async joinGauntlet(msgContent, msgID) {
		this.gauntVars.gauntletID = msgID
		this.gauntVars.mainGauntlet = msgContent === "MainEvent"
		this.gauntVars.gauntletInProgress = true

		if (settings.verbose) log(`Joining ${this.gauntVars.mainGauntlet ? "main" : "regular"} gauntlet due to message #${msgID}`)
		this.BUTTONS[this.getTrade].click()
		eventListeners.toggle("roa-ws:event_action", this.changeTrade, true)

		// If we are still tracking the same gauntlet after 16 minutes, stop tracking it:
		await delay(16*60*1000)
		if (this.gauntVars.gauntletID === msgID) this.finishGauntlet()
	},

	/**
	 * Attacks in gauntlets when the criteria are met
	 * @function gauntlet.changeTrade
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game-functions
	 */
	changeTrade(_, data) {
		data = data.results
		if (data.carvingTier > 2500 && !this.gauntVars.mainGauntlet) {
			if (settings.verbose) log("Attacking gauntlet boss (carving tier)")
			gauntlet.BUTTONS.battle.click()
		} else if (data.time_remaining < settings.attackAt * 60) {
			if (!username.isAlt() || !this.gauntVars.mainGauntlet) {
				if (settings.verbose) log("Attacking gauntlet boss (time)")
				gauntlet.BUTTONS.battle.click()
			}
		} else { // Don't execute the rest of the function
			return
		}
		this.finishGauntlet()
	},

	/**
	 * Resets gauntlet trackers
	 * @function gauntlet.finishGauntlet
	 * @memberof beta-game-functions
	 */
	finishGauntlet() {
		this.gauntVars.mainGauntlet = false
		this.gauntVars.gauntletInProgress = false
		eventListeners.toggle("roa-ws:event_action", this.changeTrade, false)
	},
}

/**
 * Gems related functions
 * @const gems
 * @property {function} addAltsSpawn Adds a "Spawn For All Alts" button
 * @property {function} spawnGems Spawns gems
 * @property {function} addSocket5Button Adds a "Socket Gem x5" button
 * @property {function} socketGems Sockets gems
 * @memberof beta-game-functions
 */
const gems = {
	/**
	 * Creates a "Spawn For All Alts" button on the Spawn Gems interface
	 * @function gems.addAltsSpawn
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game-functions
	 */
	addAltsSpawn(_, data) {
		if (data.title === "Spawn Gems") {
			$("#gemSpawnConfirm").after(`<input id="betabot-spawn-gem" class="betabot" type="button" style="padding:6.5px; margin: 0 -.5em 0 .5em;" value="Spawn For All Alts">`)

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
	},

	/**
	 * Spawns gems
	 * @async
	 * @function gems.spawnGems
	 * @param {number} type ID of a gem type for the main gem
	 * @param {number} splice ID of a gem type for the spliced gem
	 * @param {number} tier
	 * @param {number} amount
	 * @memberof beta-game-functions
	 */
	async spawnGems(tier, type, splice, amount) {
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
	},

	/**
	 * Adds a "Socket Gem x5" button to the Item Options interface
	 * @function gems.addSocket5Button
	 * @memberof beta-game-functions
	 */
	addSocket5Button() {
		if (!$("#betabot-socket-5")[0]) {
			$("#socketThisGem").after(`<button id="betabot-socket-5" class="betabot">Socket Gem x5</button>`)
			$("#betabot-socket-5").click(this.socketGems)
		}
	},

	/**
	 * Sockets gems into an item
	 * @async
	 * @function gems.socketGems
	 * @memberof beta-game-functions
	 */
	async socketGems() {
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
			await delay(vars.startActionsDelay)
		}

		vars.actionsPending = false
		if (settings.verbose) log("Finished socketing gems")
	},
}

/**
 * Wiring related functions and variables
 * @const wiring
 * @property {number?} autoWireID
 * @property {function} wire Sends currency to another user
 * @property {function} spreadCurrency Spreads currency among other users
 * @memberof beta-game-functions
 */
const wiring = {
	autoWireID: null,

	/**
	 * - Sends currency to another user (according to the user's currency send settings)
	 * @function wiring.wire
	 * @param {string} target Wire recipient
	 * @memberof beta-game-functions
	 */
	wire(target) {
		if (target === username.name) return
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
	},

	/**
	 * Spreads all currencies evenly across all alts (according to the user's currency send settings)
	 * @function wiring.spreadCurrency
	 * @param {string[]} alts Alt names to spread the currency across (e.g. `["altI", "altII"]`)
	 * @memberof beta-game-functions
	 */
	spreadCurrency(alts) {
		// Don't spread to yourself:
		alts = alts.filter(name => name !== username.name).sort()

		if (settings.verbose) log(`Spreading currencies among ${alts.length} other users`)
		let sendMessage = ""

		// Calculate the amounts:
		for (const [currencyName, sendSettings] of Object.entries(settings.currencySend)) {
			if (!sendSettings.send) continue

			const totalAmount = $(`.${currencyName}`).attr("title").replace(/,/g, "")
			const marketable = $(`.${currencyName}`).attr("data-personal").replace(/,/g, "")

			// Keep the specified amount to yourself:
			let amountToSend = totalAmount - sendSettings.keepAmount
			// Only send what you can:
			if (amountToSend > marketable) amountToSend = marketable
			// Divide what you can send by the amount of alts:
			amountToSend = Math.floor(amountToSend / alts.length)
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
	},
}

/**
 * Calendar related functions
 * @const calendar
 * @property {function} addAdventCalendar
 * @property {function} receiveAdventCalendar
 * @memberof beta-game-functions
 */
const calendar = {
	/**
	 * Adds a button to open the advent calendar on all alts at once
	 * @function calendar.addAdventCalendar
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game-functions
	 */
	addAdventCalendar (_, data) {
		// `data.month` can be either a `Number` or a `String` representing a `Number`, so can't use strict equality here:
		if (data.month == 11 && !$("#betabot-collect-advent")[0]) {
			$("#eventCalendarWrapper .mt10.center").append(` <button id="betabot-collect-advent" class="betabot"><a>Receive Your Prize</a></button>`)
			$("#betabot-collect-advent").click(() => port.postMessage({ text: "receive advent calendar awards" }))
		}
	},

	/**
	 * Gets the daily Advent Calendar reward in one click link
	 * @async
	 * @function calendar.receiveAdventCalendar
	 * @memberof beta-game-functions
	 */
	async receiveAdventCalendar() {
		if (settings.verbose) log("Collecting Advent Calendar reward")
		vars.actionsPending = true

		await delay(vars.startActionsDelay)
		$("#eventCalendarLink").click()

		await eventListeners.waitFor("roa-ws:page:event_calendar")
		$(".calendar-day.current-day a")[0].click()

		await eventListeners.waitFor("roa-ws:page:event_view")
		await delay(vars.buttonDelay)
		$(".advent_calendar_collect")[0].click()

		await eventListeners.waitFor("roa-ws:page:advent_calendar_collect")
		await delay(vars.buttonDelay)

		$(".closeModal.col-xs-12").click()
		completeTask()
	},
}

/**
 * Crafting and carving related functions
 * @const professionQueues
 * @property {function} checkQueue Checks the queue
 * @property {function} fillQueue Fills the queue
 * @memberof beta-game-functions
 */
const professionQueues = {
	/**
	 * Checks whether or not the queue should be filled
	 * @function professionQueues.checkQueue
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game-functions
	 */
	checkQueue(_, data) {
		if (vars.actionsPending) return

		const expr = /You completed your (crafting|carving) queue and began (Battling|Fishing|Woodcutting|Mining|Stonecutting) automatically./
		if ((["carve", "craft"].includes(data.type) && data.results.a.cq < settings.minQueue) ||
			data.type === "notification" && settings.resumeQueue && expr.test(data.m)) {
			if (settings.verbose) log("Refilling queue")
			this.fillQueue(data.type)
		}
	},

	/**
	 * Fills the queue
	 * @async
	 * @function professionQueues.fillQueue
	 * @param {"craft"|"carve"} type Type of queue
	 * @memberof beta-game-functions
	 */
	async fillQueue(type) {
		vars.actionsPending = true

		await delay(vars.startActionsDelay)
		type === "craft" ? $(".craftingTableLink")[0].click() : $(".carvingBenchLink")[0].click()
		// $(".craftingTableLink")[0].dispatchEvent(new Event("click")) // For some weird reason, .click() does not work here ¯\_(ツ)_/¯

		await eventListeners.waitFor("roa-ws:page:house_room_item")
		await delay(vars.buttonDelay)
		if (type === "craft") {
			$("#craftingVetoUnselectAll").click()
			$("#craftingItemLevelMax").click()
			$("#craftingQuality").val(0)
			$("#craftingJobFillQueue").attr("checked", "true")
		} else {
			$("#carvingItemLevel option:last").attr("selected", "selected")
			$("#carvingType").val(65535)
			$("#carvingJobCountMax").click()
		}

		await delay(vars.buttonDelay)
		$(`#${type.replace("e", "") + "ing"}JobStart`).click()

		await eventListeners.waitFor(`roa-ws:page:${type}_item`)
		completeTask()
	},
}

/**
 * Automation related functions and variables (excluding housing)
 * @const betabot
 * @memberof beta-game-functions
 */
const betabot = {
	questCompleting: null,
	staminaCooldown: false,
	/**
	 * Stops tracking Harvestron/Quests for 60 seconds after manually cancelling
	 * @async
	 * @function betabot.questOrHarvestronCancelled
	 * @param {event} event Event object
	 * @memberof beta-game-functions
	 */
	async questOrHarvestronCancelled(event) {
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
	},

	/**
	 * Finishes a quest and starts a new one
	 * @async
	 * @function betabot.finishQuest
	 * @memberof beta-game-functions
	 */
	async finishQuest() {
		await delay(vars.startActionsDelay)
		if (settings.verbose) log(`Completing a ${this.questCompleting} quest`)
		$(`input.completeQuest[data-questtype=${this.questCompleting}]`).click() // Complete the quest

		await eventListeners.waitFor("roa-ws:page:quests")
		await delay(vars.buttonDelay)
		if (settings.verbose) log(`Starting a ${this.questCompleting} quest`)
		$(`input.questRequest[data-questtype=${this.questCompleting}][value="Begin Quest"]`).click() // Start new quest

		await eventListeners.waitFor("roa-ws:page:quests")
		await delay(vars.buttonDelay)
		this.questCompleting = null
		completeTask()
	},

	/**
	 * Starts a new Harvestron job
	 * @async
	 * @function betabot.startHarvestron
	 * @memberof beta-game-functions
	 */
	async startHarvestron() {
		if (settings.verbose) log("Starting Harvestron job")
		$("#houseHarvestingJobStart").click()
		await eventListeners.waitFor("roa-ws:page:house_harvest_job")
		completeTask()
	},

	/**
	 * Buys daily crystals for gold
	 * @async
	 * @function betabot.buyCrys
	 * @memberof beta-game-functions
	 */
	async buyCrys() {
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
	},

	/**
	 * Checks action results for needed actions
	 * @async
	 * @function betabot.checkResults
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @memberof beta-game-functions
	 */
	async checkResults(_, data) {
		data = data.results.p

		// Stamina:
		if (settings.autoStamina && data.autos_remaining < settings.minStamina && !this.staminaCooldown) {
			if (settings.verbose) log("Replenishing stamina")
			$("#replenishStamina").click()
			this.staminaCooldown = true
			await delay(2500)
			this.staminaCooldown = false
			return
		}

		// Actions that should always be performed go before this line:
		if (vars.actionsPending) return

		// Quests:
		if (settings.autoQuests) {
			if (data.bq_info2?.c >= data.bq_info2.r) {
				this.questCompleting = "kill"
			} else if (data.tq_info2?.c >= data.tq_info2.r) {
				this.questCompleting = "tradeskill"
			} else if (data.pq_info2?.c >= data.pq_info2.r) {
				this.questCompleting = "profession"
			}

			if (this.questCompleting != null) {
				vars.actionsPending = true
				await delay(vars.buttonDelay)
				$("a.questCenter")[0].click()
				await eventListeners.waitFor("roa-ws:page:quests")
				this.finishQuest()
				return
			}
		}
		// Construction:
		if (settings.autoHouse) {
			switch (true) {
				case data?.house_timers[0]?.next < 1800 && !house.houseItemQueued:
					if (settings.verbose) log("House timer less than 30 minutes, queuing another item")
					house.houseItemQueued = true
					setTimeout( () => house.houseItemQueued = false, 30*60*1000)
					// Fall through
				case data?.can_build_house:
					vars.actionsPending = true
					$("li#housing").click()
					await eventListeners.waitFor("roa-ws:page:house")
					house.selectBuild()
					return
			}
		}
		// Harvestron:
		if (settings.autoHarvestron && data.can_house_harvest) {
			vars.actionsPending = true
			$("#harvestronNotifier")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_room_item")
			this.startHarvestron()
			return
		}
	},
}

/**
 * Closes the banner
 * @function closeBanner
 * @memberof beta-game-functions
 */
function closeBanner() {
	if (!$("#close_general_notification")[0]) return // Don't run if the banner is already closed
	$("#close_general_notification")[0].click()
	if (settings.verbose) log("Banner closed")
}

/**
 * Closes the modal and sets `vars.actionsPending` to false
 * @async
 * @function completeTask
 * @memberof beta-game-functions
 */
async function completeTask() {
	await delay(vars.startActionsDelay)
	vars.actionsPending = false
	$(".closeModal").click()
}

/**
 * Jumps to a mob with a given ID
 * @async
 * @function jumpMobs
 * @param {number} number Mob ID
 * @memberof beta-game-functions
 */
async function jumpMobs(number) {
	if (settings.verbose) log(`Jumping to mob number ${number}`)
	await delay(vars.startActionsDelay)
	$("#battleGrounds").click()

	await eventListeners.waitFor("roa-ws:page:town_battlegrounds")
	$(`#enemyList > option[value|=${number}]`).attr("selected", "selected")
	await delay(vars.buttonDelay)
	$("#autoEnemy").click()
}