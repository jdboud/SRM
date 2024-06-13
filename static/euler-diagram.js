document.addEventListener('DOMContentLoaded', function() {
    const svg = d3.select('#network-graph').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    function fetchEulerData() {
        fetch('/data')
            .then(response => response.json())
            .then(data => {
                updateEulerDiagram(data);
            })
            .catch(error => console.error('Error fetching data:', error));
    }

    function updateEulerDiagram(data) {
        const width = svg.node().getBoundingClientRect().width;
        const height = svg.node().getBoundingClientRect().height;

        svg.selectAll("*").remove();

        const sets = [];
        data.nodes.forEach((node, i) => {
            sets.push({ sets: [i], size: node.numbers.length });
        });

        const overlaps = [];
        data.links.forEach(link => {
            const sourceNode = data.nodes.find(node => node.id === link.source);
            const targetNode = data.nodes.find(node => node.id === link.target);
            const intersectionSize = sourceNode.numbers.filter(value => targetNode.numbers.includes(value)).length;
            overlaps.push({ sets: [sourceNode.id, targetNode.id], size: intersectionSize });
        });

        const chart = venn.VennDiagram().width(width).height(height);
        svg.datum({ sets: sets, overlaps: overlaps }).call(chart);

        d3.selectAll(".venn-circle path")
            .style("stroke-width", 3)
            .style("fill-opacity", 0.5)
            .style("stroke-opacity", 1)
            .style("fill", d => d3.scaleOrdinal(d3.schemeCategory10)(d.sets[0]));

        d3.selectAll(".venn-circle text")
            .style("fill", "black")
            .style("font-size", "14px");
    }

    fetchEulerData();
});