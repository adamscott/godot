/**************************************************************************/
/*  index.ts                                                              */
/**************************************************************************/
/*                         This file is part of:                          */
/*                             GODOT ENGINE                               */
/*                        https://godotengine.org                         */
/**************************************************************************/
/* Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md). */
/* Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.                  */
/*                                                                        */
/* Permission is hereby granted, free of charge, to any person obtaining  */
/* a copy of this software and associated documentation files (the        */
/* "Software"), to deal in the Software without restriction, including    */
/* without limitation the rights to use, copy, modify, merge, publish,    */
/* distribute, sublicense, and/or sell copies of the Software, and to     */
/* permit persons to whom the Software is furnished to do so, subject to  */
/* the following conditions:                                              */
/*                                                                        */
/* The above copyright notice and this permission notice shall be         */
/* included in all copies or substantial portions of the Software.        */
/*                                                                        */
/* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,        */
/* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF     */
/* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. */
/* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY   */
/* CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,   */
/* TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE      */
/* SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                 */
/**************************************************************************/

import {
	type ExportSpecifierStructure,
	type ImportDeclarationStructure,
	type ImportSpecifierStructure,
	IndentationText,
	ModuleDeclarationKind,
	NewLineKind,
	Node,
	type OptionalKind,
	Project,
	QuoteKind,
	type SourceFile,
	type Statement,
	type StatementStructures,
	StructureKind,
	SyntaxKind,
	type WriterFunction,
	ts,
} from "ts-morph";
import { generateDisableEslintComment, generateDoNotModifyByHand, generateHeader } from "./header.js";
import { basename } from "node:path";
import { isFile } from "@godotengine/node-utils/fs";
import { rm } from "node:fs/promises";

interface ModuleData {
	importStatement: ImportDeclarationStructure;
	exportStatements: StatementStructures[];
}
type NamedImport = string | OptionalKind<ImportSpecifierStructure> | WriterFunction;
type NamedExport = string | OptionalKind<ExportSpecifierStructure> | WriterFunction;
interface SourceFileImportExport {
	namedImports: NamedImport[];
	namedExports: NamedExport[];
	exportStatements: StatementStructures[];
}

const EXTRACT_TO_GLOBAL_PREFIX = "__EXTRACT_TO_GLOBAL__";

export async function buildGlobalDTs(pTsConfigPath: string, pFilePath: string, pModulePaths: string[]): Promise<void> {
	if (await isFile(pFilePath)) {
		await rm(pFilePath);
	}

	const project = new Project({
		tsConfigFilePath: pTsConfigPath,
		manipulationSettings: {
			indentationText: IndentationText.Tab,
			newLineKind: NewLineKind.LineFeed,
			quoteKind: QuoteKind.Double,
			useTrailingCommas: true,
		},
	});

	const builtGlobalDTsFile = project.createSourceFile(pFilePath);
	const modulesData = await Promise.all(
		pModulePaths.map(async (pModulePath) => await processModule(project, pFilePath, pModulePath)),
	);

	const importDeclarations = builtGlobalDTsFile.addImportDeclarations(
		modulesData.map((pModuleData) => pModuleData.importStatement),
	);

	// Must be after "addImportDeclarations", as it __really__ wants to be at the top of the file.
	builtGlobalDTsFile.insertStatements(0, (pWriter) => {
		pWriter.write(generateHeader(basename(pFilePath)));
		pWriter.writeLine("");
		pWriter.writeLine(generateDoNotModifyByHand());
		pWriter.writeLine("");
		pWriter.writeLine(
			generateDisableEslintComment([
				"@typescript-eslint/naming-convention",
				"@typescript-eslint/no-deprecated",
				"@typescript-eslint/no-unused-vars",
				"sort-imports",
			]),
		);
		pWriter.writeLine("");
	});

	const globalModule = builtGlobalDTsFile.addModule({
		name: "global",
		hasDeclareKeyword: true,
	});
	globalModule.setDeclarationKind(ModuleDeclarationKind.Global);

	// Declare global statements.
	for (const importDeclaration of importDeclarations) {
		for (const namedImport of importDeclaration.getNamedImports()) {
			let symbol = namedImport.getSymbol();
			const aliasedSymbol = symbol?.getAliasedSymbol();
			if (aliasedSymbol != null) {
				symbol = aliasedSymbol;
			}
			if (symbol == null) {
				continue;
			}

			const extractedFromGlobalPrefix = new Map<string, string[]>();
			const generatedGlobalPrefixTypes = new Map<string, Map<string, Statement[]>>();

			const declarations = symbol
				.getDeclarations()
				.map((pDeclaration) => {
					if (!Node.isInterfaceDeclaration(pDeclaration) && !Node.isTypeAliasDeclaration(pDeclaration)) {
						return pDeclaration;
					}
					const declarationName = pDeclaration.getName();
					if (!declarationName.startsWith(EXTRACT_TO_GLOBAL_PREFIX)) {
						return pDeclaration;
					}
					namedImport.removeAlias();

					// For each global prefix interface entry (property).
					return pDeclaration
						.getType()
						.getProperties()
						.map((pProperty) => {
							// Return all the declarations of the properties (it's usually just a single ExportSpecifier);
							return pProperty.getDeclarations().map((pDeclaration) => {
								if (!Node.isExportSpecifier(pDeclaration)) {
									return null;
								}
								const aliasNode = pDeclaration.getSymbol()?.getAliasedSymbol();
								if (aliasNode == null) {
									return null;
								}
								// Return all the actual types.
								// eslint-disable-next-line max-nested-callbacks -- TODO: fix this issue.
								return aliasNode.getDeclarations().map((pDeclaration) => {
									const name = pDeclaration.getSymbol()?.getFullyQualifiedName();
									if (name == null) {
										return null;
									}

									const declarationNames = extractedFromGlobalPrefix.get(declarationName);
									if (declarationNames == null) {
										extractedFromGlobalPrefix.set(declarationName, [name]);
									} else {
										declarationNames.push(name);
									}

									let globalPrefixTypes = generatedGlobalPrefixTypes.get(declarationName);
									if (globalPrefixTypes == null) {
										globalPrefixTypes = new Map();
										generatedGlobalPrefixTypes.set(declarationName, globalPrefixTypes);
									}

									const globalPrefixTypesForName = globalPrefixTypes.get(name);
									if (globalPrefixTypesForName == null) {
										const insertedStatements = builtGlobalDTsFile.insertStatements(
											globalModule.getChildIndex(),
											[`type ${getGlobalPrefixTypeName(name)} = ${declarationName}["${name}"];`],
										);

										globalPrefixTypes.set(name, insertedStatements);
									}

									return pDeclaration;
								});
							});
						});
				})
				.flat(999)
				.filter((pDeclaration) => pDeclaration != null);

			globalModule.addStatements(
				declarations
					.map((pDeclaration): string | WriterFunction | StatementStructures | null => {
						const hasGlobalPrefix = (pName: string): boolean => {
							for (const [_globalPrefix, entries] of extractedFromGlobalPrefix.entries()) {
								if (entries.includes(pName)) {
									return true;
								}
							}
							return false;
						};

						// Variables.
						if (Node.isVariableDeclaration(pDeclaration)) {
							const variableStatement = pDeclaration.getVariableStatement();
							if (variableStatement == null) {
								return null;
							}

							const name = pDeclaration.getName();
							const alias = getVariableAliasForName(name);
							const type = hasGlobalPrefix(name) ? getGlobalPrefixTypeName(name) : `typeof ${alias}`;

							return {
								kind: StructureKind.VariableStatement,
								declarationKind: variableStatement.getDeclarationKind(),
								declarations: [
									{
										kind: StructureKind.VariableDeclaration,
										name,
										type,
									},
								],
							};
						}
						// Interfaces.
						else if (Node.isInterfaceDeclaration(pDeclaration)) {
							const name = pDeclaration.getName();
							const alias = getTypeAliasForName(name);
							const type = hasGlobalPrefix(name) ? getGlobalPrefixTypeName(name) : alias;

							return {
								kind: StructureKind.Interface,
								name,
								extends: [type],
							};
						}
						// Types.
						else if (Node.isTypeAliasDeclaration(pDeclaration)) {
							const name = pDeclaration.getName();
							const alias = getTypeAliasForName(name);
							const type = hasGlobalPrefix(name) ? getGlobalPrefixTypeName(name) : alias;

							return {
								kind: StructureKind.TypeAlias,
								name,
								type,
							};
						}
						return null;
					})
					.filter((pStatement) => pStatement != null),
			);
		}
	}

	builtGlobalDTsFile.addExportDeclaration({});

	await builtGlobalDTsFile.save();
}

export async function processModule(pProject: Project, pFilePath: string, pModulePath: string): Promise<ModuleData> {
	const module = ts.resolveModuleName(
		pModulePath,
		pFilePath,
		pProject.getCompilerOptions(),
		pProject.getModuleResolutionHost(),
	);
	const resolvedModuleFileName = module.resolvedModule?.resolvedFileName ?? "";
	const sourceFile = pProject.getSourceFile(resolvedModuleFileName);
	if (sourceFile == null) {
		throw new Error(`Could not find module \`${pModulePath}\`.`);
	}

	const importExport = await processSourceFile(sourceFile);

	return {
		importStatement: {
			kind: StructureKind.ImportDeclaration,
			moduleSpecifier: pModulePath,
			namedImports: importExport.namedImports,
		},
		exportStatements: importExport.exportStatements,
	};
}

export async function processSourceFile(pSourceFile: SourceFile): Promise<SourceFileImportExport> {
	const namedImports: NamedImport[] = [];
	const namedExports: NamedExport[] = [];
	const exportStatements: StatementStructures[] = [];

	const exportResults = (
		await Promise.all(
			pSourceFile.getExportDeclarations().map(async (pExportDeclaration) => {
				// Namespace export => `export * from "my-module"`
				if (pExportDeclaration.isNamespaceExport()) {
					// It exports everything from the module, so let's treat that itself like a source file.
					const moduleSourceFile = pExportDeclaration.getModuleSpecifierSourceFile();
					if (moduleSourceFile == null) {
						return null;
					}

					return await processSourceFile(moduleSourceFile);
				}

				const namedExports = pExportDeclaration.getNamedExports();
				const output: Omit<SourceFileImportExport, "exportStatements"> = {
					namedImports: namedExports
						.map((pNamedExport) => {
							const name = pNamedExport.getName();
							const symbol = pNamedExport.getSymbol()?.getAliasedSymbol() ?? null;
							if (symbol == null) {
								return null;
							}

							return symbol.getDeclarations().map((pSymbolDeclaration) => {
								if (hasTypeDeclaration(pSymbolDeclaration)) {
									const alias = getTypeAliasForName(name);
									return {
										name,
										alias,
										isTypeOnly: true,
									};
								} else {
									const alias = getVariableAliasForName(name);
									return {
										name,
										alias,
										isTypeOnly: false,
									};
								}
							});
						})
						.filter((pNamedImport) => pNamedImport != null)
						.flat(),
					namedExports: namedExports.map((pNamedExport) => {
						const name = pNamedExport.getName();
						const isInterface = pNamedExport.getType().isInterface();
						return {
							name,
							isTypeOnly: isInterface,
						};
					}),
				};
				return output;
			}),
		)
	)
		.filter((pValue): pValue is NonNullable<typeof pValue> => {
			return pValue != null;
		})
		.reduce(
			(pAccumulator, pValue) => {
				pAccumulator.namedImports.push(...pValue.namedImports);
				pAccumulator.namedExports.push(...pValue.namedExports);
				return pAccumulator;
			},
			{ namedImports: [], namedExports: [] },
		);

	namedImports.push(...exportResults.namedImports);
	namedExports.push(...exportResults.namedExports);

	for (const statement of pSourceFile.getStatements()) {
		// Variable.
		if (statement.isKind(SyntaxKind.VariableStatement)) {
			if (!statement.isExported() && !pSourceFile.isDeclarationFile()) {
				continue;
			}

			for (const declararation of statement.getDeclarations()) {
				const name = declararation.getName();
				const alias = getVariableAliasForName(name);

				namedImports.push({
					name: declararation.getName(),
					alias,
				});
			}
		}
		// Interface && Types.
		else if (
			statement.isKind(SyntaxKind.InterfaceDeclaration) ||
			statement.isKind(SyntaxKind.TypeAliasDeclaration)
		) {
			if (!statement.isExported() && !pSourceFile.isDeclarationFile()) {
				continue;
			}

			const typeName = statement.getName();
			const alias = getTypeAliasForName(typeName);

			namedImports.push({
				name: typeName,
				alias,
				isTypeOnly: true,
			});
		}
	}

	return {
		namedImports,
		namedExports,
		exportStatements,
	};
}

function getVariableAliasForName(pName: string): string {
	return `__${pName}`;
}

function getTypeAliasForName(pName: string): string {
	return `__${pName}Type`;
}

function getGlobalPrefixTypeName(pName: string): string {
	return `__Global_${pName}Type`;
}

function hasTypeDeclaration(pNode: Node): boolean {
	return Node.isInterfaceDeclaration(pNode) || Node.isTypeAliasDeclaration(pNode);
}
