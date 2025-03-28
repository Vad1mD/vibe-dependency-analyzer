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

module.exports = { createJsonOutput }; 