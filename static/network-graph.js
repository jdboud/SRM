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
    const homeButton = document.getElementById('home-button');
    const mainPage = document.getElementById('main-page');
    const numberDisplayPage = document.getElementById('number-display-page');

    layoutDropdown.addEventListener('change', updateGraph);
    nodeSizeFactorInput.addEventListener('input', updateGraph);
    edgeLengthFactorInput.addEventListener('input', updateGraph);

    homeButton.addEventListener('click', () => {
        mainPage.style.display = 'block';
        numberDisplayPage.style.display = 'none';
    });

    let graphData = { nodes: [], links: [] };
    let selectedNumbers = new Set();
    let nodeSizeFactor = 1;
    let graphSizeFactor = 1;
    let edgesVisible = false;

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    function initializeSliders(minNumbers, maxNumbers) {
        noUiSlider.create(numbersRangeSlider, {
            start: [minNumbers, maxNumbers],
            connect: true,
            range: {
                'min': minNumbers,
                'max': maxNumbers
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
    }

    function resetGraph() {
        selectedNumbers.clear();
        numberGrid.selectAll('.number-box')
            .style('background-color', d => d === 'X' ? '#ffffff' : (graphData.nodes.some(node => node.numbers.includes(d)) ? '#e0e0e0' : '#ffffff'));
        updateGraph(false);
        updateThumbnails([]);
    }

    // Fetch data dynamically from the server
    fetch('static/data/generated_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(fetchedData => {
            console.log('Fetched data:', fetchedData);
            graphData = fetchedData; // Use the fetched data directly

            // Calculate min and max numbers for dynamic range sliders
            const minNumbers = d3.min(graphData.nodes, d => d.numbers.length);
            const maxNumbers = d3.max(graphData.nodes, d => d.numbers.length);

            // Initialize sliders with dynamic ranges
            initializeSliders(minNumbers, maxNumbers);

            updateGraph(false);
            updateGrid();
            resetGraph();

            simulateSliderMovement();

        })
        .catch(error => {
            console.error('Error fetching data:', error);

            // Optional: Define fallback data if the fetch fails
            const fallbackData = {
                nodes: [
                    { id: 'Group A', numbers: [1, 2], size: 10 },
                    { id: 'Group B', numbers: [3, 4], size: 12 }
                ],
                links: [
                    { source: 'Group A', target: 'Group B', weight: 2 }
                ]
            };

            graphData = fallbackData;
            initializeSliders(2, 4); // Example slider range for fallback data
            updateGraph(false);
            updateGrid();
        });

    function zoomed(event) {
        g.attr('transform', event.transform);
    }
function simulateSliderMovement() {
        // Simulate slider movement by setting a value and then resetting it
        const initialValue = numbersRangeSlider.noUiSlider.get();
        const newValue = [initialValue[0], initialValue[1] + 1]; // Slightly increase the max range

        // Move slider to a new value
        numbersRangeSlider.noUiSlider.set(newValue);

        // Return slider to its original value after a short delay
        setTimeout(() => {
            numbersRangeSlider.noUiSlider.set(initialValue);
        }, 100);
    }
    function updateGraph(useTransitions) {
        const layout = layoutDropdown.value;
        const edgeLengthFactor = edgeLengthFactorInput.value;
        
        // Ensure the slider is initialized before using 'get' method
        if (!numbersRangeSlider.noUiSlider) {
            console.error("Sliders are not initialized yet.");
            return;
        }
        
        const [minIndices, maxIndices] = numbersRangeSlider.noUiSlider.get().map(Number);

        svg.style('display', layout !== 'heatmap' && layout !== 'euler' ? 'block' : 'none');
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

        if (layout === 'force') {
            const simulation = d3.forceSimulation(graphData.nodes)
                .alphaDecay(0.05)
                .velocityDecay(0.85)
                .force('link', d3.forceLink(graphData.links)
                    .id(d => d.id)
                    .distance(d => 25 / (1 + d.weight))
                    .strength(0.5)
                )
                .force('charge', d3.forceManyBody().strength(-50))
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
           // for (let i = 0; i < 300; ++i) simulation.tick(); // Arbitrary number of ticks to reach stability
            //simulation.stop(); // Stop the simulation to prevent further automatic ticking

            graphData.nodes.forEach(boundNode);
        }

        const visibleNodes = graphData.nodes.filter(node => 
            (node.numbers.length >= minIndices && node.numbers.length <= maxIndices) && 
            (selectedNumbers.size === 0 || node.numbers.some(num => selectedNumbers.has(num)))
        );

        const visibleLinks = graphData.links.filter(link => 
            visibleNodes.some(node => node.id === link.source) && 
            visibleNodes.some(node => node.id === link.target)
        );

        visibleNodes.sort((a, b) => (b.size * nodeSizeFactor) - (a.size * nodeSizeFactor));

        console.log('Visible Links:', visibleLinks);  // Check the edge data

const link = g.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(visibleLinks)
    .enter().append('line')
    .attr('stroke', '#999')
    .attr('stroke-width', edgesVisible ? 1 : 0)
    .attr('stroke-opacity', edgesVisible ? 1 : 0);


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
            .on('click', function(event, d) {
                highlightAssociatedNumbers(d.numbers);
                openNodeDetails(d);
            });

            node.append('title')
            .text(d => `Group: ${d.id}\nNumbers: ${d.numbers.join(', ')}`);

            node.attr('stroke', d => selectedNumbers.size > 0 && d.numbers.some(num => selectedNumbers.has(num)) ? 'black' : 'none')
            .attr('stroke-width', d => selectedNumbers.size > 0 && d.numbers.some(num => selectedNumbers.has(num)) ? 0 : 0);

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

    function updateThumbnails(numbers) {
        const thumbnails = d3.select('#thumbnails');
        thumbnails.selectAll('*').remove();

        numbers.forEach(number => {
            thumbnails.append('div')
                .attr('class', 'thumbnail')
                .style('width', '100%')
                .style('height', '30px')
                .style('margin', '5px 0')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('justify-content', 'center')
                .style('border', '1px solid #ccc')
                .style('background', '#fff')
                .text(number)
                .on('click', () => {
                    displayNumberPage(number, numbers);
                });
        });
    }

    function openNodeDetails(node) {
        updateThumbnails(node.numbers);
    }

    function displayNumberPage(number, numbers) {
        mainPage.style.display = 'none';
        numberDisplayPage.style.display = 'flex';

        const numberDisplay = document.getElementById('number');
        numberDisplay.textContent = number;

        const prevButton = document.getElementById('prev-number');
        const nextButton = document.getElementById('next-number');

        prevButton.onclick = () => {
            const currentIndex = numbers.indexOf(number);
            const prevIndex = (currentIndex - 1 + numbers.length) % numbers.length;
            displayNumberPage(numbers[prevIndex], numbers);
        };

        nextButton.onclick = () => {
            const currentIndex = numbers.indexOf(number);
            const nextIndex = (currentIndex + 1) % numbers.length;
            displayNumberPage(numbers[nextIndex], numbers);
        };
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
            const sourceIndex = graphData.nodes.findIndex(node => node.id === link.source);
            const targetIndex = graphData.nodes.findIndex(node => node.id === link.target);
            overlaps.push({ sets: [graphData.nodes[sourceIndex].id, graphData.nodes[targetIndex].id], size: link.weight });
        });

        const vennData = { sets, overlaps };

        const chart = venn.VennDiagram().width(width).height(height);
        d3.select("#network-graph svg").datum(vennData).call(chart);

        d3.selectAll(".venn-circle path")
            .style("fill-opacity", 0.5);

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
            .data([...allNumbers, 'X', 'Edges'])
            .enter().append('div')
            .attr('class', 'number-box')
            .style('fill', d => d === 'X' ? '#f4ce65' : (d === 'Edges' ? '#e0e0e0' : '#39ea7d'))
            .style('background-color', d => d === 'X' ? '#ffffff' : (numbersInGroups.has(d) ? '#e0e0e0' : '#ffffff'))
            .style('border', d => d === 'X' ? '4px solid #f4ce65' : (d === 'Edges' ? '4px solid #e0e0e0' : '1px solid #e0e0e0'))
            .text(d => d)
            .on('click', function(event, d) {
                console.log('Clicked:', d); // Debugging statement
                if (d === 'X') {
                    resetSelection();
                } else if (d === 'Edges') {
                    console.log('Toggling edges'); // Debugging statement
                    toggleEdges();
                } else if (numbersInGroups.has(d)) {
                    toggleNumberSelection(d);
                }
            });
    }

    function toggleEdges() {
        edgesVisible = !edgesVisible;
        const lines = g.selectAll('.links line');  // Select line elements correctly
    
        console.log('Toggling edges, visibility:', edgesVisible);
        console.log('Lines selected:', lines.size());
    
        // Ensure edges are created before toggling visibility
        if (lines.size() > 0) {
            lines.attr('stroke-width', edgesVisible ? 1 : 0)
                 .attr('stroke-opacity', edgesVisible ? 1 : 0)
                 .attr('display', edgesVisible ? 'block' : 'none');  // Explicit display toggle
        } else {
            console.warn('No lines found to toggle. Ensure edges are correctly added.');
        }
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

        updateThumbnails(Array.from(associatedNumbers));
    }

    function resetSelection() {
        selectedNumbers.clear();
        numberGrid.selectAll('.number-box')
            .style('background-color', d => d === 'X' ? '#ffffff' : (graphData.nodes.some(node => node.numbers.includes(d)) ? '#e0e0e0' : '#ffffff'));
        updateGraph();
        updateThumbnails([]);
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

    // Initialize the graph and grid with the fetched data
    updateGraph(false);
    updateGrid();
});