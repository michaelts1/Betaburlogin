let vars = null

async function getVars() {
	vars = await browser.storage.sync.get()

	$("#auto-quests")    .prop("checked", vars.autoQuests)
	$("#auto-house")     .prop("checked", vars.autoHouse)
	$("#auto-craft")     .prop("checked", vars.autoCraft)
	$("#auto-harvestron").prop("checked", vars.autoHarvestron)
}

async function toggle(event) {
	const id = event.target.id
	const setting = id.replaceAll(/-(.)/g, (match, group1) => match.replace(match, group1.toUpperCase())) // auto-house => autoHouse
	vars[setting] = $(`#${id}`).prop("checked")
	await browser.storage.sync.set(vars)
}

$(getVars)

$("input").on("change", toggle)
$("#settings-icon").click( () => {
	browser.runtime.openOptionsPage()
})

browser.storage.onChanged.addListener(getVars)
