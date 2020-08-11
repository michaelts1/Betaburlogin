"use strict"

/**
 * Object used to manage jQuery document event listeners
 * @const eventListeners
 * @property {function} toggle Toggles an event listener on/off
 * @property {...function[]}
 * - One or more properties using the following format:
 * - string: function[]
 * - Where the string is the name of the event (e.g. "roa-ws:all"), and function[] is an array of functions that will be called when the event is triggered
 * - Example: `eventListeners["roa-ws:page"] = [onPage, getPage, log]` will call onPage(), getPage(), and log() whenever "roa-ws:page" is triggered
 */
/* eslint-disable-next-line no-redeclare, no-unused-vars */ // Defined in this file, used in other files
const eventListeners = {
	/**
	 * Attaches/deattaches handlers to document events, while avoiding having duplicate listeners
	 * @method toggle
	 * @param {string} eventName - Listen to events with this name
	 * @param {function} handler - Handle the event with this handler
	 * @param {boolean} turnOn - If true, turns the event listener on. If false, turns the event listener off
	 * */
	toggle(eventName, handler, turnOn) {
		if (typeof eventName !== "string") throw new TypeError(`Parameter eventName ${eventName} must be a string`)
		if (typeof handler !== "function") throw new TypeError(`Parameter handler ${handler} must be function`)
		if (typeof turnOn !== "boolean") throw new TypeError(`Parameter turnOn ${turnOn} must be boolean`)

		if (this[eventName] === undefined) {
			this[eventName] = []
		}
		const prop = this[eventName] // Shorter identifier

		if (prop.includes(handler) && turnOn) { // Turn off the previous event handler to avoid duplicates
			$(document).off(eventName, handler)
		}

		$(document)[turnOn ? "on" : "off"](eventName, handler) // If turnOn is true, $(document).on(...), if false, $(document).off(...)
		if (prop.includes(handler) && !turnOn) { // Push/pop the handler from the handlers array
			prop.splice(prop.indexOf(handler), 1)
		} else if (turnOn) {
			prop.push(handler)
		}
	},

	/**
	 * Allows waiting for events in asynchronous functions
	 * @method waitFor
	 * @param {string} eventName Wait for event with this name
	 * @returns {promise} A Promise that will be fulfilled with no arguments after `eventName` is triggered
	 */
	waitFor(eventName) {
		if (typeof eventName !== "string") throw new TypeError(`Parameter eventName ${eventName} must be a string`)

		return new Promise(resolve => {
			function resolved() {
				eventListeners.toggle(eventName, resolved, false) // Remove the listener
				resolve() // Resolve the promise
			}
			eventListeners.toggle(eventName, resolved, true) // Add a listener that will call resolved() when the event is triggered
		})
	}
}
