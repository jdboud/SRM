document.addEventListener('DOMContentLoaded', function() {
    const svg = d3.select('#network-graph').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    const g = svg.append('g');
    svg.call(d3.zoom().on('zoom', zoomed));

    const heatmapContainer = d3.select('#heatmap').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    const eulerContainer = d3.select('#euler-diagram').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    const layoutDropdown = document.getElementById('layout-dropdown');
    const numbersRangeSlider = document.getElementById('numbers-range-slider');
    const nodeSizeSlider = document.getElementById('node-size-slider');
    const graphSizeSlider = document.getElementById('graph-size-slider');
    const nodeSizeFactorInput = document.getElementById('node-size-factor');
    const edgeLengthFactorInput = document.getElementById('edge-length-factor');
    const numberGrid = d3.select('#number-grid');

    layoutDropdown.addEventListener('change', updateGraph);
    nodeSizeFactorInput.addEventListener('input', updateGraph);
    edgeLengthFactorInput.addEventListener('input', updateGraph);

    let graphData = { nodes: [], links: [] };
    let selectedNumbers = new Set();
    let nodeSizeFactor = 1;
    let graphSizeFactor = 1;

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    noUiSlider.create(numbersRangeSlider, {
        start: [0, 100],
        connect: true,
        range: {
            'min': 0,
            'max': 100
        }
    });

    noUiSlider.create(nodeSizeSlider, {
        start: [4],
        range: {
            'min': 0.1,
            'max': 10
        },
        step: 0.1
    });

    noUiSlider.create(graphSizeSlider, {
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
        updateGraph(true);
    });

    graphSizeSlider.noUiSlider.on('update', function(values, handle) {
        graphSizeFactor = values[handle];
        updateGraph(true);
    });

    function fetchData() {
        fetch('/data')
            .then(response => response.json())
            .then(data => {
                graphData = data;
                nodeSizeFactor = Math.max(0.1, Math.min(10, 12 / Math.sqrt(graphData.nodes.length)));
                nodeSizeFactorInput.value = nodeSizeFactor;
                nodeSizeSlider.noUiSlider.set(nodeSizeFactor);

                updateGraph(false);
                updateGrid();
            })
            .catch(error => console.error('Error fetching data:', error));
    }

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

            simulation.force('link').links(graphData.links);
        }

        const visibleNodes = graphData.nodes.filter(node => (node.numbers.length >= minIndices && node.numbers.length <= maxIndices) && (selectedNumbers.size === 0 || node.numbers.some(num => selectedNumbers.has(num))));
        const visibleLinks = graphData.links.filter(link => visibleNodes.some(node => node.id === link.source.id) && visibleNodes.some(node => node.id === link.target.id));
        visibleNodes.sort((a, b) => (b.size * nodeSizeFactor) - (a.size * nodeSizeFactor)); // Descending order

        const link = g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(visibleLinks)
            .enter().append('line')
            .attr('stroke-width', d => d.weight)
            .attr('stroke', '#999');

        const node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(visibleNodes)
            .enter().append('circle')
            .attr('r', d => d.size * nodeSizeFactor)
            .attr('fill', d => color(d.id))
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended))
            .on('mouseover', function(event, d) {
                highlightAssociatedNumbers(d.numbers);
            })
            .on('mouseout', function(event, d) {
                highlightAssociatedNumbers([]);
            })
            .on('click', function(event, d) {
                toggleNodeSelection(d);
            });

        node.append('title')
            .text(d => `Group: ${d.id}\nNumbers: ${d.numbers.join(', ')}`);

        node.attr('stroke', d => selectedNumbers.size > 0 && d.numbers.some(num => selectedNumbers.has(num)) ? 'black' : 'none')
            .attr('stroke-width', d => selectedNumbers.size > 0 && d.numbers.some(num => selectedNumbers.has(num)) ? 3 : 0);

        if (useTransitions) {
            node.transition()
                .duration(500)
                .attr('r', d => d.size * nodeSizeFactor);
        } else {
            node.attr('r', d => d.size * nodeSizeFactor);
        }

        if (layout === 'force') {
            g.attr('transform', `translate(${centerX}, ${centerY}) scale(${graphSizeFactor}) translate(${-centerX}, ${-centerY})`);
        } else {
            g.attr('transform', null);
        }

        link.attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('cx', d => d.x)
            .attr('cy', d => d.y);
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
            .data([...allNumbers, 'X'])
            .enter().append('div')
            .attr('class', 'number-box')
            .style('background-color', d => d === 'X' ? '#f4ce65' : (numbersInGroups.has(d) ? '#e0e0e0' : '#ffffff'))
            .style('border', d => d === 'X' ? '4px solid #f4ce65' : '1px solid #e0e0e0')
            .text(d => d)
            .on('click', function(event, d) {
                if (d === 'X') {
                    resetSelection();
                } else if (numbersInGroups.has(d)) {
                    toggleNumberSelection(d);
                }
            });
    }

    function highlightAssociatedNumbers(numbers) {
        const associatedNumbers = new Set(numbers);
        numberGrid.selectAll('.number-box')
            .style('background-color', d => {
                if (d === 'X') return '#f4ce65';
                if (associatedNumbers.has(d)) {
                    return 'yellow';
                }
                return '#ffffff';
            })
            .style('border', d => {
                if (associatedNumbers.has(d)) {
                    return '2px solid black';
                }
                return '1px solid #e0e0e0';
            });

        g.selectAll('circle')
            .style('stroke', d => {
                if (d.numbers.some(num => associatedNumbers.has(num))) {
                    return 'black';
                }
                return 'none';
            })
            .style('stroke-width', d => {
                if (d.numbers.some(num => associatedNumbers.has(num))) {
                    return '2px';
                }
                return '0px';
            });
    }

    function resetSelection() {
        selectedNumbers.clear();
        numberGrid.selectAll('.number-box')
            .style('background-color', d => d === 'X' ? '#f4ce65' : '#ffffff')
            .style('border', '1px solid #e0e0e0');
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

    fetchData();
});