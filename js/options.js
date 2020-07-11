var vars

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
	
	$("#mainAccountName")	.val(vars.mainAccount)
	$("#mainUsername") 		.val(vars.mainUsername)
	$("#loginPass") 		.val(vars.loginPassword)
	$("#minCraftingQueue")	.val(vars.minCraftingQueue)
	$("#dailyCrystals") 	.val(vars.dailyCrystals)
	$("#altNameType") 		.val(vars.pattern)
	$("#altsNumber") 		.val(vars.altsNumber)
	$("#altName") 			.val(vars.altBaseName)
	$("#namesList") 		.val(vars.namesList.join(", "))
	
	$("#autoWire").prop("checked", vars.autoWire)
	
	for (let currency of vars.currencySend) {
		$(`#${currency.name}Keep`).val(abbreviateNumber(currency.keepAmount))
		$(`#${currency.name}Keep`).prop("title", currency.keepAmount)
		$(`#${currency.name}Send`).prop("checked", currency.send)
	}

	for (let trade of Object.keys(vars.tradesList)) {
		$("#"+trade).val(vars.tradesList[trade].join(", "))
	}
	
	updatePrice()
	displayAltFields()
}

async function saveChanges() {
	try {
		if ($("#settings")[0].reportValidity() === false) {
			throw "Form is invalid"
		}

		vars.mainAccount 	  = $("#mainAccountName").val()
		vars.mainUsername 	  = $("#mainUsername").val()
		vars.loginPassword 	  = $("#loginPass").val()
		vars.minCraftingQueue = parseInt($("#minCraftingQueue").val())
		vars.dailyCrystals 	  = parseInt($("#dailyCrystals").val())
		vars.pattern 		  = $("#altNameType").val()
		vars.altsNumber 	  = parseInt($("#altsNumber").val())
		vars.altBaseName 	  = $("#altName").val()
		vars.namesList 		  = $("#namesList").val().split(', ')
		vars.autoWire 		  = $("#autoWire").prop("checked")

		for (let i = 0; i < vars.currencySend.length; i++) {
			let keepAmount = $(`#${vars.currencySend[i].name}Keep`).val()
			vars.currencySend[i].keepAmount = deabbreviateNumber(keepAmount)
			vars.currencySend[i].send = $(`#${vars.currencySend[i].name}Send`).prop("checked")
		}

		for (trade of Object.keys(vars.tradesList)) {
			vars.tradesList[trade] = $("#"+trade).val().split(", ")
		}

		await browser.storage.sync.set(vars)
		fillFields()

		displayMessage("Changes saved")
	}
	catch (error) {
		displayMessage("Error: "+error.message)
		console.error(error)
	}
}

function cancelChanges() {
	try {
		fillFields()
		displayMessage("Cancelled changes")
	}
	catch (error) {
		displayMessage("Error: "+error.message)
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

$(fillFields)
$("#altNameType").on("input", displayAltFields)
$("#saveChanges").click(saveChanges)
$("#cancelChanges").click(cancelChanges)
$("#dailyCrystals").on("input", updatePrice)

browser.storage.onChanged.addListener( changes => {
	for (change in Object.getOwnPropertyNames(changes)) {
		if ( ["doQuests", "doBuildingAndHarvy", "doCraftQueue"].includes(change) ) {
			return
		}
		fillFields()
	}
})