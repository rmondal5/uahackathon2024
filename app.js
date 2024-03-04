const width = window.innerWidth / 1.5;
const height = window.innerHeight / 1.5;
const projection = d3.geoAlbersUsa()
    .scale(1300)
    .translate([width / 2, height / 2]);

const path = d3.geoPath()
    .projection(projection);

const svg = d3.select("#map").append("svg")
    .attr("width", width)
    .attr("height", height);

const g = svg.append("g");

// Define tooltip element
const tooltip = d3.select("#map").append("div")
    .attr("class", "tooltip")
    .style("display", "none");

// Define facility details element
const facilityDetails = d3.select("#map").append("div")
    .attr("class", "facility-details")
    .style("display", "none")
    .style("position", "absolute")
    .style("top", "10px")
    .style("right", "10px")
    .style("background-color", "white")
    .style("padding", "10px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "5px")
    .style("box-shadow", "0 2px 4px rgba(0, 0, 0, 0.1)");

let filters = {
    address: null,
    state: null,
    zipCode: null,
    division: null,
    timeZone: null,
    emr: null
};

function updateFacilityDisplay() {
    g.selectAll("circle")
        .style("display", d => {
            const addressMatch = !filters.address || d.facility_address1.toLowerCase().includes(filters.address.toLowerCase());
            const stateMatch = !filters.state || d.facility_state.toLowerCase() === filters.state.toLowerCase();
            const zipCodeMatch = !filters.zipCode || d.facility_zipcode === filters.zipCode;
            const divisionMatch = !filters.division || checkDivision(d, filters.division);
            const timeZoneMatch = !filters.timeZone || d.timezone.toLowerCase() === filters.timeZone.toLowerCase();
            const emrMatch = !filters.emr || d.emr_name.toLowerCase() === filters.emr.toLowerCase();
            
            return addressMatch && stateMatch && zipCodeMatch && divisionMatch && timeZoneMatch && emrMatch ? "block" : "none";
        });
}

function checkDivision(data, division) {
    if (division === "Division Office") {
        return data.facility_name.includes("Hub Sites");
    } else if (division === "Supply Chain Center") {
        return data.division_name === "Supply Chain";
    } else if (division === "Shared Service Center") {
        return data.division_name === "HSC";
    } else {
        // Hospital - everything else
        return !data.facility_name.includes("Hub Sites") && data.division_name !== "Supply Chain" && data.division_name !== "HSC";
    }
}

function handleFilterChange(filterType, value) {
    filters[filterType] = value;
    updateFacilityDisplay();
}

function populateStateDropdown(data) {
    const states = [...new Set(data.map(d => d.facility_state))];
    const stateDropdown = d3.select("#state-filter");
    states.forEach(state => {
        stateDropdown.append("option")
            .attr("value", state)
            .text(state);
    });
}

function populateDivisionDropdown() {
    const divisions = ["Division Office", "Supply Chain Center", "Shared Service Center", "Hospital"];
    const divisionDropdown = d3.select("#division-filter");
    divisions.forEach(division => {
        divisionDropdown.append("option")
            .attr("value", division)
            .text(division);
    });
}

function populateTimezoneDropdown(data) {
    const timezones = [...new Set(data.map(d => d.timezone))];
    const timezoneDropdown = d3.select("#timezone-filter");
    timezones.forEach(timezone => {
        timezoneDropdown.append("option")
            .attr("value", timezone)
            .text(timezone);
    });
}

function populateEMRDropdown(data) {
    const emrs = [...new Set(data.map(d => d.emr_name))];
    const emrDropdown = d3.select("#emr-filter");
    emrs.forEach(emr => {
        emrDropdown.append("option")
            .attr("value", emr)
            .text(emr);
    });
}

d3.json("gz_2010_us_050_00_20m.json").then(function(geojson) {
    g.selectAll("path")
        .data(geojson.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "white")
        .attr("stroke", "#808080")
        .attr("stroke-width", 0.2);

    d3.csv("facilities.csv").then(function(data) {
        const simulation = d3.forceSimulation(data)
            .force("x", d3.forceX().x(d => projection([d.longitude, d.latitude])[0]))
            .force("y", d3.forceY().y(d => projection([d.longitude, d.latitude])[1]))
            .force("collide", d3.forceCollide(5));
        
        const facilities = g.selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("r", 3)
            .style("fill", d => {
                if (d.facility_name.includes("Hub Sites")) {
                    return "green"; // Division Office
                } else if (d.division_name.includes("Supply Chain")) {
                    return "blue"; // Supply Chain Center
                } else if (d.division_name.includes("HSC")) {
                    return "red"; // Shared Service Center
                } else {
                    return "black"; // Hospital
                }

            })
            .on("mouseover", (event, d) => {
                tooltip.html(`
                  <div class="tooltip-content">
                    <strong>Name:</strong> ${d.facility_name}<br>
                    <strong>Division:</strong> ${d.division_name}<br>
                    <strong>State:</strong> ${d.facility_state}
                  </div>
                `);
              
                // Calculate the position of the tooltip relative to the container
                const containerRect = document.getElementById("map").getBoundingClientRect();
                const tooltipWidth = tooltip.node().offsetWidth;
                const tooltipHeight = tooltip.node().offsetHeight;
                const x = event.pageX - containerRect.left + 10; // Adjust the offset as needed
                const y = event.pageY - containerRect.top - tooltipHeight - 10; // Adjust the offset as needed
              
                tooltip.style("left", x + "px")
                       .style("top", y + "px")
                       .style("display", "block");
              })
              .on("mouseout", () => {
                tooltip.style("display", "none");
              })
            .on("click", (event, d) => {
                facilityDetails.html(`
                    <strong>Name:</strong> ${d.facility_name}<br>
                    <strong>COID:</strong> ${d.facility_coid}<br>
                    <strong>Address:</strong> ${d.facility_address1}, ${d.facility_city}, ${d.facility_state}<br>
                    <strong>Division:</strong> ${d.division_name}<br>
                    <strong>Time Zone:</strong> ${d.timezone}<br>
                    <strong>EMR:</strong> ${d.emr_name}<br>
                    <strong>Other Details:</strong><br>
                    <!-- Add other details here as needed -->
                `);
                facilityDetails.style("display", "block");
                 // Calculate the coordinates of the clicked circle
                 const [x, y] = projection([d.longitude, d.latitude]);
                 // Define the scale for zooming
                 const scale = 10; // You can adjust this value as needed
 
                 // Apply zoom to the clicked location
                 svg.transition()
                     .duration(750)
                     .call(zoom.transform, d3.zoomIdentity
                         .translate(width / 2, height / 2) // Translate to the center of the SVG
                         .scale(scale) // Apply the desired scale
                         .translate(-x, -y) // Translate to the clicked location
                     );
            });

        simulation.nodes(data).on("tick", () => {
            facilities
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });

        const zoom = d3.zoom()
            .scaleExtent([1, 200])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
                const zoomLevel = event.transform.k;
                const newRadius = 3 / zoomLevel;
                facilities.attr('r', newRadius);
                simulation.force("collide", d3.forceCollide(newRadius)).alpha(1).restart();
            });

        svg.call(zoom);

        // Populate filter options
        populateStateDropdown(data);
        populateDivisionDropdown();
        populateTimezoneDropdown(data);
        populateEMRDropdown(data);

        // Add event listeners for filter changes
        d3.select("#address-filter").on("input", function() {
            handleFilterChange("address", this.value);
        });
        d3.select("#state-filter").on("change", function() {
            handleFilterChange("state", this.value);
        });
        d3.select("#division-filter").on("change", function() {
            handleFilterChange("division", this.value);
        });
        d3.select("#timezone-filter").on("change", function() {
            handleFilterChange("timeZone", this.value);
        });
        d3.select("#emr-filter").on("change", function() {
            handleFilterChange("emr", this.value);
        });
    });
});