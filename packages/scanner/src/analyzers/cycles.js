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

        // Handle the dependency format with path and isExternal keys
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

module.exports = { detectCycles }; 