#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

/**
 * Parse JS/TS imports from a file and return a list of imported modules.
 * @param {string} filePath - Path to the file to analyze
 * @returns {string[]} List of imported modules
 */
function parseJsImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = new Set();

    // Match ES6 imports
    const es6Pattern = /import\s+(?:(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6Pattern.exec(content)) !== null) {
        imports.add(match[1]);
    }

    // Match CommonJS require statements with variable declarations
    const cjsPattern = /(?:const|let|var)\s+(?:{[^}]*}|\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((match = cjsPattern.exec(content)) !== null) {
        imports.add(match[1]);
    }

    // Match direct require calls
    const directRequire = /require\(['"]([^'"]+)['"]\)/g;
    while ((match = directRequire.exec(content)) !== null) {
        imports.add(match[1]);
    }

    // Match dynamic imports
    const dynamicImport = /import\(['"]([^'"]+)['"]\)/g;
    while ((match = dynamicImport.exec(content)) !== null) {
        imports.add(match[1]);
    }

    // Match destructured requires
    const destructuredRequire = /const\s*{([^}]+)}\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((match = destructuredRequire.exec(content)) !== null) {
        imports.add(match[2]);
    }

    // Match requires with multiple variables
    const multiVarRequire = /const\s+([^=]+)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((match = multiVarRequire.exec(content)) !== null) {
        imports.add(match[2]);
    }

    return Array.from(imports);
}

/**
 * Resolve relative import paths to absolute paths within the project.
 * @param {string} baseDir - Base directory of the project
 * @param {string} importingFile - Path to the file doing the import
 * @param {string} importedModule - The imported module path
 * @returns {string} Resolved path
 */
function resolveImportPath(baseDir, importingFile, importedModule) {
    if (importedModule.startsWith('.')) {
        // It's a relative import
        const importingDir = path.dirname(importingFile);
        const resolvedPath = path.normalize(path.join(importingDir, importedModule));

        // Try to resolve to an actual file
        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
            return resolvedPath;
        }

        // Try with different extensions
        const extensions = ['.js', '.ts', '.jsx', '.tsx'];
        for (const ext of extensions) {
            if (fs.existsSync(resolvedPath + ext)) {
                return resolvedPath + ext;
            }
        }

        // Check for index files
        const indexExtensions = ['.js', '.ts', '.jsx', '.tsx'];
        for (const ext of indexExtensions) {
            const indexPath = path.join(resolvedPath, 'index' + ext);
            if (fs.existsSync(indexPath)) {
                return indexPath;
            }
        }

        // If we couldn't resolve it to a file, return the directory
        return resolvedPath;
    } else if (!importedModule.startsWith('@') && importedModule.includes('/') && !importedModule.startsWith('/')) {
        // It might be a local module without ./ prefix
        const parts = importedModule.split('/');
        if (parts[0] !== 'node_modules') {
            // Try to resolve as if it was a relative import
            return resolveImportPath(baseDir, importingFile, './' + importedModule);
        }
    }

    // It's an external module or couldn't be resolved
    return importedModule;
}

/**
 * Detect cycles in the dependency graph using DFS.
 * @param {Object} graph - The dependency graph
 * @returns {Array<Array<string>>} List of cycles found
 */
function detectCycles(graph) {
    const visited = new Set();
    const path = new Set();
    const cycles = [];

    function dfs(node, parentPath = []) {
        if (path.has(node)) {
            // Found a cycle
            const cycleStartIdx = parentPath.indexOf(node);
            const cycle = parentPath.slice(cycleStartIdx).concat(node);
            cycles.push(cycle);
            return;
        }

        if (visited.has(node)) {
            return;
        }

        visited.add(node);
        path.add(node);
        const newPath = parentPath.concat(node);

        // Handle the new dependency format with path and isExternal keys
        for (const dep of graph[node] || []) {
            if (!dep.isExternal) { // Only follow internal dependencies for cycles
                dfs(dep.path, newPath);
            }
        }

        path.delete(node);
    }

    for (const node of Object.keys(graph)) {
        if (!visited.has(node)) {
            dfs(node);
        }
    }

    return cycles;
}

/**
 * Recursively find all nested dependencies for a file.
 * @param {string} filePath - Path to the file
 * @param {Object} dependencyGraph - The dependency graph
 * @param {Object} nestedDependencies - Object to store nested dependencies
 * @param {Set<string>} visited - Set of visited files
 */
function findNestedDependencies(filePath, dependencyGraph, nestedDependencies, visited) {
    if (visited.has(filePath)) {
        return; // Avoid infinite recursion
    }

    visited.add(filePath);

    // Get direct dependencies
    const directDeps = dependencyGraph[filePath] || [];

    // Add direct dependencies to the nested dependencies
    for (const dep of directDeps) {
        nestedDependencies[filePath].add(dep);

        // Recursively process each dependency
        findNestedDependencies(dep.path, dependencyGraph, nestedDependencies, new Set(visited));

        // Add nested dependencies of the current dependency
        const nestedDepsOfDep = nestedDependencies[dep.path] || new Set();
        nestedDepsOfDep.forEach(dep => nestedDependencies[filePath].add(dep));
    }
}

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
    // Validate the root directory exists
    if (!fs.existsSync(rootDir)) {
        console.error(`ERROR: Path '${rootDir}' does not exist.`);
        return {};
    }

    if (!fs.statSync(rootDir).isDirectory()) {
        console.error(`ERROR: '${rootDir}' is not a directory.`);
        return {};
    }

    // Print some diagnostics
    console.log(`Looking for files in: ${path.resolve(rootDir)}`);
    console.log(`Searching for file extensions: ${fileExtensions}`);
    console.log(`Excluding directories: ${excludeDirs}`);
    if (maxDepth !== null) {
        console.log(`Maximum dependency depth: ${maxDepth}`);
    }

    const dependencyGraph = {};
    const filesFound = new Set();

    // Find all JS/TS files
    function walkDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(rootDir, fullPath);

            // Skip excluded directories
            if (entry.isDirectory()) {
                if (!excludeDirs.some(excl => relPath.includes(excl))) {
                    walkDir(fullPath);
                }
                continue;
            }

            if (fileExtensions.some(ext => entry.name.endsWith(ext))) {
                filesFound.add(relPath);
            }
        }
    }

    walkDir(rootDir);

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

/**
 * Try to identify files used in different deployment modes based on common patterns.
 * @param {string} rootDir - Root directory of the project
 * @param {Object} dependencyGraph - The dependency graph
 * @returns {Object} Files used in each deployment mode
 */
function analyzeDeploymentModes(rootDir, dependencyGraph) {
    const modePatterns = {
        'development': ['dev', 'development', 'local'],
        'testing': ['test', 'testing'],
        'staging': ['stage', 'staging'],
        'production': ['prod', 'production']
    };

    const modeFiles = {};
    for (const mode of Object.keys(modePatterns)) {
        modeFiles[mode] = new Set();
    }

    // First pass: identify files directly related to a mode
    for (const filePath of Object.keys(dependencyGraph)) {
        const fileLower = filePath.toLowerCase();
        for (const [mode, patterns] of Object.entries(modePatterns)) {
            if (patterns.some(pattern => fileLower.includes(pattern))) {
                modeFiles[mode].add(filePath);
            }
        }
    }

    // Second pass: follow dependencies to identify files used in each mode
    for (const mode of Object.keys(modePatterns)) {
        const visited = new Set();
        const toVisit = Array.from(modeFiles[mode]);

        while (toVisit.length > 0) {
            const current = toVisit.pop();
            if (visited.has(current)) {
                continue;
            }

            visited.add(current);
            modeFiles[mode].add(current);

            // Add all dependencies
            for (const dep of dependencyGraph[current] || []) {
                if (!visited.has(dep.path)) {
                    toVisit.push(dep.path);
                }
            }
        }
    }

    return modeFiles;
}

/**
 * Create the final JSON output.
 * @param {Object} dependencyGraph - The dependency graph
 * @param {Array<Array<string>>} cycles - List of cycles found
 * @param {Object} modeFiles - Files used in each deployment mode
 * @returns {Object} The final JSON output
 */
function createJsonOutput(dependencyGraph, cycles, modeFiles = null) {
    // Create a list of files with circular dependencies
    const circularDeps = new Set();
    for (const cycle of cycles) {
        cycle.forEach(file => circularDeps.add(file));
    }

    // Get all unique file paths (both sources and targets)
    const allFiles = new Set(Object.keys(dependencyGraph));
    for (const deps of Object.values(dependencyGraph)) {
        deps.forEach(dep => allFiles.add(dep.path));
    }

    // Separate internal and external dependencies
    const internalFiles = new Set(Array.from(allFiles).filter(f => 
        f.startsWith('.') || f.startsWith('/') || dependencyGraph[f]
    ));
    const externalFiles = new Set(Array.from(allFiles).filter(f => !internalFiles.has(f)));

    // Create nodes
    const nodes = Array.from(allFiles).map(filePath => {
        const node = {
            id: filePath,
            isExternal: externalFiles.has(filePath),
            dependencies: dependencyGraph[filePath] || [],
            hasCircularDependency: circularDeps.has(filePath)
        };

        // Add deployment mode information if available
        if (modeFiles) {
            node.deploymentModes = Object.entries(modeFiles)
                .filter(([_, files]) => files.has(filePath))
                .map(([mode]) => mode);
        }

        return node;
    });

    // Create the final structure
    const result = {
        nodes,
        cycles,
        summary: {
            totalFiles: allFiles.size,
            internalFiles: internalFiles.size,
            externalFiles: externalFiles.size,
            totalDependencies: Object.values(dependencyGraph).reduce((sum, deps) => sum + deps.length, 0),
            filesWithCircularDependencies: circularDeps.size,
            totalCycles: cycles.length
        }
    };

    // Add deployment mode summary if available
    if (modeFiles) {
        result.deploymentModes = Object.entries(modeFiles).reduce((acc, [mode, files]) => {
            acc[mode] = {
                fileCount: files.size,
                files: Array.from(files)
            };
            return acc;
        }, {});
    }

    return result;
}

// CLI setup
program
    .name('dependency-analyzer')
    .description('Generate a dependency graph for a Node.js application')
    .argument('path', 'Root directory or entry file of the Node.js application')
    .option('-o, --output <file>', 'Output JSON file path', 'dependency-graph.json')
    .option('-m, --analyze-modes', 'Attempt to analyze deployment modes')
    .option('-e, --extensions <extensions>', 'Comma-separated list of file extensions to scan', '.js,.jsx,.ts,.tsx')
    .option('-x, --exclude <dirs>', 'Comma-separated list of directories to exclude', 'node_modules,tests,test')
    .option('-d, --max-depth <number>', 'Maximum depth of dependency traversal')
    .action((path, options) => {
        // Parse file extensions and excluded directories
        const fileExtensions = options.extensions.split(',');
        const excludeDirs = options.exclude.split(',');
        const maxDepth = options.maxDepth ? parseInt(options.maxDepth) : null;

        // Check if path is a file or directory
        const isFile = fs.existsSync(path) && fs.statSync(path).isFile();
        const rootDir = isFile ? path.dirname(path) : path;
        const startFile = isFile ? path.basename(path) : null;

        console.log(`Will scan for files with extensions: ${fileExtensions}`);
        console.log(`Will exclude directories: ${excludeDirs}`);

        if (isFile) {
            console.log(`Analyzing single file: ${path}`);
        } else {
            console.log(`Scanning dependencies in directory: ${rootDir}`);
        }

        if (maxDepth !== null) {
            console.log(`Maximum dependency depth: ${maxDepth}`);
        }

        // Scan dependencies
        const dependencyGraph = scanDependencies(rootDir, fileExtensions, startFile, excludeDirs, maxDepth);

        // Detect cycles
        console.log("Detecting circular dependencies...");
        const cycles = detectCycles(dependencyGraph);

        // Analyze deployment modes if requested
        let modeFiles = null;
        if (options.analyzeModes) {
            console.log("Analyzing deployment modes...");
            modeFiles = analyzeDeploymentModes(rootDir, dependencyGraph);
        }

        // Create and save the output
        const result = createJsonOutput(dependencyGraph, cycles, modeFiles);
        fs.writeFileSync(options.output, JSON.stringify(result, null, 2));

        console.log(`Dependency graph saved to ${options.output}`);
        console.log(`Total files: ${result.summary.totalFiles}`);
        console.log(`Total dependencies: ${result.summary.totalDependencies}`);
        console.log(`Files with circular dependencies: ${result.summary.filesWithCircularDependencies}`);
        console.log(`Total cycles: ${result.summary.totalCycles}`);

        if (cycles.length > 0) {
            console.log("\nWarning: Circular dependencies detected:");
            cycles.slice(0, 5).forEach((cycle, i) => {
                console.log(`  Cycle ${i + 1}: ${cycle.join(' -> ')}`);
            });

            if (cycles.length > 5) {
                console.log(`  ... and ${cycles.length - 5} more cycles (see the JSON output for details)`);
            }
        }
    });

program.parse(); 