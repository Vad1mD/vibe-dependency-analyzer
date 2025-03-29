// Graph visualization utility functions

/**
 * Updates the graph layout
 * @param {string} layout - The layout type
 */
function updateLayout(layout) {
    currentLayout = layout;
    
    // Stop current simulation
    if (simulation) simulation.stop();
    
    // Only force layout is supported
    simulation
        .force('link', d3.forceLink(links).id(d => d.id).strength(parseFloat(linkStrengthInput.value)))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .alpha(1).restart();
}

/**
 * Extract the filename from a path
 */
function getFileName(path) {
    const parts = path.split('/');
    return parts[parts.length - 1];
}

/**
 * Check if a link is part of a cyclic dependency
 */
function isCyclicLink(source, target) {
    if (!graph.cycles) return false;
    
    for (const cycle of graph.cycles) {
        if (cycle.includes(source) && cycle.includes(target)) {
            // Check if they're adjacent in the cycle
            for (let i = 0; i < cycle.length; i++) {
                const next = (i + 1) % cycle.length;
                if ((cycle[i] === source && cycle[next] === target) || 
                    (cycle[i] === target && cycle[next] === source)) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Highlight a specific cycle path
 */
function highlightCyclePath(cycle) {
    // Reset previous highlights
    linkElements.classed('cyclic', d => d.isCyclic);
    nodeElements.classed('cyclic', d => d.hasCircularDependency);
    
    // Highlight the specific cycle
    linkElements.classed('cyclic', function(d) {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        
        for (let i = 0; i < cycle.length; i++) {
            const next = (i + 1) % cycle.length;
            if (cycle[i] === sourceId && cycle[next] === targetId) {
                return true;
            }
        }
        return false;
    });
    
    nodeElements.classed('cyclic', d => cycle.includes(d.id));
    
    // Zoom to fit the cycle
    const cycleNodes = nodes.filter(n => cycle.includes(n.id));
    if (cycleNodes.length > 0) {
        zoomToFit(cycleNodes);
    }
}

/**
 * Zoom to fit a set of nodes
 */
function zoomToFit(nodesToFit) {
    const padding = 50;
    
    // Get bounds of nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodesToFit.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    });
    
    // Add padding
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const dx = maxX - minX;
    const dy = maxY - minY;
    const scale = Math.min(width / dx, height / dy);
    const translateX = (width - scale * (minX + maxX)) / 2;
    const translateY = (height - scale * (minY + maxY)) / 2;
    
    svg.transition()
        .duration(750)
        .call(
            d3.zoom().transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
}

/**
 * Show tooltip for node
 */
function showTooltip(event, d) {
    if (!tooltipEl) return;
    
    const [x, y] = d3.pointer(event, svg.node());
    
    let content = `<h4>${d.id}</h4>`;
    
    const dependencies = d.dependencies || [];
    const depCount = Array.isArray(dependencies) ? dependencies.length : 0;
    content += `<p>Dependencies: ${depCount}</p>`;
    
    if (d.hasCircularDependency) {
        content += `<p class="circular">Has circular dependencies</p>`;
    }
    
    if (d.isExternal) {
        content += `<p class="external">External module</p>`;
    }
    
    if (d.deploymentModes && d.deploymentModes.length) {
        content += `<p>Used in: ${d.deploymentModes.map(mode => 
            `<span class="deployment">${mode}</span>`).join(' ')}</p>`;
    }
    
    tooltipEl.innerHTML = content;
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = (x + 10) + 'px';
    tooltipEl.style.top = (y + 10) + 'px';
}

/**
 * Hide tooltip
 */
function hideTooltip() {
    if (tooltipEl) {
        tooltipEl.style.opacity = 0;
    }
}

/**
 * Handle node click - focus on node and its dependencies
 */
function nodeClicked(event, d) {
    // If we're already in focus mode for this node, reset the view
    if (d3.select(this).classed('focus-node')) {
        window.resetNodeFocus();
        return;
    }
    
    // Check if we're already in focus mode
    const inFocusMode = nodeElements.filter('.focus-node').size() > 0;
    
    // If we're in focus mode but for a different node, reset first
    if (inFocusMode) {
        window.resetNodeFocus();
    }
    
    // Find all dependencies of the clicked node
    const dependencies = getNodeDependencies(d);
    
    // Add the node itself to the list
    dependencies.push(d.id);
    
    // Hide all nodes and links completely
    nodeElements.style('display', 'none');
    linkElements.style('display', 'none');
    
    // Mark the main node as the focus node
    d3.select(this).classed('focus-node', true);
    
    // Show only the selected nodes and their links
    nodeElements.filter(n => dependencies.includes(n.id))
        .style('display', '')
        .style('opacity', 1)
        .style('filter', 'brightness(1.2)');
    
    // Show links between visible nodes
    linkElements.filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        
        return dependencies.includes(sourceId) && dependencies.includes(targetId);
    })
    .style('display', '')
    .style('opacity', 1)
    .style('filter', 'brightness(1.3)');
    
    // Show reset buttons
    document.getElementById('focus-reset-btn').style.display = 'block';
    document.getElementById('emergency-reset').style.display = 'block';
    
    // Update node selector to show the currently focused node
    const nodeSelector = document.getElementById('node-selector');
    if (nodeSelector) {
        nodeSelector.value = d.id;
    }
    
    // Zoom to fit the visible nodes
    const nodesToFit = nodes.filter(n => dependencies.includes(n.id));
    zoomToFit(nodesToFit);
}

/**
 * Get all dependencies of a node
 */
function getNodeDependencies(node) {
    // Get direct dependencies
    const dependencies = [];
    
    if (node.dependencies) {
        node.dependencies.forEach(dep => {
            const depId = typeof dep === 'object' ? dep.path : dep;
            dependencies.push(depId);
        });
    }
    
    // Recursively get indirect dependencies
    function findDependencies(nodeId) {
        const currentNode = nodes.find(n => n.id === nodeId);
        if (!currentNode || !currentNode.dependencies) return;
        
        currentNode.dependencies.forEach(dep => {
            const depId = typeof dep === 'object' ? dep.path : dep;
            if (!dependencies.includes(depId)) {
                dependencies.push(depId);
                findDependencies(depId);
            }
        });
    }
    
    dependencies.forEach(depId => findDependencies(depId));
    
    return dependencies;
}

/**
 * D3 force simulation tick function
 */
function ticked() {
    linkElements
        .attr('d', d => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            
            // If it's a self-loop
            if (d.source.id === d.target.id) {
                return `M${d.source.x},${d.source.y} 
                       C${d.source.x + 40},${d.source.y - 40} 
                        ${d.source.x + 40},${d.source.y + 40} 
                        ${d.source.x},${d.source.y}`;
            }
            
            // For normal links
            return `M${d.source.x},${d.source.y} 
                   L${d.target.x},${d.target.y}`;
        });
    
    nodeElements
        .attr('transform', d => `translate(${d.x},${d.y})`);
}

/**
 * Drag handlers for nodes
 */
function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}

function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
} 