let vars = null

async function getVars() {
	vars = await browser.storage.sync.get()

	$("#doQuests")          .prop("checked", vars.doQuests)
	$("#doBuildingAndHarvy").prop("checked", vars.doBuildingAndHarvy)
	$("#doCraftQueue")      .prop("checked", vars.doCraftQueue)
}

async function toggle(data) {
	let target = data.target.id
	vars[target] = $(`#${target}`).prop("checked")
	await browser.storage.sync.set(vars)
}

$(getVars)

$("input").on("change", toggle)
$("#settingsIcon").click( () => {
	browser.runtime.openOptionsPage()
})

browser.storage.onChanged.addListener(changes => {
	for (change in Object.getOwnPropertyNames(changes)) {
		if ( ["doQuests", "doBuildingAndHarvy", "doCraftQueue"].includes(change) ) {
			getVars()
		}
	}
})