const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { scanDependencies } = require('./analyzers/dependencies');
const { detectCycles } = require('./analyzers/cycles'); 
const { analyzeDeploymentModes } = require('./analyzers/modes');
const { createJsonOutput } = require('./formatter');

/**
 * Execute the dependency analysis
 */
function executeAnalysis(targetPath, options) {
    // Parse file extensions and excluded directories
    const fileExtensions = options.extensions.split(',');
    const excludeDirs = options.exclude.split(',');
    const maxDepth = options.maxDepth ? parseInt(options.maxDepth) : null;

    // Check if path is a file or directory
    const isFile = fs.existsSync(targetPath) && fs.statSync(targetPath).isFile();
    const rootDir = isFile ? path.dirname(targetPath) : targetPath;
    const startFile = isFile ? path.basename(targetPath) : null;

    console.log(`Will scan for files with extensions: ${fileExtensions}`);
    console.log(`Will exclude directories: ${excludeDirs}`);

    if (isFile) {
        console.log(`Analyzing single file: ${targetPath}`);
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
}

/**
 * Set up and run the CLI
 */
function run() {
    program
        .name('dependency-scanner')
        .description('Generate a dependency graph for JavaScript/TypeScript applications')
        .argument('<path>', 'Root directory or entry file of the application')
        .option('-o, --output <file>', 'Output JSON file path', 'dependency-graph.json')
        .option('-m, --analyze-modes', 'Attempt to analyze deployment modes')
        .option('-e, --extensions <extensions>', 'Comma-separated list of file extensions to scan', '.js,.jsx,.ts,.tsx')
        .option('-x, --exclude <dirs>', 'Comma-separated list of directories to exclude', 'node_modules,tests,test')
        .option('-d, --max-depth <number>', 'Maximum depth of dependency traversal')
        .action(executeAnalysis);

    program.parse();
}

module.exports = { run }; 