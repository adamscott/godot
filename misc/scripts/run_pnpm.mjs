import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, resolve, isAbsolute } from "node:path";
import { argv, chdir, cwd, exit } from "node:process";
import { fileURLToPath } from "node:url";

const FILE_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR_PATH = dirname(FILE_PATH);
const ROOT_DIR_PATH = resolve(SCRIPT_DIR_PATH, "../..");

/**
 * Returns the nearest package.json path.
 * @param {string} pFilePath
 * @returns {Promise<string | null>}
 * @throws
 */
async function getNearestPackageJsonDirPath(pFilePath) {
	let currentDir = resolve(dirname(pFilePath));
	while (currentDir !== ROOT_DIR_PATH) {
		const packageJsonPath = resolve(currentDir, "package.json");
		try {
			const packageJsonStat = await stat(packageJsonPath);
			if (packageJsonStat.isDirectory()) {
				throw new Error(`"${packageJsonReadlinkPath}" is not a file, it's a dir.`);
			}
			if (packageJsonStat.isFile()) {
				return currentDir;
			}
		} catch (pError) {
			// Do nothing, stat failed.
		}
		currentDir = resolve(currentDir, "..");
	}

	return null;
}

/**
 * Install project with `pnpm`.
 * @returns {Promise<number | null>}
 */
async function launchPnpmInstall() {
	const command = ["npx", "--yes", "pnpm", "install"];
	const commandString = command.join(" ");
	return await new Promise((pResolve, _) => {
		console.info(`Launching \`${commandString}\``);
		const npxInstallProcess = spawn(command[0], command.slice(1), {
			stdio: "inherit",
		});
		npxInstallProcess.on("error", (pError) => {
			console.error(`Error while running \`${commandString}\`:`, pError);
		});
		npxInstallProcess.on("exit", (pCode) => {
			pResolve(pCode);
		});
	});
}

/**
 * Launch process for the specified file.
 * @param {string} pCommand
 * @param {string[]} pArgs
 * @param {string} pFileToProcess
 * @returns {Promise<number | null>}
 */
async function processFile(pCommand, pArgs, pFileToProcess) {
	const args = pArgs;
	let fileToProcess = pFileToProcess;
	let currentDir = cwd();

	if (!isAbsolute(fileToProcess)) {
		fileToProcess = resolve(ROOT_DIR_PATH, fileToProcess);
	}

	const nearestPackageJsonDir = await getNearestPackageJsonDirPath(fileToProcess);
	if (nearestPackageJsonDir == null) {
		switch (pCommand.toLowerCase()) {
			case "eslint":
				currentDir = resolve(ROOT_DIR_PATH, "platform/web/packages/eslint-config/");
				args.push("--no-config-lookup", "--config", "eslint.config.ts");
				break;
			case "prettier":
				currentDir = resolve(ROOT_DIR_PATH, "platform/web/packages/prettier-config/");
				args.push("--config", "prettier.config.mts");
				break;
			case "stylelint":
				currentDir = resolve(ROOT_DIR_PATH, "platform/web/packages/stylelint-config/");
				args.push("--config", "stylelint.config.ts");
				break;
			default:
				throw new Error(`Command \`${pCommand}\` not supported by "misc/scripts/run_pnpm.mjs".`);
		}
	} else {
		currentDir = nearestPackageJsonDir;
	}

	const command = ["npx", "--yes", "pnpm", "exec", pCommand, ...args, fileToProcess];
	const commandString = command.join(" ");

	return await new Promise((resolve, _) => {
		console.info(`Launching \`${commandString}\``);
		const commandProcess = spawn(command[0], command.slice(1), {
			stdio: "inherit",
			cwd: currentDir,
		});
		commandProcess.on("error", (pError) => {
			console.error(`Error while running \`${command}\`:`, pError);
		});
		commandProcess.on("exit", (pCode) => {
			resolve(pCode);
		});
	});
}

/**
 * Main script function.
 */
async function main() {
	chdir(ROOT_DIR_PATH);
	console.info("main argv:", argv)

	let returnCode = await launchPnpmInstall();
	if (returnCode != null && returnCode !== 0) {
		exit(returnCode);
	}

	const indexOfFirstArgSeparator = argv.indexOf("--");
	if (indexOfFirstArgSeparator === -1) {
		throw new Error("Couldn't find first `--` in args to signal start of the command to launch.");
	}
	const indexOfCommand = indexOfFirstArgSeparator + 1;
	if (indexOfCommand >= argv.length) {
		throw new Error("Couldn't find command after first `--` in args.");
	}
	const command = argv[indexOfCommand];
	const indexOfCommandArgs = indexOfCommand + 1;
	const indexOfSecondDoubleDash = argv.indexOf("-- ", indexOfCommand);
	if (indexOfSecondDoubleDash === -1) {
		throw new Error("Couldn't find second `--` in args to signal list of files to feed to command.");
	}
	const indexOfFilesToProcess = indexOfSecondDoubleDash + 1;
	if (indexOfFilesToProcess >= argv.length) {
		throw new Error("Couldn't find files after second `--` in args.");
	}
	/** @type {string[]} */
	let commandArgs = [];
	if (indexOfCommandArgs !== indexOfSecondDoubleDash) {
		commandArgs = argv.slice(indexOfCommandArgs, indexOfSecondDoubleDash);
	}
	const filesToProcess = argv.slice(indexOfFilesToProcess);

	for (const fileToProcess of filesToProcess) {
		let processedFileResult = null;
		try {
			processedFileResult = await processFile(command, commandArgs, fileToProcess);
			if (processedFileResult != null && processedFileResult !== 0) {
				exit(processedFileResult);
			}
		} catch (eError) {
			console.error(eError);
			exit(1);
		}
	}
}

try {
	await main();
} catch (eError) {
	console.error("Error while running `misc/scripts/run_pnpm.mjs`:", eError);
}
