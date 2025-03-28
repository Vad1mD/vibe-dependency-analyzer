const fs = require('fs');
const path = require('path');
const { parseJsImports } = require('../parser');
const { resolveImportPath } = require('../utils/resolver');
const { findJsFiles } = require('../utils/fileSystem');

/**
 * Process a file and all its dependencies.
 * @param {string} filePath - Path to the file
 * @param {string} rootDir - Root directory of the project
 * @param {Set<string>} filesFound - Set of files found
 * @param {Object} dependencyGraph - The dependency graph
 * @param {Set<string>} processedFiles - Set of processed files
 * @param {number} depth - Current depth in the dependency tree
 * @param {number} maxDepth - Maximum depth to traverse
 */
function processFileDependencies(filePath, rootDir, filesFound, dependencyGraph, processedFiles = new Set(), depth = 0, maxDepth = null) {
    // Skip if we've already processed this file
    if (processedFiles.has(filePath)) {
        return;
    }

    // Skip if we've reached max depth (if specified)
    if (maxDepth !== null && depth > maxDepth) {
        return;
    }

    processedFiles.add(filePath);
    const fullPath = path.join(rootDir, filePath);

    // Skip if file doesn't exist
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        return;
    }

    // Initialize the array for this file if it doesn't exist
    if (!dependencyGraph[filePath]) {
        dependencyGraph[filePath] = [];
    }

    // Parse imports for the current file
    const imports = parseJsImports(fullPath);
    console.log(`\nProcessing imports for ${filePath}:`);
    
    for (const imported of imports) {
        console.log(`  Found import: ${imported}`);
        const resolvedImport = resolveImportPath(rootDir, fullPath, imported);
        console.log(`  Resolved to: ${resolvedImport}`);

        // Try to get relative path for project files
        let relResolved = null;
        try {
            if (fs.existsSync(resolvedImport) && fs.statSync(resolvedImport).isFile()) {
                relResolved = path.relative(rootDir, resolvedImport);
                console.log(`  Relative path: ${relResolved}`);
            }
        } catch (error) {
            // This happens when the path is not under the root_dir (like node_modules)
            relResolved = resolvedImport;
            console.log(`  External dependency: ${resolvedImport}`);
        }

        if (relResolved) {
            if (!dependencyGraph[filePath].some(dep => dep.path === relResolved)) {
                dependencyGraph[filePath].push({
                    path: relResolved,
                    isExternal: !relResolved.startsWith('.') && !relResolved.startsWith('/') && !filesFound.has(relResolved)
                });
                console.log(`  Added dependency: ${filePath} -> ${relResolved} (depth: ${depth})`);
                
                // Only recursively process internal dependencies
                if (!dependencyGraph[filePath][dependencyGraph[filePath].length - 1].isExternal) {
                    processFileDependencies(relResolved, rootDir, filesFound, dependencyGraph, processedFiles, depth + 1, maxDepth);
                }
            } else {
                console.log(`  Skipping duplicate dependency: ${relResolved}`);
            }
        } else {
            console.log(`  Skipping: ${relResolved} (could not resolve)`);
        }
    }
}

/**
 * Scan the project directory and build a dependency graph.
 * @param {string} rootDir - Root directory to scan
 * @param {string[]} fileExtensions - File extensions to scan
 * @param {string} startFile - Optional starting file
 * @param {string[]} excludeDirs - Directories to exclude
 * @param {number} maxDepth - Maximum depth to traverse
 * @returns {Object} The dependency graph
 */
function scanDependencies(rootDir, fileExtensions = ['.js', '.jsx', '.ts', '.tsx'], startFile = null, excludeDirs = ['node_modules', 'tests', 'test'], maxDepth = null) {
    // Print some diagnostics
    console.log(`Looking for files in: ${path.resolve(rootDir)}`);
    console.log(`Searching for file extensions: ${fileExtensions}`);
    console.log(`Excluding directories: ${excludeDirs}`);
    if (maxDepth !== null) {
        console.log(`Maximum dependency depth: ${maxDepth}`);
    }

    const dependencyGraph = {};
    const filesFound = findJsFiles(rootDir, fileExtensions, excludeDirs);

    // Process dependencies recursively
    const processedFiles = new Set();
    if (startFile) {
        // If a start file is specified, begin with that file
        const startFilePath = path.join(rootDir, startFile);
        if (fs.existsSync(startFilePath) && fs.statSync(startFilePath).isFile()) {
            const relStartFile = path.relative(rootDir, startFilePath);
            console.log(`\nStarting dependency analysis from: ${relStartFile}`);
            processFileDependencies(relStartFile, rootDir, filesFound, dependencyGraph, processedFiles, 0, maxDepth);
        }
    } else {
        // Process all files
        console.log("\nProcessing all files in the project...");
        for (const filePath of filesFound) {
            processFileDependencies(filePath, rootDir, filesFound, dependencyGraph, processedFiles, 0, maxDepth);
        }
    }

    return dependencyGraph;
}

module.exports = { scanDependencies, processFileDependencies }; 