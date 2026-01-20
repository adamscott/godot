#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, join as joinPath, relative as relativePath } from "node:path";
import { argv, exit } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Entrypoint.
 * @param {Array<string>} pArgv
 */
async function main(pArgv) {
	// Change dir to `/platform/web`.
	const rootDir = joinPath(__dirname, "..", "..");
	const platformWebDir = joinPath(rootDir, "platform", "web");

	const firstDoubleDashIndex = pArgv.indexOf("--", 0);
	if (firstDoubleDashIndex === -1) {
		throw new Error("Couldn't find first `--` in arguments");
	}

	const biomeActionsIndex = firstDoubleDashIndex + 1;
	if (pArgv.length <= biomeActionsIndex) {
		throw new Error("No biome action was submitted");
	}

	const secondDoubleDashIndex = pArgv.indexOf("--", biomeActionsIndex);
	if (secondDoubleDashIndex === -1) {
		throw new Error("Couldn't find second `--` in arguments");
	}

	const biomeActions = pArgv.slice(biomeActionsIndex, secondDoubleDashIndex);

	const nonRelativePaths = pArgv.slice(secondDoubleDashIndex + 1);
	if (nonRelativePaths.length < 1) {
		console.log("No files to check.");
		exit(0);
	}

	const relativePaths = nonRelativePaths.map((nonRelativePath) => {
		return relativePath(platformWebDir, nonRelativePath);
	});

	const biomeArgs = [...biomeActions, ...relativePaths];
	try {
		const biomeProcess = spawn("biome", biomeArgs, {
			cwd: platformWebDir,
			encoding: "buffer",
			stdio: "inherit",
		});
		biomeProcess.on("exit", (pError) => {
			if (pError) {
				console.error(`Error while running \`biome ${biomeArgs.join(" ")}\`.`);
				exit(1);
			}
			exit(0);
		});
	} catch (eError) {
		console.error(
			`Error while running \`biome ${biomeArgs.join(" ")}\`:`,
			eError.message,
		);
	}
}

try {
	await main(argv);
} catch (eError) {
	console.error("Error while running `main()`:", eError);
}
