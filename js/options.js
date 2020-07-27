"use strict"

let vars = null

function abbreviateNumber(num) {
	const round = num => Math.round(num*1000)/1000

	if(num >= 1000000000000000) {
		return round(num/1000000000000000)+"Q"
	}
	if(num >= 1000000000000) {
		return round(num/1000000000000)+"T"
	}
	if(num >= 1000000000) {
		return round(num/1000000000)+"B"
	}
	if(num >= 1000000) {
		return round(num/1000000)+"M"
	}
	if(num >= 1000) {
		return round(num/1000)+"K"
	}
	return round(num)
}

function deabbreviateNumber (input) {
	if (typeof input !== "string") return input

	const regex = /^([0-9,.]+)(k|m|b|t|q)?$/gi
	const parts = regex.exec(input)
	const numPart = parts[1]
	const scale = (parts[2] || "").toUpperCase()

	if (!scale) return input

	const num = parseFloat(numPart.replace(/[^0-9.]/g, ""))
	const scales = {
			K: 1000,
			M: 1000000,
			B: 1000000000,
			T: 1000000000000,
			Q: 1000000000000000,
		}

	if (!scales[scale]) return input

	return num * scales[scale]
}

function displayMessage(message, time=2500) {
	$("#form-buttons-output").text(message)
	$("#form-buttons-output").fadeIn(250)

	setTimeout( () => {
		$("#form-buttons-output").fadeOut(750, () => {$("#form-buttons-output").text("")} )
	}, time)
}

async function fillFields() {
	vars = await browser.storage.sync.get()
	if (browser.contextualIdentities === undefined) {
		$(`.requires-containers`).html(`<td colspan="2">This feature requires Container Tabs. Please enable Container tabs in Browser Options -&gt; Tabs -&gt; Enable Container Tabs, and reload the page.</td>`)
	} else {
		fillContainers()
	}

	$("#alt-name")          .val(vars.altBaseName)
	$("#attack-at")         .val(vars.attackAt)
	$("#name-list")         .val(vars.namesList.join(", "))
	$("#login-pass")        .val(vars.loginPassword)
	$("#custom-css")        .val(vars.css.custom)
	$("#min-stamina")       .val(vars.minStamina)
	$("#alts-number")       .val(vars.altsNumber)
	$("#alt-name-type")     .val(vars.pattern)
	$("#main-username")     .val(vars.mainUsername)
	$("#wire-frequency")    .val(vars.wireFrequency)
	$("#daily-crystals")    .val(vars.daily-crystals)
	$("#event-channel-id")  .val(vars.eventChannelID)
	$("#main-account-name") .val(vars.mainAccount)
	$("#min-crafting-queue").val(vars.minCraftingQueue)

	$("#verbose")          .prop("checked", vars.verbose)
	$("#auto-wire")        .prop("checked", vars.autoWire)
	$("#auto-house")       .prop("checked", vars.autoHouse)
	$("#auto-craft")       .prop("checked", vars.autoCraft)
	$("#auto-event")       .prop("checked", vars.joinEvents)
	$("#append-name")      .prop("checked", vars.addUsername)
	$("#wire-button")      .prop("checked", vars.addRequestMoney)
	$("#auto-quests")      .prop("checked", vars.autoQuests)
	$("#auto-stamina")     .prop("checked", vars.autoStamina)
	$("#add-open-tabs")    .prop("checked", vars.addOpenTabs)
	$("#add-login-alts")   .prop("checked", vars.addLoginAlts)
	$("#alt-jump-button")  .prop("checked", vars.addJumpMobs)
	$("#containers-auto")  .prop("checked", vars.containers.useAll)
	$("#alt-spawn-button") .prop("checked", vars.addSpawnGems)
	$("#auto-house-custom").prop("checked", vars.addCustomBuild)

	for (const currency of vars.currencySend) {
		const name = currency.name.replace("_", "-")
		$(`#${name}-keep`).val(abbreviateNumber(currency.keepAmount))
		$(`#${name}-keep`).prop("title", currency.keepAmount)
		$(`#${name}-send`).prop("checked", currency.send)
	}

	for (const trade of Object.keys(vars.tradesList)) {
		$(`#${trade}`).val(vars.tradesList[trade].join(", "))
	}

	updatePrice()
	displayAltFields()
}

async function saveChanges() {
	try {
		if ($("#settings")[0].reportValidity() === false) {
			const invalid = $(":invalid")[1] // First invalid field
			const table = $("table").has(`#${invalid.id}`)[0].id // Containing table id
			$(`#${table}-tab-button`).click() // Go to its tab

			console.error("Form is invalid: First invalid field found is", invalid)
			setTimeout(() => {$("#settings")[0].reportValidity()})
			throw new Error("Form is invalid")
		}

		vars.pattern        = $("#alt-nameType").val()
		vars.namesList      = $("#name-list").val().split(', ')
		vars.css.custom     = $("#custom-css").val()
		vars.altBaseName    = $("#alt-name").val()
		vars.mainAccount    = $("#main-account-name").val()
		vars.mainUsername   = $("#main-username").val()
		vars.wireFrequency  = $("#wire-frequency").val()
		vars.loginPassword  = $("#login-pass").val()

		vars.verbose           = $("#verbose").prop("checked")
		vars.autoWire          = $("#auto-wire").prop("checked")
		vars.autoHouse         = $("#auto-house").prop("checked")
		vars.autoCraft         = $("#auto-craft").prop("checked")
		vars.joinEvents        = $("#auto-event").prop("checked")
		vars.autoQuests        = $("#auto-quests").prop("checked")
		vars.autoStamina       = $("#auto-stamina").prop("checked")
		vars.addJumpMobs       = $("#alt-jump-button").prop("checked")
		vars.addUsername       = $("#append-name").prop("checked")
		vars.addOpenTabs       = $("#add-open-tabs").prop("checked")
		vars.addLoginAlts      = $("#add-login-alts").prop("checked")
		vars.addSpawnGems      = $("#alt-spawn-button").prop("checked")
		vars.addCustomBuild    = $("#auto-house-custom").prop("checked")
		vars.addRequestMoney   = $("#wire-button").prop("checked")
		vars.containers.useAll = $("#containers-auto").prop("checked")

		vars.attackAt         = $("#attack-at").val() || 3
		vars.altsNumber       = parseInt($("#alts-number").val()) || 0
		vars.minStamina       = $("#min-stamina").val() || 5
		vars.dailyCrystals    = parseInt($("#daily-crystals").val()) || 0
		vars.eventChannelID   = $("#event-channel-id").val() || 3202
		vars.minCraftingQueue = parseInt($("#min-crafting-queue").val()) || 0

		vars.containers.list = $("[name=containers]:checked").get().map(e => e.id) // Get id's of checked containers

		for (const currency of vars.currencySend) {
			const name = currency.name.replace("_", "-")
			const keepAmount = $(`#${name}-keep`).val() || 0
			currency.keepAmount = deabbreviateNumber(keepAmount)
			currency.send = $(`#${name}-send`).prop("checked")
		}

		for (const trade of Object.keys(vars.tradesList)) {
			vars.tradesList[trade] = $(`#${trade}`).val().split(", ")
		}

		await browser.storage.sync.set(vars)
		fillFields()

		displayMessage("Changes saved")
	}
	catch (error) {
		displayMessage(`Error: ${error.message}`)
		console.error(error)
	}
}

function cancelChanges() {
	try {
		fillFields()
		displayMessage("Cancelled changes")
	}
	catch (error) {
		displayMessage(`Error: ${error.message}`)
		console.error(error)
	}
}

function updatePrice() {
	const price = n => (n * (2 * 2000000 + (n - 1) * 1000000)) / 2
	const number = parseInt($("#daily-crystals").val())
	$("#daily-crystals-price").text(abbreviateNumber(price(number)))
	$("#daily-crystals + div").prop("title", Intl.NumberFormat().format(price(number)) )
}

function displayAltFields() {
	const value = $("#alt-name-type").val()
	if (value === "") {
		$("#number").hide()
		$("#alts-base-name").hide()
		$("#alts-unique-names").hide()
	} else if (value === "roman" || value === "romanCaps") {
		$("#number").show()
		$("#alts-base-name").show()
		$("#alts-unique-names").hide()
	} else if (value === "unique") {
		$("#number").hide()
		$("#alts-base-name").hide()
		$("#alts-unique-names").show()
	}
}

function changeTab(event) {
	const tabID = event.target.id.replace("-tab-button", "")

	for (const tab of document.querySelectorAll(".tab")) {
		tab.classList.remove("selected")
	}
	$(`#${tabID}`)[0].classList.add("selected")

	for (const button of document.querySelectorAll(`.tab-button`)) {
		button.classList.remove("selected")
	}
	$(`#${tabID}-tab-button`)[0].classList.add("selected")

}

function resetCSS() {
	$("#custom-css").val(
`#areaContent {
	height: 350px;
}
#questInfo {
	font-size: 0.95em;
}
.navSection li {
	line-height: 25px;
}`)
}

async function fillContainers() {
	const containers = await browser.contextualIdentities.query({}) // Get all containers
	if (containers.length === 0) { // If there are no containers, return
		$("#containers").text("No containers found")
		return
	}

	if ($("[name=containers]").length === 0) { // Only add checkboxes if they don't exist already
		for (const container of containers) {
			const name = container.name
			$("#containers").append(`<input id="${name}" name="containers" type="checkbox"><span id="${name}-icon" class="container-icon"></span><label for="${name}">${name}</label><br>`)
			$(`#${name}-icon`).css({"background-color": container.color, "mask": `url(${container.iconUrl})`, "mask-size": "100%"})
		}
	}

	for (const container of vars.containers.list) { // Check all containers previously saved
		$(`#${container}`).prop("checked", true)
	}
}

$(fillFields)
$("#reset-css").click(resetCSS)
$(".tab-button").click(changeTab)
$("#save-changes").click(saveChanges)
$("#cancel-changes").click(cancelChanges)
$("#daily-crystals").on("input", updatePrice)
$("#alt-name-type").on("input", displayAltFields)

browser.storage.onChanged.addListener(changes => {
	for (const change of Object.getOwnPropertyNames(changes)) {
		if (["autoQuests", "autoHouse", "autoCraft"].includes(change)) {
			return
		}
		fillFields()
	}
})