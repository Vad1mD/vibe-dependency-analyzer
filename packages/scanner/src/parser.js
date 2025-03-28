const fs = require('fs');

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

module.exports = { parseJsImports }; 