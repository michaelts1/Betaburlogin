var vars

function abbreviateNumber(num) {
	let round = num => Math.round(num*1000)/1000
	
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

	let regex = /^([0-9,.]+)(k|m|b|t)?$/gi,
		parts = regex.exec(input),
		numPart = parts[1],
		scale = (parts[2] || "").toUpperCase()

	if (!scale) {
		return input
	}

	let num = parseFloat(numPart.replace(/[^0-9.]/g, "")),
		scales = {
			K: 1000,
			M: 1000000,
			B: 1000000000,
			T: 1000000000000,
		}

	if (!scales[scale]) {
		return input
	}

	return num * scales[scale]
}

async function fillFields() {
	vars = await browser.storage.sync.get()
	
	$("#mainAccountName")	.val(vars.mainAccount)
	$("#mainUsername")		.val(vars.mainUsername)
	$("#altsNumber")		.val(vars.altsNumber)
	$("#altName")			.val(vars.altBaseName)
	$("#loginPass")			.val(vars.loginPassword)
	$("#minCraftingQueue")	.val(vars.minCraftingQueue)
	$("#dailyCrystals")		.val(vars.dailyCrystals)
	
	for (currency of vars.currencySend) {
		$(`#${currency.name}Keep`).val(abbreviateNumber(currency.keepAmount))
		$(`#${currency.name}Keep`).prop("title", currency.keepAmount)
		$(`#${currency.name}Send`).prop("checked", currency.send)
	}
	
	updatePrice()
}

async function saveChanges() {
	try {
		vars.mainAccount 	  = $("#mainAccountName").val()
		vars.mainUsername 	  = $("#mainUsername").val()
		vars.altsNumber 	  = parseInt($("#altsNumber").val())
		vars.altBaseName 	  = $("#altName").val()
		vars.loginPassword 	  = $("#loginPass").val()
		vars.minCraftingQueue = parseInt($("#minCraftingQueue").val())
		vars.dailyCrystals 	  = parseInt($("#dailyCrystals").val())

		for (let i = 0; i < vars.currencySend.length; i++) {
			let keepAmount = $(`#${vars.currencySend[i].name}Keep`).val()
			vars.currencySend[i].keepAmount = deabbreviateNumber(keepAmount)
			vars.currencySend[i].send = $(`#${vars.currencySend[i].name}Send`).prop("checked")
		}
		
		await browser.storage.sync.set(vars)
		fillFields()
		
		$("#formButtonsOutput").text("Changes saved")
		setTimeout( () => {
			$("#formButtonsOutput").text("")
		}, 1000)
	}
	catch (e) {
		$("#formButtonsOutput").text("Error occured")
		setTimeout( () => {
			$("#formButtonsOutput").text("")
		}, 1000)
		console.error(e)
	}
}

function updatePrice() {
	let price = n => (n * (2 * 2000000 + (n - 1) * 1000000)) / 2
	let number = parseInt($("#dailyCrystals").val())
	$("#dailyCrystalsPrice").text(abbreviateNumber(price(number)))
}


$(fillFields)

$("#saveChanges").click(saveChanges)
$("#cancelChanges").click(fillFields)
$("#dailyCrystals").on("input", updatePrice)

browser.storage.onChanged.addListener( changes => {
	for (change in Object.getOwnPropertyNames(changes)) {
		if ( ["doQuests", "doBuildingAndHarvy", "doCraftQueue"].includes(change) ) {
			return
		}
		fillFields()
	}
})