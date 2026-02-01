import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, resolve, isAbsolute } from "node:path";
import { argv, chdir, cwd, exit, execPath, env } from "node:process";
import { fileURLToPath } from "node:url";

const FILE_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR_PATH = dirname(FILE_PATH);
const ROOT_DIR_PATH = resolve(SCRIPT_DIR_PATH, "../..");

async function isFile(pPath) {
	try {
		const stats = await stat(pPath);
		return stats.isFile();
	} catch (eError) {
		return false;
	}
}

/**
 * Returns the nearest package.json path.
 * @param {string} pDirPath
 * @returns {Promise<string | null>}
 * @throws
 */
async function getNearestPackageJsonDirPath(pDirPath) {
	let currentDir = pDirPath;
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
	const command = ["corepack", "pnpm", "install"];
	const commandString = command.join(" ");
	return await new Promise((pResolve, _) => {
		console.info(`Launching \`${commandString}\``);
		const npxInstallProcess = spawn(command[0], command.slice(1), {
			stdio: "inherit",
		});
		npxInstallProcess.on("error", (pError) => {
			console.error(`Error while running \`${commandString}\`:`, pError);
		});
		npxInstallProcess.on("close", (pCode) => {
			pResolve(pCode);
		});
	});
}

/**
 * Launch process for the specified file.
 * @param {string} pCommand
 * @param {string[]} pArgs
 * @param {string} pDirectory
 * @param {string[]} pFilesToProcess
 * @returns {Promise<number | null>}
 */
async function processFiles(pCommand, pArgs, pDirectory, pFilesToProcess) {
	const args = pArgs;
	let filesToProcess = pFilesToProcess;
	let currentDir = cwd();

	const nearestPackageJsonDir = await getNearestPackageJsonDirPath(pDirectory);

	let hasNoConfig = nearestPackageJsonDir == null;

	if (nearestPackageJsonDir != null) {
		let configFile;
		switch (pCommand.toLowerCase()) {
			case "eslint":
				configFile = "eslint.config.ts";
				break;
			case "prettier":
				configFile = "prettier.config.mts";
				break;
			case "stylelint":
				configFile = "stylelint.config.ts";
				break;
			default:
				throw new Error(`Command \`${pCommand}\` not supported by "misc/scripts/run_pnpm.mjs".`);
		}
		const configPath = resolve(nearestPackageJsonDir, configFile);
		if (!(await isFile(configPath))) {
			hasNoConfig = true;
		}
	}

	if (nearestPackageJsonDir == null || hasNoConfig) {
		switch (pCommand.toLowerCase()) {
			case "eslint":
				currentDir = resolve(ROOT_DIR_PATH, "platform/web/packages/config-eslint/");
				args.push("--no-config-lookup", "--config", "eslint.config.ts");
				break;
			case "prettier":
				currentDir = resolve(ROOT_DIR_PATH, "platform/web/packages/config-prettier/");
				args.push("--config", "prettier.config.mts");
				break;
			case "stylelint":
				currentDir = resolve(ROOT_DIR_PATH, "platform/web/packages/config-stylelint/");
				args.push("--config", "stylelint.config.ts");
				break;
			default:
				throw new Error(`Command \`${pCommand}\` not supported by "misc/scripts/run_pnpm.mjs".`);
		}
	} else {
		currentDir = nearestPackageJsonDir;
	}

	const command = ["corepack", "pnpm", "exec", pCommand, ...args, ...filesToProcess];
	const commandString = command.join(" ");

	return await new Promise((resolve, _) => {
		console.info(`Launching \`${commandString}\``);
		const commandProcess = spawn(command[0], command.slice(1), {
			stdio: "inherit",
			cwd: currentDir,
		});
		commandProcess.on("error", (pError) => {
			console.error(`Error while running \`${commandString}\`:`, pError);
		});
		commandProcess.on("close", (pCode) => {
			resolve(pCode);
		});
	});
}

/**
 * Main script function.
 */
async function main() {
	chdir(ROOT_DIR_PATH);
	// console.info("main argv:", argv)

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
	const indexOfSecondDoubleDash = argv.indexOf("--", indexOfCommand);
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

	/** @type {Map<string, string[]>} */
	const filesByDir = new Map();
	for (const fileToProcess of filesToProcess) {
		const fileToProcessDir = dirname(fileToProcess);
		const absoluteFileToProcessPath = resolve(ROOT_DIR_PATH, fileToProcess);
		if (filesByDir.has(fileToProcessDir)) {
			filesByDir.get(fileToProcessDir).push(absoluteFileToProcessPath);
		} else {
			filesByDir.set(fileToProcessDir, [absoluteFileToProcessPath]);
		}
	}

	for (const [filesDir, filesToProcess] of filesByDir) {
		let processedFilesResult = null;
		try {
			processedFilesResult = await processFiles(command, commandArgs, filesDir, filesToProcess);
			if (processedFilesResult != null && processedFilesResult !== 0) {
				exit(processedFilesResult);
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
