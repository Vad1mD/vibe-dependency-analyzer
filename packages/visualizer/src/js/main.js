// DOM elements
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const dropArea = document.getElementById('drop-area');
const infoPanel = document.getElementById('info-panel');
const totalFilesEl = document.getElementById('total-files');
const totalDepsEl = document.getElementById('total-deps');
const circularDepsEl = document.getElementById('circular-deps');
const cycleListEl = document.getElementById('cycle-list');
const deploymentModesSection = document.getElementById('deployment-modes-section');
const deploymentModesList = document.getElementById('deployment-modes-list');
const nodeSizeInput = document.getElementById('node-size');
const linkStrengthInput = document.getElementById('link-strength');
const highlightCyclesBtn = document.getElementById('highlight-cycles-btn');
const searchInput = document.getElementById('search-input');
const focusResetBtn = document.getElementById('focus-reset-btn');
const exportGraphBtn = document.getElementById('export-graph-btn');
const resetViewBtn = document.getElementById('reset-view');
const loader = document.querySelector('.loader');
const tooltipEl = document.getElementById('tooltip');
const zoomIn = document.getElementById('zoom-in');
const zoomOut = document.getElementById('zoom-out');
const zoomReset = document.getElementById('zoom-reset');

// State variables
let graph = null;
let simulation = null;
let nodes = [];
let links = [];
let nodeElements = null;
let linkElements = null;
let nodeSize = 7;
let highlightCycles = false;
let currentLayout = 'force';
let svg = d3.select('#graph');
let width = svg.node().parentElement.clientWidth;
let height = svg.node().parentElement.clientHeight;
let cyclicPaths = [];
let transform = d3.zoomIdentity;

// Set up SVG and zoom behavior
svg = svg
    .attr('width', width)
    .attr('height', height)
    .call(d3.zoom().on('zoom', zoomed))
    .append('g');

function zoomed(event) {
    transform = event.transform;
    svg.attr('transform', transform);
}

// File upload handlers
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        loadFile(file);
    }
});

// Drag and drop handling
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight() {
    dropArea.classList.add('active');
}

function unhighlight() {
    dropArea.classList.remove('active');
}

dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        loadFile(files[0]);
    }
}

function loadFile(file) {
    if (file.type !== 'application/json') {
        alert('Please upload a JSON file');
        return;
    }
    
    showLoader(true);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            processData(data);
            showLoader(false);
        } catch (error) {
            showLoader(false);
            alert('Error parsing JSON: ' + error.message);
        }
    };
    reader.onerror = function() {
        showLoader(false);
        alert('Error reading file');
    };
    reader.readAsText(file);
}

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}

function processData(data) {
    graph = data;
    
    // Update UI with statistics
    infoPanel.style.display = 'block';
    totalFilesEl.textContent = graph.summary.totalFiles || 0;
    totalDepsEl.textContent = graph.summary.totalDependencies || 0;
    circularDepsEl.textContent = graph.summary.filesWithCircularDependencies || 0;
    
    // Display cycles
    if (cycleListEl) {
        cycleListEl.innerHTML = '';
        graph.cycles.forEach((cycle, index) => {
            const cycleItem = document.createElement('div');
            cycleItem.className = 'cycle-item';
            cycleItem.textContent = `Cycle ${index + 1}: ${cycle.length} files`;
            cycleItem.title = cycle.join(' → ');
            cycleItem.addEventListener('click', () => highlightCyclePath(cycle));
            cycleListEl.appendChild(cycleItem);
        });
    }
    
    // Display deployment modes if available
    if (graph.deploymentModes && deploymentModesSection && deploymentModesList) {
        deploymentModesSection.style.display = 'block';
        deploymentModesList.innerHTML = '';
        
        Object.keys(graph.deploymentModes).forEach(mode => {
            const modeItem = document.createElement('div');
            modeItem.className = 'stat-item';
            modeItem.innerHTML = `<span>${mode}:</span><span class="stat-value">${graph.deploymentModes[mode].fileCount} files</span>`;
            deploymentModesList.appendChild(modeItem);
        });
    } else if (deploymentModesSection) {
        deploymentModesSection.style.display = 'none';
    }
    
    // Create visualization
    createGraph();
}

function createGraph() {
    // Clear previous visualization
    svg.selectAll('*').remove();
    
    // Prepare data for visualization
    nodes = graph.nodes.map(node => ({ ...node }));
    
    links = [];
    nodes.forEach(node => {
        // Handle both formats: array of dependency objects or array of strings
        const dependencies = node.dependencies || [];
        
        if (Array.isArray(dependencies)) {
            dependencies.forEach(dep => {
                const targetId = typeof dep === 'object' ? dep.path : dep;
                const target = nodes.find(n => n.id === targetId);
                
                if (target) {
                    const isCyclic = isCyclicLink(node.id, targetId);
                    links.push({
                        source: node.id,
                        target: targetId,
                        isCyclic,
                        isExternal: (typeof dep === 'object' && dep.isExternal) || false
                    });
                }
            });
        }
    });
    
    // Create a force simulation
    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(80))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .on('tick', ticked);
    
    // Create links
    linkElements = svg.append('g')
        .attr('class', 'links')
        .selectAll('path')
        .data(links)
        .enter().append('path')
        .attr('class', d => `link ${d.isCyclic ? 'cyclic' : ''} ${d.isExternal ? 'external' : ''}`)
        .attr('marker-end', d => d.isCyclic ? 'url(#arrow-cyclic)' : 'url(#arrow)');
    
    // Create arrow markers
    svg.append('defs').selectAll('marker')
        .data(['arrow', 'arrow-cyclic'])
        .enter().append('marker')
        .attr('id', d => d)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', d => d === 'arrow-cyclic' ? '#f38ba8' : '#45475a')
        .attr('d', 'M0,-5L10,0L0,5');
    
    // Create nodes
    nodeElements = svg.append('g')
        .attr('class', 'nodes')
        .selectAll('.node')
        .data(nodes)
        .enter().append('g')
        .attr('class', d => `node ${d.hasCircularDependency ? 'cyclic' : 'regular'} ${d.isExternal ? 'external' : ''}`)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended))
        .on('mouseover', showTooltip)
        .on('mouseout', hideTooltip)
        .on('click', nodeClicked);
    
    nodeElements.append('circle')
        .attr('r', nodeSize);
    
    // Add labels to nodes
    nodeElements.append('text')
        .attr('dx', 12)
        .attr('dy', '.35em')
        .text(d => getFileName(d.id))
        .each(function(d) {
            // Limit text length
            const text = d3.select(this);
            const textLength = text.node().getComputedTextLength();
            if (textLength > 100) {
                let textContent = text.text();
                text.text(textContent.substring(0, 15) + '...');
            }
        });
    
    // Update layout - always using force layout
    updateLayout('force');
}

// Set up event listeners for controls
nodeSizeInput.addEventListener('input', function() {
    nodeSize = parseInt(this.value);
    nodeElements.selectAll('circle').attr('r', nodeSize);
});

linkStrengthInput.addEventListener('input', function() {
    const strength = parseFloat(this.value);
    simulation.force('link').strength(strength);
    simulation.alpha(0.3).restart();
});

highlightCyclesBtn.addEventListener('click', function() {
    highlightCycles = !highlightCycles;
    
    if (highlightCycles) {
        this.textContent = 'Reset Highlights';
        nodeElements.classed('cyclic', d => d.hasCircularDependency);
        linkElements.classed('cyclic', d => d.isCyclic);
    } else {
        this.textContent = 'Highlight Cycles';
        nodeElements.classed('cyclic', false);
        linkElements.classed('cyclic', false);
    }
});

// Search functionality
searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    
    if (query.length > 0) {
        nodeElements.classed('inactive', d => !d.id.toLowerCase().includes(query));
        nodeElements.classed('active', d => d.id.toLowerCase().includes(query));
        
        linkElements.classed('inactive', true);
        linkElements.classed('active', d => {
            const sourceId = typeof d.source === 'object' ? d.source.id.toLowerCase() : d.source.toLowerCase();
            const targetId = typeof d.target === 'object' ? d.target.id.toLowerCase() : d.target.toLowerCase();
            return sourceId.includes(query) || targetId.includes(query);
        });
    } else {
        nodeElements.classed('inactive', false);
        nodeElements.classed('active', false);
        linkElements.classed('inactive', false);
        linkElements.classed('active', false);
    }
});

// Reset buttons
if (focusResetBtn) {
    focusResetBtn.addEventListener('click', function() {
        console.log("Reset button clicked");
        window.resetNodeFocus();
    });
}

if (resetViewBtn) {
    resetViewBtn.addEventListener('click', function() {
        console.log("Reset view button clicked");
        window.resetNodeFocus();
    });
}

// Zoom control handlers
zoomIn.addEventListener('click', function() {
    svg.transition().call(
        d3.zoom().scaleBy, 1.3
    );
});

zoomOut.addEventListener('click', function() {
    svg.transition().call(
        d3.zoom().scaleBy, 0.7
    );
});

zoomReset.addEventListener('click', function() {
    svg.transition().call(
        d3.zoom().transform, d3.zoomIdentity
    );
});

// Export button listener
if (exportGraphBtn) {
    exportGraphBtn.addEventListener('click', exportSelectedGraph);
}

// Handle window resize
window.addEventListener('resize', function() {
    width = svg.node().parentElement.clientWidth;
    height = svg.node().parentElement.clientHeight;
    svg.attr('width', width).attr('height', height);
    
    if (simulation) {
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.3).restart();
    }
});

// Try to load a sample/default file
fetch('./dependency-graph.json')
    .then(response => {
        if (!response.ok) {
            throw new Error('Sample file not found');
        }
        return response.json();
    })
    .then(data => {
        processData(data);
    })
    .catch(error => {
        console.log('No sample file found. Please upload a dependency graph JSON file.');
    });

// Expose resetNodeFocus function globally
window.resetNodeFocus = function() {
    // Reset node focus
    nodeElements.classed('focus-node', false)
        .style('display', '')
        .style('opacity', 1)
        .style('filter', 'brightness(1)');
    
    linkElements.style('display', '')
        .style('opacity', 1)
        .style('filter', 'brightness(1)');
    
    // Hide reset buttons
    if (focusResetBtn) {
        focusResetBtn.style.display = 'none';
    }
    
    // Hide export button
    if (exportGraphBtn) {
        exportGraphBtn.style.display = 'none';
    }
    
    const emergencyResetBtn = document.getElementById('emergency-reset');
    if (emergencyResetBtn) {
        emergencyResetBtn.style.display = 'none';
    }
    
    // Reset node selector
    const nodeSelector = document.getElementById('node-selector');
    if (nodeSelector) {
        nodeSelector.value = '';
    }
    
    // Reset zoom
    svg.transition().duration(750).call(
        d3.zoom().transform, d3.zoomIdentity
    );
    
    console.log('Reset view executed');
}; 