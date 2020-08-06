"use strict"

/**
 * Allows basic, **vulnerable**, crypto operation
 */
/* eslint-disable-next-line no-redeclare, no-unused-vars */ // Defined in this file, used in other files
const insecureCrypt = {
	/**
	 * @method Do the actual crypto operations
	 * @param {string} str Message to work on
	 * @param {string} key Key to work with
	 * @param {boolean} decrypt If decrypt is true, decrypts the message. If decrypt is false, encrypts the message
	 * @returns {string} A string containing the new message
	 * @private
	 */
	_insecureCrypt(str, key, decrypt) {
		if (typeof str !== "string") throw new TypeError("Parameter \"str\" must be a string")
		if (typeof key !== "string") throw new TypeError("Parameter \"key\" must be a string")
		if (typeof decrypt !== "boolean") throw new TypeError("Parameter \"decrypt\" must be a boolean")

		str = [...str].map(e => e.codePointAt()) // Convert to an array of codepoints

		for (let i = 0; i < str.length; i++) {
			// Using modulus in case str is longer than key
			const keyAtIndex = key[i % key.length].codePointAt()
			// In/Decrement by the keyAtIndex. If it's not decrypt, it's encrypt
			str[i] = decrypt ? str[i] - keyAtIndex : str[i] + keyAtIndex
		}

		str = String.fromCodePoint(...str) // Convert to unencrypted string

		return str
	},

	/**
	 * @method **vulnerable** Encrypt a string using another string as a key
	 * @param {string} str Message to encrypt
	 * @param {string} key Key to encrypt the message with
	 * @return {string} A string containing the encrypted message
	 */
	encrypt(str, key) { return this._insecureCrypt(str, key, true) },

	/**
	 * @method **vulnerable** Decrypt a string using another string as a key
	 * @param {string} str Message to decrypt
	 * @param {string} key Key to decrypt the message with
	 * @return {string} A string containing the decrypted message
	 */
	decrypt(str, key) { return this._insecureCrypt(str, key, false) },
}

insecureCrypt.encrypt("2to")
