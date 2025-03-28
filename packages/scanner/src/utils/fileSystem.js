const fs = require('fs');
const path = require('path');

/**
 * Find all JS/TS files in a directory.
 * @param {string} rootDir - Root directory to scan
 * @param {string[]} fileExtensions - JS/TS file extensions to look for
 * @param {string[]} excludeDirs - Directories to exclude
 * @returns {Set<string>} Set of found file paths relative to rootDir
 */
function findJsFiles(rootDir, fileExtensions, excludeDirs) {
    const filesFound = new Set();

    // Validate the root directory exists
    if (!fs.existsSync(rootDir)) {
        console.error(`ERROR: Path '${rootDir}' does not exist.`);
        return filesFound;
    }

    if (!fs.statSync(rootDir).isDirectory()) {
        console.error(`ERROR: '${rootDir}' is not a directory.`);
        return filesFound;
    }
    
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
    return filesFound;
}

module.exports = { findJsFiles }; 