"use strict"

/**
 * @file Defines helper functions for use in other files
 */
/**
 * @namespace helpers
 */

/* eslint-disable no-redeclare, no-unused-vars */ // Defined in this file, used in other files

/**
 * See {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port|MDN Documentation}
 * @typedef {object} runtimePort
 * @property {string=} name Name of the sender
 * @property {object} sender Contains information about the sender of the port
 * @property {object} onMessage
 * @property {function} onMessage.addListener
 * @property {function} onMessage.removeListener
 * @property {object} onDisconnect
 * @property {function} onDisconnect.addListener
 * @property {function} onDisconnect.removeListener
 * @property {function} postMessage
 * @memberof helpers
 */

/**
 * Logs a message, while prefixing it with date, time and the the addon's name
 * @function log
 * @param {...any} msg Zero or more objects of any type that will be logged
 * @memberof helpers
 */
function log(...msg) {
	console.log(`[${new Date().toLocaleString().replace(",", "")}] Betaburlogin:`, ...msg)
}

/**
 * - Returns a promise that is resolved after some time.
 * - Useful for pausing async functions.
 * @function delay
 * @param {number} ms Amount of milliseconds to wait before resolving the promise
 * @memberof helpers
 */
function delay(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
}

/**
 * @const helpers
 * @property {object} eventListeners
 * @property {object} insecureCrypt
 * @property {function} objectEquals
 * @property {function} capitalize
 * @property {function} romanize
 */
const helpers = {
	/**
	 * Object used to manage jQuery document event listeners
	 * @const eventListeners
	 * @property {function} toggle Toggles an event listener on/off
	 * @property {function} waitFor Allows asynchronously waiting for events
	 * @property {...function[]}
	 * - One or more properties using the following format:
	 * - `string: function[]`
	 * - Where `string` is the name of the event (e.g. "roa-ws:all"), and `function[]` is an array of functions that will be called when the event is triggered
	 * - Example: `eventListeners["roa-ws:page"] = [onPage, getPage, log]` will call onPage(), getPage(), and log() every time "roa-ws:page" is triggered
	 * @memberof helpers
	 */
	eventListeners: {
		/**
		 * Attaches/deattaches handlers to document events, while avoiding having duplicate listeners
		 * @method toggle
		 * @param {string} eventName - Listen to events with this name
		 * @param {function} handler - Handle the event with this handler
		 * @param {boolean} turnOn - If true, turns the event listener on. If false, turns the event listener off
		 * @memberof helpers
		 * */
		toggle(eventName, handler, turnOn) {
			if (typeof eventName !== "string") throw new TypeError(`Parameter eventName ${eventName} must be a string`)
			if (typeof handler !== "function") throw new TypeError(`Parameter handler ${handler} must be function`)
			if (typeof turnOn !== "boolean") throw new TypeError(`Parameter turnOn ${turnOn} must be boolean`)

			if (this[eventName] === undefined) {
				this[eventName] = []
			}

			// Shorter identifier:
			const prop = this[eventName]

			// Turn off the previous event handler to avoid duplicates:
			if (prop.includes(handler) && turnOn) {
				$(document).off(eventName, handler)
			}

			// If turnOn is true, $(document).on(...), if false, $(document).off(...):
			$(document)[turnOn ? "on" : "off"](eventName, handler)

			// Push/pop the handler from the handlers array:
			if (prop.includes(handler) && !turnOn) {
				prop.splice(prop.indexOf(handler), 1)
			} else if (turnOn) {
				prop.push(handler)
			}
		},

		/**
		 * @typedef {object} waitForEvent
		 * @property {event} event Event object
		 * @property {object} data Event data, see {@link https://api.jquery.com/event.data/|event.data} in jQuery docs
		 * @memberof helpers
		 */

		/**
		 * Allows waiting for events in asynchronous functions
		 * @method waitFor
		 * @param {string} eventName Wait for event with this name
		 * @returns {Promise<waitForEvent>} A Promise that will be fulfilled with an object, containing an `event` object and an `data` object, after `eventName` is triggered
		 * @memberof helpers
		 */
		waitFor(eventName) {
			if (typeof eventName !== "string") throw new TypeError(`Parameter eventName ${eventName} must be a string`)

			return new Promise(resolve => {
				function resolved(event, data) {
					// Remove the listener and resolve the promise:
					helpers.eventListeners.toggle(eventName, resolved, false)
					resolve({event, data})
				}

				// Add a listener that will call resolved() when the event is triggered:
				helpers.eventListeners.toggle(eventName, resolved, true)
			})
		},
	},

	/**
	 * Allows basic, **vulnerable**, crypto operations
	 * @property {function} encrypt Encrypts a message
	 * @property {function} decrypt Decrypts a message
	 * @memberof helpers
	 */
	insecureCrypt: {
		/**
		 * Do the actual crypto operations
		 * @async
		 * @method _insecureCrypt
		 * @param {string} str Message to work on
		 * @param {string} key Key to work with
		 * @param {boolean} decrypt If true, decrypts the message. If false, encrypts the message
		 * @returns {Promise<string>} A promise that is resolved with a string containing the new message
		 * @private
		 * @memberof helpers
		 */
		async _insecureCrypt(str, key, decrypt) {
			if (typeof str !== "string") throw new TypeError("Parameter \"str\" must be a string")
			if (typeof key !== "string") throw new TypeError("Parameter \"key\" must be a string")
			if (typeof decrypt !== "boolean") throw new TypeError("Parameter \"decrypt\" must be a boolean")

			// Hash the key:
			key = await crypto.subtle.digest("SHA-512", new TextEncoder("utf-8").encode(key))
			key = new Uint8Array(key)

			// Convert to an array of codepoints:
			str = [...str].map(e => e.codePointAt())

			for (let i = 0; i < str.length; i++) {
				// Using modulus in case str is longer than key:
				const keyAtIndex = key[i % key.length]
				// In/Decrement by the keyAtIndex. If it's not decrypt, it's encrypt:
				str[i] = decrypt ? str[i] - keyAtIndex : str[i] + keyAtIndex
			}

			// Make sure there are no negative numbers in the array (a result of incorrect key):
			str = str.map(e => e < 0 ? 0 : e)

			// Convert to unencrypted string:
			str = String.fromCodePoint(...str)

			return str
		},

		/**
		 * **vulnerable** Encrypt a string using another string as a key
		 * @async
		 * @method encrypt
		 * @param {string} str Message to encrypt
		 * @param {string} key Key to encrypt the message with
		 * @returns {Promise<string>} A promise that is resolved with a string containing the encrypted message
		 * @memberof helpers
		 */
		async encrypt(str, key) { return await this._insecureCrypt(str, key, false) },

		/**
		 * **vulnerable** Decrypt a string using another string as a key
		 * @async
		 * @method decrypt
		 * @param {string} str Message to decrypt
		 * @param {string} key Key to decrypt the message with
		 * @returns {Promise<string>} A promise that is resolved with a string containing the decrypted message
		 * @memberof helpers
		 */
		async decrypt(str, key) { return await this._insecureCrypt(str, key, true) },
	},

	/**
	 * @function objectEquals Compares two objects and returns true if they have the same value
	 * @author {@link https://stackoverflow.com/a/6713782|Jean Vincent}
	 * @param {*} object1
	 * @param {*} object2
	 * @returns {boolean}
	 * @memberof helpers
	 */
	objectEquals(object1, object2) {
		if (object1 === object2) return true
		if (!(object1 instanceof Object) || !(object2 instanceof Object)) return false
		if (object1.constructor !== object2.constructor) return false
		for (const p in object1) {
			if (!object1.hasOwnProperty(p)) continue
			if (!object2.hasOwnProperty(p)) return false
			if (object1[p] === object2[p]) continue
			if (typeof object1[p] !== "object") return false
			if (!helpers.objectEquals(object1[p], object2[p])) return false
		}
		for (const p in object2) {
			if (object2.hasOwnProperty(p) && !object1.hasOwnProperty(p)) return false
		}
		return true
	},

	/**
	 * @function capitalize
	 * @param {string} str
	 * @returns {string}
	 * @memberof helpers
	 */
	capitalize(str) {
		return str[0].toUpperCase() + str.substring(1)
	},

	/**
	 * Converts a Latin numeral to Roman numeral
	 * @function romanize
	 * @example
	 * // Returns "IX"
	 * romanize(9)
	 * @param {number} num Latin numeral
	 * @returns {string} String containing a roman numeral
	 * @private
	 * @memberof background
	 */
	romanize(num) {
		if (!num) return ""

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
	},
}

/* Respond to messages from the backround script asking if we are alive */
browser.runtime.onMessage.addListener((message, _, sendResponse) => {
	if (message === "Content script running?") sendResponse(true)
	console.log("Message received")
})
