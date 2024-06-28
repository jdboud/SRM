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
        const dataUrl = 'https://jdboud.github.io/SRM/data/binaryCleanUserNumberCollections1Test024.xlsx';
        fetch(dataUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(data => {
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                console.log('Fetched Data:', json);

                graphData = processData(json);
                updateGraph(false);
                updateGrid();
            })
            .catch(error => console.error('Error fetching data:', error));
    }

    function processData(data) {
        const df = data.slice(1); // Remove header row
        const headers = data[0].slice(1); // Remove index column
        const user_collections = {};
        const common_groups = {};

        headers.forEach((user, colIndex) => {
            user_collections[user] = new Set();
            df.forEach((row, rowIndex) => {
                if (row[colIndex + 1] === 1) {
                    user_collections[user].add(rowIndex + 1);
                }
            });
        });

        for (let user1 in user_collections) {
            for (let user2 in user_collections) {
                if (user1 !== user2) {
                    const common_indices = [...user_collections[user1]].filter(x => user_collections[user2].has(x));
                    if (common_indices.length >= 2) {
                        const sorted_common = common_indices.sort().join(',');
                        if (!common_groups[sorted_common]) {
                            common_groups[sorted_common] = new Set();
                        }
                        common_groups[sorted_common].add(user1);
                        common_groups[sorted_common].add(user2);
                    }
                }
            }
        }

        const G = { nodes: [], links: [] };
        let group_id = 1;
        for (let indices in common_groups) {
            const group_name = `Group ${group_id}`;
            const num_elements = indices.split(',').length;
            const node_size = 10 + num_elements - 2;
            G.nodes.push({ id: group_name, numbers: indices.split(','), size: node_size });
            group_id++;
        }

        const node_map = {};
        G.nodes.forEach(node => node_map[node.id] = node);

        G.nodes.forEach(node1 => {
            G.nodes.forEach(node2 => {
                if (node1 !== node2) {
                    const shared_numbers = node1.numbers.filter(value => node2.numbers.includes(value));
                    if (shared_numbers.length > 0) {
                        G.links.push({ source: node1.id, target: node2.id, weight: shared_numbers.length });
                    }
                }
            });
        });

        return G;
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
                console.log('Mouseover Node:', d);
                highlightAssociatedNumbers(d.numbers);
            })
            .on('mouseout', function(event, d) {
                highlightAssociatedNumbers(Array.from(selectedNumbers));
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

    function toggleNodeSelection(node) {
        if (selectedNumbers.has(node)) {
            selectedNumbers.delete(node);
        } else {
            selectedNumbers.add(node);
        }
        highlightAssociatedNumbers(Array.from(selectedNumbers));
        updateGraph();
    }

    function updateVennDiagram() {
        d3.select("#network-graph svg").selectAll("*").remove();

        const width = svg.node().getBoundingClientRect().width;
        const height = svg.node().getBoundingClientRect().height;

        const sets = [];
        const overlaps = [];

        graphData.nodes.forEach((node, index) => {
            sets.push({ sets: [node.id], size: node.numbers.length, label: `Group ${node.id}` });
        });

        graphData.links.forEach(link => {
            const sourceIndex = graphData.nodes.findIndex(node => node.id === link.source.id);
            const targetIndex = graphData.nodes.findIndex(node => node.id === link.target.id);
            overlaps.push({ sets: [graphData.nodes[sourceIndex].id, graphData.nodes[targetIndex].id], size: link.weight });
        });

        const vennData = { sets, overlaps };

        const chart = venn.VennDiagram().width(width).height(height);
        d3.select("#network-graph svg").datum(vennData).call(chart);

        d3.selectAll(".venn-circle path")
            .style("fill-opacity", 0.5)
            .style("stroke", "#fff")
            .style("stroke-width", 2);

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
        console.log('Highlight Numbers:', numbers);
        const associatedNumbers = new Set(numbers);
        graphData.nodes.forEach(node => {
            if (node.numbers.some(num => selectedNumbers.has(num))) {
                node.numbers.forEach(number => {
                    associatedNumbers.add(number);
                });
            }
        });

        console.log('Associated Numbers:', Array.from(associatedNumbers));

        numberGrid.selectAll('.number-box')
            .style('background-color', d => {
                console.log('Checking number:', d);
                if (d === 'X') return '#f4ce65';
                if (associatedNumbers.has(d)) {
                    const node = graphData.nodes.find(node => node.numbers.includes(d));
                    if (node) {
                        console.log('Highlighting Number:', d, 'with color:', color(node.id));
                        return color(node.id);
                    }
                }
                return graphData.nodes.some(node => node.numbers.includes(d)) ? '#e0e0e0' : '#ffffff';
            })
            .style('border', d => {
                if (d === 'X') return '4px solid #f4ce65';
                if (associatedNumbers.has(d)) {
                    console.log('Setting Border for Number:', d);
                    return '2px solid black';
                }
                return graphData.nodes.some(node => node.numbers.includes(d)) ? '1px solid #e0e0e0' : 'none';
            });

        // Ensure grid visibility after highlighting
        numberGrid.style('display', 'flex');
    }

    function resetSelection() {
        selectedNumbers.clear();
        numberGrid.selectAll('.number-box')
            .style('background-color', d => d === 'X' ? '#f4ce65' : (graphData.nodes.some(node => node.numbers.includes(d)) ? '#e0e0e0' : '#ffffff'));
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

    function updateHeatmap() {
        heatmapContainer.selectAll("*").remove();

        const margin = { top: 50, right: 0, bottom: 100, left: 30 };
        const width = 450 - margin.left - margin.right;
        const height = 450 - margin.top - margin.bottom;
        const gridSize = Math.floor(width / 24);
        const legendElementWidth = gridSize * 2;
        const buckets = 9;
        const colors = ["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"];
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

    fetchData();
});
