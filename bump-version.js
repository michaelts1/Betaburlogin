"use strict"

/* global require, process */
const jsonfile = require("jsonfile")

const manifestPath = "./manifest.json"
const updateListPath = "./updates.json"

const versionIncrementationDepth = process.argv[2]

/**
 * Increments a version string
 * @function incrementVersion
 * @param {string} version A version string to increment
 * @param {number} depth What part of the version string to increment
 * @example incrementVersion("1.9.2.1", 1) // Returns "1.10.0.0"
 */
function incrementVersion(version, depth) {
	// Split the version string into an array:
	let result = version.split(".")

	if (depth >= result.length) {
		// Fill the array to the required depth:
		for (let i = result.length; i <= depth; i++) {
			result[i] = "0"
		}
	}

	// Increment the version number at the requested depth:
	result[depth] = String(Number(result[depth]) + 1)

	// Reset all version numbers after said depth to 0:
	for (let i = +depth + 1; i < result.length; i++) {
		result[i] = "0"
	}

	// Join the resulted array back into a string:
	result = result.join(".")
	console.log(result)

	// Return the result:
	return result
}

async function update() {
	// Read files:
	const manifest = await jsonfile.readFile(manifestPath)
	const updateList = await jsonfile.readFile(updateListPath)

	// Increment version:
	manifest.version = incrementVersion(manifest.version, versionIncrementationDepth)

	// Push the new update to the update list:
	updateList.addons["betaburloginID@example.com"].updates.push({
		version: manifest.version,
		update_link: `https://github.com/michaelts1/Betaburlogin/releases/download/v${manifest.version}/betaburlogin-${manifest.version}-fx.xpi`,
		update_info_url: `https://github.com/michaelts1/Betaburlogin/releases/tag/v${manifest.version}`,
	})

	// Write to files:
	await jsonfile.writeFile(manifestPath, manifest, {spaces: "\t"})
	await jsonfile.writeFile(updateListPath, updateList, {spaces: "\t"})
}
update()
