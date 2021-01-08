"use strict"

/**
 * @file Options Page code
 */
/**
 * @namespace options
 */

let settings = null

/**
 * @function buildHTML
 * @memberof options
 */
function buildHTML() {
	/**
	 * Removes a data attribute and returns its value
	 * @function getData
	 * @param {HTMLElement} el
	 * @param {String} attr
	 * @returns {string}
 	 * @memberof options
	 * @private
	 */
	function getData(el, attr) {
		const tmp = el.getAttribute("data-" + attr)
		el.removeAttribute(attr)
		return tmp
	}

	for (const table of $("table")) {
		const tableName = getData(table, "name")
		const cols = getData(table, "cols")

		// Add tab button:
		$("#tabs-buttons").append(`<div id="${table.id}-tab-button" class="tab-button">${tableName}</div>`)

		// Add table header:
		let head = `<thead><tr><th colspan="${cols}">${tableName} Settings`
		if (table.dataset.headerTooltip) {
			head += ` <span class="title-info" role="img" aria-label="info" data-tooltip='${getData(table, "header-tooltip")}'></span>`
		}
		head += "</thead></th></tr>"
		$(table).prepend(head)

		// Add colgroup:
		let colGroup = "<colgroup>"
		for (let i = 1; i <= cols; i++) {
			colGroup += `<col id="${table.id}-col-${i}">`
		}
		$(table).prepend(colGroup)
	}

	// Wrap all tables:
	$("table").wrapAll(`<article id="settings"></article>`)

	// Add `.tab` class:
	$("table").addClass("tab")

	// Select first tab:
	$("table").eq(0).addClass("selected")
	$(".tab-button").eq(1).addClass("selected")

	// Add info tooltips:
	for (const el of $("[data-info]")) {
		$(el).after(`<span class="info" role="img" aria-label="info" data-tooltip='${getData(el, "info")}'></span>`)
	}

	// Add buttons animation:
	$("button").wrapInner("<span></span>")
	$("button").prepend(`<span class="circle"></span>`)
}

/**
 * A class for setting fields
 */
class Setting {
	/**
	 * @param {HTMLInputElement} input Input field
	 */
	constructor(input) {
		// Set object properties:
		this.input = input
		this.name = input.dataset.setting
		this.path = input.dataset.setting.split(".") /** @todo Is this really needed? its almost equivalent to `this.name` */
		const {settingType, settingValue} = Setting.getSettingByName(this.name)
		this.type = settingType
		this.value = settingValue
		this.lastChanged = new Date().getTime()
		this.runAfterChange = []
		this.runAfterSave = []

		// Set functions that will run after any change:
		switch (this.input.id) {
			case "daily-crystals":
				this.runAfterChange.push(updateCrystalsPrice)
				break
			case "add-login-alts":
				// Fall through
			case "pattern":
				this.runAfterChange.push(displayLoginFields)
				break
			case this.input.id.match(/.*-keep$/)?.input: // https://stackoverflow.com/a/18881169/
				this.runAfterChange.push(currencySendTitle)
				this.runAfterSave.push(async setting => {
					// Update the displayed value (e.g 1000b => 1T)
					setting.value = abbreviateNumber(deabbreviateNumber(setting.value))
				})
		}

		// Set load/save functions based on type:
		switch (this.type) {
			case "encrypted":
				/**
				 * **Note: DO NOT trust this encryption**. it's very weak and uses a public key for encryption.
				 * There is a reason why there is still a warning about the password being saved in plain text.
				 * @name notEncrypted
				 * @memberof options
				 */
				this.loadValue = async function() {this.input.value = await insecureCrypt.decrypt(settings[this.name], "betabot Totally-not-secure Super NOT secret key!")}
				this.updateValue = async function() {this.value = await insecureCrypt.encrypt(this.input.value, "betabot Totally-not-secure Super NOT secret key!")}
				break
			case "boolean":
				this.loadValue = function() {this.input.checked = this.value}
				this.updateValue = function() {this.value = this.input.checked}
				break
			case "array":
				this.loadValue = function() {this.input.value = this.value.join(", ")}
				this.updateValue = function() {this.value = this.input.value !== "" ? this.input.value.split(", ") : []}
				break
			case "number":
				// Don't abbreviate the Event Channel ID field
				this.loadValue = function() {this.input.value = this.input.id === "event-channel-id" ? this.value : abbreviateNumber(this.value)}
				this.updateValue = function() {this.value = deabbreviateNumber(this.input.value) || this.value}
				break
			default:
				this.loadValue = function() {this.input.value = this.value}
				this.updateValue = function() {this.value = this.input.value}
		}

		// Save changes. Using an arrow function because `oninput` functions receive the input element as `this`:
		this.input.oninput = () => this.valueChanged(this)

		// Load setting value:
		this.load()

		// Keep track of all `Setting` instances:
		Setting.instances.push(this)
	}

	/**
	 * Calls `this.save` after 2 seconds
	 * @async
	 * @function valueChanged
	 * @private
	 * @memberof options
	 */
	async valueChanged() {
		this.lastChanged = new Date().getTime()
		for (const fun of this.runAfterChange) fun(this.input)
		await delay(2000)
		this.save(new Date().getTime())
	}

	/**
	 * Saves setting to sync storage if at least 2 seconds have passed since last input
	 * @async
	 * @function save
	 * @param {number} timestamp Time in ms since epoch to check `this.lastChanged` against
	 * @private
	 * @memberof options
	 */
	async save(timestamp) {
		if (!this.input.reportValidity()) {
			console.error(`#${this.input.id} is invalid`)
			return
		}

		// If less than 2 seconds have passed since last change, return:
		if (timestamp - this.lastChanged < 2000) return

		// update value:
		await this.updateValue()

		for (const fun of this.runAfterSave) fun(this.input)

		// Don't save if the setting didn't change:
		if (objectEquals(this.value, Setting.getSettingByName(this.name).settingValue)) return

		/**
		 * Recursively creates a clone of the child of `settings` containing a specific setting, while using a new value for that setting
		 * @function changeSetting
		 * @param {Setting} setting A setting that needs to be changed
		 * @param {object} _settingsObject A copy of `settings`. Should be omitted when called manually
		 * @param {number} _index Current index in `path`. Should be omitted when called manually
		 * @returns {object} New clone of the child of `settings` containing said setting, using the new value for that setting
		 * @const
		 * @private
		 * @memberof options
		 */
		const changeSetting = (setting, _settingsObject = settings, _index = 0) => {
			if (_index + 1 === setting.path.length) { // If index is the last index, change the setting
				_settingsObject[setting.path[_index]] = setting.value
			} else { // Else, call `changeSetting()` again to modify the next child
				_settingsObject[setting.path[_index]] = changeSetting(setting, _settingsObject[setting.path[_index]], _index + 1)
			}
			return _settingsObject // Return the modified object
		}
		/* Change a setting without modifying the rest of `settings`. I am using `[this.path[0]]`
		   to only set the specific setting (e.g. `css`), and not the whole `settings` object: */
		browser.storage.sync.set({
			[this.path[0]]: changeSetting(this)[this.path[0]],
		})

		displayMessage("Changes saved")
	}

	/**
	 * Loads a setting from sync storage
	 * @async
	 * @function Load
	 * @private
	 * @memberof options
	 */
	async load() {
		this.value = Setting.getSettingByName(this.name).settingValue

		// Update field:
		await this.loadValue()

		for (const fun of this.runAfterChange) fun(this.input)
	}

	/**
	 * Gets the settings from storage, and updates the displayed settings accordingly
	 * @async
	 * @function refreshSettings
	 * @memberof options
	 * @static
	 */
	static async refreshSettings() {
		settings = await browser.storage.sync.get()

		for (const setting of Setting.instances) {
			if (!objectEquals(setting.value, Setting.getSettingByName(setting.name).settingValue)) {
				setting.load()
			}
		}

		displayLoginFields()
		updateCrystalsPrice()
	}

	/**
	 * Finds a setting in `settings` based on its name and path, and returns its value and type
	 * @function getSettingByName
	 * @param {string} settingName Name of the setting
	 * @returns {object}
	 * @returns {*} settingValue
	 * @returns {string} settingType
	 * @static
	 * @memberof options
	 */
	static getSettingByName(settingName) {
		let settingValue = settings
		let settingType = null

		// Get the setting value by using a pointer to navigate down the tree:
		for (const key of settingName.split(".")) {
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
	 * @async
	 * @function init
	 * @static
	 * @memberof options
	 */
	static async init() {
		settings = await browser.storage.sync.get()
		// Make sure that Contextual Identities are available:
		browser.contextualIdentities ? fillContainers() : $(`.requires-containers`).html(
			`<td colspan="2">This feature requires Container Tabs. Please enable Container tabs in Browser Options -&gt; Tabs -&gt; Enable Container Tabs, and reload the page.</td>`)

		// Create `Setting` instances:
		for (const input of $("[data-setting]").toArray()) new Setting(input)
	}
}
Setting.instances = []

/**
 * Abbreviates a number into short form
 * @function abbreviateNumber
 * @example
 * // Returns "10K"
 * abbreviateNumber(10000)
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
 * Deabbreviates a number from short form
 * @function deabbreviateNumber
 * @example
 * // Returns 10000
 * romanize("10K")
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

	if (!scale) return parseFloat(input)

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

	setTimeout(() => {
		output.fadeOut(750, () => {output.text("")} )
	}, time)
}

/**
 * Adds a title to the currency send settings fields
 * @function currencySendTitle
 * @param {HTMLInputElement} target
 * @memberof options
 */
function currencySendTitle(target) {
	target.title = deabbreviateNumber(target.value).toLocaleString()
}

/**
 * Updates the displayed daily crystal prices
 * @function updateCrystalsPrice
 * @memberof options
 */
function updateCrystalsPrice() {
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
 * Displays or hides the login settings as needed
 * @function displayLoginFields
 * @memberof options
 */
function displayLoginFields() {
	const fieldRows = {
		number:        $("#alts-number-tr"),
		pattern:       $("#pattern-tr"),
		baseName:      $("#alt-base-name-tr"),
		namesList:     $("#names-list-tr"),
		mainAccount:   $("#main-account-tr"),
		loginPassword: $("#login-password-tr"),
	}

	// Hide everything, then only show what is needed
	for (const field in fieldRows) fieldRows[field].hide()

	if ($("#add-login-alts").prop("checked")) {
		fieldRows.pattern.show()
		fieldRows.mainAccount.show()
		fieldRows.loginPassword.show()
		switch ($("#pattern").val()) {
			case "roman":
				fieldRows.number.show()
				fieldRows.baseName.show()
				break
			case "unique":
				fieldRows.namesList.show()
		}
	}
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

	$("#containers-auto").prop("checked", settings.containers.useAll)

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

	$("#containers-auto, [name=containers]").on("input", saveContainers)
}

/**
 * Saves changes to container settings
 * @function saveContainers
 * @memberof options
 */
function saveContainers() {
	browser.storage.sync.set({
		containers: {
			useAll: $("#containers-auto").prop("checked"),
			list: $("[name=containers]:checked").get().map(e => e.id), // Get id's of checked containers,
		},
	})
}
/**
 * Resets all settings to default values
 * @async
 * @function resetSettings
 * @memberof options
 */
async function resetSettings() {
	if(!window.confirm("Are you sure you want to reset ALL settings?")) return

	// Don't update settings before reloading:
	browser.storage.onChanged.removeListener(Setting.refreshSettings)
	await browser.storage.sync.clear()
	log("Resetting settings")

	location.reload()
}

$(buildHTML)
$(Setting.init)

$("#reset-css").click(resetCSS)
$(".tab-button").click(changeTab)
$("#reset-settings").click(resetSettings)

window.onbeforeunload = () => {
	const time = new Date().getTime()
	for (const setting of Setting.instances) {
		if (time - setting.lastChanged < 2000) { // If `setting` was last changed less than 2 seconds ago, it still didn't save
			setting.save()
		}
	}
}

browser.storage.onChanged.addListener(Setting.refreshSettings)
