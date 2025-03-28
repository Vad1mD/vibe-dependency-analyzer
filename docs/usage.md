# Usage Guide

## Command Line Usage

The dependency analyzer can be used from the command line to analyze JavaScript and TypeScript projects.

### Basic Usage

```bash
# Analyze a project directory
./bin/dependency-analyzer /path/to/your/project -o dependency-graph.json

# Analyze a specific file
./bin/dependency-analyzer /path/to/your/project/app.js -o dependency-graph.json
```

### Command Line Options

```
-o, --output       Output JSON file path (default: dependency-graph.json)
-m, --analyze-modes Attempt to analyze deployment modes
-e, --extensions   Comma-separated list of file extensions to scan 
                   (default: .js,.jsx,.ts,.tsx)
-x, --exclude      Comma-separated list of directories to exclude 
                   (default: node_modules,tests,test)
-d, --max-depth    Maximum depth of dependency traversal
```

## Visualization

1. Generate a JSON dependency graph using the command line tool
2. Open `visualizer/current/index.html` in your web browser
3. Click "Choose JSON File" and select your generated JSON file
4. Explore the dependency graph using the visualization tools

### Visualization Features

- Interactive force-directed graph
- Highlighting of circular dependencies
- Search for specific files
- Zoom and pan controls
- Different layout options 