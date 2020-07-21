"use strict"

let vars = null

function abbreviateNumber(num) {
	let round = num => Math.round(num*1000)/1000

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

	let regex = /^([0-9,.]+)(k|m|b|t|q)?$/gi,
		parts = regex.exec(input),
		numPart = parts[1],
		scale = (parts[2] || "").toUpperCase()

	if (!scale) return input

	let num = parseFloat(numPart.replace(/[^0-9.]/g, "")),
		scales = {
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
	$("#formButtonsOutput").text(message)
	$("#formButtonsOutput").fadeIn(250)

	setTimeout( () => {
		$("#formButtonsOutput").fadeOut(750, () => {$("#formButtonsOutput").text("")} )
	}, time)
}

async function fillFields() {
	vars = await browser.storage.sync.get()
	if (browser.contextualIdentities === undefined) {
		let disabled = ["containers", "alt", "wire"]
		for (let table of disabled) {
			$(`#${table}`).html("This feature requires Container Tabs.<br>Please enable Container tabs in Browser Options -&gt; Tabs -&gt; Enable Container Tabs, and reload the page.")
		}
	}
	else {
		fillContainers()
	}

	$("#altName")         .val(vars.altBaseName)
	$("#loginPass")       .val(vars.loginPassword)
	$("#namesList")       .val(vars.namesList.join(", "))
	$("#customCSS")       .val(vars.css.custom)
	$("#altsNumber")      .val(vars.altsNumber)
	$("#altNameType")     .val(vars.pattern)
	$("#mainUsername")    .val(vars.mainUsername)
	$("#wireFrequency")   .val(vars.wireFrequency)
	$("#dailyCrystals")   .val(vars.dailyCrystals)
	$("#mainAccountName") .val(vars.mainAccount)
	$("#minCraftingQueue").val(vars.minCraftingQueue)

	$("#verbose").prop("checked", vars.verbose)
	$("#autoWire").prop("checked", vars.autoWire)
	$("#containersAuto").prop("checked", vars.containers.useAll)

	for (let currency of vars.currencySend) {
		$(`#${currency.name}Keep`).val(abbreviateNumber(currency.keepAmount))
		$(`#${currency.name}Keep`).prop("title", currency.keepAmount)
		$(`#${currency.name}Send`).prop("checked", currency.send)
	}

	for (let trade of Object.keys(vars.tradesList)) {
		$(`#${trade}`).val(vars.tradesList[trade].join(", "))
	}

	updatePrice()
	displayAltFields()
}

async function saveChanges() {
	try {
		if ($("#settings")[0].reportValidity() === false) {
			let invalid = $(":invalid")[1], //get first invalid field
				table = $(`table:has(#${invalid.id})`)[0].id //get containing table id
			$(`#${table}TabButton`).click() //go to its tab

			console.error("Form is invalid: First invalid field found is", invalid)
			setTimeout(() => {$("#settings")[0].reportValidity()})
			throw new Error("Form is invalid")
		}

		vars.altBaseName       = $("#altName").val()
		vars.loginPassword     = $("#loginPass").val()
		vars.css.custom        = $("#customCSS").val()
		vars.pattern           = $("#altNameType").val()
		vars.mainUsername      = $("#mainUsername").val()
		vars.wireFrequency     = $("#wireFrequency").val()
		vars.mainAccount       = $("#mainAccountName").val()
		vars.namesList         = $("#namesList").val().split(', ')
		vars.verbose           = $("#verbose").prop("checked")
		vars.autoWire          = $("#autoWire").prop("checked")
		vars.containers.useAll = $("#containersAuto").prop("checked")
		vars.altsNumber        = parseInt($("#altsNumber").val()) || 0
		vars.dailyCrystals     = parseInt($("#dailyCrystals").val()) || 0
		vars.minCraftingQueue  = parseInt($("#minCraftingQueue").val()) || 0
		vars.containers.list   = $("[name=containers]:checked").get().map(e => e.id) //get id's of checked containers

		for (let i = 0; i < vars.currencySend.length; i++) {
			let keepAmount = $(`#${vars.currencySend[i].name}Keep`).val() || 0
			vars.currencySend[i].keepAmount = deabbreviateNumber(keepAmount)
			vars.currencySend[i].send = $(`#${vars.currencySend[i].name}Send`).prop("checked")
		}

		for (let trade of Object.keys(vars.tradesList)) {
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
	let price = n => (n * (2 * 2000000 + (n - 1) * 1000000)) / 2
	let number = parseInt($("#dailyCrystals").val())
	$("#dailyCrystalsPrice").text(abbreviateNumber(price(number)))
	$("#dailyCrystals + div").prop("title", Intl.NumberFormat().format(price(number)) )
}

function displayAltFields() {
	let value = $("#altNameType").val()
	if (value === "") {
		$("#number").hide()
		$("#altsBaseName").hide()
		$("#altsUniqueNames").hide()
	} else if (value === "roman" || value === "romanCaps") {
		$("#number").show()
		$("#altsBaseName").show()
		$("#altsUniqueNames").hide()
	} else if (value === "unique") {
		$("#number").hide()
		$("#altsBaseName").hide()
		$("#altsUniqueNames").show()
	}
}

function changeTab(event) {
	let tabID = event.target.id.replace("TabButton", "")

	for (let tab of document.querySelectorAll(".tab")) {
		tab.classList.remove("selected")
	}
	$(`#${tabID}`)[0].classList.add("selected")

	for (let button of document.querySelectorAll(`.tabButton`)) {
		button.classList.remove("selected")
	}
	$(`#${tabID}TabButton`)[0].classList.add("selected")

}

function resetCSS() {
	$("#customCSS").val(
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
	let containers = await browser.contextualIdentities.query({}) //get all containers
	if (containers.length === 0) { //if there are no containers, abort
		$("#containers").text("No containers found")
		return
	}

	if ($("[name=containers]").length === 0) { //only add checkboxes if they don't exist already
		for (let container of containers) {
			let name = container.name
			$("#containers").append(`<input id="${name}" name="containers" type="checkbox"><span id="${name}Icon" class="containerIcon"></span><label for="${name}">${name}</label><br>`)
			$(`#${name}Icon`).css({"background-color": container.color, "mask": `url(${container.iconUrl})`, "mask-size": "100%"})
		}
	}

	for (let container of vars.containers) { //check all containers previously saved
		$(`#${container}`).prop("checked", true)
	}

	if (vars.containers[0] === "betabot-default") { //if there were no changes to the default, check all
		$("[name=containers]").prop("checked", true)
	}
}

$(fillFields)
$("#resetCSS").click(resetCSS)
$(".tabButton").click(changeTab)
$("#saveChanges").click(saveChanges)
$("#cancelChanges").click(cancelChanges)
$("#dailyCrystals").on("input", updatePrice)
$("#altNameType").on("input", displayAltFields)

browser.storage.onChanged.addListener(changes => {
	for (change in Object.getOwnPropertyNames(changes)) {
		if ( ["doQuests", "doBuildingAndHarvy", "doCraftQueue"].includes(change) ) {
			return
		}
		fillFields()
	}
})