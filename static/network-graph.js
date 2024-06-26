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
    let maxIndices = 100;
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
        const dataUrl = 'https://jdboud.github.io/SRM/data/binaryCleanUserNumberCollections2Test024.xlsx';
        fetch(dataUrl)
            .then(response => response.arrayBuffer())
            .then(data => {
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

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

        // Continue with the rest of your updateGraph function logic...
    }

    function updateGrid() {
        // Your updateGrid function logic...
    }

    fetchData(); // Fetch initial data when the page loads
});
