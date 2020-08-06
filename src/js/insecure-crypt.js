"use strict"

/* eslint-disable-next-line no-redeclare, no-unused-vars */ // Defined it this file, used in other files
const insecureCrypt = {
	_insecureCrypt: function(str, key, encrypt) {
		if (typeof str !== "string") throw new TypeError("Parameter \"str\" must be a string")
		if (typeof key !== "string") throw new TypeError("Parameter \"key\" must be a string")
		if (typeof encrypt !== "boolean") throw new TypeError("Parameter \"encrypt\" must be a boolean")

		str = [...str].map(e => e.codePointAt()) // Convert to an array of codepoints

		for (let i = 0; i < str.length; i++) {
			// Using modulus in case str is longer than key
			const keyAtIndex = key[i % key.length].codePointAt()
			// In/Decrement by the keyAtIndex. If it's not encrypt, it's decrypt
			//console.log(`${String.fromCodePoint(str[i])} (${str[i]}) ${encrypt ? "+" : "-"} ${key[i % key.length]} (${key[i % key.length].codePointAt()}) = ${encrypt ? str[i] + keyAtIndex : str[i] - keyAtIndex}`)
			str[i] = encrypt ? str[i] + keyAtIndex : str[i] - keyAtIndex
		}

		str = String.fromCodePoint(...str) // Convert to unencrypted string

		return str
	},
	encrypt(str, key) { return this._insecureCrypt(str, key, true) },
	decrypt(str, key) { return this._insecureCrypt(str, key, false) },
}
