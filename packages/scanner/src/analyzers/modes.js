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

module.exports = { analyzeDeploymentModes }; 