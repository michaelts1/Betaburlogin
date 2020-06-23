/*~~~To Do:~~~
 * Add custom CSS style
 * Spawn gems for all alts
 * Automatic wiring (once every hour?)
 * Allow on/off toggling for all features
 * Make keepUsernameVisible actually work
 * Reformat options page, it's too long currently
 * Use optional chaining in checkResults quest section
 * Move root "if" statements contents to their own functions
 * 
 *~~~Needs Testing:~~~
 */

"use strict"
var port
let url = window.location.href

if ( /^https:\/\/www.avabur.com\/\??e?x?p?i?r?e?d?=?1?$/.test(url) ) { //live login page
	port = browser.runtime.connect({name: "live"})
	$("#login_notification").html(`<button id="openAltTabs">open all alt tabs</button>`)
	$("#openAltTabs").click( () => {port.postMessage({text: "open alt tabs"}) })
}

if ( /^https:\/\/beta.avabur.com\/\??e?x?p?i?r?e?d?=?1?$/.test(url) ) { //beta login page
	port = browser.runtime.connect({name: "login"})

	function login(username, password) {
		$("#acctname").val(username)
		$("#password").val(password)
		$("#login").click()

		setTimeout( () => {
			if ( $("#login_notification").text() === "Your location is making too many requests too quickly.  Try again later.") {
				login(username, password)
			}
		}, 7500)
	}
	port.onMessage.addListener( message => {
		if (message.text === "login") {
			login(message.username, message.password)
		}
	})
	$("#login_notification").html(`<button id="loginAlts">login all alts</button>`)
	$("#loginAlts").click( () => {port.postMessage({text: "requesting login"}) })
}

if ( /^https:\/\/beta.avabur.com\/game$/.test(url) ) { //beta game page
	let port2, // used for communicating with the background page
		username 		= $("#username").text(),
		vars 	 		= undefined,
		isAlt 	 		= undefined,
		betabotCooldown = false,
		mainTrade 		= null

	/*forbid the extension from running on certain alts:
	let forbiddenAlts = ["michaelts", "michaeltsI","michaeltsII", "michaeltsIII", "michaeltsIV", "michaeltsV", "michaeltsVI"]
	if (forbiddenAlts.includes(username)) throw `ERROR: one of ${forbiddenAlts}`*/

	//connect to background script:
	port = browser.runtime.connect({name: username})
	port.onMessage.addListener( message => {
		if (message.text === "send currency") wire(message.recipient)
		if (message.text === "jump mobs") jumpMobs(message.number)
		if (message.text === "buy crystals now") autoBuyCrys()
		if (message.text === "spawn gems") spawnGems(message.tier, message.type, message.splice, message.amount)
	})

	//set vars:
	function setVar(key, value) {
		vars[key] = value
		port.postMessage({text:"setKey", key: key, value: value})
	}

	//get vars from sync storage:
	function getVars() {//using a promise because i need to be able to use .then()
		return new Promise( async resolve => {
			vars = await browser.storage.sync.get()
			isAlt = username !== vars.mainUsername
			mainTrade = getTrade()
			resolve()
		})
	}
	browser.storage.onChanged.addListener(getVars)

	function jumpMobs(number) {
		setTimeout( () => {
			$("#battleGrounds").click()
			$(document).one("roa-ws:page:town_battlegrounds", () => {
				setTimeout( () => {
					$(`#enemyList>option[value|=${number}]`).attr("selected","selected")
					setTimeout( () => {
						$("#autoEnemy").click()
					}, vars.buttonDelay)
				}, vars.buttonDelay)
			})
		}, vars.startActionsDelay)
	}
	
	function spawnGems(tier, type, splice, amount) {
		$(document).one("roa-ws:modalContent", (e, d) => {
			if (d.title === "Spawn Gems") {
				setTimeout( () => {
					$("#spawnGemLevel").val(tier)
					$("#gemSpawnType").val(type)
					$("#gemSpawnSpliceType").val(splice)
					$("#gemSpawnCount").val(amount)
					setTimeout( () => {
						$("#gemSpawnConfirm").click()
					}, vars.buttonDelay)
					$(document).one("roa-ws:page:gem_spawn", (e,d) => {
						$("#betabotSpawnGem").prop("disabled", true)
						setTimeout( () => {
							$("#confirmButtons>a.green").click()
						},vars.buttonDelay)
						setTimeout( () => { //re-enable after 60 seconds
							$("#betabotSpawnGem").prop("disabled", false)
						}, 65000)
					})
				}, vars.startActionsDelay)
			}
		})
		if ( $("#modal2Wrapper").is(":visible") && $("#modal2Title").text() === "Spawn Gems") {
			$(document).trigger("roa-ws:modalContent",{title:"Spawn Gems"})
		}
		else {
			itemBuilding()
			$("#chatMessage").text("/spawngem")
			$("#chatSendMessage").click()
		}
	}
		
	//only run on alts:
	getVars().then( () => {
		if(!isAlt) return
		//jump mobs:
		if ($("#betabotMobJump")[0] === undefined) {
			$("#autoEnemy").after(`
			<div class="mt10" id="betabotMobJump" style="display: block;">
				<input id="betabotMobJumpNumber" type="number" size=1>
				<input id="betabotMobJumpButton" type="button" value="Jump Mobs">
			</div>
			`)
		}
		$("#betabotMobJumpButton").click( () => {
			//:selected won't work here, since we want the last monster won, not
			//the currently selected mob
			let number = parseInt($("#enemyList>option[selected]").val()) + parseInt($("#betabotMobJumpNumber").val()),
				maxNumber = parseInt($(`#enemyList>option:last-child`).val())
			if (number > maxNumber) {
				$("#areaName").text("the mob you chose is not in the list!")
				return
			}
			port.postMessage({text:"move to mob", number: number})
		})

		/*
		//spawn gems:
		$(document).on("roa-ws:modalContent", (e, d) => {
			if (d.title === "Spawn Gems") {
				if ($("#betabotSpawnGem")[0] === undefined) {
					$("#gemSpawnConfirm").after(`
						<input id="betabotSpawnGem" type="button" style="padding:6.5px" value="Spawn For All Alts">
					`)
				}
				$("#betabotSpawnGem").off("click")
				$("#betabotSpawnGem").on("click", () => {
					port.postMessage({
						text  : "spawnGem",
						tier  : parseInt($("#spawnGemLevel").val()),
						type  : parseInt($("#gemSpawnType").val()),
						splice: parseInt($("#gemSpawnSpliceType").val()),
						amount: parseInt($("#gemSpawnCount").val())
					})
				})
			}
		})*/
	})

	//make it easier to see what alt it is:
	let keepUsernameVisible = new MutationObserver( (mutationsList, observer) => {
		if ( $("#roomName").text().search(username) === -1 ) {
			$("#roomName").append(`: <span id="clearUsername">${username}</span>`)
	} })
	setTimeout( () => {keepUsernameVisible.observe($("#roomName")[0], {attributes:true, childList:true, subtree:true})}, 1000)

	//make it easier to send currency:
	function wire(target) {
		if (target === username) return
		let sendMessage = `/wire ${target}`

		for (let currency of vars.currencySend) {
			if (currency.send === false) continue

			let amount = $(`.${currency.name}`).attr("title").replace(/,/g, ""),
				sellable = $(`.${currency.name}`).attr("data-personal").replace(/,/g, ""),
				amountToSend = 0

			//leave this amount for the alt
			amountToSend = amount - currency.keepAmount

			//if we want to send more than we can, only send what we can
			if (amountToSend > sellable) {
				amountToSend = sellable
			}

			//only send if we have the minimum amount
			if (amountToSend > currency.minimumAmount) {
				sendMessage += ` ${amountToSend} ${currency.name},`
			}
		}

		if (sendMessage !== `/wire ${target}`) {
			$("#chatMessage").text(sendMessage)
			$("#chatSendMessage").click()
		}
	}

	if ($("#sendMeCurrency")[0] === undefined) {
		$("#username").after(`<button id="sendMeCurrency"><a>Send me currency</a></button>`)
	}
	$("#sendMeCurrency").click( () => {port.postMessage({text:"requesting currency"}) })

	//RoA-WS courtesy of @Reltorakii:
	//re-inject the script
	if ($("#betabot-ws")[0] !== undefined) $("#betabot-ws").remove()

	let elm = document.createElement("script")
	elm.innerHTML = `
		//create a new channel
		var channel	= new MessageChannel()
		//send message to content script (do we even need to send port2?)
		window.postMessage("betabot-ws message", "*", [channel.port2])

		$(document).on("roa-ws:all", function(event, data){
			channel.port1.postMessage(JSON.parse(data))
		})
	`
	$(elm).attr("id", "betabot-ws")
	document.head.appendChild(elm)

	function onMessage(event) {
		let data = event.data
		var etype = "roa-ws:"
		for (var i = 0; i < data.length; i++) {
			etype = "roa-ws:"
			var etypepage = ""
			var item = data[i]
			if (item.hasOwnProperty("type")) {
				etype = etype + item.type
				// in case its a "page" type message create additional event
				// e.g.: "roa-ws:page:boosts", "roa-ws:page:clans" or "roa-ws:page:settings_milestones" etc.
				if (item.type === "page" && item.hasOwnProperty("page") && "string" === typeof item.page) {
					etypepage = etype + ":" + item.page
				}
			} else {
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
		let origin 	= message.originalEvent.origin,
			data 	= message.originalEvent.data
		//make sure we are connecting to the right port!
		if (origin === "https://beta.avabur.com" && data === "betabot-ws message") {
			port2 = message.originalEvent.ports[0]
			port2.onmessage = onMessage
		}
	})

	//Betabot based on @Batosi's bot:
	
	//add option to build a specific item:
	if ($("#selectBuild")[0] === undefined) {
		$( $("div > #allHouseUpgrades")[0].parentNode ).after(`
		<div id="selectBuild" class="col-md-12 mt10">
			<input id="customBuild" type="checkbox">
			<label for="customBuild"><a>Build a specific item:</a></label>
			<input id="itemId" placeholder="item id" type="text" size="3" pattern="^\\d*$">
		</div>
		`)
	}

	function autoBuyCrys(){
		if (vars.dailyCrystals === 0) return
		vars.actionsPending = true
		setTimeout(() => { $("#premiumShop").click() }, vars.startActionsDelay)
		$(document).one("roa-ws:page:boosts", () => {
			setTimeout( () => {
				$("#goldCrystalButton").click()
				setTimeout( () => {
					$("#premium_purchase_gold_count").val(vars.dailyCrystals)
					$("#premium_purchase_gold_button").click()
					setTimeout(itemBuilding, vars.buttonDelay)
				}, vars.buttonDelay)
			}, vars.buttonDelay)
		})
		$(document).one("roa-ws:page:purchase_crystals_gold", itemBuilding)
	}
	setInterval(autoBuyCrys, 1000*60*60*24) //once a day
	
	let finishQuest = () => {
		setTimeout(() => {
			$(`input.completeQuest[data-questtype=${vars.questCompleting}]`).click() //complete the quest
			$(document).one("roa-ws:page:quests", () => {
				setTimeout(() => {
					$(`input.questRequest[data-questtype=${vars.questCompleting}][value="Begin Quest"]`).click() //start new quest
					$(document).one("roa-ws:page:quests", () => { //close the quest window
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

	let selectBuild = () => {
		setTimeout(() => {
			let itemId = parseInt($("#itemId").val())
			if ($("#customBuild").is(":checked") && itemId > 0) {
				$(document).one("roa-ws:page:house_all_builds", itemId, customBuild)
				setTimeout(() => { $("#allHouseUpgrades")[0].click() }, vars.buttonDelay)
			} else if ($("#houseRoomCanBuild").is(":visible")) { //if new room is available, build it
				$(document).one("roa-ws:page:house_build_room", itemBuilding)
				setTimeout(() => { $("#houseBuildRoom")[0].click() }, vars.buttonDelay)
			} else if ($("#houseQuickBuildList li:first .houseViewRoom").length === 1) { //if new item is available, build it
				$(document).one("roa-ws:page:house_room", buildItem)
				setTimeout(() => { $("#houseQuickBuildList li:first .houseViewRoom")[0].click() }, vars.buttonDelay)
			} else { //else, upgrade existing item
				$(document).one("roa-ws:page:house_room_item", upgradeItem)
				setTimeout(() => { $("#houseQuickBuildList li:first .houseViewRoomItem")[0].click() }, vars.buttonDelay)
			}
		}, vars.startActionsDelay)
	}

	let customBuild = event => {
		$(document).one("roa-ws:page:house_room_item", upgradeItem)
		setTimeout(() => {
			$(`#modal2Content a[data-itemtype=${event.data}]`)[0].click()
		}, vars.buttonDelay)
	}

	let buildItem = () => {
		setTimeout(() => {
			$(document).one("roa-ws:page:house_build_room_item", itemBuilding)
			setTimeout(() => { $("#houseBuildRoomItem").click() }, vars.buttonDelay)
		}, vars.startActionsDelay)
	}

	let upgradeItem = () => {
		setTimeout(() => {
			if ($("#houseRoomItemUpgradeTier").is(":visible")) { //if tier upgrade is available, upgrade it
				$(document).one("roa-ws:page:house_room_item_upgrade_tier", itemBuilding)
				setTimeout(() => { $("#houseRoomItemUpgradeTier").click() }, vars.buttonDelay)
			} else { //else do a regular upgrade
				$(document).one("roa-ws:page:house_room_item_upgrade_level", itemBuilding)
				setTimeout(() => { $("#houseRoomItemUpgradeLevel").click() }, vars.buttonDelay)
			}
		}, vars.startActionsDelay)
	}

	let itemBuilding = () => {
		$("#confirmOverlay > a.red").click() //if there is confirmation layer, close it.
		setTimeout(() => {
			vars.actionsPending = false
			$(".closeModal").click()
		}, vars.startActionsDelay)
	}

	let startHarvestron = () => {
		$("#houseHarvestingJobStart").click()
		setTimeout(itemBuilding, vars.buttonDelay)
	}

	let checkCraftingQueue = (event, data) => {
		if (vars.actionsPending || !vars.doCraftQueue) return
		if (data.results.a.cq < vars.minCraftingQueue) {
			vars.actionsPending = true
			setTimeout(() => {
				//for some weird reason, .click() does not work here ¯\_(ツ)_/¯
				$(".craftingTableLink")[0].dispatchEvent(new Event("click"));
			}, vars.buttonDelay)
			$(document).one("roa-ws:page:house_room_item", () => {
				setTimeout(() => {
					$("#craftingItemLevelMax").click()
					setTimeout(() => {
						$("#craftingQuality").val(0) //set to poor quality
						$("#craftingJobFillQueue").attr("checked", "true")
						$("#craftingJobStart").click()
					}, vars.buttonDelay)
				}, vars.startActionsDelay)
				$(document).one("roa-ws:page:craft_item", itemBuilding)
			})
		}
	}
	
	let checkResults = (event, data) => {
		data = data.results.p

		if (data.autos_remaining < 5 && !betabotCooldown){ //Stamina
			$("#replenishStamina").click()
			betabotCooldown = true
			setTimeout( () => {betabotCooldown = false}, 2500)
			return
		}

		//actions that should always be performed go before this
		if (vars.actionsPending) { //make sure there are no actions pending
			return
		}

		if (vars.doQuests) { //Quests
			if (data.bq_info2) {
				if (data.bq_info2.c >= data.bq_info2.r) {
					vars.questCompleting = "kill"
				}
			}
			if (data.tq_info2) {
				if (data.tq_info2.c >= data.tq_info2.r) {
					vars.questCompleting = "tradeskill"
				}
			}
			if (data.pq_info2) {
				if (data.pq_info2.c >= data.pq_info2.r) {
					vars.questCompleting = "profession"
				}
			}

			if (vars.questCompleting != null) {
				vars.actionsPending = true
				$(document).one("roa-ws:page:quests", finishQuest)
				setTimeout(() => {$("a.questCenter")[0].click()}, vars.buttonDelay)
				return
			}
		}
		if (vars.doBuildingAndHarvy && data.can_build_house) { //Construction
			vars.actionsPending = true
			$(document).one("roa-ws:page:house", selectBuild)
			$("li#housing").click()
			return
		}
		if (vars.doBuildingAndHarvy && data.can_house_harvest) { //Harvestron
			vars.actionsPending = true
			$(document).one("roa-ws:page:house_room_item", startHarvestron)
			$("#harvestronNotifier")[0].click()
			return
		}
	}

	$(document).on("roa-ws:battle roa-ws:harvest roa-ws:carve roa-ws:craft roa-ws:event_action", checkResults)
	$(document).on("roa-ws:craft", checkCraftingQueue)

	//auto event. orginally taken from: https://github.com/dragonminja24/betaburCheats/blob/master/betaburCheatsHeavyWeight.js
	let	eventLimiter 	= 0,
		carvingChanged 	= false,
		eventID 		= null,
		mainEvent 		= false

	//const CHANNEL = 3203 //debugging channel
	const CHANNEL = 3202 //"production" channel
	const BUTTONS = {
		battle 		: $(".bossFight.btn.btn-primary")[0],
		fishing 	: $(".bossHarvest.btn")[4],
		woodcutting : $(".bossHarvest.btn")[5],
		mining 		: $(".bossHarvest.btn")[6],
		stonecutting : $(".bossHarvest.btn")[7],
		crafting 	: $(".bossCraft.btn")[0],
		carving 	: $(".bossCarve.btn")[0]
	}

	function delay(time){
		return new Promise( resolve => {
			setTimeout(resolve, time)
		})
	}

	function getTrade() {
		for (let trade of Object.keys(vars.tradesList)) {
			if (vars.tradesList[trade].includes(username)) {
				return trade
			}
		}
		return "carving"
	}

	function changeTrade(){
		let time = $("#eventCountdown")[0].innerText,
			bossCarvingTier = $("#currentBossCarvingTier")[0].innerText

		if(bossCarvingTier > 2500 && !carvingChanged && !mainEvent){
			carvingChanged = true
			BUTTONS.battle.click()
		}

		if(time.includes("02m")) {
			if ( !isAlt || (isAlt && !mainEvent) ){
				BUTTONS.battle.click()
			}
			$("#eventCountdown").unbind()
			carvingChanged = false
			mainEvent = false
		}
	}

	async function joinEvent(msgContent, msgID){
		await delay(vars.startActionsDelay)
		if (eventLimiter === 0){
			if(msgContent === "InitEvent" || msgContent === "MainEvent"){
				eventLimiter += 1
				if (msgID !== eventID){	
					mainEvent = false
					if(msgContent === "MainEvent"){
						mainEvent = true
					}
					eventID = msgID

					BUTTONS[mainTrade].click()
					await delay(70000)
					$("#eventCountdown").bind("DOMSubtreeModified", changeTrade)
				}
			}
			await delay(vars.startActionsDelay)
			eventLimiter = 0
		}
	}
	
	setTimeout( () => {
		$(document).on("roa-ws:message", (event, data) => {
			if (data.c_id === CHANNEL) {
				joinEvent(data.m, data.m_id)
			}
		})
	}, 10000) //start after a delay to avoid being triggered by old messages

	//custom style:
	if ($("#betabot-css")[0] === undefined) {
		let elm2 = document.createElement("style")
		elm2.innerHTML = `
			#clearUsername {
				font-size: 25px;
				color: yellow;
				line-height: 10px;
			}

			#sendMeCurrency a {
				text-decoration: none;
				line-height: 10px;
				padding: 3px;
			}

			#betabotMobJumpButton {
				font-size: 14px;
				padding: 6.5px;
			}

			#sendMeCurrency {
				margin-left: 10px
			}

			#betabotBuyCrys {
				padding: 6.5px;
			}

			#areaContent {
				height: 354px;
			}

			#questInfo {
				font-size: 0.95em;
			}

			.navSection li {
				line-height: 25px;
			}

			#customBuild + label > a {
				text-decoration: none;
				padding: 3px;
			}
		`
		$(elm2).attr("id", "betabot-css")
		document.head.appendChild(elm2)
	}

	if ($("#effectInfo")[0] !== undefined) {
		$("#effectInfo").remove()
	}
}

console.log("betaburlogin finished evaluating")