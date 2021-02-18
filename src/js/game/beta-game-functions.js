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
/* eslint-disable no-use-before-define */ // Functions here will only run after all other functions and objects were initialized

/**
 * Stores variables and constants to avoid polluting the global space
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

	keepUsernameVisible: null,

	/**
	 * Returns `true` if the current user is an alt, and returns `false` otherwise
	 * @function username.isAlt
	 * @returns {boolean}
	 * @memberof beta-game-functions
	 */
	isAlt: () => username.name !== settings.mainUsername,

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
username.keepUsernameVisible = new MutationObserver(username.appendName)

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
		// Hide the interface for the duration of this function:

		$("#housing").click()
		await eventListeners.waitFor("roa-ws:page:house")

		// Only run if the user has bought a house (needed in case the user's level >= 10):
		if ($("#allHouseUpgrades")[0]) {
			$("#allHouseUpgrades")[0].click()

			const {data: {q_b}} = await eventListeners.waitFor("roa-ws:page:house_all_builds")
			const items = []
			// Filter duplicates (https://stackoverflow.com/a/53543804):
			q_b.map(el1 => items.filter(el2 => el2.i === el1.i).length > 0 ? null : items.push(el1))

			// Create the dropdown list:
			if (!$("#betabot-custom-build")[0]) {
				let select = `<div id="betabot-custom-build" class="betabot">Build a specific item: <select id="betabot-select-build" class="betabot"><option value="" selected>None (Build Fastest)</option>`
				for (const item of items) select += `<option value="${item.i}">${item.n}</option>`
				$("#houseQuickBuildWrapper").append(select + "</select></div>")

				if (settings.verbose) log("Added Custom Build select menu")
			}
		}

		// Close house pages:
		$("#modal2Wrapper .closeModal").click()
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
			house.customBuild(itemId)
		} else if ($("#houseRoomCanBuild").is(":visible")) {
			house.buildRoom()
		} else if ($("#houseQuickBuildList li:first .houseViewRoom").length === 1) {
			house.buildItem()
		} else {
			house.upgradeItem()
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

		$("#allHouseUpgrades")[0].click()

		await eventListeners.waitFor("roa-ws:page:house_all_builds")
		await delay(vars.buttonDelay)
		$(`#modal2Content a[data-itemtype=${itemId}]`)[0].click()

		await eventListeners.waitFor("roa-ws:page:house_room_item")
		await delay(vars.buttonDelay)
		$("#houseRoomItemUpgradeLevel").click()

		await eventListeners.waitFor("roa-ws:page:house_room_item_upgrade_level")
		completeTask()
	},

	/**
	 * Builds a new room
	 * @async
	 * @function house.buildRoom
	 * @memberof beta-game-functions
	 */
	async buildRoom() {
		if (settings.verbose) log("Building a new room")

		$("#houseBuildRoom")[0].click()

		await eventListeners.waitFor("roa-ws:page:house_build_room")
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

		$("#houseQuickBuildList li:first .houseViewRoom")[0].click()

		await eventListeners.waitFor("roa-ws:page:house_room")
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
		$("#houseQuickBuildList li:first .houseViewRoomItem")[0].click()

		await eventListeners.waitFor("roa-ws:page:house_room_item")
		await delay(vars.startActionsDelay)

		// If tier upgrade is available, upgrade it. Else, do a regular upgrade:
		if ($("#houseRoomItemUpgradeTier").is(":visible")) {
			if (settings.verbose) log("Upgrading item tier")
			$("#houseRoomItemUpgradeTier").click()
		} else {
			if (settings.verbose) log("Upgrading fastest item")
			$("#houseRoomItemUpgradeLevel").click()
		}

		completeTask()

		// If we somehow tried to queue an item when there are more than 30 minutes left, cancel the queue (`s` stands for success):
		const {data: {s}} = await eventListeners.waitFor("roa-ws:page:house_room_item_upgrade_tier roa-ws:page:house_room_item_upgrade_level")
		if (s === 0) {
			// Click "No" after the confirmation window shows up:
			setTimeout(() => {
				$(".button.red").click()
			}, 100)
		}
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
		gauntlet.gauntVars.motdReceived = true
		await delay(5000)
		gauntlet.gauntVars.motdReceived = false
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
			if (!gauntlet.gauntVars.motdReceived) {
				if (gauntlet.gauntVars.gauntletID !== data.m_id || !gauntlet.gauntVars.gauntletInProgress ||
					["InitEvent", "MainEvent"].includes(data.m)) {
					gauntlet.joinGauntlet(data.m, data.m_id)
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
		gauntlet.gauntVars.gauntletID = msgID
		gauntlet.gauntVars.mainGauntlet = msgContent === "MainEvent"
		gauntlet.gauntVars.gauntletInProgress = true

		if (settings.verbose) log(`Joining ${gauntlet.gauntVars.mainGauntlet ? "main" : "regular"} gauntlet due to message #${msgID}`)
		gauntlet.BUTTONS[gauntlet.getTrade].click()
		eventListeners.toggle("roa-ws:event_action", gauntlet.changeTrade, true)

		// If we are still tracking the same gauntlet after 16 minutes, stop tracking it:
		await delay(16*60000)
		if (gauntlet.gauntVars.gauntletID === msgID) gauntlet.finishGauntlet()
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
		if (data.carvingTier > 2500 && !gauntlet.gauntVars.mainGauntlet) {
			if (settings.verbose) log("Attacking gauntlet boss (carving tier)")
			gauntlet.BUTTONS.battle.click()
		} else if (data.time_remaining < settings.attackAt * 60) {
			if (!username.isAlt() || !gauntlet.gauntVars.mainGauntlet) {
				if (settings.verbose) log("Attacking gauntlet boss (time)")
				gauntlet.BUTTONS.battle.click()
			}
		} else { // Don't execute the rest of the function
			return
		}
		gauntlet.finishGauntlet()
	},

	/**
	 * Resets gauntlet trackers
	 * @function gauntlet.finishGauntlet
	 * @memberof beta-game-functions
	 */
	finishGauntlet() {
		gauntlet.gauntVars.mainGauntlet = false
		gauntlet.gauntVars.gauntletInProgress = false
		eventListeners.toggle("roa-ws:event_action", gauntlet.changeTrade, false)
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
		await delay(60000)
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
			$("#betabot-socket-5").click(gems.socketGems)
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
 * @property {number} autoWireLastTimestamp
 * @property {function} wire Sends currency to another user
 * @property {function} spreadCurrency Spreads currency among other users
 * @memberof beta-game-functions
 */
const wiring = {
	autoWireLastTimestamp: Date.now(),

	/**
	 * Sends currency to another user (according to the Currency Send settings)
	 * @function wiring.wire
	 * @param {string} [target] Wire recipient. If omitted, defaults to `settings.mainUsername`
	 * @memberof beta-game-functions
	 */
	wire(target) {
		// If this is an automatic wire:
		if (settings.wireFrequency > 0 && !target) {
			// Make sure enough time has passed since last run:
			const wiringInterval = settings.wireFrequency*60000
			// Subtract one second from wiringInterval, to allow slight mistimings:
			if (Date.now() - wiring.autoWireLastTimestamp < wiringInterval - 1000) {
				//log(`Automatic wiring occurred before time. Stopping now`)
				return
			}

			// Update last run timestamp:
			wiring.autoWireLastTimestamp = Date.now()
			// Set `target` to main username:
			target = settings.mainUsername

			// Call `wire` again, but only if `settings.wireFrequency` is not 0:
			if (wiringInterval) setTimeout(wiring.wire, wiringInterval)
		}

		// Don't allow wiring to oneself:
		if (target === username.name) return

		if (settings.verbose) log(`Wiring ${target}`)

		let sendMessage = `/wire ${target}`

		for (const [name, sendSettings] of Object.entries(settings.currencySend)) {
			if (!sendSettings.sendRequest) continue

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
			if (!sendSettings.sendSpread) continue

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
			setTimeout(() => {
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
		/* eslint-disable-next-line eqeqeq */ // `data.month` can be either a `Number` or a `String` containing a number, so can't use strict equality here:
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

		// If auto Craft/Carve is off, return:
		if (settings[`auto${capitalize(data.type)}`] === false) return

		const expr = /You completed your (crafting|carving) queue and began (Battling|Fishing|Woodcutting|Mining|Stonecutting) automatically./
		if ((["carve", "craft"].includes(data.type) && data.results.a.cq < settings.minQueue) ||
			data.type === "notification" && settings.resumeQueue && expr.test(data.m)) {
			if (settings.verbose) log("Refilling queue")
			professionQueues.fillQueue(data.type)
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
 * Automation related functions and variables (excluding housing and crafting/carving)
 * @const betabot
 * @property {boolean} staminaCooldown Tracks recent stamina replenishes
 * @property {boolean} questCooldown Tracks recent quest cancels
 * @property {boolean} harvestronCooldown Tracks recent harvestron job cancels
 * @property {function} questOrHarvestronCancelled Stops tracking quests/harvestron for 60 seconds after manual cancel
 * @property {function} finishQuest Finishes a quest and start a new one
 * @property {function} startQuest Starts a new quest
 * @property {function} startHarvestron Starts a new Harvestron Job
 * @property {function} buyCrys Buys crystals for gold from the crystal shop
 * @property {function} checkResults Checks action results
 * @memberof beta-game-functions
 */
const betabot = {
	staminaCooldown: false,
	questCooldown: false,
	harvestronCooldown: false,

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
			key = "questCooldown"
		} else if (type === "house_harvest_job_cancel") {
			if (settings.verbose) log("Harvestron job cancelled. Waiting 60 seconds before checking the Harvestron again")
			key = "harvestronCooldown"
		}

		betabot[key] = true
		await delay(60000)
		betabot[key] = false
	},

	/**
	 * Finishes a quest
	 * @async
	 * @function betabot.finishQuest
	 * @param {string} type Quest type
	 * @memberof beta-game-functions
	 */
	async finishQuest(type) {
		vars.actionsPending = true

		await delay(vars.startActionsDelay)
		$("a.questCenter")[0].click()

		// Complete the quest:
		await eventListeners.waitFor("roa-ws:page:quests")
		await delay(vars.buttonDelay)
		if (settings.verbose) log(`Completing a ${type} quest`)
		$(`input.completeQuest[data-questtype=${type}]`).click()
		await eventListeners.waitFor("roa-ws:page:quest_complete")

		// If auto climbing is on, don't start a new battle quest:
		if (settings.autoClimb.climb && type === "kill") {
			vars.actionsPending = false
			await eventListeners.waitFor("roa-ws:page:quests")
			$(".closeModal").click()
		} else {
			betabot.startQuest(type)
		}
	},

	/**
	 * Start a new quest
	 * @async
	 * @function betabot.startQuest
	 * @param {string} type Quest type
	 * @memberof beta-game-functions
	 */
	async startQuest(type) {
		$("a.questCenter")[0].click()
		await eventListeners.waitFor("roa-ws:page:quests")
		await delay(vars.buttonDelay)

		if (settings.verbose) log(`Starting a ${type} quest`)
		$(`.questRequest[data-questtype=${type}]`).click()
		await eventListeners.waitFor("roa-ws:page:quest_request")

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
		setTimeout(betabot.buyCrys, 1000*60*60*24)

		if (settings.dailyCrystals === 0) return

		vars.actionsPending = true
		await delay(vars.startActionsDelay)

		$("#premiumShop").click()

		await eventListeners.waitFor("roa-ws:page:boosts")

		// Don't buy the whole amount if some crystals have already been bought:
		let leftToBuy = settings.dailyCrystals - parseInt($("#premium_purchased_today").text())

		/*
		   Before purchasing crystals, make sure that there is enough gold for
		   the purchase. If there isn't, buy as many crystals as possible.
		   Original sum equation can be found on `options-page.js` under `updateCrystalsPrice()`.
		*/
		const max = s => (-1500000 + Math.sqrt(1500000**2 -4 * 500000 *-s)) / 1000000
		const gold = parseInt($(`.mygold`).attr("title").replace(/,/g, ""))
		const maxCrystals = Math.floor(max(gold))
		leftToBuy = Math.min(leftToBuy, maxCrystals)

		// Don't purchase if there is nothing to purchase
		if (leftToBuy > 0) {
			await delay(vars.buttonDelay)
			$("#goldCrystalButton").click()

			await delay(vars.buttonDelay)
			$("#premium_purchase_gold_count").val(leftToBuy)
			$("#premium_purchase_gold_button").click()
			if (settings.verbose) log(`Bought ${leftToBuy} daily crystals`)
		}
		await completeTask()
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
		if (settings.autoStamina && data.autos_remaining < settings.minStamina && !betabot.staminaCooldown) {
			$("#replenishStamina").click()
			betabot.staminaCooldown = true
			await delay(2500)
			betabot.staminaCooldown = false
			return
		}

		// Actions that should always be performed go before this line:
		if (vars.actionsPending) return

		// Quests:
		if (settings.autoQuests && !betabot.questCooldown) {
			let type = null
			if (data.bq_info2?.c >= data.bq_info2.r) {
				type = "kill"
			} else if (data.tq_info2?.c >= data.tq_info2.r) {
				type = "tradeskill"
			} else if (data.pq_info2?.c >= data.pq_info2.r) {
				type = "profession"
			}

			if (type) {
				betabot.finishQuest(type)
				return
			}
		}
		// Construction:
		if (settings.autoHouse) {
			switch (true) {
				case data?.house_timers[0]?.next < 1800 && !house.houseItemQueued:
					if (settings.verbose) log("House timer less than 30 minutes, queuing another item")
					// Fall through
				case data?.can_build_house:
					house.houseItemQueued = true
					// Falsify after 30 minutes, or after 1 minute if house is available:
					setTimeout(() => house.houseItemQueued = false, data?.can_build_house ? 1 : 30 * 60000)

					vars.actionsPending = true
					$("li#housing").click()
					await eventListeners.waitFor("roa-ws:page:house")
					house.selectBuild()
					return
			}
		}
		// Harvestron:
		if (settings.autoHarvestron && data.can_house_harvest && !betabot.harvestronCooldown) {
			vars.actionsPending = true
			$("#harvestronNotifier")[0].click()
			await eventListeners.waitFor("roa-ws:page:house_room_item")
			betabot.startHarvestron()
			return
		}
	},
}

/**
 * Mob climbing related functions and variables
 * @const mobClimbing
 * @property {boolean} climbing Tracks current climbing status
 * @property {function} getCurrentWinRate Returns an object containing winrate and number of actions tracked
 * @property {function} checkClimbing Checks to see if we should climb
 * @property {function} move Climbs/descends mobs
 * @property {function} travel Travels to another zone
 * @property {function} checkStability Checks to see if we should stop climbing
 * @property {function} finishClimbing Stops tracking winrate and starts a new quest
 * @memberof beta-game-functions
 */
const mobClimbing = {
	climbing: false,

	/**
	 * Returns an object containing the win rate (in percentages), and the number of actions tracked so far
	 * @function mobClimbing.getCurrentWinRate
	 * @returns {object}
	 * @returns {number} winRate
	 * @returns {number} numberOfActions
	 * @memberof beta-game-functions
	 */
	getCurrentWinRate() {
		const kills = parseFloat($("#gainsKills")[0].dataset.value)
		const deaths = parseFloat($("#gainsDeaths")[0].dataset.value)
		const numberOfActions = kills + deaths
		const result = {
			numberOfActions,
			winRate: Math.round((kills / (numberOfActions) * 100) * 100) / 100,
		}
		return result
	},

	/**
	 * Checks to see if we should climb mobs
	 * @function mobClimbing.checkClimbing
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 * @param {object} data.results.p
	 * @memberof beta-game-functions
	 */
	checkClimbing(_, {results: {p}}) {
		// Pseudo-code: If (quest active/cancelled by user, or in middle of climbing, or actions are pending), then return
		if (p.bq_info2?.a === 0 || betabot.questCooldown || mobClimbing.climbing || vars.actionsPending) return

		mobClimbing.checkStability()
	},

	/**
	 * Climbs/descends mobs
	 * @async
	 * @function mobClimbing.move
	 * @param {string} direction If `direction` is "up", climbs up. If `direction` is "down", descends down
	 * @memberof beta-game-functions
	 */
	async move(direction) {
		vars.actionsPending = true

		await delay(vars.startActionsDelay)
		$("#battleGrounds").click()

		await eventListeners.waitFor("roa-ws:page:town_battlegrounds")
		const currentMob = parseInt($(`#enemyList option:selected`).val())
		const minNumber = parseInt($(`#enemyList option:first-child`).val())
		const maxNumber = parseInt($(`#enemyList option:last-child`).val())
		const i = username.isAlt() ? settings.autoClimb.jumpAmountAlts : settings.autoClimb.jumpAmountMain
		const nextMob = direction === "up" ? currentMob + i : currentMob - i

		// If the next mob is not on the list:
		if (nextMob > maxNumber || nextMob < minNumber) {
			await mobClimbing.travel(direction === "up" ? 1 : -1)
			await delay(vars.buttonDelay)
			$("#battleGrounds").click()

			await eventListeners.waitFor("roa-ws:page:town_battlegrounds")
		}
		$(`#enemyList`).val(nextMob)

		await delay(vars.buttonDelay)
		$("#autoEnemy").click()
		$("#clearBattleStats")[0].click()

		if (direction === "up") {
			// Track stability:
			eventListeners.toggle("roa-ws:battle", mobClimbing.checkStability, true)
		} else {
			// Stop tracking stability (if we are tracking it) and start a new quest:
			await eventListeners.waitFor("roa-ws:battle")
			mobClimbing.finishClimbing()
		}

		vars.actionsPending = false
	},

	/**
	 * Travels to another zone
	 * @async
	 * @function mobClimbing.travel
	 * @param {number} amount Amount of zones to travel (as an offset from current zone). Can be either positive or negative
	 * @memberof beta-game-functions
	 */
	async travel(amount) {
		const gold = parseInt($(".right.mygold.gold").data("personal").replace(/,/g, ""))
		// If we don't have enough gold for travel, don't climb:
		if (gold < 100000000) {
			$("#loadBattle").click()
			mobClimbing.finishClimbing()
			return
		}

		$("#basePage").click()
		await eventListeners.waitFor("roa-ws:page:town")
		await delay(vars.buttonDelay)

		$("#loadTravel")[0].click()
		await eventListeners.waitFor("roa-ws:page:town_travel")
		await delay(vars.buttonDelay)

		const currentArea = parseInt($("#area_list option:selected").val())
		const nextArea = currentArea + amount

		$("#area_list option").eq(nextArea).attr("selected", "selected")
		$("#travel_confirm").click()

		await eventListeners.waitFor("roa-ws:page:travel")
	},

	/**
	 * checks to see if we should stop climbing
	 * @function mobClimbing.checkStability
	 * @memberof beta-game-functions
	 */
	checkStability() {
		// Allow the user to stop climbing manually:
		if (!settings.autoClimb.climb) {
			mobClimbing.finishClimbing()
		}

		const {winRate, numberOfActions} = mobClimbing.getCurrentWinRate()

		// If we are severely losing, climb down:
		if (numberOfActions > 5 && winRate < 75) {
			mobClimbing.move("down")
			return
		}

		if (numberOfActions < settings.autoClimb.minimumActions) return

		/* If we are winning more than the maximum, climb up.
		   If we are winning less than the minimum, climb down.
		   Else, finish climbing */

		let direction = ""
		if (winRate >= settings.autoClimb.maximumWinrate) {
			direction = "up"
		} else if (winRate < settings.autoClimb.minimumWinrate) {
			direction = "down"
		} else {
			if (settings.verbose) log("Staying on this mob and resetting statistics")
			$("#clearBattleStats")[0].click()
			mobClimbing.finishClimbing()
			return
		}

		mobClimbing.climbing = true
		if (settings.verbose) log(`Climbing ${direction}`)
		mobClimbing.move(direction)
	},

	/**
	 * Stops tracking winrate and starts a new quest
	 * @async
	 * @function mobClimbing.finishClimbing
	 * @memberof beta-game-functions
	 */
	async finishClimbing() {
		if (settings.verbose) log("Finished climbing mobs")
		eventListeners.toggle("roa-ws:battle", mobClimbing.checkStability, false)

		if (settings.autoQuests) {
			betabot.startQuest("kill")
		} else {
			vars.actionsPending = false
		}

		// Only try climbing again in one hour:
		if (!settings.autoQuests) await delay(60*60000)
		mobClimbing.climbing = false
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
