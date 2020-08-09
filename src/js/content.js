/**
 * @file
 * @todo
 * <pre>
 * <h5>Add</h5>
 * - Reorganize this file
 * </pre>
 *
 * @todo
 * <pre>
 * <h5>Test</h5>
 * - Hide old banners
 * - Socket 5 gems at once
 * - Clicking on the OK button after spawning gems for all alts
 * - Clear event vars after 16+ minutes even if the user is not participating
 * - Use weak and compromised encryption for the password (this **CANNOT** be trusted as a secure encryption)
 * </pre>
 */

"use strict"

/**
 * Stores the current page URL
 * @constant href
 * @type {string}
 */
const href = window.location.href

/**
 * See [MDN Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port)
 * @typedef {object} runtimePort
 * @property {string=} name Name of the sender
 * @property {object} sender Contains information about the sender of the port
 * @property {object} onMessage
 * @property {function} onMessage.addListener
 * @property {function} onMessage.removeListener
 * @property {object} onDisconnect
 * @property {function} onDisconnect.addListener
 * @property {function} onDisconnect.removeListener
 * @property {function} postMessage
 */

/**
 * Stores the connection to the background script
 * @type {runtimePort}
 */
let port = null

/**
 * @type {object}
 * @description Stores the settings
 */
let vars = null

if (/www.avabur.com[/?expird=1]*$/.test(href)) {
	liveLogin()
} else if (/beta.avabur.com[/?expird=1]*$/.test(href)) {
	betaLogin()
} else if (/beta.avabur.com\/game/.test(href)) {
	betaGame()
}

/**
 * Logs a message, while prefixing it with date, time and the the addon's name
 * @function log
 * @param {...any} msg Zero or more objects of any type that will be logged
 */
function log(...msg) {
	console.log(`[${new Date().toLocaleString().replace(",", "")}] Betaburlogin:`, ...msg)
}

/**
 * - Returns a promise that is resolved after some time.
 * - Useful for pausing async functions.
 * @function delay
 * @param {number} ms Amount of milliseconds to wait before resolving the promise
 */
function delay(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
}

/**
 * Object used to manage jQuery document event listeners
 * @const eventListeners
 * @property {function} toggle Toggles an event listener on/off
 * @property {...function[]}
 * - One or more properties using the following format:
 * - string: function[]
 * - Where the string is the name of the event (e.g. "roa-ws:all"), and function[] is an array of functions that will be called when the event is triggered
 * - Example: `eventListeners["roa-ws:page"] = [onPage, getPage, log]` will call onPage(), getPage(), and log() whenever "roa-ws:page" is triggered
 */
const eventListeners = {
	/**
	 * Attaches/deattaches handlers to document events, while avoiding having duplicate listeners
	 * @method toggle
	 * @param {string} eventName - Listen to events with this name
	 * @param {function} handler - Handle the event with this handler
	 * @param {boolean} value - Turn the event handler on/off
	 * */
	toggle: function(eventName, handler, value) {
		if (typeof eventName !== "string") throw new TypeError(`Parameter eventName ${eventName} must be a string`)
		if (typeof handler !== "function") throw new TypeError(`Parameter handler ${handler} must be function`)
		if (typeof value !== "boolean") throw new TypeError(`Parameter value ${value} must be boolean`)

		if (this[eventName] === undefined) {
			this[eventName] = []
		}
		const prop = this[eventName] // Shorter identifier

		if (prop.includes(handler) && value) { // Turn off the previous event handler to avoid duplicates
			$(document).off(eventName, handler)
		}

		$(document)[value ? "on" : "off"](eventName, handler) // If value is true, $(document).on(...), if false, $(document).off(...)
		if (prop.includes(handler) && !value) { // Push/pop the handler from the handlers array
			prop.splice(prop.indexOf(handler), 1)
		} else if (value) {
			prop.push(handler)
		}
	},
}

/**
 * Code to run when on Live Login page
 * @async
 * @function liveLogin
 */
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

/**
 * Code to run when on Beta Login page
 * @async
 * @function betaLogin
 */
async function betaLogin() {
	vars = await browser.storage.sync.get(["verbose", "addLoginAlts", "loginPassword"])

	if (vars.verbose) log("Starting up (Beta Login)")

	/**
	 * Logs in with given username
	 * @function login
	 * @param {string} username
	 */
	async function login(username) {
		$("#acctname").val(username)
		$("#password").val(insecureCrypt.decrypt(vars.password, "betabot Totally-not-secure Super NOT secret key!"))
		$("#login").click()
		if (vars.verbose) log(`Logging in with username ${username}`)
		await delay(7500)
		if ($("#login_notification").text() === "Your location is making too many requests too quickly.  Try again later.") {
			if (vars.verbose) log("Rate limited, trying again")
			login(username)
		}
	}

	if (vars.addLoginAlts) {
		port = browser.runtime.connect({name: "login"})
		port.onMessage.addListener(message => {
			if (vars.verbose) log(`Received message with text: ${message.text}`)
			if (message.text === "login") login(message.username)
		})

		$("#login_notification").html(`<button id="login-alts">Login All Alts</button>`)
		$("#login-alts").click(() => { port.postMessage({text: "requesting login"}) })
	}
}

/**
 * Code to run when on Beta Game page
 * @async
 * @function betaGame
 */
async function betaGame() {
	vars = await browser.storage.sync.get()
	let username        = $("#username").text()
	let isAlt           = username !== vars.mainUsername.toLowerCase()
	let staminaCooldown = false
	let mainTrade       = getTrade()
	let autoWireID      = vars.autoWire ? setInterval(wire, vars.wireFrequency*60*1000, vars.mainUsername) : null

	if (vars.verbose) {
		log(`Starting up (Beta Game)\nUsername: ${username}\nAlt: ${isAlt ? "yes" : "no"}\nEvent TS: ${mainTrade}\nAuto Wire: ${autoWireID ? "on" : "off"}`)
	}

	/**
	 * Loads new settings from storage
	 * @function refreshVars
	 * @param {object} changes [StorageChange object](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageChange)
	 */
	async function refreshVars(changes) {
		if (vars.verbose) log("Refreshing settings")

		vars = await browser.storage.sync.get()
		isAlt = username !== vars.mainUsername.toLowerCase()
		mainTrade = getTrade()

		for (const wireRelated of ["wireFrequency", "mainUsername",]) { // If one of these has changed, reset autoWire
			if (changes[wireRelated].oldValue !== changes[wireRelated].newValue) {
				clearInterval(autoWireID)
				autoWireID = null
				log("Resetting autoWireID")
			}
		}

		// Turn on/off autoWire if needed
		if (autoWireID && !vars.autoWire) {
			clearInterval(autoWireID)
			autoWireID = null
		} else if (!autoWireID && vars.autoWire) {
			autoWireID = setInterval(wire, vars.wireFrequency*60*1000, vars.mainUsername)
		}

		toggleInterfaceChanges(true)

		if (vars.verbose) log(`Alt: ${isAlt ? "yes" : "no"}\nEvent TS: ${mainTrade}\nAuto Wire: ${autoWireID ? "on" : "off"}`)
	}
	browser.storage.onChanged.addListener(refreshVars)

	// Event listeners that are currently always on (might change in the future) are below
	// Event listeners that will be turned on/off as needed are inside toggleInterfaceChanges()

	// Toggle motdReceived on for a short time after receiving motd message
	eventListeners.toggle("roa-ws:motd", motd, true)
	// Advice the user to update the options page after a name change:
	eventListeners.toggle("roa-ws:page:username_change", usernameChange, true)
	// Don't start new quests/harvestron jobs for 60 seconds after manually cancelling one:
	eventListeners.toggle("roa-ws:page:quest_forfeit roa-ws:page:house_harvest_job_cancel", questOrHarvestronCancelled, true,)

	// Connect to background script:
	port = browser.runtime.connect({name: username})
	port.onMessage.addListener(message => {
		if (vars.verbose) log("Received message:", message)

		if (message.text === "send currency") wire(message.recipient)
		if (message.text === "jump mobs") jumpMobs(message.number)
		if (message.text === "spawn gems") spawnGems(message.tier, message.type, message.splice, message.amount)
		if (message.text === "close banners") closeBanner()
	})

	/**
	 * Advises the user to update settings when changing name
	 * @function usernameChange
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 */
	function usernameChange(_, data) {
		if (data.s === 0) return // Unsuccessful name change

		log(`User has changed name from ${username} to ${data.u}`)
		$.alert(`It looks like you have changed your username from ${username} to ${data.u}.
			If you used the old username in BetaburLogin settings page, you might want to
			update these settings`, "Name Changed")
		username = data.u
	}

	/**
	 * Creates a drop down list in the house page, allowing the user to select a custom build instead of always building the fastest
	 * @function getCustomBuild
	 */
	function getCustomBuild() {
		eventListeners.toggle("roa-ws:motd", getCustomBuild, false) // Turn off event listener
		vars.actionsPending = true
		$("#allHouseUpgrades")[0].click()
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

	/**
	 * Creates a "Spawn For All Alts" button on the Spawn Gems interface
	 * @function addAltsSpawn
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
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
				if (vars.verbose) log(`Requested to spawn ${msg.amount} tier ${msg.tier} gems with type value of ${msg.type} and splice value of ${msg.splice}`)
			})
		}
	}

	/**
	 * Appends the username to the room name
	 * @function appendName
	 */
	function appendName() {
		if ($("#betabot-clear-username")[0] === undefined) {
			$("#roomName").append(`<span id="betabot-clear-username">${username}</span>`)
			if (vars.verbose) log("Appended username to room name")
		}
	}
	/**
	 * MutationObserver for appendName
	 * @constant {MutationObserver} keepUsernameVisible
	 */
	const keepUsernameVisible = new MutationObserver(appendName)

	/**
	 * Jumps to a mob with a given ID
	 * @async
	 * @function jumpMobs
	 * @param {number} number Mob ID
	 */
	async function jumpMobs(number) {
		if (vars.verbose) log(`Jumping to mob number ${number}`)
		await delay(vars.startActionsDelay)
		$("#battleGrounds").click()
		$(document).one("roa-ws:page:town_battlegrounds", async () => {
			await delay(vars.buttonDelay)
			$(`#enemyList>option[value|=${number}]`).attr("selected", "selected")
			await delay(vars.buttonDelay)
			$("#autoEnemy").click()
		})
	}

	$("#close_general_notification").click(() => {
		if (vars.removeBanner) {
			if (vars.verbose) log("Banner closed by user")
			port.postMessage({text: "banner closed"})
		}
	})

	/**
	 * Closes the banner
	 * @function closeBanner
	 */
	function closeBanner() {
		if (vars.verbose) log("Banner closed automatically")
		$("#close_general_notification").click()
	}

	/**
	 * Spawns gems
	 * @param {number} type ID of a gem type for the main gem
	 * @param {number} splice ID of a gem type for the spliced gem
	 * @param {number} tier
	 * @param {number} amount
	 */
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
					await delay(60*1000)
					$("#betabot-spawn-gem").prop("disabled", false)
					$("#confirmButtons>a.green")[0].click()
				})
			}
		})
		$("#chatMessage").text("/spawngem")
		$("#chatSendMessage").click()
	}

	/**
	 * - Sends currency to another user
	 * - Exact settings can be changed by the user under the Currency Send section of the Options Page.
	 * @function wire
	 * @param {string} target Wire recipient
	 */
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

		/**
		 * A script that will be injected to the page. Used to broadcast events to the content script
		 * @constant elm
		 * @private
		 */
		const elm = document.createElement("script")
		elm.innerHTML =
`betabotChannel = new MessageChannel()
window.postMessage("betabot-ws message", "*", [betabotChannel.port2])
$(document).on("roa-ws:all", function(_, data){
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
			// Make sure we are connecting to the right port
			// No need to be absolutely sure about it since we don't send sensitive data
			if (origin === "https://beta.avabur.com" && data === "betabot-ws message") {
				message.originalEvent.ports[0].onmessage = roaWS
			}
		})
	})()

	/**
	 * This section of the code was originally based on a private distribution of @Batosi's bot
	 */

	/**
	 * Closes the modal and sets actionsPending to false
	 * @async
	 * @function completeTask
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
	 */
	async function questOrHarvestronCancelled(event) {
		const type = event.type.replace("roa-ws:page:", "")
		let key = null
		if (type === "quest_forfeit") {
			if (vars.verbose) log("Quest forfeited. Waiting 60 seconds before checking for quests again")
			key = "autoQuest"
		} else if (type === "house_harvest_job_cancel") {
			if (vars.verbose) log("Harvestron job cancelled. Waiting 60 seconds before checking the Harvestron again")
			key = "autoHarvestron"
		}

		if (vars[key]) {
			vars[key] = false
			await delay(60*1000)
			vars[key] = (await browser.storage.sync.get(key))[key]
		}
	}

	/**
	 * Buys daily crystals for gold
	 * @async
	 * @function buyCrys
	 */
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

	/**
	 * Finishes a quest and get a new one
	 * @async
	 * @function finishQuest
	 */
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

	/**
	 * Selects the next item to build
	 * @async
	 * @function selectBuild
	 */
	async function selectBuild() {
		if (vars.verbose) log("Selecting build")
		const itemId = parseInt($("#betabot-select-build").val())
		await delay(vars.startActionsDelay)
		if (!isNaN(itemId)) { // If a custom build is specified, upgrade it
			$(document).one("roa-ws:page:house_all_builds", customBuild)
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

	/**
	 * Builds a custom item as specified by the user
	 * @async
	 * @function customBuild
	 */
	async function customBuild() {
		const itemId = $("#betabot-select-build").val()
		if (vars.verbose) log(`Upgrading custom item with id ${itemId}`)
		$(document).one("roa-ws:page:house_room_item", async () => {
			await delay(vars.buttonDelay)
			$(document).one("roa-ws:page:house_room_item_upgrade_level", completeTask)
			$("#houseRoomItemUpgradeLevel").click()
		})
		await delay(vars.buttonDelay)
		$(`#modal2Content a[data-itemtype=${itemId}]`)[0].click()

	}

	/**
	 * Builds a new item
	 * @async
	 * @function buildItem
	 */
	async function buildItem() {
		if (vars.verbose) log("Building a new item")
		await delay(vars.startActionsDelay)
		$(document).one("roa-ws:page:house_build_room_item", completeTask)
		$("#houseBuildRoomItem").click()
	}

	/**
	 * Upgrades an existing item tier or level
	 * @async
	 * @function upgradeItem
	 */
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

	/**
	 * Starts a new Harvestron job
	 * @async
	 * @function startHarvestron
	 */
	async function startHarvestron() {
		if (vars.verbose) log("Starting Harvestron job")
		$("#houseHarvestingJobStart").click()
		setTimeout(completeTask, vars.buttonDelay)
	}

	/**
	 * Fills the crafting queue
	 * @async
	 * @function fillCraftingQueue
	 */
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

	/**
	 * Checks if the crafting queue should be filled
	 * @function checkCraftingQueue
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 */
	function checkCraftingQueue(_, data) {
		if (data.type === "craft" && data.results.a.cq < vars.minCraftingQueue) {
			if (vars.verbose) log(`There are less than ${vars.minCraftingQueue} items in the crafting queue. Refilling now`)
			fillCraftingQueue()
		} else if (data.type === "notification" && vars.resumeCrafting) {
			// Means the user has not manually stopped crafting:
			if (/You completed your crafting queue and began (Battling|Fishing|Woodcutting|Mining|Stonecutting) automatically./.test(data.m)) {
				if (vars.verbose) log("Crafting queue is empty. Refilling now")
				fillCraftingQueue()
			}
		}
	}

	/**
	 * Adds a "Socket Gem x5" button to the Item Options interface
	 * @function addSocket5Button
	 */
	function addSocket5Button() {
		$("#socketThisGem").after(`<button id="betabot-socket-5">Socket Gem x5</button>`)
		$("#betabot-socket-5").click( () => {
			eventListeners.toggle("roa-ws:page:gem_socket_to_item", socketGem, true)
			$("#socketThisGem").click()
		})
	}

	/**
	 * Sockets a gem to an item
	 * @function socketGem
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 */
	function socketGem(_, data) {
		const gemsAmount = $(".moreGemOptions2").get().length
		if (gemsAmount === 5 || data.s !== 1) { // If we finished, or if it was an unsuccessful socket
			eventListeners.toggle("roa-ws:page:gem_socket_to_item", socketGem, false)
			return
		}
		$("#socketThisGem").click()
	}

	/**
	 * Checks action results for needed actions
	 * @async
	 * @function checkResults
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 */
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

	/**
	 * This section of the code was originally based on [BetaburCheats](https://github.com/dragonminja24/betaburCheats/blob/master/betaburCheatsHeavyWeight.js)
	 */
	let eventID         = null
	let mainEvent       = false
	let eventInProgress = false
	let motdReceived    = false

	/**
	 * Enum for the event buttons
	 * @enum {HTMLElement}
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
	 * - Gets the Trade Skill of this user
	 * - If the user's Trade Skill is not found, returns `"mining"`
	 * @function getTrade
	 * @returns {string} Name of the Trade Skill
	 */
	function getTrade() {
		for (const trade of Object.keys(vars.tradesList)) {
			if (vars.tradesList[trade].includes(username.toLowerCase())) {
				return trade
			}
		}
		return "mining"
	}

	/**
	 * Attacks in events if the criteria are met
	 * @function changeTrade
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 */
	function changeTrade(_, data) {
		const d = data.results
		if (d.carvingTier > 2500 && !mainEvent) {
			if (vars.verbose) log("Attacking event boss (carving tier)")
			BUTTONS.battle.click()
		} else if (d.time_remaining < vars.attackAt * 60) {
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
		eventListeners.toggle("roa-ws:event_action", changeTrade, false)
	}

	/**
	 * Joins the event if the criteria are met
	 * @async
	 * @function joinEvent
	 * @param {string} msgContent Contents of the chat message
	 * @param {string} msgID ID of the chat message
	 */
	async function joinEvent(msgContent, msgID) {
		if (eventID !== msgID && !eventInProgress && (msgContent === "InitEvent" || msgContent === "MainEvent")) {
			eventID = msgID
			mainEvent = msgContent === "MainEvent"
			eventInProgress = true

			if (vars.verbose) log(`Joining ${mainEvent ? "main" : "regular"} event due to message #${msgID}`)
			BUTTONS[mainTrade].click()
			eventListeners.toggle("roa-ws:event_action", changeTrade, true)
		}
		await delay(16*60*1000) // After 16 minutes, make sure the event is registered as over
		if (eventID === msgID) { // Means it's the same event
			mainEvent = false
			eventInProgress = false
			eventListeners.toggle("roa-ws:event_action", changeTrade, false)
		}
	}

	/**
	 * Checks chat message and listens to event commands
	 * @async
	 * @function checkEvent
	 * @param {event} _ Placeholder parameter
	 * @param {object} data Event data
	 */
	async function checkEvent(_, data) {
		if (data.c_id === vars.eventChannelID) {
			await delay(vars.startActionsDelay)
			// Wait to see if the message is received together with a message of the day,
			// which means it was only sent due to a chat reconnection, and we should not join the event.
			if (motdReceived === false) {
				joinEvent(data.m, data.m_id)
			}
		}
	}

	/**
	 * Sets motdReceived to true for a short time after receiving a message of the day
	 * @async
	 * @function motd
	 */
	async function motd() {
		motdReceived = true
		await delay(vars.startActionsDelay * 5)
		motdReceived = false
	}

	/**
	 * @async
	 * @function toggleInterfaceChanges
	 * @param {boolean} refresh Should be true when called by refreshVars and false otherwise
	 */
	async function toggleInterfaceChanges(refresh) {
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
					<div class="row" id="effectTable"></div>
				</div>
			</div>`)
		}

		/**
		 * The next two settings (customBuild and joinEvents) need to listen to roa-ws:motd to start.
		 * However, since jQuery .one method can't be used for two functions on the same event at the
		 * same time, I had to use .on and call .off immediately after the event triggers.
		 */

		// Option to build a specific item:
		if (vars.addCustomBuild && $("#betabot-custom-build")[0] === undefined) {
			if (refresh) { // Don't activate immediately on page load
				getCustomBuild()
			} else {
				eventListeners.toggle("roa-ws:motd", getCustomBuild, true) // Wait for the page to load
			}
		} else if (vars.addCustomBuild === false && $("#betabot-custom-build")[0] !== undefined) {
			$("#betabot-custom-build").remove()
		}

		// Auto Events:
		if (refresh) { // Don't activate immediately on page load
			eventListeners.toggle("roa-ws:message", checkEvent, vars.joinEvents)
		} else {
			const startCheckEvent = () => {
				eventListeners.toggle("roa-ws:message", checkEvent, vars.joinEvents)
				eventListeners.toggle("roa-ws:motd", startCheckEvent, false)
			}
			eventListeners.toggle("roa-ws:motd", startCheckEvent, vars.joinEvents)/*
			$(document).one("roa-ws:motd", () => {
				eventListeners.toggle("roa-ws:message", checkEvent, vars.joinEvents)
			})*/ // Start after a delay to avoid being triggered by old messages
		}

		// Auto Craft:
		eventListeners.toggle("roa-ws:craft roa-ws:notification", checkCraftingQueue, vars.autoCraft)
		// Auto Stamina/Quests/House/Harvestron:
		eventListeners.toggle("roa-ws:battle roa-ws:harvest roa-ws:carve roa-ws:craft roa-ws:event_action", checkResults,
			vars.autoStamina || vars.autoQuests || vars.autoHouse || vars.autoHarvestron)
		// Socket Gem x5:
		eventListeners.toggle("roa-ws:page:item_options", addSocket5Button, vars.addSocketX5)

		if (isAlt) { // Only run on alts
			// Spawn Gems For All Alts:
			eventListeners.toggle("roa-ws:modalContent", addAltsSpawn, vars.addSpawnGems)

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
		}
	}
	toggleInterfaceChanges(false)
}
