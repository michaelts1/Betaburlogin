"use strict"

const VARS_VERSION = 8
const ADDON_CSS =
`#clear-username {
	color: yellow;
	font-size: 25px;
	line-height: 10px;
}
#send-me-currency {
	margin-left: 10px
}
#send-me-currency a {
	line-height: 10px;
	padding: 3px;
	text-decoration: none;
}
#betabot-mob-jump-button {
	font-size: 14px;
	padding: 6.5px;
}
label[for=custom-build] a {
	padding: 3px;
	text-decoration: none;
}
#betabot-spawn-gem[disabled] {
	opacity: 0.5;
}`
const CUSTOM_CSS =
`#areaContent {
	height: 350px;
}
#questInfo {
	font-size: 0.95em;
}
.navSection li {
	line-height: 25px;
}`

//These will store the ports
let live = null
let main = null
const alts = []
const logins = []

//This will store the settings
let vars = null

browser.runtime.onConnect.addListener(async port => {
	console.log(port.name, " connected")
	const mainUsername = (await browser.storage.sync.get("mainUsername")).mainUsername

	//If live login
	if (port.name === "live") {
		live = port
		live.onMessage.addListener(message => {
			if (message.text === "open alt tabs") {
				openTabs()
			}
		})
	} else if (port.name === "login") { //Else, if beta login
		logins.push(port)
		port.onMessage.addListener(message => {
			if (message.text === "requesting login") {
				login()
			}
		})
	} else if (port.name === mainUsername) { //Else, if beta main
		main = port
	} else { //Else, if beta alt
		alts.push(port)
		port.onMessage.addListener(message => {
			if (message.text === "move to mob") {
				console.log(`moving all alts to mob ${message.number}`)
				jumpMobs(message.number)
			}
			if (message.text === "spawnGem") {
				console.log("${port.name} requested to spawn gems:", message)
				spawnGem(message.type, message.splice, message.tier, message.amount)
			}
		})
	}

	if (port.name !== "live" || port.name !== "login") { //If beta account
		port.onMessage.addListener(message => {
			if (message.text === "requesting currency") { //Send currency
				console.log(`${port.name} requested currency`)
				sendCurrency(port.name)
			}
		})
	}

	//When a port disconnects, forget it
	port.onDisconnect.addListener( () => {
		if (port.name === "live") {
			live = null
		} else if (port.name === "login") {
			const index = logins.indexOf(port)
			if (index !== -1) logins.splice(index, 1)
		} else if (port.name === mainUsername) {
			main = null
		} else {
			const index = alts.indexOf(port)
			if (index !== -1) alts.splice(index, 1)
		}
		console.log(port.name, " disconnected!")
	})
})

//Open tabs:
async function openTabs() {
	let containers = await browser.contextualIdentities.query({}) //Get all containers
	if (vars.containers.useAll === false) {
		containers = containers.filter(e => vars.containers.list.includes(e.name)) //Filter according to settings
	}

	let altsNumber = 0
	if (vars.pattern === "unique") {
		altsNumber += vars.namesList.length
	}
	else {
		altsNumber += vars.altsNumber
	}

	browser.tabs.create({url: "https://beta.avabur.com"})
	for (let i = 0; i < Math.min(containers.length, altsNumber); i++) {
		setTimeout( () => {
			browser.tabs.create({
				cookieStoreId: containers[i].cookieStoreId,
				url: "https://beta.avabur.com",
			})
		}, 500*(i+1))
	}
}

//Login all alts:
function login() {
	function sendLogin(i, username) {
		logins[i].postMessage({
			text: "login",
			username: username,
			password: vars.loginPassword,
		})
	}

	if (vars.pattern === "roman") {
		function romanize(num) {
			if (num === 0) return ""
			const roman = {
				L : 50,
				XL: 40,
				X : 10,
				IX: 9,
				V : 5,
				IV: 4,
				I : 1,
			}
			let str = ""
			for (const key of Object.keys(roman)) {
				const q = Math.floor(num / roman[key])
				num -= q * roman[key]
				str += key.repeat(q)
			}
			return str
		}

		sendLogin(0, vars.mainAccount)
		for (let i = 1; i <= vars.altsNumber; i++) {
			sendLogin(i, vars.altBaseName+romanize(i))
		}
	} else if (vars.pattern === "unique") {
		sendLogin(0, vars.mainAccount)
		for (let i = 0; i < vars.namesList.length; i++) {
			sendLogin(i+1, vars.namesList[i])
		}
	}
}

//Send message to alts:
function sendMessage(message, users=alts.concat(main)) {
	for (const user of users) {
		user.postMessage(message)
	}
}

//Spawn gems:
function spawnGem(type, splice, tier, amount) {
	sendMessage({
		text  : "spawn gems",
		type  : type,
		splice: splice,
		tier  : tier,
		amount: amount,
	}, alts)
}

//Jump mobs:
function jumpMobs(number) {
	sendMessage({text: "jump mobs", number: number}, alts)
}

//Send currency:
function sendCurrency(name) {
	sendMessage({text: "send currency", recipient: name})
}

//Get settings from storage:
async function getVars() {
	vars = await browser.storage.sync.get()
	//If not set, create with default settings
	if (Object.keys(vars).length === 0) {
		vars = {
			version           : VARS_VERSION,
			startActionsDelay : 1000,
			buttonDelay       : 500,
			dailyCrystals     : 50,
			minCraftingQueue  : 5,
			altsNumber        : 0,
			wireFrequency     : 0,
			doQuests          : true,
			doBuildingAndHarvy: true,
			doCraftQueue      : true,
			actionsPending    : false,
			autoWire          : false,
			verbose           : false,
			questCompleting   : null,
			mainAccount       : "",
			mainUsername      : "",
			loginPassword     : "",
			pattern           : "",
			altBaseName       : "",
			namesList         : [],
			containers        : {
				useAll: true,
				list  : [],
			},
			tradesList        : {
				fishing       : [],
				woodcutting   : [],
				mining        : [],
				stonecutting  : [],
				crafting      : [],
				carving       : [],
			},
			css: {
				addon : ADDON_CSS,
				custom: CUSTOM_CSS,
			},
			currencySend: [
				{
					name         : "crystals",
					send         : true,
					minimumAmount: 0,
					keepAmount   : 0,
				},
				{
					name         : "platinum",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 0,
				},
				{
					name         : "gold",
					send         : true,
					minimumAmount: 10000,
					keepAmount   : 0,
				},
				{
					name         : "crafting_materials",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 0,
				},
				{
					name         : "gem_fragments",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 0,
				},
				{
					name         : "food",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
				{
					name         : "wood",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
				{
					name         : "iron",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
				{
					name         : "stone",
					send         : true,
					minimumAmount: 100,
					keepAmount   : 10000000,
				},
			],
		}
		await browser.storage.sync.set(vars)
	}
	updateVars()
}
getVars()

async function updateVars() {
	if (vars.version === VARS_VERSION) {
		return
	}
	if (typeof vars.version !== "number") {
		console.log("Reseting settings - current settings are too old")
		await browser.storage.sync.clear()
		getVars()
		return
	}
	if (vars.version < 2) {
		vars.mainUsername = ""
	}
	if (vars.version < 3) {
		vars.pattern = ""
		vars.namesList = []
	}
	if (vars.version < 4) {
		vars.tradesList = {
			fishing      : [],
			woodcutting  : [],
			mining       : [],
			stonecutting : [],
			crafting     : [],
			carving      : [],
		}
	}
	if (vars.version < 5) {
		for (const trade of ["food", "wood", "iron", "stone"]) {
			vars.currencySend.push({
				name : trade,
				send : true,
				minimumAmount : 100,
				keepAmount : 10000000,
			})
		}
	}
	if (vars.version < 6) {
		vars.autoWire = false
	}
	if (vars.version < 7) {
		vars.css = {
			addon : ADDON_CSS,
			custom: CUSTOM_CSS,
		},
		vars.verbose = false
		vars.containers = ["betabot-default"]
		vars.wireFrequency = 60
	}
	if (vars.version < 8) {
		vars.containers = {
			useAll: true,
			list  : []
		}
		if (vars.pattern === "romanCaps") vars.pattern = "roman" //deprecated
	}

	if (vars.css.addon !== ADDON_CSS) {
		vars.css.addon = ADDON_CSS
	}

	vars.version = VARS_VERSION
	browser.storage.sync.set(vars)
}

browser.storage.onChanged.addListener(changes => {
	getVars()

	function objectEquals(object1, object2) { //https://stackoverflow.com/a/6713782/10687471
		if (object1 === object2) return true
		if (!(object1 instanceof Object) || !(object2 instanceof Object)) return false
		if (object1.constructor !== object2.constructor) return false
		for (const p in object1) {
			if (!object1.hasOwnProperty(p)) continue
			if (!object2.hasOwnProperty(p)) return false
			if (object1[p] === object2[p]) continue
			if (typeof(object1[p]) !== "object") return false
			if (!objectEquals(object1[p], object2[p])) return false
		}
		for (const p in object2) {
			if (object2.hasOwnProperty(p) && !object1.hasOwnProperty(p)) return false
		}
		return true
	}

	const values = Object.values(changes)
	const keys   = Object.keys(changes)
	for (let i = 0; i < Object.values(changes).length; i++) {
		if (objectEquals(values[i].oldValue, values[i].newValue) === false) {
			console.log(keys[i], "changed from", values[i].oldValue, "to", values[i].newValue)
		}
	}
})

console.log("background script finished evaluating")