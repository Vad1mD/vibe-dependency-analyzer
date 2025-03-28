const fs = require('fs');
const path = require('path');

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

module.exports = { resolveImportPath }; 