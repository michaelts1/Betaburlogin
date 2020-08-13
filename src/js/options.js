"use strict"

/**
 * @file Options Page code
 */

/**
 * Stores the settings
 * @type {object}
 */
let vars = null

/**
 * Abbreviates a number into short form (e.g. 10000 => 10K)
 * @function abbreviateNumber
 * @param {number} num
 * @returns {string} Short form number
 */
function abbreviateNumber(num) {
	/**
	 * Rounds a number
	 * @function round
	 * @param {number} num
	 * @returns {number}
	 * @private
	 */
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

/**
 * Deabbreviates a number from short form (e.g. 10K => 10000)
 * @function deabbreviateNumber
 * @param {string} input A string containing a short form number
 * @returns {number} Long form number
 */
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

/**
 * Displays a message to the user under the form control buttons
 * @function displayMessage
 * @param {string} message A message to show to the user
 * @param {number} [time=2500] The amount of time (ms) that the message should be shown for. Defaults to 2500 ms
 */
function displayMessage(message, time=2500) {
	$("#form-buttons-output").text(message)
	$("#form-buttons-output").fadeIn(250)

	setTimeout( () => {
		$("#form-buttons-output").fadeOut(750, () => {$("#form-buttons-output").text("")} )
	}, time)
}

/**
 * Gets the settings from storage, and updates the displayed settings accordingly
 * @async
 * @function fillFields
 */
async function fillFields() {
	vars = await browser.storage.sync.get()
	if (browser.contextualIdentities === undefined) {
		$(`.requires-containers`).html(`<td colspan="2">This feature requires Container Tabs. Please enable Container tabs in Browser Options -&gt; Tabs -&gt; Enable Container Tabs, and reload the page.</td>`)
	} else {
		fillContainers()
	}

	$("#pattern")           .val(vars.pattern)
	$("#attack-at")         .val(vars.attackAt)
	$("#name-list")         .val(vars.namesList.join(", "))
	$("#custom-css")        .val(vars.css.custom)
	$("#min-stamina")       .val(vars.minStamina)
	$("#alts-number")       .val(vars.altsNumber)
	$("#main-account")      .val(vars.mainAccount)
	$("#main-username")     .val(vars.mainUsername)
	$("#alt-base-name")     .val(vars.altBaseName)
	$("#login-password")    .val(await insecureCrypt.decrypt(vars.loginPassword, "betabot Totally-not-secure Super NOT secret key!"))
	$("#wire-frequency")    .val(vars.wireFrequency)
	$("#daily-crystals")    .val(vars.dailyCrystals)
	$("#event-channel-id")  .val(vars.eventChannelID)
	$("#min-crafting-queue").val(vars.minCraftingQueue)

	$("#verbose")          .prop("checked", vars.verbose)
	$("#auto-wire")        .prop("checked", vars.autoWire)
	$("#auto-house")       .prop("checked", vars.autoHouse)
	$("#auto-craft")       .prop("checked", vars.autoCraft)
	$("#join-gauntlets")   .prop("checked", vars.joinGauntlets)
	$("#append-name")      .prop("checked", vars.addUsername)
	$("#auto-quests")      .prop("checked", vars.autoQuests)
	$("#auto-stamina")     .prop("checked", vars.autoStamina)
	$("#remove-banner")    .prop("checked", vars.removeBanner)
	$("#add-socket-x5")    .prop("checked", vars.addSocketX5)
	$("#add-open-tabs")    .prop("checked", vars.addOpenTabs)
	$("#add-jump-mobs")    .prop("checked", vars.addJumpMobs)
	$("#remove-effects")   .prop("checked", vars.removeEffects)
	$("#add-login-alts")   .prop("checked", vars.addLoginAlts)
	$("#add-spawn-gems")   .prop("checked", vars.addSpawnGems)
	$("#resume-crafting")  .prop("checked", vars.resumeCrafting)
	$("#auto-harvestron")  .prop("checked", vars.autoHarvestron)
	$("#containers-auto")  .prop("checked", vars.containers.useAll)
	$("#add-custom-build") .prop("checked", vars.addCustomBuild)
	$("#add-request-money").prop("checked", vars.addRequestMoney)

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

/**
 * Saves the displayed settings to storage
 * @async
 * @function saveChanges
 */
async function saveChanges() {
	try {
		if ($("#settings")[0].reportValidity() === false) {
			const invalid = $(":invalid")[1] // First invalid field
			const table = $("table").has(`#${invalid.id}`)[0].id // Containing table id
			$(`#${table}-tab-button`).click() // Go to tab

			console.error("Form is invalid: First invalid field found is", invalid)
			setTimeout(() => {$("#settings")[0].reportValidity()})
			throw new Error("Form is invalid")
		}

		vars.pattern        = $("#pattern").val()
		vars.css.custom     = $("#custom-css").val()
		vars.altBaseName    = $("#alt-base-name").val()
		vars.mainAccount    = $("#main-account").val()
		vars.mainUsername   = $("#main-username").val()
		vars.wireFrequency  = $("#wire-frequency").val()

		vars.verbose           = $("#verbose").prop("checked")
		vars.autoWire          = $("#auto-wire").prop("checked")
		vars.autoHouse         = $("#auto-house").prop("checked")
		vars.autoCraft         = $("#auto-craft").prop("checked")
		vars.joinGauntlets     = $("#join-gauntlets").prop("checked")
		vars.autoQuests        = $("#auto-quests").prop("checked")
		vars.addSocketX5       = $("#add-socket-x5").prop("checked")
		vars.autoStamina       = $("#auto-stamina").prop("checked")
		vars.addJumpMobs       = $("#add-jump-mobs").prop("checked")
		vars.addUsername       = $("#append-name").prop("checked")
		vars.addOpenTabs       = $("#add-open-tabs").prop("checked")
		vars.removeBanner      = $("#remove-banner").prop("checked")
		vars.addLoginAlts      = $("#add-login-alts").prop("checked")
		vars.addSpawnGems      = $("#add-spawn-gems").prop("checked")
		vars.removeEffects     = $("#remove-effects").prop("checked")
		vars.resumeCrafting    = $("#resume-crafting").prop("checked")
		vars.autoHarvestron    = $("#auto-harvestron").prop("checked")
		vars.addCustomBuild    = $("#add-custom-build").prop("checked")
		vars.addRequestMoney   = $("#add-request-money").prop("checked")
		vars.containers.useAll = $("#containers-auto").prop("checked")

		vars.attackAt         = parseInt($("#attack-at").val()) || 3
		vars.altsNumber       = parseInt($("#alts-number").val()) || 0
		vars.minStamina       = parseInt($("#min-stamina").val()) || 5
		vars.dailyCrystals    = parseInt($("#daily-crystals").val()) || 0
		vars.eventChannelID   = parseInt($("#event-channel-id").val()) || 3202
		vars.minCraftingQueue = parseInt($("#min-crafting-queue").val()) || 0

		vars.containers.list = $("[name=containers]:checked").get().map(e => e.id) // Get id's of checked containers

		$("#name-list").val() === "" ? vars.namesList = [] : vars.namesList = $("#name-list").val().split(", ")

		/**
		 * **Note: DO NOT trust this encryption**. it's very weak and uses a public key for encryption.
		 * There is a reason why there is still a warning about the password being saved in plain text.
		 * @name notEncrypted
		 */

		vars.loginPassword = await insecureCrypt.encrypt($("#login-password").val(), "betabot Totally-not-secure Super NOT secret key!")

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

/**
 * Reloads the settings from storage and updates the displayed settings
 * @function cancelChanges
 */
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

/**
 * Updates the displayed daily crystal prices
 * @function updatePrice
 */
function updatePrice() {
	/**
	 * Returns the cost of buying daily crystals in gold
	 * @function price
	 * @param {number} n Number of daily crystals
	 * @returns {number} Cost of daily crystals
	 * @private
	 */
	const price = n => (n * (2 * 2000000 + (n - 1) * 1000000)) / 2
	const number = parseInt($("#daily-crystals").val())
	$("#daily-crystals-price").text(abbreviateNumber(price(number)))
	$("#daily-crystals + div").prop("title", Intl.NumberFormat().format(price(number)) )
}

/**
 * Displays or hides the alt settings as needed
 * @function displayAltFields
 */
function displayAltFields() {
	const value = $("#pattern").val()
	if (value === "") {
		$("#number").hide()
		$("#alts-base-name").hide()
		$("#alts-unique-names").hide()
	} else if (value === "roman") {
		$("#number").show()
		$("#alts-base-name").show()
		$("#alts-unique-names").hide()
	} else if (value === "unique") {
		$("#number").hide()
		$("#alts-base-name").hide()
		$("#alts-unique-names").show()
	}
}

/**
 * Sets login-related settings as non-required/required
 * @function loginChanged
 */
function loginChanged() {
	const checked = $("#add-login-alts").prop("checked")
	$("#login .required")[`${checked ? "remove" : "add"}Class`]("hidden") // .removeClass() or .addClass(), respectively
	$("#login input[size=15],#pattern").get().forEach(elm => elm.required = checked)
}

/**
 * Switches settings tab
 * @function changeTab
 * @param {event} event Click event object
 */
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

/**
 * Resets the code in the custom css textarea
 * @function resetCSS
 */
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

/**
 * Gets all the containers from and lists them to the user
 * @async
 * @function fillContainers
 */
async function fillContainers() {
	const containers = await browser.contextualIdentities.query({}) // Get all containers
	if (containers.length === 0) { // If there are no containers
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
$("#pattern").on("input", displayAltFields)
$("#daily-crystals").on("input", updatePrice)
$("#add-login-alts").on("input", loginChanged)

browser.storage.onChanged.addListener(fillFields)
