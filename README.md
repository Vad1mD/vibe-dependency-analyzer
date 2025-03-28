# Dependency Analyzer

A tool for analyzing and visualizing dependencies in JavaScript/TypeScript projects.

## Features

- Scans JavaScript and TypeScript files for dependencies
- Detects circular dependencies in your codebase
- Generates a detailed dependency graph
- Visualizes dependencies with an interactive graph
- Analyzes files used in different deployment modes

## Project Structure

```
dependency-analyzer/
├── src/
│   └── scanner/           # Core dependency scanning logic
├── visualizer/
│   └── current/          # HTML/JS visualization
├── bin/                  # CLI executable
├── docs/                 # Documentation
└── examples/             # Example projects and outputs
```

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/dependency-analyzer.git
cd dependency-analyzer

# Install dependencies
npm install
```

## Usage

```bash
# Analyze a project
npm start /path/to/your/project -o output.json

# Or use the binary directly
./bin/dependency-analyzer /path/to/your/project -o output.json

# View visualization
Open visualizer/current/index.html in a browser and load the output.json file
```

## Command Line Options

```
-o, --output       Output JSON file path (default: dependency-graph.json)
-m, --analyze-modes Attempt to analyze deployment modes
-e, --extensions   Comma-separated list of file extensions to scan 
                   (default: .js,.jsx,.ts,.tsx)
-x, --exclude      Comma-separated list of directories to exclude 
                   (default: node_modules,tests,test)
-d, --max-depth    Maximum depth of dependency traversal
```

## License

MIT 