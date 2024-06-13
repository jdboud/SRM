document.addEventListener('DOMContentLoaded', function() {
    const heatmap = d3.select('#heatmap').append('svg')
        .attr('width', '100%')
        .attr('height', '500px');

    function fetchHeatmapData() {
        fetch('/data')
            .then(response => response.json())
            .then(data => {
                updateHeatmap(data);
            })
            .catch(error => console.error('Error fetching data:', error));
    }

    function updateHeatmap(data) {
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
        data.nodes.forEach(node => {
            node.numbers.forEach(number => {
                dataTransformed.push({ user: node.id, number: number, value: 1 });
            });
        });

        heatmap.selectAll("*").remove();

        const svg = heatmap
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

    fetchHeatmapData();
});