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
	const output = $("#output")

	output.text(message)
	output.fadeIn(250)

	setTimeout( () => {
		output.fadeOut(750, () => {output.text("")} )
	}, time)
}

/**
 * Finds a setting in `settings` based on it's name and path, and returns it's value and type
 * @function getSettingByPath
 * @param {string} settingName Name of the setting
 * @param {string[]} path Path to travel in `settings` in order to get to the setting, splitted to steps (e.g. to find `settings.a.b`, path should be `["a", "b"]`)
 * @returns {object}
 * @returns {*} settingValue
 * @returns {string} settingType
 */
function getSettingByPath(settingName, path) {
	let settingValue = settings
	let settingType = null

	// Get the setting value by using a pointer to navigate down the tree:
	for (const key of path) {
		settingValue = settingValue[key]
	}

	if (settingName === "loginPassword") {
		settingType = "encrypted"
	} else if (typeof settingValue === "boolean") {
		settingType = "boolean"
	} else if (typeof settingValue === "number") {
		settingType = "number"
	} else if (Array.isArray(settingValue)) {
		settingType = "array"
	} else {
		settingType = "string"
	}
	return {settingValue, settingType}
}

/**
 * Gets the settings from storage, and updates the displayed settings accordingly
 * @async
 * @function loadSettings
 * @memberof options
 */
async function loadSettings() {
	try {
		// Load setting:
		settings = await browser.storage.sync.get()

		// Make sure that Contextual Identities is available:
		browser.contextualIdentities ? fillContainers() : $(`.requires-containers`).html(
			`<td colspan="2">This feature requires Container Tabs. Please enable Container tabs in Browser Options -&gt; Tabs -&gt; Enable Container Tabs, and reload the page.</td>`)

		$("input").toArray().forEach(async input => {
			const settingName = input.dataset.setting
			let {settingValue, type} = getSettingByPath(settingName, settingName.split("."))

			// Update field according to setting type:
			switch (type) {
				case "encrypted":
					input.value = await insecureCrypt.decrypt(settings[settingName], "betabot Totally-not-secure Super NOT secret key!")
					break
				case "boolean":
					input.checked = settingValue
					break
				case "array":
					input.value = settingValue.join(", ")
					break
				case "number":
					input.value = abbreviateNumber(settingValue)
					break
				case "string":
					input.value = settingValue
			}
		})

		//displayAltFields()
		//displayLoginFields()
	} catch (error) {
		displayMessage(`Error: ${error.message}`)
		console.error(error)
	}
}

/**
 * Auto saves settings after changes
 * @async
 * @function saveSetting
 * @param {event} event `input` event
 * @param {HTMLInputElement} event.target
 * @memberof options
 */
async function saveSetting({target}) {
	if (target.reportValidity() === false) {
		console.error(`#${target.id} is invalid`)
		return
	}

	try {
		const settingName = target.dataset.setting
		const path = settingName.split(".")
		let {settingValue, type} = getSettingByPath(settingName, path)

		// Adapt value to type:
		switch (type) {
			case "encrypted":
				/**
				 * **Note: DO NOT trust this encryption**. it's very weak and uses a public key for encryption.
				 * There is a reason why there is still a warning about the password being saved in plain text.
				 * @name notEncrypted
				 * @memberof options
				 */
				settingValue = await insecureCrypt.encrypt(target.value, "betabot Totally-not-secure Super NOT secret key!")
				break
			case "boolean":
				settingValue = target.checked
				break
			case "array":
				settingValue = target.value.split(", ")
				break
			case "number":
				settingValue = deabbreviateNumber(target.value) || settingValue
				break
			case "string":
				settingValue = target.value
		}

		/**
		 * Changes a setting without modifying the rest of `settings`, even if the setting has a depth higher than 1
		 * @function changeSetting
		 * @param {object} settingsObject `settings` or a child of `settings`, containing the setting
		 * @param {number} index Current index in `path`
		 * @memberof options
		 * @private
		 */
		function changeSetting(settingsObject, index) {
			if (index + 1 === path.length) {
				settingsObject[path[index]] = settingValue
			} else {
				settingsObject[path[index]] = changeSetting(settingsObject[path[index]], index + 1)
			}
			return settingsObject
		}
		// Use `[path[0]]` to only set the specific setting (e.g. `css`), and not the whole `settings` object:
		browser.storage.sync.set(changeSetting(settings, 0)[path[0]])

		displayMessage("Changes saved")
	} catch(error) {
		displayMessage(`Error: ${error.message}`)
		console.error(error)
	}
}

/**
 * Adds a title to the currency send settings fields
 * @function currencySendTitle
 * @param {event} event `input` event
 * @param {HTMLInputElement} event.target
 */
function currencySendTitle({target}) {
	const settingName = target.dataset.setting
	const {settingValue} = getSettingByPath(settingName, settingName.split("."))
	$(target).prop("title", settingValue)
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
	const number = deabbreviateNumber($("#daily-crystals").val())
	$("#daily-crystals-price").text(abbreviateNumber(price(number) || 0))
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
	$("#custom-css").val(settings.css.custom.default)
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
			$("#containers").append(`<input id="${name}" name="containers" type="checkbox" data-for="containers"><span id="${name}-icon" class="container-icon"></span><label for="${name}">${name}</label><br>`)
			$(`#${name}-icon`).css({"background-color": container.color, "mask": `url(${container.iconUrl})`, "mask-size": "100%"})
		}
	}

	for (const container of settings.containers.list) { // Check all containers previously saved
		$(`#${container}`).prop("checked", true)
	}
}

/**
 * Saves changes to container settings
 * @function saveContainers
 * @memberof options
 */
function saveContainers() {
	browser.storage.sync.set({
		useAll: $("#containers-auto").prop("checked"),
		list: $("[name=containers]:checked").get().map(e => e.id), // Get id's of checked containers,
	})
}
/**
 * Resets all settings to default values
 * @async
 * @function resetSettings
 * @memberof options
 */
async function resetSettings() {
	if(window.confirm("Are you sure you want to reset ALL settings?") === false) return

	// Don't update settings before reloading:
	browser.storage.onChanged.removeListener(loadSettings)
	await browser.storage.sync.clear()
	log("Resetting settings")

	location.reload()
}

$(loadSettings)
$("#reset-css").click(resetCSS)
$(".tab-button").click(changeTab)
$("#reset-settings").click(resetSettings)

$("#pattern").on("input", displayAltFields)
$("[data-setting]").on("input", saveSetting)
$("#daily-crystals").on("input", updatePrice)
$("#add-login-alts").on("input", loginChanged)
$("#wire [id*=-keep]").on("input", currencySendTitle)
$("#containers-auto, [name=containers]").on("input", saveContainers)

browser.storage.onChanged.addListener(loadSettings)
