document.addEventListener('DOMContentLoaded', function() {
    const svg = d3.select('#network-graph').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    const heatmapContainer = d3.select('#heatmap').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    const eulerContainer = d3.select('#euler-diagram').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    const layoutDropdown = document.getElementById('layout-dropdown');
    const numbersRangeSlider = document.getElementById('numbers-range-slider');
    const nodeSizeFactorInput = document.getElementById('node-size-factor');
    const edgeLengthFactorInput = document.getElementById('edge-length-factor');
    const numberGrid = d3.select('#number-grid');

    layoutDropdown.addEventListener('change', updateGraph);
    numbersRangeSlider.addEventListener('input', updateGraph);
    nodeSizeFactorInput.addEventListener('input', updateGraph);
    edgeLengthFactorInput.addEventListener('input', updateGraph);

    let graphData = { nodes: [], links: [] };
    let selectedNumbers = new Set();

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    function fetchData() {
        fetch('/data')
            .then(response => response.json())
            .then(data => {
                graphData = data;
                console.log('Graph Data:', graphData); // Debug statement to print the data in the browser console
                updateGraph();
                updateGrid();
            })
            .catch(error => console.error('Error fetching data:', error)); // Handle fetch errors
    }

    function updateGraph() {
        const layout = layoutDropdown.value;
        const nodeSizeFactor = nodeSizeFactorInput.value;
        const edgeLengthFactor = edgeLengthFactorInput.value;
        const maxIndices = numbersRangeSlider.value;

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

        svg.selectAll('*').remove();

        const width = svg.node().getBoundingClientRect().width;
        const height = svg.node().getBoundingClientRect().height;

        let simulation;
        if (layout === 'force') {
            simulation = d3.forceSimulation(graphData.nodes)
                .alphaDecay(0.05)
                .velocityDecay(0.7)
                .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(edgeLengthFactor * 50))
                .force('charge', d3.forceManyBody().strength(-200))
                .force('center', d3.forceCenter(width / 2, height / 2));
        } else if (layout === 'circular') {
            const angleStep = (2 * Math.PI) / graphData.nodes.length;
            graphData.nodes.forEach((node, i) => {
                node.x = width / 2 + (width / 2.5) * Math.cos(i * angleStep);
                node.y = height / 2 + (height / 2.5) * Math.sin(i * angleStep);
            });
        } else if (layout === 'radial') {
            const radiusStep = Math.min(width, height) / (2 * graphData.nodes.length);
            graphData.nodes.forEach((node, i) => {
                node.x = width / 2 + (radiusStep * i) * Math.cos(i * 2 * Math.PI / graphData.nodes.length);
                node.y = height / 2 + (radiusStep * i) * Math.sin(i * 2 * Math.PI / graphData.nodes.length);
            });
        } else if (layout === 'grid') {
            const columns = Math.ceil(Math.sqrt(graphData.nodes.length));
            const rows = Math.ceil(graphData.nodes.length / columns);
            const cellSize = Math.min(width, height) / columns;
            const totalWidth = columns * cellSize;
            const totalHeight = rows * cellSize;
            const xOffset = (width - totalWidth) / 2;
            const yOffset = (height - totalHeight) / 2;

            graphData.nodes.forEach((node, i) => {
                node.x = (i % columns) * cellSize + cellSize / 2 + xOffset;
                node.y = Math.floor(i / columns) * cellSize + cellSize / 2 + yOffset;
            });
        } else if (layout === 'tree') {
            const treeLayout = d3.tree().size([width, height]);
            const root = d3.hierarchy({ children: graphData.nodes.map(d => ({ ...d, children: [] })) });
            treeLayout(root);
            root.descendants().forEach((d, i) => {
                graphData.nodes[i].x = d.x;
                graphData.nodes[i].y = d.y;
            });
        } else if (layout === 'cluster') {
            const clusterLayout = d3.cluster().size([width, height]);
            const root = d3.hierarchy({ children: graphData.nodes.map(d => ({ ...d, children: [] })) });
            clusterLayout(root);
            root.descendants().forEach((d, i) => {
                graphData.nodes[i].x = d.x;
                graphData.nodes[i].y = d.y;
            });
        }

        const visibleNodes = graphData.nodes.filter(node => (node.numbers.length <= maxIndices) && (selectedNumbers.size === 0 || node.numbers.some(num => selectedNumbers.has(num))));
        const visibleLinks = graphData.links.filter(link => visibleNodes.some(node => node.id === link.source.id) && visibleNodes.some(node => node.id === link.target.id));

        const link = svg.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(visibleLinks)
            .enter().append('line')
            .attr('stroke-width', 2);

        const node = svg.append('g')
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
                highlightAssociatedNumbers(Array.from(selectedNumbers));
            });

        node.append('title')
            .text(d => `Group: ${d.id}\nNumbers: ${d.numbers.join(', ')}`);

        if (layout === 'force') {
            simulation.on('tick', () => {
                link.attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                node.attr('cx', d => d.x)
                    .attr('cy', d => d.y);
            });
            simulation.force('link').links(visibleLinks);
        } else {
            link.attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('cx', d => d.x)
                .attr('cy', d => d.y);
        }

        // Highlight the selected node
        node.attr('stroke', d => selectedNumbers.size > 0 && d.numbers.some(num => selectedNumbers.has(num)) ? 'black' : 'none')
            .attr('stroke-width', d => selectedNumbers.size > 0 && d.numbers.some(num => selectedNumbers.has(num)) ? 3 : 0);
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
            .data([...allNumbers, 'X']) // Add 'X' for reset button
            .enter().append('div')
            .attr('class', 'number-box')
            .style('background-color', d => d === 'X' ? '#ffffff' : (numbersInGroups.has(d) ? '#e0e0e0' : '#ffffff')) // Grey selectable numbers
            .style('cursor', d => d === 'X' || numbersInGroups.has(d) ? 'pointer' : 'default')
            .style('border', d => d === 'X' ? '1px solid red' : '1px solid #ccc') // Red border for reset button
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
        graphData.nodes.forEach(node => {
            if (node.numbers.some(num => selectedNumbers.has(num))) {
                node.numbers.forEach(number => {
                    associatedNumbers.add(number);
                });
            }
        });

        numberGrid.selectAll('.number-box')
            .style('background-color', d => {
                if (d === 'X') return '#ffffff';
                return associatedNumbers.has(d) ? color(graphData.nodes.find(node => node.numbers.includes(d)).id) : (graphData.nodes.some(node => node.numbers.includes(d)) ? '#e0e0e0' : '#ffffff');
            });
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
        highlightAssociatedNumbers(selectedNumbers);
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
        const colors = ["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"]; // alternatively colorbrewer.YlGnBu[9]
        const users = d3.range(1, 11);
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
            .style("fill", colors[0]);

        cards.transition().duration(1000)
            .style("fill", d => colorScale(d.value));

        cards.select("title").text(d => d.value);

        cards.exit().remove();

        const legend = svg.selectAll(".legend")
            .data([0].concat(colorScale.quantiles()), d => d);

        legend.enter().append("g")
            .attr("class", "legend");

        legend.append("rect")
            .attr("x", (d, i) => legendElementWidth * i)
            .attr("y", height)
            .attr("width", legendElementWidth)
            .attr("height", gridSize / 2)
            .style("fill", (d, i) => colors[i]);

        legend.append("text")
            .attr("class", "mono")
            .text(d => "≥ " + Math.round(d))
            .attr("x", (d, i) => legendElementWidth * i)
            .attr("y", height + gridSize);

        legend.exit().remove();
    }

    function updateEulerDiagram() {
        eulerContainer.selectAll("*").remove();

        const width = eulerContainer.node().getBoundingClientRect().width;
        const height = eulerContainer.node().getBoundingClientRect().height;

        const sets = [];
        graphData.nodes.forEach((node, i) => {
            sets.push({ sets: [i], size: node.numbers.length });
        });

        const overlaps = [];
        graphData.links.forEach(link => {
            const sourceNode = graphData.nodes.find(node => node.id === link.source);
            const targetNode = graphData.nodes.find(node => node.id === link.target);
            const intersectionSize = sourceNode.numbers.filter(value => targetNode.numbers.includes(value)).length;
            overlaps.push({ sets: [sourceNode.id, targetNode.id], size: intersectionSize });
        });

        const chart = venn.VennDiagram().width(width).height(height);
        eulerContainer.datum({ sets: sets, overlaps: overlaps }).call(chart);

        d3.selectAll(".venn-circle path")
            .style("stroke-width", 3)
            .style("fill-opacity", 0.5)
            .style("stroke-opacity", 1)
            .style("fill", d => d3.scaleOrdinal(d3.schemeCategory10)(d.sets[0]));

        d3.selectAll(".venn-circle text")
            .style("fill", "black")
            .style("font-size", "14px");
    }

    fetchData();
});
/*
document.addEventListener('DOMContentLoaded', function() {
    const svg = d3.select('#network-graph').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    const layoutDropdown = document.getElementById('layout-dropdown');
    const numbersRangeSlider = document.getElementById('numbers-range-slider');
    const nodeSizeFactorInput = document.getElementById('node-size-factor');
    const edgeLengthFactorInput = document.getElementById('edge-length-factor');
    const numberGrid = d3.select('#number-grid');

    layoutDropdown.addEventListener('change', updateGraph);
    numbersRangeSlider.addEventListener('input', updateGraph);
    nodeSizeFactorInput.addEventListener('input', updateGraph);
    edgeLengthFactorInput.addEventListener('input', updateGraph);

    let graphData = { nodes: [], links: [] };
    let selectedNumbers = new Set();

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    function fetchData() {
        fetch('/data')
            .then(response => response.json())
            .then(data => {
                graphData = data;
                console.log('Graph Data:', graphData); // Debug statement to print the data in the browser console
                updateGraph();
                updateGrid();
            })
            .catch(error => console.error('Error fetching data:', error)); // Handle fetch errors
    }

    function updateGraph() {
        const layout = layoutDropdown.value;
        const nodeSizeFactor = nodeSizeFactorInput.value;
        const edgeLengthFactor = edgeLengthFactorInput.value;

        svg.selectAll('*').remove();

        const width = svg.node().getBoundingClientRect().width;
        const height = svg.node().getBoundingClientRect().height;

        let simulation;
        if (layout === 'force') {
            simulation = d3.forceSimulation(graphData.nodes)
                .alphaDecay(0.05)
                .velocityDecay(0.7)
                .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(edgeLengthFactor * 50))
                .force('charge', d3.forceManyBody().strength(-200))
                .force('center', d3.forceCenter(width / 2, height / 2));
        } else if (layout === 'circular') {
            const angleStep = (2 * Math.PI) / graphData.nodes.length;
            graphData.nodes.forEach((node, i) => {
                node.x = width / 2 + (width / 2.5) * Math.cos(i * angleStep);
                node.y = height / 2 + (height / 2.5) * Math.sin(i * angleStep);
            });
        } else if (layout === 'radial') {
            const radiusStep = Math.min(width, height) / (2 * graphData.nodes.length);
            graphData.nodes.forEach((node, i) => {
                node.x = width / 2 + (radiusStep * i) * Math.cos(i * 2 * Math.PI / graphData.nodes.length);
                node.y = height / 2 + (radiusStep * i) * Math.sin(i * 2 * Math.PI / graphData.nodes.length);
            });
      } else if (layout === 'grid') {
    const columns = Math.ceil(Math.sqrt(graphData.nodes.length));
    const rows = Math.ceil(graphData.nodes.length / columns);
    const cellSize = Math.min(width, height) / columns;
    const totalWidth = columns * cellSize;
    const totalHeight = rows * cellSize;
    const xOffset = (width - totalWidth) / 2;
    const yOffset = (height - totalHeight) / 2;

    graphData.nodes.forEach((node, i) => {
        node.x = (i % columns) * cellSize + cellSize / 2 + xOffset;
        node.y = Math.floor(i / columns) * cellSize + cellSize / 2 + yOffset;
    });
        } else if (layout === 'tree') {
            const treeLayout = d3.tree().size([width, height]);
            const root = d3.hierarchy({ children: graphData.nodes.map(d => ({ ...d, children: [] })) });
            treeLayout(root);
            root.descendants().forEach((d, i) => {
                graphData.nodes[i].x = d.x;
                graphData.nodes[i].y = d.y;
            });
        } else if (layout === 'cluster') {
            const clusterLayout = d3.cluster().size([width, height]);
            const root = d3.hierarchy({ children: graphData.nodes.map(d => ({ ...d, children: [] })) });
            clusterLayout(root);
            root.descendants().forEach((d, i) => {
                graphData.nodes[i].x = d.x;
                graphData.nodes[i].y = d.y;
            });
        }

        const visibleNodes = graphData.nodes.filter(node => selectedNumbers.size === 0 || node.numbers.some(num => selectedNumbers.has(num)));
        const visibleLinks = graphData.links.filter(link => visibleNodes.some(node => node.id === link.source.id) && visibleNodes.some(node => node.id === link.target.id));

        const link = svg.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(visibleLinks)
            .enter().append('line')
            .attr('stroke-width', 2);

        const node = svg.append('g')
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
                highlightAssociatedNumbers(Array.from(selectedNumbers));
            });

        node.append('title')
            .text(d => `Group: ${d.id}\nNumbers: ${d.numbers.join(', ')}`);

        if (layout === 'force') {
            simulation.on('tick', () => {
                link.attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                node.attr('cx', d => d.x)
                    .attr('cy', d => d.y);
            });
            simulation.force('link').links(visibleLinks);
        } else {
            link.attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('cx', d => d.x)
                .attr('cy', d => d.y);
        }

        // Highlight the selected node
        node.attr('stroke', d => selectedNumbers.size > 0 && d.numbers.some(num => selectedNumbers.has(num)) ? 'black' : 'none')
            .attr('stroke-width', d => selectedNumbers.size > 0 && d.numbers.some(num => selectedNumbers.has(num)) ? 3 : 0);
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
            .data([...allNumbers, 'X']) // Add 'X' for reset button
            .enter().append('div')
            .attr('class', 'number-box')
            .style('background-color', d => {
                if (d === 'X') return '#ffffff';
                return numbersInGroups.has(d) ? '#e0e0e0' : '#ffffff';
            }) // Grey selectable numbers
            .style('cursor', d => d === 'X' || numbersInGroups.has(d) ? 'pointer' : 'default')
            .style('border', d => d === 'X' ? '0px solid red' : '1px solid #ccc') // Red border for reset button
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
        graphData.nodes.forEach(node => {
            if (node.numbers.some(num => selectedNumbers.has(num))) {
                node.numbers.forEach(number => {
                    associatedNumbers.add(number);
                });
            }
        });

        numberGrid.selectAll('.number-box')
            .style('background-color', d => {
                if (d === 'X') return '#ffffff';
                return associatedNumbers.has(d) ? color(graphData.nodes.find(node => node.numbers.includes(d)).id) : (graphData.nodes.some(node => node.numbers.includes(d)) ? '#e0e0e0' : '#ffffff');
            });
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
        highlightAssociatedNumbers(selectedNumbers);
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
*/