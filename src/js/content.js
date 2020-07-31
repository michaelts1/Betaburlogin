/* ~~~ To Do ~~~
 * Don't toggle checkEvent inside toggleInterfaceChanges() if we just loded the page (wait at least 30 seconds)
 * Allow multiple handlers for the same event
 *
 * ~~~ Needs Testing ~~~
 * Events
 * RoA-WS
 * Stamina
 * Custom build
 * Changing CSS
 * Auto Harvestron
 * Remove effects info
 * All interface settings
 * eventListeners.toggle()
 * questOrHarvestronCancelled()
 * Changing autoWire settings
 * Make mainUsername case insensitive
 * Use await delay instead of setTimeout
 * Start crafting again if stopped due to a disconnect
 * Turn on/off event listeners according to settings instead of checking the settings every time an event is triggered
 */

"use strict"

const href = window.location.href
let port = null
let vars = null

if (/www.avabur.com[/?expird=1]*$/.test(href)) {
	liveLogin()
} else if (/beta.avabur.com[/?expird=1]*$/.test(href)) {
	betaLogin()
} else if (/beta.avabur.com\/game/.test(href)) {
	betaGame()
}

function log(...msg) {
	console.log(`[${new Date().toLocaleString().replace(",", "")}] Betaburlogin:`, ...msg)
}

function delay(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
}

async function liveLogin() {
	vars = await browser.storage.sync.get(["verbose", "addOpenTabs"])

	if (vars.verbose) log("Starting up (Live Login)")

	if (vars.addOpenTabs) {
		port = browser.runtime.connect({name: "live"})
		$("#login_notification").html(`<button id="open-alt-tabs">Open Beta Tabs</button>`)
		$("#open-alt-tabs").click(() => {
			port.postMessage({text: "open alt tabs"})
			if (vars.verbose) log("Requesting background script to open alt tabs")
		})
	}
}

async function betaLogin() {
	vars = await browser.storage.sync.get(["verbose", "addLoginAlts"])

	if (vars.verbose) log("Starting up (Beta Login)")

	async function login(username, password) {
		$("#acctname").val(username)
		$("#password").val(password)
		$("#login").click()
		if (vars.verbose) log(`Logging in with username ${username}`)
		await delay(7500)
		if ($("#login_notification").text() === "Your location is making too many requests too quickly.  Try again later.") {
			if (vars.verbose) log("Rate limited, trying again")
			login(username, password)
		}
	}

	if (vars.addLoginAlts) {
		port = browser.runtime.connect({name: "login"})
		port.onMessage.addListener(message => {
			if (vars.verbose) log(`Received message with text: ${message.text}`)
			if (message.text === "login") login(message.username, message.password)
		})

		$("#login_notification").html(`<button id="login-alts">Login All Alts</button>`)
		$("#login-alts").click(() => { port.postMessage({text: "requesting login"}) })
	}
}

async function betaGame() {
	const eventListeners = {
		/**
		 * Attaches/deattaches a handler to an event
		 * @param {string|string[]} eventName - Listen to events with this name(s)
		 * @param {function} handler - Handle the event with this handler
		 * @param {boolean} value - Turn the event handler on/off
		 * @param {*=} data - Data to be passed to the handler
		 * */
		toggle: function(eventName, handler, value, data) {
			if (typeof eventName !== "string") throw new TypeError(`Parameter eventName ${eventName} must be a string`)
			if (typeof handler !== "function") throw new TypeError(`Parameter handler ${handler} must be function`)
			if (typeof value !== "boolean") throw new TypeError(`Parameter value ${value} must be boolean`)

			if (this[eventName] === value) {
				console.warn(`Event handler ${handler} is already ${value ? "on" : "off"} for event ${eventName}`)
			}

			this[eventName] = value // Mark eventName as used

			const turnOn = value ? "on" : "off" // If value is truthy, $(document).on(...), if falsy, $(document).off(...)
			data === undefined ? $(document)[turnOn](eventName, data, handler) : $(document)[turnOn](eventName, handler) // If we have data, send it too
		},
	}
	vars = await browser.storage.sync.get()
	let username        = $("#username").text()
	let isAlt           = username !== vars.mainUsername.toLowerCase()
	let staminaCooldown = false
	let mainTrade       = getTrade()
	let autoWireID      = vars.autoWire ? setInterval(wire, vars.wireFrequency*60*1000, vars.mainUsername) : null
	toggleInterfaceChanges()

	if (vars.verbose) {
		log(`Starting up (Beta Game)\nUsername: ${username}\nAlt: ${isAlt ? "yes" : "no"}\nEvent TS: ${mainTrade}\nAuto Wire: ${autoWireID ? "on" : "off"}`)
	}

	async function refreshVars(changes) {
		if (vars.verbose) log("Refreshing settings")

		vars = await browser.storage.sync.get()
		isAlt = username !== vars.mainUsername.toLowerCase()
		mainTrade = getTrade()

		for (const wireRelated of ["wireFrequency", "mainUsername",]) { // If one of these has changed, reset autoWire
			if (changes[wireRelated].oldValue !== changes[wireRelated].newValue) {
				clearInterval(autoWireID)
				autoWireID = null
			}
		}

		// Turn on/off autoWire if needed
		if (autoWireID && !vars.autoWire) {
			clearInterval(autoWireID)
			autoWireID = null
		} else if (!autoWireID && vars.autoWire) {
			autoWireID = setInterval(wire, vars.wireFrequency*60*1000, vars.mainUsername)
		}

		toggleInterfaceChanges()

		if (vars.verbose) log(`Alt: ${isAlt ? "yes" : "no"}\nEvent TS: ${mainTrade}\nAuto Wire: ${autoWireID ? "on" : "off"}`)
	}
	browser.storage.onChanged.addListener(refreshVars)

	// Event listeners that are not going to be turned off right now (might change in the future) are below
	// Event listeneres that will be turned on/off as needed are inside toggleInterfaceChanges()

	// Toggle motdReceived on for a shor time after receiving motd message
	eventListeners.toggle("roa-ws:motd", motd, true)
	// Advice the user to update the options page after a name change:
	eventListeners.toggle("roa-ws:page:username_change", usernameChange, true)
	// Don't start new quests/harvestron jobs for 60 seconds after manually cancelling one:
	eventListeners.toggle("roa-ws:page:quest_forfeit", questOrHarvestronCancelled, true, "autoQuest")
	eventListeners.toggle("roa-ws:page:house_harvest_job_cancel", questOrHarvestronCancelled, true, "autoHouse")

	setTimeout(() => {
		eventListeners.toggle("roa-ws:message", checkEvent, vars.joinEvents)
	}, 30*1000) // Auto Event. Start after a delay to avoid being triggered by old messages

	// Connect to background script:
	port = browser.runtime.connect({name: username})
	port.onMessage.addListener(message => {
		if (vars.verbose) log("Received message:", message)

		if (message.text === "send currency") wire(message.recipient)
		if (message.text === "jump mobs") jumpMobs(message.number)
		if (message.text === "spawn gems") spawnGems(message.tier, message.type, message.splice, message.amount)
	})

	function toggleInterfaceChanges() {
		// Request Currency Button:
		if (vars.addRequestMoney && $("#betabot-request-currency")[0] === undefined) {
			$("#username").after(`<button id="betabot-request-currency"><a>Request Currency</a></button>`)
			$("#betabot-request-currency").click(() => { port.postMessage({text: "requesting currency"}) })
		} else if (vars.addRequestMoney === false && $("#betabot-request-currency")[0] !== undefined) {
			$("#betabot-request-currency").remove()
		}

		// Make it easier to see what alt it is:
		if (vars.addUsername) {
			appendName()
			keepUsernameVisible.observe($("#roomName")[0], {attributes: true, childList: true, subtree: true})
		} else {
			keepUsernameVisible.disconnect()
			$("#betabot-clear-username")?.remove()
		}

		// Option to build a specific item:
		if (vars.addCustomBuild && $("#betabot-custom-build")[0] === undefined) {
			getCustomBuild()
		} else if (vars.addCustomBuild === false && $("#betabot-custom-build")[0] !== undefined) {
			$("#betabot-custom-build").remove()
		}

		if (!isAlt) return // Only run the rest on alts

		// Jump mobs:
		if (vars.addJumpMobs && $("#betabot-mob-jump")[0] === undefined) {
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
				if (vars.verbose) log(`Requested to move all alts ${number} mobs up`)
			})
		} else if (vars.addJumpMobs === false && $("#betabot-mob-jump")[0] !== undefined) {
			$("#betabot-mob-jump").remove()
		}

		// Custom style:
		const cssChanged = `data:text/css;base64,${btoa(vars.css.addon + vars.css.custom)}` !== $("#betabot-css")?.prop("href")
		if (cssChanged) { // If the code has changed, or if it was never injected
			$("#betabot-css")?.remove() //only remove the element if it exists
			// Decode CSS into base64 and use it as a link to avoid script injections:
			$("head").append(`<link id="betabot-css" rel="stylesheet" href="data:text/css;base64,${btoa(vars.css.addon + vars.css.custom)}">`)
		}

		// Remove Effects Box:
		if (vars.removeEffects && $("#effectInfo")[0] !== undefined) {
			$("#effectInfo").remove()
		} else if (vars.removeEffects === false && $("#effectInfo")[0] === undefined) {
			$("#gauntletInfo").after(`
			<div id="effectInfo" style="display: block;">
				<div class="ui-element border2">
					<h5 class="toprounder center"><a id="effectUpgradeTable">Effects</a></h5>
					<div class="row" id="effectTable" style=""></div>
				</div>
			</div>`)
		}

		// Auto Events:
		eventListeners.toggle("roa-ws:message", checkEvent, vars.joinEvent)
		// Spawn Gems For All Alts:
		eventListeners.toggle("roa-ws:modalContent", addAltsSpawn, vars.addSpawnGems)
		// Auto Craft:
		eventListeners.toggle("roa-ws:craft roa-ws:notification", checkCraftingQueue, vars.autoCraft)
		// Auto Stamina/Quests/House/Harvestron
		eventListeners.toggle("roa-ws:battle roa-ws:harvest roa-ws:carve roa-ws:craft roa-ws:event_action", checkResults, vars.autoStamina || vars.autoQuests || vars.autoHouse)
	}

	function usernameChange(_, data) {
		if (data.s === 0) return // Unsuccessful name change

		log(`User has changed name from ${username} to ${data.u}`)
		$.alert(`It looks like you have changed your username from ${username} to ${data.u}.
			If you used the old username in BetaburLogin settings page, you might want to
			update these settings`, "Name Changed")
		username = data.u
	}

	function getCustomBuild() {
		vars.actionsPending = true
		$("#allHouseUpgrades").click()

		$(document).one("roa-ws:page:house_all_builds", (_, data) => {
			setTimeout(completeTask)

			const items = []
			data.q_b.map(el1 => items.filter(el2 => el2.i == el1.i).length > 0 ? null : items.push(el1)) // Filter duplicates - https://stackoverflow.com/a/53543804

			$("#houseQuickBuildWrapper").append(`<div id="betabot-custom-build">Build a specific item:
			<select id="betabot-select-build"><option value="" selected>None (Build Fastest)</option></select></div>`)

			for (const item of items) {
				$("#betabot-select-build").append(`<option value="${item.i}">${item.n}</option>`)
			}
		})
	}

	function addAltsSpawn(_, data) {
		if (data.title === "Spawn Gems") {
			$("#gemSpawnConfirm").after(`<input id="betabot-spawn-gem" type="button" style="padding:6.5px; margin: 0 -.5em 0 .5em;" value="Spawn For All Alts">`)

			$("#betabot-spawn-gem").on("click", () => {
				const msg = {
					text  : "spawnGem",
					tier  : parseInt($("#spawnGemLevel").val()),
					type  : parseInt($("#gemSpawnType").val()),
					splice: parseInt($("#gemSpawnSpliceType").val()),
					amount: parseInt($("#gemSpawnCount").val()),
				}
				port.postMessage(msg)
				if (vars.verbose) log(`Requested to spawn ${msg.amount} tier ${msg.tier} gems with type value of ${msg.type} and splice value of ${msg.splice}`)
			})
		}
	}

	function appendName() {
		if ($("#betabot-clear-username")[0] === undefined) {
			$("#roomName").append(`<span id="betabot-clear-username">${username}</span>`)
			if (vars.verbose) log("Appended username to room name")
		}
	}
	const keepUsernameVisible = new MutationObserver(appendName)

	async function jumpMobs(number) {
		if (vars.verbose) log(`Jumping ${number} mobs`)
		await delay(vars.startActionsDelay)
		$("#battleGrounds").click()
		$(document).one("roa-ws:page:town_battlegrounds", async () => {
			await delay(vars.buttonDelay)
			$(`#enemyList>option[value|=${number}]`).attr("selected", "selected")
			await delay(vars.buttonDelay)
			$("#autoEnemy").click()
		})
	}

	function spawnGems(tier, type, splice, amount) {
		if (vars.verbose) log(`Spawning ${amount} level ${tier*10} gems with type value of ${type} and splice value of ${splice}`)

		if (tier > parseInt($("#level").text()) * 10 || amount > 60 || type === 65535 || splice === 65535 || type === splice) {
			log("Invalid request. Aborting spawn")
			return
		}

		$(document).one("roa-ws:modalContent", async (_, data) => {
			if (data.title === "Spawn Gems") {
				await delay(vars.startActionsDelay)

				$("#spawnGemLevel").val(tier)
				$("#gemSpawnType").val(type)
				$("#gemSpawnSpliceType").val(splice)
				$("#gemSpawnCount").val(amount)

				await delay(vars.buttonDelay)
				$("#gemSpawnConfirm").click()
				$(document).one("roa-ws:page:gem_spawn", async () => {
					$("#betabot-spawn-gem").prop("disabled", true)
					await delay(55*1000)
					$("#confirmButtons>a.green")[0].click()
					await delay(5*1000)
					$("#betabot-spawn-gem").prop("disabled", false)
				})
			}
		})
		$("#chatMessage").text("/spawngem")
		$("#chatSendMessage").click()
	}

	// Make it easier to send currency:
	function wire(target) {
		if (target === username) return
		if (vars.verbose) log(`Wiring ${target}`)

		let sendMessage = `/wire ${target}`

		for (const currency of vars.currencySend) {
			if (currency.send === false) continue

			const amount   = $(`.${currency.name}`).attr("title").replace(/,/g, "")
			const sellable = $(`.${currency.name}`).attr("data-personal").replace(/,/g, "")
			let amountToSend = amount - currency.keepAmount // Keep this amount

			// Don't send more than you can
			if (amountToSend > sellable) {
				amountToSend = sellable
			}

			// Only send if you have enough
			if (amountToSend > currency.minimumAmount) {
				sendMessage += ` ${amountToSend} ${currency.name},`
			}
		}

		if (sendMessage !== `/wire ${target}`) {
			$("#chatMessage").text(sendMessage)
			$("#chatSendMessage").click()
		}
	}

	// Using an IIFE to avoid polluting the global space
	(function() {
		if ($("#betabot-ws")[0] !== undefined) $("#betabot-ws").remove() // Re-inject the script

		const elm = document.createElement("script")
		elm.innerHTML =
`const betabotChannel = new MessageChannel()
window.postMessage("betabot-ws message", "*", [betabotChannel.port2])
$(document).on("roa-ws:all", function(_, data){
	betabotChannel.port1.postMessage(JSON.parse(data))
})`
		elm.id = "betabot-ws"
		document.head.appendChild(elm)

		// RoA-WS. Taken from: https://github.com/edvordo/RoA-WSHookUp/blob/master/RoA-WSHookUp.user.js
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
			// Make sure we are connecting to the right port
			// No need to be absolutely sure about it since we don't send sensitive data
			if (origin === "https://beta.avabur.com" && data === "betabot-ws message") {
				message.originalEvent.ports[0].onmessage = roaWS
			}
		})
	})()

	// Betabot based on @Batosi's bot:
	async function completeTask() {
		await delay(vars.startActionsDelay)
		vars.actionsPending = false
		$(".closeModal").click()
	}

	/**
	 * Disables autoQuests or autoHouse to avoid starting them again, when the user cancels a quest or harvestron job
	 * @param {Object} event - Details of the event
	 * @param {string} event.data - Setting to disable. should be either "autoQuest" or "autoHouse"
	 */
	async function questOrHarvestronCancelled(event) {
		if (vars.verbose) {
			if (event.data === "autoQuest") log("Quest forfeited. Waiting 60 seconds before checking for quests again")
			if (event.data === "autoHouse") log("Harvestron job cancelled. Waiting 60 seconds before checking the Harvestron again")
		}
		if (vars[event.data]) {
			vars[event.data] = false
			await delay(60*1000)
			vars[event.data] = (await browser.storage.sync.get(event.data))[event.data]
		}
	}

	// Buy crystals every 24 hours
	async function buyCrys() {
		if (vars.dailyCrystals === 0) return

		if (vars.verbose) log(`Buying ${vars.dailyCrystals} daily crystals`)
		vars.actionsPending = true
		await delay(vars.startActionsDelay)
		$("#premiumShop").click()

		$(document).one("roa-ws:page:boosts", async () => {
			await delay(vars.buttonDelay)
			$("#goldCrystalButton").click()
			await delay(vars.buttonDelay)
			$("#premium_purchase_gold_count").val(vars.dailyCrystals)
			$("#premium_purchase_gold_button").click()
			setTimeout(completeTask, vars.buttonDelay)
		})
		$(document).one("roa-ws:page:purchase_crystals_gold", completeTask)
	}
	setInterval(buyCrys, 1000 * 60 * 60 * 24) // Once a day

	// Quests, house, harvestron, and crafting
	async function finishQuest() {
		await delay(vars.startActionsDelay)
		if (vars.verbose) log(`Completing a ${vars.questCompleting} quest`)
		$(`input.completeQuest[data-questtype=${vars.questCompleting}]`).click() // Complete the quest
		$(document).one("roa-ws:page:quests", async () => {
			await delay(vars.buttonDelay)
			if (vars.verbose) log(`Starting a ${vars.questCompleting} quest`)
			$(`input.questRequest[data-questtype=${vars.questCompleting}][value="Begin Quest"]`).click() // Start new quest
			$(document).one("roa-ws:page:quests", async () => {
				await delay(vars.buttonDelay)
				vars.actionsPending = false
				vars.questCompleting = null
				$(".closeModal").click()
			})
		})
	}

	async function selectBuild() {
		if (vars.verbose) log("Selecting build")
		const itemId = parseInt($("#item-id").val())
		await delay(vars.startActionsDelay)
		if ($("#custom-Build").is(":checked") && itemId > 0) { // If a custom build is specified, upgrade it
			if (vars.verbose) log(`Upgrading custom item with id ${itemId}`)
			$(document).one("roa-ws:page:house_all_builds", itemId, customBuild)
			await delay(vars.buttonDelay)
			$("#allHouseUpgrades")[0].click()
		} else if ($("#houseRoomCanBuild").is(":visible")) { // Else, if new room is available, build it
			if (vars.verbose) log("Building a new room")
			$(document).one("roa-ws:page:house_build_room", completeTask)
			await delay(vars.buttonDelay)
			$("#houseBuildRoom")[0].click()
		} else if ($("#houseQuickBuildList li:first .houseViewRoom").length === 1) { // Else, if new item is available, build it
			$(document).one("roa-ws:page:house_room", buildItem)
			await delay(vars.buttonDelay)
			$("#houseQuickBuildList li:first .houseViewRoom")[0].click()
		} else { // Else, upgrade existing item
			$(document).one("roa-ws:page:house_room_item", upgradeItem)
			await delay(vars.buttonDelay)
			$("#houseQuickBuildList li:first .houseViewRoomItem")[0].click()
		}
	}

	async function customBuild(event) {
		$(document).one("roa-ws:page:house_room_item", upgradeItem)
		await delay(vars.buttonDelay)
		$(`#modal2Content a[data-itemtype=${event.data}]`)[0].click()
	}

	async function buildItem() {
		if (vars.verbose) log("Building a new item")
		await delay(vars.startActionsDelay)
		$(document).one("roa-ws:page:house_build_room_item", completeTask)
		$("#houseBuildRoomItem").click()
	}

	async function upgradeItem() {
		await delay(vars.startActionsDelay)
		if ($("#houseRoomItemUpgradeTier").is(":visible")) { // If tier upgrade is available, upgrade it
			if (vars.verbose) log("Upgrading item tier")
			$(document).one("roa-ws:page:house_room_item_upgrade_tier", completeTask)
			$("#houseRoomItemUpgradeTier").click()
		} else { // Else do a regular upgrade
			if (vars.verbose) log("Upgrading fastest item")
			$(document).one("roa-ws:page:house_room_item_upgrade_level", completeTask)
			$("#houseRoomItemUpgradeLevel").click()
		}
	}

	async function startHarvestron() {
		if (vars.verbose) log("Starting Harvestron job")
		$("#houseHarvestingJobStart").click()
		setTimeout(completeTask, vars.buttonDelay)
	}

	async function fillCraftingQueue() {
		if (vars.actionsPending) return

		vars.actionsPending = true
		await delay(vars.startActionsDelay)
		// For some weird reason, .click() does not work here ¯\_(ツ)_/¯
		$(".craftingTableLink")[0].dispatchEvent(new Event("click"))
		$(document).one("roa-ws:page:house_room_item", async () => {
			await delay(vars.buttonDelay)
			$("#craftingItemLevelMax").click()
			await delay(vars.buttonDelay)
			$("#craftingQuality").val(0) // Set to poor quality
			$("#craftingJobFillQueue").attr("checked", "true")
			await delay(vars.buttonDelay)
			$("#craftingJobStart").click()
			$(document).one("roa-ws:page:craft_item", completeTask)
		})
	}

	function checkCraftingQueue(_, data) {
		if (data.type === "craft" && data.results.a.cq < vars.minCraftingQueue) {
			if (vars.verbose) log(`There are less than ${vars.minCraftingQueue} items in the crafting queue. Refilling now`)
			fillCraftingQueue()
		} else if (data.type === "notification" && vars.resumeCrafting) {
			// Means the user has not manually stopped crafting:
			if (/You completed your crafting queue and began (Battling|Fishing|Woodcutting|Mining|Stonecutting) automatically./.test(data.m)) {
				if (vars.verbose) log("Crafting queue is empty. Refilling")
				fillCraftingQueue()
			}
		}
	}

	// Check action results for needed actions
	async function checkResults(_, data) {
		data = data.results.p

		if (vars.autoStamina && data.autos_remaining < vars.minStamina && !staminaCooldown) { // Stamina
			if (vars.verbose) log("Replenishing stamina")
			$("#replenishStamina").click()
			staminaCooldown = true
			await delay(2500)
			staminaCooldown = false
			return
		}

		// Actions that should always be performed go before this
		if (vars.actionsPending) return

		if (vars.autoQuests) { // Quests
			if (data.bq_info2?.c >= data.bq_info2.r) {
				vars.questCompleting = "kill"
			} else if (data.tq_info2?.c >= data.tq_info2.r) {
				vars.questCompleting = "tradeskill"
			} else if (data.pq_info2?.c >= data.pq_info2.r) {
				vars.questCompleting = "profession"
			}

			if (vars.questCompleting != null) {
				vars.actionsPending = true
				$(document).one("roa-ws:page:quests", finishQuest)
				await delay(vars.buttonDelay)
				$("a.questCenter")[0].click()
				return
			}
		}
		if (vars.autoHouse && data.can_build_house) { // Construction
			vars.actionsPending = true
			$(document).one("roa-ws:page:house", selectBuild)
			$("li#housing").click()
			return
		}
		if (vars.autoHarvestron && data.can_house_harvest) { // Harvestron
			vars.actionsPending = true
			$(document).one("roa-ws:page:house_room_item", startHarvestron)
			$("#harvestronNotifier")[0].click()
			return
		}
	}

	// Auto event Based on: https://github.com/dragonminja24/betaburCheats/blob/master/betaburCheatsHeavyWeight.js
	let eventID         = null
	let mainEvent       = false
	let eventInProgress = false
	let motdReceived    = false

	const BUTTONS = {
		battle      : $(".bossFight.btn.btn-primary")[0],
		fishing     : $(".bossHarvest.btn")[4],
		woodcutting : $(".bossHarvest.btn")[5],
		mining      : $(".bossHarvest.btn")[6],
		stonecutting: $(".bossHarvest.btn")[7],
		crafting    : $(".bossCraft.btn")[0],
		carving     : $(".bossCarve.btn")[0],
	}

	function getTrade() {
		for (const trade of Object.keys(vars.tradesList)) {
			if (vars.tradesList[trade].includes(username.toLowerCase())) {
				return trade
			}
		}
		return "mining"
	}

	function changeTrade(_, data) {
		if (data.carvingTier > 2500 && !mainEvent) {
			if (vars.verbose) log("Attacking event boss (carving tier)")
			BUTTONS.battle.click()
		} else if (data.time_remaining / 60 < vars.attackAt) {
			if (!isAlt || (isAlt && !mainEvent)) {
				if (vars.verbose) log("Attacking event boss (time)")
				BUTTONS.battle.click()
			}
		} else { // Don't execute the rest of the function
			return
		}
		// Stop tracking the event
		mainEvent = false
		eventInProgress = false
		eventListeners.toggle("roa-ws:boss", changeTrade, false)
	}

	function joinEvent(msgContent, msgID) {
		if (eventID !== msgID && !eventInProgress && (msgContent === "InitEvent" || msgContent === "MainEvent")) {
			eventID = msgID
			mainEvent = msgContent === "MainEvent"
			eventInProgress = true

			if (vars.verbose) log(`Joining ${mainEvent ? "main" : "regular"} event due to message #${msgID}`)
			BUTTONS[mainTrade].click()
			eventListeners.toggle("roa-ws:boss", changeTrade, true)
		}
	}

	async function checkEvent(_, data) {
		if (data.c_id === vars.eventChannelID) {
			await delay(vars.startActionsDelay)
			// Wait to see if the message is recieved together with a message of the day,
			// which means it was only sent due to a chat reconnection, and we should not join the event.
			if (motdReceived === false) {
				joinEvent(data.m, data.m_id)
			}
		}
	}

	async function motd() {
		motdReceived = true
		await delay(vars.startActionsDelay * 5)
		motdReceived = false
	}
}
