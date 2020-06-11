"use strict"

//communication with content pages:
var	live, //those are the ports
	main,
	alts = [],
	logins = [],
	//this will store the settings
	vars = undefined

browser.runtime.onConnect.addListener( port => {
	console.log(port.name, " connected")
	//if live login
	if (port.name === "live") {
		live = port
		live.onMessage.addListener( message => {
			if (message.text === "open alt tabs") {
				openTabs()
			}
		})
	}
	//if beta login
	else if (port.name === "login") {
		logins.push(port)
		port.onMessage.addListener( message => {
			if (message.text === "requesting login") {
				login()
			}
		})
	}
	//if beta main
	else if (port.name === "michaelts") {
		main = port
	}
	//if beta alt
	else {
		alts.push(port)
		port.onMessage.addListener( message => {
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
	//if beta account
	if (port.name !== "live" || port.name !== "login") {
		port.onMessage.addListener( message => {
			//send currency
			if (message.text === "requesting currency") {
				console.log(`${port.name} requested currency`)
				sendCurrency(port.name)
			}
			//update settings
			if (message.text === "setKey") {
				setKey(message.key, message.value)
			}
		})
	}
	
	//when a port disconnects, forget it
	port.onDisconnect.addListener( () => {
		if (port.name === "live") {
			live = undefined
		}
		else if (port.name === "login") {
			let index = logins.indexOf(port)
			if (index !== -1) {
				logins.splice(index, 1)
			}
		}
		else if (port.name === "michaelts") {
			main = undefined
		}
		else {
			let index = alts.indexOf(port)
			if (index !== -1) {
				alts.splice(index, 1)
			}
		}
		console.log(port.name, " disconnected!")
		//console.log(main,alts)
	})
})

//open tabs:
async function openTabs() {
	let contexts = await browser.contextualIdentities.query({})//get all containers
	browser.tabs.create({url: "https://beta.avabur.com"})
	for (let i = 0; i < contexts.length; i++) { //and open them
		setTimeout( () => {
			browser.tabs.create({
				cookieStoreId: contexts[i].cookieStoreId,
				url: "https://beta.avabur.com"
			})
		}, 500*i)
	}
}

//login all alts:
function login() {
	function romanize(num) {
		if (num === 0) return ""
		let roman = {v: 5, iv: 4, i: 1}
		let str = ""
		for (let key of Object.keys(roman)) {
			let q = Math.floor(num / roman[key])
			num -= q * roman[key]
			str += key.repeat(q)
		}
		return str
	}
	function login(i, username) {
		logins[i].postMessage({
			text: "login",
			username: username,
			//warning: password is saved in plain text!
			//make sure it is different from passwords
			//you use for other services, inculding live!
			password: vars.loginPassword
		})
	}
	
	login(0, vars.mainAccount)
	for (let i = 1; i <= vars.altsNumber; i++) {
		login(i, vars.altBaseName+romanize(i))
	}
}

//send message to alts:
function sendMessage(message, users=alts.concat(main)) {
	for (let user of users) {
		user.postMessage(message)
	}
}

//get settings from storage:
async function getVars() {
	vars = await browser.storage.sync.get()
	//if not set, create with default settings
	if (Object.keys(vars).length === 0) {
		vars = {
			version 			: "0.9.7.5",
			doQuests 			: true,
			doBuildingAndHarvy	: true,
			doCraftQueue 		: true,
			actionsPending 		: false,
			buttonDelay 		: 500,
			questCompleting 	: null,
			startActionsDelay 	: 1000,
			minCraftingQueue 	: 5,
			mainAccount 		: "",
			altsNumber 			: 0,
			altBaseName 		: "",
			loginPassword 		: "",
			dailyCrystals	 	: 50,
			currencySend : [
				{
					name 			: "crystals",
					send 			: true,
					minimumAmount 	: 0,
					keepAmount 		: 0
				},
				{
					name 			: "platinum",
					send 			: true,
					minimumAmount 	: 100,
					keepAmount 		: 0
				},
				{
					name 			: "gold",
					send 			: true,
					minimumAmount 	: 10000,
					keepAmount 		: 0
				},
				{
					name 			: "crafting_materials",
					send 			: true,
					minimumAmount 	: 100,
					keepAmount 		: 0
				},
				{
					name 			: "gem_fragments",
					send 			: true,
					minimumAmount 	: 100,
					keepAmount 		: 0
				}
			]
		}
		browser.storage.sync.set(vars)
	}
}
getVars()

//change settings:
async function setKey(key, value) {
	//set setting
	vars[key] = value
	await browser.storage.sync.set(vars)
}

//list changes in console:
browser.storage.onChanged.addListener( changes => {
	let values = Object.values(changes),
		keys   = Object.keys(changes)

	for (let i = 0; i < Object.values(changes).length; i++) {
		if (Array.isArray(values[i].oldValue)) {
			continue
		}
		if (values[i].oldValue != values[i].newValue) {
			console.log(keys[i], "changed from", values[i].oldValue, "to", values[i].newValue)
		}
	}
})

//spawn gems:
function spawnGem(type, splice, tier, amount) {
	sendMessage({
		text  : "spawn gems",
		type  : type,
		splice: splice,
		tier  : tier,
		amount: amount
	}, alts)
}

//jump mobs:
function jumpMobs(number) {
	sendMessage({text: "jump mobs", number: number}, alts)
}

//send currency:
function sendCurrency(name) {
	sendMessage({text: "send currency", recipient: name})
}

console.log("background script finished compiling")