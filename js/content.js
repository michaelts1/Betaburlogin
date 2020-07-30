/* ~~~ To Do ~~~
 * Use await delay instead of setTimeout
 *
 * ~~~ Needs Testing ~~~
 * Make mainUsername case insensitive
 * Remove effects info
 * All interface settings
 * Changing CSS
 * Stamina
 * Events
 * Custom build
 * RoA-WS
 * Changing autoWire settings
 */

"use strict"

const href = window.location.href
let port = null

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

async function liveLogin() {
	const vars = await browser.storage.sync.get(["verbose", "addOpenTabs"])

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
	const vars = await browser.storage.sync.get(["verbose", "addLoginAlts"])

	if (vars.verbose) log("Starting up (Beta Login)")

	async function login(username, password) {
		$("#acctname").val(username)
		$("#password").val(password)
		$("#login").click()
		if (vars.verbose) log(`Logging in with username ${username}`)

		setTimeout(() => {
			if ($("#login_notification").text() === "Your location is making too many requests too quickly.  Try again later.") {
				if (vars.verbose) log("Rate limited, trying again")
				login(username, password)
			}
		}, 7500)
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
	let vars            = await browser.storage.sync.get()
	let username        = $("#username").text()
	let isAlt           = username !== vars.mainUsername.toLowerCase()
	let staminaCooldown = false
	let mainTrade       = getTrade()
	let autoWireID      = vars.autoWire ? setInterval(wire, vars.wireFrequency*60*1000, vars.mainUsername) : null

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

	$(document).on("roa-ws:page:username_change", (_, data) => {
		if (data.s === 0) return // Unsuccessful name change

		log(`User has changed name from ${username} to ${data.u}`)
		$.alert(`It looks like you have changed your username from ${username} to ${data.u}.
			If you used the old username in BetaburLogin settings page, you might want to
			update these settings`, "Name Changed")
		username = data.u
	})

	// Connect to background script:
	port = browser.runtime.connect({name: username})
	port.onMessage.addListener(message => {
		if (vars.verbose) log("Received message:", message)

		if (message.text === "send currency") wire(message.recipient)
		if (message.text === "jump mobs") jumpMobs(message.number)
		if (message.text === "buy crystals now") autoBuyCrys()
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
			$("#betabot-clear-username").remove()
		}

		// Option to build a specific item:
		function getCustomBuild() {
			vars.actionsPending = true
			$("#allHouseUpgrades").click()

			$(document).one("roa-ws:page:house_all_builds", (_, data) => {
				setTimeout(itemBuilding)

				const items = []
				data.q_b.map(el1 => items.filter(el2 => el2.i == el1.i).length > 0 ? null : items.push(el1)) // Filter duplicates - https://stackoverflow.com/a/53543804

				$("#houseQuickBuildWrapper").append(`<div id="betabot-custom-build">Build a specific item:
				<select id="betabot-select-build"><option value="" selected>None (Build Fastest)</option></select></div>`)

				for (const item of items) {
					$("#betabot-select-build").append(`<option value="${item.i}">${item.n}</option>`)
				}
			})
		}
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
		const cssChanged = `data:text/css;base64,${btoa(vars.css.addon + vars.css.custom)}` !== $("#betabot-css").prop("href")
		if (cssChanged || $("#betabot-css")[0] === undefined) { // If the code has changed, or if it was never injected
			$("#betabot-css").remove()
			const elm = document.createElement("link")
			elm.href = `data:text/css;base64,${btoa(vars.css.addon + vars.css.custom)}` // Decode CSS into base64 and use it as a link to avoid script injections
			elm.type = "text/css"
			elm.rel  = "stylesheet"
			elm.id   = "betabot-css"
			document.head.appendChild(elm)
		}

		// Remove Effects Box
		if (vars.removeEffects && $("#effectInfo")[0] !== undefined) {
			$("#effectInfo").remove()
		} else if (vars.removeEffects === false && $("#effectInfo")[0] === undefined) {
			$("#gauntletInfo").after(
				`<div id="effectInfo" style="display: block;">
					<div class="ui-element border2">
						<h5 class="toprounder center"><a id="effectUpgradeTable">Effects</a></h5>
						<div class="row" id="effectTable" style=""></div>
					</div>
				</div>`)
		}
	}

	$(document).on("roa-ws:modalContent", (_, data) => {
		if (vars.addSpawnGems && data.title === "Spawn Gems") {
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
	})

	function appendName() {
		if ($("#betabot-clear-username")[0] === undefined) {
			$("#roomName").append(`<span id="betabot-clear-username">${username}</span>`)
			if (vars.verbose) log("Appended username to room name")
		}
	}
	const keepUsernameVisible = new MutationObserver(appendName)

	function jumpMobs(number) {
		if (vars.verbose) log(`Jumping ${number} mobs`)
		setTimeout(() => {
			$("#battleGrounds").click()
			$(document).one("roa-ws:page:town_battlegrounds", () => {
				setTimeout(() => {
					$(`#enemyList>option[value|=${number}]`).attr("selected", "selected")
					setTimeout(() => {
						$("#autoEnemy").click()
					}, vars.buttonDelay)
				}, vars.buttonDelay)
			})
		}, vars.startActionsDelay)
	}

	function spawnGems(tier, type, splice, amount) {
		if (vars.verbose) log(`Spawning ${amount} level ${tier*10} gems with type value of ${type} and splice value of ${splice}`)

		if (tier > parseInt($("#level").text()) * 10 || amount > 60 || type === 65535 || splice === 65535 || type === splice) {
			log("Invalid request. Aborting spawn")
			return
		}

		$(document).one("roa-ws:modalContent", (_, data) => {
			if (data.title === "Spawn Gems") {
				setTimeout(() => {
					$("#spawnGemLevel").val(tier)
					$("#gemSpawnType").val(type)
					$("#gemSpawnSpliceType").val(splice)
					$("#gemSpawnCount").val(amount)

					setTimeout(() => {
						$("#gemSpawnConfirm").click()
					}, vars.buttonDelay)

					$(document).one("roa-ws:page:gem_spawn", () => {
						$("#betabot-spawn-gem").prop("disabled", true)
						setTimeout(() => {
							$("#confirmButtons>a.green")[0].click()
						}, 55*1000)
						setTimeout(() => {
							$("#betabot-spawn-gem").prop("disabled", false)
						}, 60*1000)
					})
				}, vars.startActionsDelay)
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

			const amount       = $(`.${currency.name}`).attr("title").replace(/,/g, "")
			const sellable     = $(`.${currency.name}`).attr("data-personal").replace(/,/g, "")
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
`const channel = new MessageChannel()
window.postMessage("betabot-ws message", "*", [channel.port2])
$(document).on("roa-ws:all", function(_, data){
	channel.port1.postMessage(JSON.parse(data))
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
			// No need to be absolutely sure about it since we don't send sensitve data
			if (origin === "https://beta.avabur.com" && data === "betabot-ws message") {
				message.originalEvent.ports[0].onmessage = roaWS
			}
		})
	})()

	// Betabot based on @Batosi's bot:

	// When the user cancels a quest or harvestron, disable autoQuests or autoHouse to avoid starting them again
	$(document).on("roa-ws:page:quest_forfeit", () => {
		if (vars.verbose) log("Quest forfeited. Waiting 60 seconds before checking for quests again")
		if (vars.autoQuests) {
			vars.autoQuests = false
			setTimeout( async () => {
				vars.autoQuests = (await browser.storage.sync.get("autoQuests")).autoQuests
			}, 60*1000)
		}
	})

	$(document).on("roa-ws:page:house_harvest_job_cancel", () => {
		if (vars.verbose) log("Harvestron job cancelled. Waiting 60 seconds before checking the Harvestron again")
		if (vars.autoHouse) {
			vars.autoHouse = false
			setTimeout( async () => {
				vars.autoHouse = (await browser.storage.sync.get("autoQuests")).autoHouse
			}, 60*1000)
		}
	})

	// Buy crystals every 24 hours
	function autoBuyCrys() {
		if (vars.dailyCrystals === 0) return

		if (vars.verbose) log(`Buying ${vars.dailyCrystals} daily crystals`)
		vars.actionsPending = true
		setTimeout(() => { $("#premiumShop").click() }, vars.startActionsDelay)
		$(document).one("roa-ws:page:boosts", () => {
			setTimeout(() => {
				$("#goldCrystalButton").click()
				setTimeout(() => {
					$("#premium_purchase_gold_count").val(vars.dailyCrystals)
					$("#premium_purchase_gold_button").click()
					setTimeout(itemBuilding, vars.buttonDelay)
				}, vars.buttonDelay)
			}, vars.buttonDelay)
		})
		$(document).one("roa-ws:page:purchase_crystals_gold", itemBuilding)
	}
	setInterval(autoBuyCrys, 1000 * 60 * 60 * 24) // Once a day

	// Quests, house, harvestron, and crafting
	const finishQuest = () => {
		setTimeout(() => {
			if (vars.verbose) log(`Completing a ${vars.questCompleting} quest`)
			$(`input.completeQuest[data-questtype=${vars.questCompleting}]`).click() // Complete the quest
			$(document).one("roa-ws:page:quests", () => {
				setTimeout(() => {
					if (vars.verbose) log(`Starting a ${vars.questCompleting} quest`)
					$(`input.questRequest[data-questtype=${vars.questCompleting}][value="Begin Quest"]`).click() // Start new quest
					$(document).one("roa-ws:page:quests", () => {
						setTimeout(() => {
							vars.actionsPending = false
							vars.questCompleting = null
							$(".closeModal").click()
						}, vars.buttonDelay)
					})
				}, vars.buttonDelay)
			})
		}, vars.startActionsDelay)
	}

	const selectBuild = () => {
		if (vars.verbose) log("Selecting build")
		setTimeout(() => {
			const itemId = parseInt($("#item-id").val())
			if ($("#custom-Build").is(":checked") && itemId > 0) { // If a custom build is specified, upgrade it
				if (vars.verbose) log(`Upgrading custom item with id ${itemId}`)
				$(document).one("roa-ws:page:house_all_builds", itemId, customBuild)
				setTimeout(() => { $("#allHouseUpgrades")[0].click() }, vars.buttonDelay)
			} else if ($("#houseRoomCanBuild").is(":visible")) { // Else, if new room is available, build it
				if (vars.verbose) log("Building a new room")
				$(document).one("roa-ws:page:house_build_room", itemBuilding)
				setTimeout(() => { $("#houseBuildRoom")[0].click() }, vars.buttonDelay)
			} else if ($("#houseQuickBuildList li:first .houseViewRoom").length === 1) { // Else, if new item is available, build it
				$(document).one("roa-ws:page:house_room", buildItem)
				setTimeout(() => { $("#houseQuickBuildList li:first .houseViewRoom")[0].click() }, vars.buttonDelay)
			} else { // Else, upgrade existing item
				$(document).one("roa-ws:page:house_room_item", upgradeItem)
				setTimeout(() => { $("#houseQuickBuildList li:first .houseViewRoomItem")[0].click() }, vars.buttonDelay)
			}
		}, vars.startActionsDelay)
	}

	const customBuild = event => {
		$(document).one("roa-ws:page:house_room_item", upgradeItem)
		setTimeout(() => {
			$(`#modal2Content a[data-itemtype=${event.data}]`)[0].click()
		}, vars.buttonDelay)
	}

	const buildItem = () => {
		if (vars.verbose) log("Building a new item")
		setTimeout(() => {
			$(document).one("roa-ws:page:house_build_room_item", itemBuilding)
			setTimeout(() => { $("#houseBuildRoomItem").click() }, vars.buttonDelay)
		}, vars.startActionsDelay)
	}

	const upgradeItem = () => {
		setTimeout(() => {
			if ($("#houseRoomItemUpgradeTier").is(":visible")) { // If tier upgrade is available, upgrade it
				if (vars.verbose) log("Upgrading item tier")
				$(document).one("roa-ws:page:house_room_item_upgrade_tier", itemBuilding)
				setTimeout(() => { $("#houseRoomItemUpgradeTier").click() }, vars.buttonDelay)
			} else { // Else do a regular upgrade
				if (vars.verbose) log("Upgrading fastest item")
				$(document).one("roa-ws:page:house_room_item_upgrade_level", itemBuilding)
				setTimeout(() => { $("#houseRoomItemUpgradeLevel").click() }, vars.buttonDelay)
			}
		}, vars.startActionsDelay)
	}

	const itemBuilding = () => {
		setTimeout(() => {
			vars.actionsPending = false
			$(".closeModal").click()
		}, vars.startActionsDelay)
	}

	const startHarvestron = () => {
		if (vars.verbose) log("Starting Harvestron job")
		$("#houseHarvestingJobStart").click()
		setTimeout(itemBuilding, vars.buttonDelay)
	}

	const checkCraftingQueue = (_, data) => {
		if (vars.actionsPending || !vars.autoCraft) return

		if (data.results.a.cq < vars.minCraftingQueue) {
			if (vars.verbose) log(`There are less than ${vars.minCraftingQueue} items in the crafting queue. Refilling now`)
			vars.actionsPending = true
			setTimeout(() => {
				// For some weird reason, .click() does not work here ¯\_(ツ)_/¯
				$(".craftingTableLink")[0].dispatchEvent(new Event("click"))
			}, vars.buttonDelay)
			$(document).one("roa-ws:page:house_room_item", () => {
				setTimeout(() => {
					$("#craftingItemLevelMax").click()
					setTimeout(() => {
						$("#craftingQuality").val(0) // Set to poor quality
						$("#craftingJobFillQueue").attr("checked", "true")
						$("#craftingJobStart").click()
					}, vars.buttonDelay)
				}, vars.startActionsDelay)
				$(document).one("roa-ws:page:craft_item", itemBuilding)
			})
		}
	}

	// Check action results for needed actions
	const checkResults = (_, data) => {
		data = data.results.p

		if (vars.autoStamina && data.autos_remaining < vars.minStamina && !staminaCooldown) { // Stamina
			if (vars.verbose) log("Replenishing stamina")
			$("#replenishStamina").click()
			staminaCooldown = true
			setTimeout(() => {staminaCooldown = false}, 2500)
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
				setTimeout(() => { $("a.questCenter")[0].click() }, vars.buttonDelay)
				return
			}
		}
		if (vars.autoHouse && data.can_build_house) { // Construction
			vars.actionsPending = true
			$(document).one("roa-ws:page:house", selectBuild)
			$("li#housing").click()
			return
		}
		if (vars.autoHouse && data.can_house_harvest) { // Harvestron
			vars.actionsPending = true
			$(document).one("roa-ws:page:house_room_item", startHarvestron)
			$("#harvestronNotifier")[0].click()
			return
		}
	}

	$(document).on("roa-ws:battle roa-ws:harvest roa-ws:carve roa-ws:craft roa-ws:event_action", checkResults)
	$(document).on("roa-ws:craft", checkCraftingQueue)

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

	function delay(ms) {
		return new Promise(resolve => {
			setTimeout(resolve, ms)
		})
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
		$(document).off("roa-ws:boss", changeTrade)
	}

	function joinEvent(msgContent, msgID) {
		if (vars.joinEvents && eventID !== msgID && !eventInProgress && (msgContent === "InitEvent" || msgContent === "MainEvent")) {
			eventID = msgID
			mainEvent = msgContent === "MainEvent"
			eventInProgress = true

			if (vars.verbose) log(`Joining ${mainEvent ? "main" : "regular"} event due to message #${msgID}`)
			BUTTONS[mainTrade].click()
			$(document).on("roa-ws:boss", changeTrade)
		}
	}

	setTimeout(() => {
		$(document).on("roa-ws:message", async (_, data) => {
			if (data.c_id === vars.eventChannelID) {
				await delay(vars.startActionsDelay)
				// Wait to see if the message is recieved together with a message of the day,
				// which means it was only sent due to a chat reconnection, and we should not join the event.
				if (motdReceived === false) {
					joinEvent(data.m, data.m_id)
				}
			}
		})
	}, 30000) // Start after a delay to avoid being triggered by old messages

	// Avoid joining events after chat reconnections
	$(document).on("roa-ws:motd", async () => {
		motdReceived = true
		await delay(vars.startActionsDelay * 5)
		motdReceived = false
	})
}
