const { scanDependencies } = require('./analyzers/dependencies');
const { detectCycles } = require('./analyzers/cycles');
const { analyzeDeploymentModes } = require('./analyzers/modes');
const { createJsonOutput } = require('./formatter');

/**
 * @module dependency-scanner
 * Main dependency scanner module exporting all core functionality
 */

module.exports = {
  scanDependencies,
  detectCycles,
  analyzeDeploymentModes,
  createJsonOutput
}; 