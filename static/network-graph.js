document.addEventListener('DOMContentLoaded', function() {
    const svg = d3.select('#network-graph').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    const g = svg.append('g'); // Create a group element for graph content
    svg.call(d3.zoom().on('zoom', zoomed));

    const heatmapContainer = d3.select('#heatmap').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    const eulerContainer = d3.select('#euler-diagram').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    const layoutDropdown = document.getElementById('layout-dropdown');
    const numbersRangeSlider = document.getElementById('numbers-range-slider');
    const nodeSizeSlider = document.getElementById('node-size-slider'); // Node size slider element
    const graphSizeSlider = document.getElementById('graph-size-slider'); // New slider element
    const nodeSizeFactorInput = document.getElementById('node-size-factor');
    const edgeLengthFactorInput = document.getElementById('edge-length-factor');
    const numberGrid = d3.select('#number-grid');
    const edgesToggle = document.getElementById('edges-toggle');

    layoutDropdown.addEventListener('change', updateGraph);
    nodeSizeFactorInput.addEventListener('input', updateGraph);
    edgeLengthFactorInput.addEventListener('input', updateGraph);
    edgesToggle.addEventListener('click', toggleEdges);

    let graphData = { nodes: [], links: [] };
    let selectedNumbers = new Set();
    let maxIndices = 100;
    let nodeSizeFactor = 1; // Initial node size factor
    let graphSizeFactor = 1; // Initial graph size factor
    let edgesVisible = true; // Track edge visibility

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    noUiSlider.create(numbersRangeSlider, {
        start: [0, 100],
        connect: true,
        range: {
            'min': 0,
            'max': 100
        }
    });

    noUiSlider.create(nodeSizeSlider, { // Initialize the node size slider
        start: [4],
        range: {
            'min': 0.1,
            'max': 10
        },
        step: 0.1
    });

    noUiSlider.create(graphSizeSlider, { // Initialize the graph size slider
        start: [1],
        range: {
            'min': 0.6,
            'max': 4
        },
        step: 0.05
    });

    numbersRangeSlider.noUiSlider.on('update', updateGraph);
    nodeSizeSlider.noUiSlider.on('update', function(values, handle) {
        nodeSizeFactor = values[handle];
        updateGraph(true); // Pass true to use transitions
    });

    graphSizeSlider.noUiSlider.on('update', function(values, handle) {
        graphSizeFactor = values[handle];
        updateGraph(true); // Pass true to use transitions
    });

    // Embed the Excel data directly in the script
    const data = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
        [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 1, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 1, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        [0, 0, 0, 0, 0, 1, 1, 1, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        [0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 1, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [1, 1, 0, 1, 1, 0, 0, 1, 1, 0],
        [1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 1, 0, 0, 0, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 1, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 1, 0, 0, 1, 1, 0, 1],
        [0, 1, 0, 1, 0, 0, 1, 0, 0, 1],
        [0, 1, 0, 1, 0, 0, 1, 0, 0, 1],
        [0, 1, 0, 1, 0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
        [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 1, 0, 0, 0, 0, 0, 0]
    ];

// Process the embedded data
function processData(data) {
    const df = {};
    data.forEach((row, i) => {
        row.forEach((val, j) => {
            if (val === 1) {
                if (!df[j + 1]) {
                    df[j + 1] = [];
                }
                df[j + 1].push(i + 1);
            }
        });
    });

    const userCollections = Object.entries(df).reduce((acc, [key, value]) => {
        acc[key] = new Set(value);
        return acc;
    }, {});

    const commonGroups = {};
    for (const [user1, indices1] of Object.entries(userCollections)) {
        for (const [user2, indices2] of Object.entries(userCollections)) {
            if (user1 !== user2) {
                const commonIndices = [...indices1].filter(x => indices2.has(x));
                if (commonIndices.length >= 2) {
                    const sortedCommon = commonIndices.sort((a, b) => a - b).join(',');
                    if (!commonGroups[sortedCommon]) {
                        commonGroups[sortedCommon] = new Set();
                    }
                    commonGroups[sortedCommon].add(user1);
                    commonGroups[sortedCommon].add(user2);
                }
            }
        }
    }

    const G = { nodes: [], links: [] };
    let groupID = 1;
    for (const [indices, users] of Object.entries(commonGroups)) {
        G.nodes.push({
            id: `Group ${groupID++}`,
            numbers: indices.split(',').map(Number),
            size: 10 + (indices.split(',').length - 2)
        });
    }

    const nodes = G.nodes.map(n => n.id);
    for (const node of G.nodes) {
        for (const node2 of G.nodes) {
            if (node !== node2) {
                const sharedNumbers = node.numbers.filter(num => node2.numbers.includes(num));
                if (sharedNumbers.length > 0) {
                    G.links.push({
                        source: node.id,
                        target: node2.id,
                        weight: sharedNumbers.length
                    });
                }
            }
        }
    }

    return G;
}

graphData = processData(data);

function zoomed(event) {
    g.attr('transform', event.transform);
}

function updateGraph(useTransitions) {
    const layout = layoutDropdown.value;
    const edgeLengthFactor = edgeLengthFactorInput.value;
    const [minIndices, maxIndices] = numbersRangeSlider.noUiSlider.get().map(Number);

    svg.style('display', layout === 'heatmap' || layout === 'euler' ? 'none' : 'block');
    heatmapContainer.style('display', layout === 'heatmap' ? 'block' : 'none');
    eulerContainer.style('display', layout === 'euler' ? 'block' : 'none');

    if (layout === 'heatmap') {
        updateHeatmap();
        return;
    }

    if (layout === 'euler') {
        updateEulerDiagram();
        return;
    }

    if (layout === 'venn') {
        updateVennDiagram();
        return;
    }

    g.selectAll('*').remove();

    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;

    const centerX = width / 2;
    const centerY = height / 2;

    function boundNode(node) {
        node.x = Math.max(node.size * nodeSizeFactor, Math.min(width - node.size * nodeSizeFactor, node.x));
        node.y = Math.max(node.size * nodeSizeFactor, Math.min(height - node.size * nodeSizeFactor, node.y));
    }

    if (layout === 'circular') {
        const angleStep = (2 * Math.PI) / graphData.nodes.length;
        graphData.nodes.forEach((node, i) => {
            node.x = centerX + (Math.min(width, height) / 2.5) * Math.cos(i * angleStep);
            node.y = centerY + (Math.min(width, height) / 2.5) * Math.sin(i * angleStep);
            boundNode(node);
        });
    } else if (layout === 'radial') {
        const radiusStep = Math.min(width, height) / (2 * graphData.nodes.length);
        graphData.nodes.forEach((node, i) => {
            node.x = centerX + (radiusStep * i) * Math.cos(i * 2 * Math.PI / graphData.nodes.length);
            node.y = centerY + (radiusStep * i) * Math.sin(i * 2 * Math.PI / graphData.nodes.length);
            boundNode(node);
        });
    } else if (layout === 'grid') {
        const columns = Math.ceil(Math.sqrt(graphData.nodes.length));
        const rows = Math.ceil(graphData.nodes.length / columns);
        const cellSize = Math.min(width / columns, height / rows);
        const xOffset = (width - columns * cellSize) / 2;
        const yOffset = (height - rows * cellSize) / 2;
        graphData.nodes.forEach((node, i) => {
            node.x = (i % columns) * cellSize + cellSize / 2 + xOffset;
            node.y = Math.floor(i / columns) * cellSize + cellSize / 2 + yOffset;
            boundNode(node);
        });
    } else if (layout === 'concentric') {
        const radiusStep = Math.min(width, height) / (2 * Math.ceil(graphData.nodes.length / 10));
        const angleStep = (2 * Math.PI) / 10;
        graphData.nodes.forEach((node, i) => {
            const level = Math.floor(i / 10);
            const angle = (i % 10) * angleStep;
            node.x = centerX + (radiusStep * level) * Math.cos(angle);
            node.y = centerY + (radiusStep * level) * Math.sin(angle);
            boundNode(node);
        });
    } else if (layout === 'force') {
        const simulation = d3.forceSimulation(graphData.nodes)
            .alphaDecay(0.05)
            .velocityDecay(0.85)
            .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(d => Math.max(20, 100 - edgeLengthFactor * d.weight)))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('center', d3.forceCenter(centerX, centerY))
            .on('tick', () => {
                graphData.nodes.forEach(boundNode);
                link.attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
                node.attr('cx', d => d.x)
                    .attr('cy', d => d.y);
            });

        // Update the forces
        simulation.force('link').links(graphData.links);
    }

    // Sort nodes by size in descending order to ensure smaller nodes are drawn last (on top)
    const visibleNodes = graphData.nodes.filter(node => (node.numbers.length >= minIndices && node.numbers.length <= maxIndices) && (selectedNumbers.size === 0 || node.numbers.some(num => selectedNumbers.has(num))));
    const visibleLinks = graphData.links.filter(link => visibleNodes.some(node => node.id === link.source.id) && visibleNodes.some(node => node.id === link.target.id));
    visibleNodes.sort((a, b) => (b.size * nodeSizeFactor) - (a.size * nodeSizeFactor)); // Descending order

    const link = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(visibleLinks)
        .enter().append('line')
        .attr('stroke-width', d => d.weight)
        .attr('stroke', '#999')
        .style('opacity', edgesVisible ? 1 : 0); // Apply edge visibility

    const node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('circle')
        .data(visibleNodes)
        .enter().append('circle')
        .attr('r', d => d.size * nodeSizeFactor) // Set the size immediately
        .attr('fill', d => color(d.id))
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended))
        .on('mouseover', function(event, d) {
            highlightAssociatedNumbers(d.numbers);
            highlightConnectedNodes(d, true); // Highlight connected nodes
        })
        .on('mouseout', function(event, d) {
            highlightAssociatedNumbers(Array.from(selectedNumbers));
            highlightConnectedNodes(d, false); // Remove highlight from connected nodes
        })
        .on('click', function(event, d) {
            openNodeDetails(d);
        });

    node.append('title')
        .text(d => `Group: ${d.id}\nNumbers: ${d.numbers.join(', ')}`);

    node.attr('stroke', d => selectedNumbers.size > 0 && d.numbers.some(num => selectedNumbers.has(num)) ? 'black' : 'none')
        .attr('stroke-width', d => selectedNumbers.size > 0 && d.numbers.some(num => selectedNumbers.has(num)) ? 3 : 0);

    // Apply transitions only when requested
    if (useTransitions) {
        node.transition()
            .duration(500) // Duration in milliseconds
            .attr('r', d => d.size * nodeSizeFactor); // Grow to target size
    } else {
        node.attr('r', d => d.size * nodeSizeFactor); // Set size immediately
    }

    // Apply the graph size factor only for the force layout
    if (layout === 'force') {
        g.attr('transform', `translate(${centerX}, ${centerY}) scale(${graphSizeFactor}) translate(${-centerX}, ${-centerY})`);
    } else {
        g.attr('transform', null);
    }

    // Update node and link positions for non-force layouts
    link.attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

    node.attr('cx', d => d.x)
        .attr('cy', d => d.y);
}

function updateVennDiagram() {
    d3.select("#network-graph svg").selectAll("*").remove();

    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;

    // Prepare Venn diagram data
    const sets = [];
    const overlaps = [];
    /* console.log('Graph Data:', graphData); // Debug statement to print the data in the browser console*/
    console.log('Venn Data:', vennData); // Debug statement to print the Venn data in the browser console

    // Create sets based on node groups
    graphData.nodes.forEach((node, index) => {
        sets.push({ sets: [node.id], size: node.numbers.length, label: `Group ${node.id}` });
    });

    // Create overlaps based on links between nodes
    graphData.links.forEach(link => {
        const sourceIndex = graphData.nodes.findIndex(node => node.id === link.source.id);
        const targetIndex = graphData.nodes.findIndex(node => node.id === link.target.id);
        overlaps.push({ sets: [graphData.nodes[sourceIndex].id, graphData.nodes[targetIndex].id], size: link.weight });
    });

    // Combine sets and overlaps
    const vennData = { sets, overlaps };

    // Debugging statements to check data
    console.log('Venn Data:', vennData);

    // Render Venn diagram
    const chart = venn.VennDiagram().width(width).height(height);
    d3.select("#network-graph svg").datum(vennData).call(chart);

    // Style the circles
    d3.selectAll(".venn-circle path")
        .style("fill-opacity", 0.5)
        .style("stroke", "#fff")
        .style("stroke-width", 2);

    // Add labels
    d3.selectAll(".venn-circle text")
        .style("fill", "#000")
        .style("font-size", "12px")
        .attr("dy", ".35em");
}

function updateGrid() {
    const allNumbers = Array.from({ length: 100 }, (_, i) => i + 1);
    const numbersInGroups = new Map();
    graphData.nodes.forEach(node => {
        node.numbers.forEach(number => {
            numbersInGroups.set(number, color(node.id));
        });
    });

    numberGrid.selectAll('.number-box').remove();

    const numberBox = numberGrid.selectAll('.number-box')
        .data([...allNumbers, 'X', 'E']) // Add 'X' for reset button and 'E' for edge toggle
        .enter().append('div')
        .attr('class', 'number-box')
        .style('background-color', d => d === 'X' ? '#f4ce65' : (d === 'E' ? '#666' : (numbersInGroups.has(d) ? '#e0e0e0' : '#ffffff'))) // Grey selectable numbers, dark grey for 'E'
        .style('border', d => d === 'X' ? '4px solid #f4ce65' : (d === 'E' ? '4px solid #666' : '1px solid #e0e0e0')) // Orange border for 'X', dark grey for 'E', light gray for others
        .text(d => d)
        .on('click', function(event, d) {
            if (d === 'X') {
                resetSelection();
            } else if (d === 'E') {
                toggleEdges();
            } else if (numbersInGroups.has(d)) {
                toggleNumberSelection(d);
            }
        });
}

function highlightAssociatedNumbers(numbers) {
    const associatedNumbers = new Set(numbers);
    graphData.nodes.forEach(node => {
        if (node.numbers.some(num => selectedNumbers.has(num))) {
            node.numbers.forEach(number => {
                associatedNumbers.add(number);
            });
        }
    });

    numberGrid.selectAll('.number-box')
        .style('background-color', d => {
            if (d === 'X' || d === 'E') return d === 'X' ? '#ffffff' : '#666';
            return associatedNumbers.has(d) ? color(graphData.nodes.find(node => node.numbers.includes(d)).id) : (graphData.nodes.some(node => node.numbers.includes(d)) ? '#e0e0e0' : '#ffffff');
        });
}

function highlightConnectedNodes(node, highlight) {
    const connectedNodes = new Set();
    graphData.links.forEach(link => {
        if (link.source.id === node.id) {
            connectedNodes.add(link.target.id);
        } else if (link.target.id === node.id) {
            connectedNodes.add(link.source.id);
        }
    });

    d3.selectAll('.nodes circle')
        .attr('stroke', d => connectedNodes.has(d.id) && highlight ? 'white' : 'none')
        .attr('stroke-width', d => connectedNodes.has(d.id) && highlight ? 3 : 0);
}

function resetSelection() {
    selectedNumbers.clear();
    numberGrid.selectAll('.number-box')
        .style('background-color', d => d === 'X' ? '#ffffff' : (graphData.nodes.some(node => node.numbers.includes(d)) ? '#e0e0e0' : '#ffffff'));
    updateGraph();
}

function toggleNumberSelection(number) {
    if (selectedNumbers.has(number)) {
        selectedNumbers.delete(number);
    } else {
        selectedNumbers.add(number);
    }
    highlightAssociatedNumbers(Array.from(selectedNumbers));
    updateGraph();
}

function toggleEdges() {
    edgesVisible = !edgesVisible;
    d3.selectAll('.links line').style('opacity', edgesVisible ? 1 : 0);
}

function dragstarted(event, d) {
    if (!event.active) d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) d.fx = null;
    d.fy = null;
}

function updateHeatmap() {
    heatmapContainer.selectAll("*").remove();

    const margin = { top: 50, right: 0, bottom: 100, left: 30 };
    const width = 450 - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;
    const gridSize = Math.floor(width / 24);
    const legendElementWidth = gridSize * 2;
    const buckets = 9;
    const colors = ["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"]; // alternatively colorbrewer.YlGnBu[9]
    const users = d3.range(1, 101);
    const numbers = d3.range(1, 101);

    const dataTransformed = [];
    graphData.nodes.forEach(node => {
        node.numbers.forEach(number => {
            dataTransformed.push({ user: node.id, number: number, value: 1 });
        });
    });

    const svg = heatmapContainer
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const userLabels = svg.selectAll(".userLabel")
        .data(users)
        .enter().append("text")
        .text(d => "User " + d)
        .attr("x", 0)
        .attr("y", (d, i) => i * gridSize)
        .style("text-anchor", "end")
        .attr("transform", "translate(-6," + gridSize / 1.5 + ")")
        .attr("class", "userLabel mono axis");

    const numberLabels = svg.selectAll(".numberLabel")
        .data(numbers)
        .enter().append("text")
        .text(d => d)
        .attr("x", (d, i) => i * gridSize)
        .attr("y", 0)
        .style("text-anchor", "middle")
        .attr("transform", "translate(" + gridSize / 2 + ", -6)")
        .attr("class", "numberLabel mono axis");

    const colorScale = d3.scaleQuantile()
        .domain([0, buckets - 1, d3.max(dataTransformed, d => d.value)])
        .range(colors);

    const cards = svg.selectAll(".hour")
        .data(dataTransformed, d => d.user + ':' + d.number);

    cards.append("title");

    cards.enter().append("rect")
        .attr("x", d => (d.number - 1) * gridSize)
        .attr("y", d => (d.user - 1) * gridSize)
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("class", "hour bordered")
        .attr("width", gridSize)
        .attr("height", gridSize)
        .attr("fill", colors[0]);

    cards.transition().duration(1000)
        .attr("fill", d => colorScale(d.value));

    cards.select("title").text(d => d.value);

    cards.exit().remove();

    const legend = svg.selectAll(".legend")
        .data([0].concat(colorScale.quantiles()), d => d);

    const legend_g = legend.enter().append("g")
        .attr("class", "legend");

    legend_g.append("rect")
        .attr("x", (d, i) => legendElementWidth * i)
        .attr("y", height)
        .attr("width", legendElementWidth)
        .attr("height", gridSize / 2)
        .attr("fill", (d, i) => colors[i]);

    legend_g.append("text")
        .attr("class", "mono")
        .text(d => "≥ " + Math.round(d))
        .attr("x", (d, i) => legendElementWidth * i)
        .attr("y", height + gridSize);

    legend.exit().remove();
}

// Process the embedded data immediately after defining the function
graphData = processData(data);

// Initialize the graph and grid with the processed data
updateGraph(false);
updateGrid();
});