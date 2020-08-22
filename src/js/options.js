"use strict"

/**
 * @file Options Page code
 */
/**
 * @namespace options
 */

let settings = null

/**
 * Abbreviates a number into short form (e.g. 10000 => 10K)
 * @function abbreviateNumber
 * @param {number} num
 * @returns {string} Short form number
 * @memberof options
 */
function abbreviateNumber(num) {
	/**
	 * Rounds a number
	 * @function round
	 * @param {number} num
	 * @returns {number}
	 * @private
	 * @memberof options
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
 * @memberof options
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
 * @memberof options
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
 * @memberof options
 */
async function fillFields() {
	try {
		settings = await browser.storage.sync.get()
		if (browser.contextualIdentities === undefined) {
			$(`.requires-containers`).html(`<td colspan="2">This feature requires Container Tabs. Please enable Container tabs in Browser Options -&gt; Tabs -&gt; Enable Container Tabs, and reload the page.</td>`)
		} else {
			fillContainers()
		}

		$("#pattern")           .val(settings.pattern)
		$("#attack-at")         .val(settings.attackAt)
		$("#name-list")         .val(settings.namesList.join(", "))
		$("#custom-css")        .val(settings.css.custom)
		$("#min-stamina")       .val(settings.minStamina)
		$("#alts-number")       .val(settings.altsNumber)
		$("#main-account")      .val(settings.mainAccount)
		$("#main-username")     .val(settings.mainUsername)
		$("#alt-base-name")     .val(settings.altBaseName)
		$("#login-password")    .val(await insecureCrypt.decrypt(settings.loginPassword, "betabot Totally-not-secure Super NOT secret key!"))
		$("#wire-frequency")    .val(settings.wireFrequency)
		$("#daily-crystals")    .val(settings.dailyCrystals)
		$("#event-channel-id")  .val(settings.eventChannelID)
		$("#min-carving-queue").val(settings.minCarvingQueue)
		$("#min-crafting-queue").val(settings.minCraftingQueue)

		$("#verbose")          .prop("checked", settings.verbose)
		$("#auto-wire")        .prop("checked", settings.autoWire)
		$("#auto-house")       .prop("checked", settings.autoHouse)
		$("#auto-craft")       .prop("checked", settings.autoCraft)
		$("#auto-carve")       .prop("checked", settings.autoCarve)
		$("#append-name")      .prop("checked", settings.addUsername)
		$("#auto-quests")      .prop("checked", settings.autoQuests)
		$("#resume-queue")     .prop("checked", settings.resumeCrafting)
		$("#auto-stamina")     .prop("checked", settings.autoStamina)
		$("#remove-banner")    .prop("checked", settings.removeBanner)
		$("#add-socket-x5")    .prop("checked", settings.addSocketX5)
		$("#add-open-tabs")    .prop("checked", settings.addOpenTabs)
		$("#add-jump-mobs")    .prop("checked", settings.addJumpMobs)
		$("#join-gauntlets")   .prop("checked", settings.joinGauntlets)
		$("#remove-effects")   .prop("checked", settings.removeEffects)
		$("#add-login-alts")   .prop("checked", settings.addLoginAlts)
		$("#add-spawn-gems")   .prop("checked", settings.addSpawnGems)
		$("#auto-harvestron")  .prop("checked", settings.autoHarvestron)
		$("#containers-auto")  .prop("checked", settings.containers.useAll)
		$("#add-custom-build") .prop("checked", settings.addCustomBuild)
		$("#add-request-money").prop("checked", settings.addRequestMoney)

		for (const currency of settings.currencySend) {
			const name = currency.name.replace("_", "-")
			$(`#${name}-keep`).val(abbreviateNumber(currency.keepAmount))
			$(`#${name}-keep`).prop("title", currency.keepAmount)
			$(`#${name}-send`).prop("checked", currency.send)
		}

		for (const trade of Object.keys(settings.tradesList)) {
			$(`#${trade}`).val(settings.tradesList[trade].join(", "))
		}

		updatePrice()
		displayAltFields()
	} catch (error) {
		displayMessage(`Error: ${error.message}`)
		console.error(error)
	}
}

/**
 * Saves the displayed settings to storage
 * @async
 * @function saveChanges
 * @memberof options
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

		settings.pattern         = $("#pattern").val()
		settings.css.custom      = $("#custom-css").val()
		settings.altBaseName     = $("#alt-base-name").val()
		settings.mainAccount     = $("#main-account").val()
		settings.mainUsername    = $("#main-username").val()
		settings.wireFrequency   = $("#wire-frequency").val()
		settings.minCarvingQueue = $("#min-carving-queue").val()

		settings.verbose           = $("#verbose").prop("checked")
		settings.autoWire          = $("#auto-wire").prop("checked")
		settings.autoHouse         = $("#auto-house").prop("checked")
		settings.autoCraft         = $("#auto-craft").prop("checked")
		settings.autoCarve         = $("#auto-carve").prop("checked")
		settings.autoQuests        = $("#auto-quests").prop("checked")
		settings.addSocketX5       = $("#add-socket-x5").prop("checked")
		settings.autoStamina       = $("#auto-stamina").prop("checked")
		settings.addJumpMobs       = $("#add-jump-mobs").prop("checked")
		settings.addUsername       = $("#append-name").prop("checked")
		settings.addOpenTabs       = $("#add-open-tabs").prop("checked")
		settings.resumeQueue       = $("#resume-queue").prop("checked")
		settings.removeBanner      = $("#remove-banner").prop("checked")
		settings.addLoginAlts      = $("#add-login-alts").prop("checked")
		settings.addSpawnGems      = $("#add-spawn-gems").prop("checked")
		settings.joinGauntlets     = $("#join-gauntlets").prop("checked")
		settings.removeEffects     = $("#remove-effects").prop("checked")
		settings.autoHarvestron    = $("#auto-harvestron").prop("checked")
		settings.resumeCrafting    = $("#resume-queue").prop("checked")
		settings.addCustomBuild    = $("#add-custom-build").prop("checked")
		settings.addRequestMoney   = $("#add-request-money").prop("checked")
		settings.containers.useAll = $("#containers-auto").prop("checked")

		settings.attackAt         = parseInt($("#attack-at").val()) || 3
		settings.altsNumber       = parseInt($("#alts-number").val()) || 0
		settings.minStamina       = parseInt($("#min-stamina").val()) || 5
		settings.dailyCrystals    = parseInt($("#daily-crystals").val()) || 0
		settings.eventChannelID   = parseInt($("#event-channel-id").val()) || 3202
		settings.minCraftingQueue = parseInt($("#min-crafting-queue").val()) || 0

		settings.containers.list = $("[name=containers]:checked").get().map(e => e.id) // Get id's of checked containers

		$("#name-list").val() === "" ? settings.namesList = [] : settings.namesList = $("#name-list").val().split(", ")

		/**
		 * **Note: DO NOT trust this encryption**. it's very weak and uses a public key for encryption.
		 * There is a reason why there is still a warning about the password being saved in plain text.
		 * @name notEncrypted
		 * @memberof options
		 */

		settings.loginPassword = await insecureCrypt.encrypt($("#login-password").val(), "betabot Totally-not-secure Super NOT secret key!")

		for (const currency of settings.currencySend) {
			const name = currency.name.replace("_", "-")
			const keepAmount = $(`#${name}-keep`).val() || 0
			currency.keepAmount = deabbreviateNumber(keepAmount)
			currency.send = $(`#${name}-send`).prop("checked")
		}

		for (const trade of Object.keys(settings.tradesList)) {
			settings.tradesList[trade] = $(`#${trade}`).val().split(", ")
		}

		await browser.storage.sync.set(settings)
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
 * @memberof options
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
 * @memberof options
 */
function updatePrice() {
	/**
	 * Returns the cost of buying daily crystals in gold
	 * @function price
	 * @param {number} n Number of daily crystals
	 * @returns {number} Cost of daily crystals
	 * @private
	 * @memberof options
	 */
	const price = n => (n * (2 * 2000000 + (n - 1) * 1000000)) / 2
	const number = parseInt($("#daily-crystals").val())
	$("#daily-crystals-price").text(abbreviateNumber(price(number)))
	$("#daily-crystals + div").prop("title", Intl.NumberFormat().format(price(number)) )
}

/**
 * Displays or hides the alt settings as needed
 * @function displayAltFields
 * @memberof options
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
 * @memberof options
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
 * @memberof options
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
 * @memberof options
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
 * @memberof options
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

	for (const container of settings.containers.list) { // Check all containers previously saved
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
