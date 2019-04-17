//main.js
//// Pop in millions, gdp in 10s of billions, infant per 1000 live births, 
//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){////Rework the code layout, wrap everything together for referencing, etc

    //pseudo-global variables ////Moved variables here to be accessed throughout function, to get around wrapping the entire code into one block
    var attrArray = ["Parliament Seats", "Population", "GDP", "Unemployment", "Growth Rate", "Infant Mortality", "Life Expectancy"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute////Name to join the csv data and country tables
    //chart frame dimensions ////Define the chart dimensions
    var chartWidth = window.innerWidth * 0.425,////Keep it under half the screen so it fits with map
    chartHeight = 473,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    var chart = d3.select("body")////Chart here so it can be accessed when dynamically altering the chart axis
            .append("svg")////Append chart to svg
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
    
    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
    .range([463, 0])
    .domain([0, 110]);////Set domain for Y values to display within, height of each bar
    window.onload = setMap();////Create the map

    //set up choropleth map
    function setMap(){////Function that contains all the map creation code
        //map frame dimensions
        var width = window.innerWidth * 0.48,////Set dimensions for appearing on screen
            height = 600;////Increase height to better visualize Malta

        //create new svg container for the map
        var map = d3.select("body")////Place map, svg in body of html
            .append("svg")
            .attr("class", "map")
            .attr("width", width)////Obtain width and height keys from vars above
            .attr("height", height);

        //create Albers equal area conic projection
        var projection = d3.geoAlbers()////Since data is Europe, can use some of the basis from example, just zoomed out
        .center([0.00, 51.75])////geoConicEqualArea originally used since geoAlbers seemed to break code, but ConicEqual did not. Now it seems fine with both, so using geoAlbers
        .rotate([-13.35, 0.00, 0])
        .parallels([27.91, 45.5])
        .scale(1000)////Increase scale to better see Malta
        .translate([width / 2, height / 2]);////Keep map in center of container

        var path = d3.geoPath()////Create projection for map
            .projection(projection);

        //use Promise.all to parallelize asynchronous data loading
        var promises = [];////Push all the data with Promise to add it all to map
        promises.push(d3.csv("data/EU_stats_csv.csv")); //load attributes from csv ////Load stats for EU members
        promises.push(d3.json("data/EuropeCountries.topojson")); //load background spatial data
        promises.push(d3.json("data/EU_Countries.topojson")); ////load countries for choropleth
        Promise.all(promises).then(callback);

        function callback(data){////create vars from data loaded above
            csvData = data[0];
            europe = data[1];
            eu = data[2];
        
            setGraticule(map, path);////Rework code layout to better condense, streamline it

            var europeCountries = topojson.feature(europe, europe.objects.EuropeCountries),////create vars for topojson datasets
            //translate europe TopoJSON////translate eu countries topojson
                euCountries = topojson.feature(eu, eu.objects.EU_Countries).features;////add .features to pull array data
            
            //add Europe countries to map ////Add countries after graticule or else the graticule covers them
            var countries = map.append("path")////append countries to map to serve as a basemap of sorts
                .datum(europeCountries)////Use europeCountries var (based on europe var) to create countries var, base map
                .attr("class", "countries")
                .attr("d", path);

            //join csv data to GeoJSON enumeration units
            euCountries = joinData(euCountries, csvData);////add the data to the map, essentially

            //create the color scale
            var colorScale = makeColorScale(csvData);////call colorscale function to determine what country is what color

            //add enumeration units to the map
            setEnumerationUnits(euCountries, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);
            createDropdown(csvData);
        };
    }; //end of setMap()

    function setGraticule(map, path){
        //create graticule generator ////Create graticule above countries so it's drawn first
        var graticule = d3.geoGraticule()
        .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")////create background to entire map, give it some contrast and (preferably) ocean feel
    .datum(graticule.outline()) //bind graticule background
    .attr("class", "gratBackground") //assign class for styling
    .attr("d", path) //project graticule////add the graticule to the map, basically, visualize it

    //create graticule lines////Helps give context to the projection, parameters. Helps user understand distortion, how the map lies in relation to the rest of the world
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
    .data(graticule.lines()) //bind graticule lines to each element to be created
    .enter() //create an element for each datum
    .append("path") //append each element to the svg as a path element
    .attr("class", "gratLines") //assign class for styling////Allow modification in css stylesheet
    .attr("d", path); //project graticule lines////As above, display the graticule lines to allow increased understanding of map layout
    };

    function joinData(euCountries, csvData){////Join the csv data to the eu countries, enumeration units
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i=0; i<csvData.length; i++){////Loop to work through each csv column
            var csvCountry = csvData[i]; //the current region
            var csvKey = csvCountry.NAME; //the CSV primary key
            //loop through geojson regions to find correct region
            for (var a=0; a<euCountries.length; a++){

                var geojsonProps = euCountries[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.NAME; //the geojson primary key
                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){////Check that geojson and csv match, country has corresponding csv values

                    //assign all attributes and values
                    attrArray.forEach(function(attr){////assign the data, make sure it's in float format
                        var val = parseFloat(csvCountry[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };
        return euCountries;////Return the enumeration units and data to map frame
    };

    function setEnumerationUnits(euCountries, map, path, colorScale){
        ////Add EU countries to map, primary enumeration units
        var europeanUnion = map.selectAll(".country")////NOT PROJECTING? NOT APPENDING/filling array. Fixed: Forgot to add .features above, rip me
        .data(euCountries)////MALTA MISSING FROM SHAPEFILE. Fixed. Apparently it wasn't. I think I over-simplified in mapshaper, it was removed. Should be in now, less simplification/prevent shape removal was necessary
        .enter()
        .append("path")
        .attr("class", function(d){
            return "country " + d.properties.NAME;////Use NAME from file attribute table to properly identify countries
        })
        .attr("d", path)
        .style("fill", function(d){////Set colorscale in accordance to properties
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover", function(d){////Set mouseover and out to listen for when indirect pointing passes over geographic area
            highlight(d.properties);////Display highlight of area
        })
        .on("mouseout", function(d){////Remove the highlight to maintain overall visual coherence
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);////Move the info label with the mouse for easy reading
        var desc = europeanUnion.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    };

    //function to create color scale generator
    function makeColorScale(data){////Define the colors to be used for choropleth classification
        var colorClasses = [////Function so it can be called later
            "#feebe2",////Use Color Brewer to determine set that is colorblind and lcd friendly
            "#fbb4b9",
            "#f768a1",
            "#c51b8a",
            "#7a0177",
        ];

        //create color scale generator
        var colorScale = d3.scaleThreshold()////Create variable using the color variable above
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){////Loop to create array, ensure float format
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);////Determine natural breaks with ckmeans
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){////natural breaks due to extreme differences between countries (i.e. Germany and Bulgaria)
            return d3.min(d);
        });
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);////Determine the breakpoints, return to map

        return colorScale;
    };
    
    //function to test for data value and return color
    function choropleth(props, colorScale){////Define choropleth with colorscale
        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)){////value is number and is not not a number
            return colorScale(val);
        } else {////Else for if there's no data or improper format, make it gray
            return "#CCC";
        };
    };

    //function to create coordinated bar chart
    function setChart(csvData, colorScale){////Create the bar chart to visualize data numbers
        ////Moved the chart dimensions out to a more global position, at the beginning of the code
        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")////Give a backdrop to distinguish chart box from rest of webpage
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //create a scale to size bars proportionally to frame and for axis
        var yScale = d3.scaleLinear()////Scale bars to fit frame
            .range([463, 0])
            .domain([0,110]);

        //set bars for each country
        var bars = chart.selectAll(".bar")
        .data(csvData)////Use the csv data to determine the bar values
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){////Define class as bar, along with the country name
            return "bar " + d.NAME;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", highlight)////Define attributes of bar, add highlight/dehighlight functionality to assist visualization
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);

        var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');////Scale so all countries fit in chart frame
        //create a text element for the chart title
        var chartTitle = chart.append("text")////Chart title to better inform reader
            .attr("x", 40)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Number of " + expressed + " in each EU country")////Dynamic Title for expressed variable (need to try and remove underscores, can't figure out keywords that work)
        
        var yAxis = d3.axisLeft()////Y axis for chart values
            .scale(yScale);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);////Put axis on chart
        
        //create frame for chart border
        var chartFrame = chart.append("rect")////Distinguish/separate chart from rest of web page
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale); ////Uodate the chart so it corresponds to the presently displayed map data
    }; //end of setChart()

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){////Afford user to decide what attribute they will visualize
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData)////Call change attribute function to allow user to actually change the displayed data
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")////Basic selection display upon loading the page
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)////Acquire names from attribute array, populate the dropdown menu
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    };
    //dropdown change listener handler
    function changeAttribute(attribute, csvData){////Function to change the attribute, and thus the displayed data
        //change the expressed attribute
        expressed = attribute;
        //recreate the color scale
        var colorScale = makeColorScale(csvData);////Create color scale, using colorbrewer

        d3.select(".axis").remove();////Remove axis values when changing attributes so correct values can be placed on axis

        /*var maxattr = d3.max(csvData,function(d){return parseFloat(d[expressed])});
        yScale = d3.scaleLinear()
        .range([463, 0])
        .domain([0, maxattr]); ////This section works, but alters the chart in weird ways (like making Population not display correctly)
        console.log(yScale) ////Decided to keep it for posterity
        console.log(maxattr)*/

        /*Most of my data is a bit different in terms of measurement, so running these checks to determine what the domain should be for best visualization*/
        if (expressed == "Parliament Seats") { 
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 110]);
        }
        else if (expressed == "Population") { 
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 90]);
        }
        else if (expressed =="GDP"){
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 400]);
        }
        else if (expressed =="Unemployment"){
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 30]);
        }
        else if (expressed =="Growth Rate"){ ////Domain has negative values here as some countries have negative growth
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([-1.5, 2.5]);
        }
        else if (expressed =="Infant Mortality"){
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 11]);
        }
        else if (expressed =="Life Expectancy"){
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 110]);
        }

        //create vertical axis generator
        var yAxis = d3.axisLeft()////Y axis for chart values
        .scale(yScale);

        //place axis
        var axis = chart.append("g")////Reset the axis on the chart to correspond to the domain determined above
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);////Put axis on chart

        //recolor enumeration units
        var europeanUnion = d3.selectAll(".country")
            .transition()
            .duration(1400)////Create transition for visual feedback, slightly longer duration to better match the chart transition
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            });
        //re-sort, resize, and recolor bars
        var bars = d3.selectAll(".bar")////Change the bars to match the selected attribute data layout
            //re-sort bars
            .sort(function(a, b){
                return b[expressed] - a[expressed];
            })
            .transition() //add animation
            .delay(function(d, i){
                return i * 20 ////20 millisecond delay between each bar transition
        })
        .duration(500); ////Set duration of individual bar transition
        updateChart(bars, csvData.length, colorScale);////Call function to change the chart
    };  //end of changeAttribute()





    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale){////Actually affect bar data here, how tall they are in the chart
        yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 110]);////Determine basic domain for yScale, attribute value display
        
        /* Once again, the different domains are needed due to the various levels of data, measurement. Run if/else checks to determine which domain value to use*/
        if (expressed == "Parliament Seats") { 
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 110]);
        }
        else if (expressed == "Population") { 
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 90]);
        }
        else if (expressed == "GDP") { 
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 400]);
        }
        else if (expressed =="Unemployment"){
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 30]);
        }
        else if (expressed =="Growth Rate"){ ////Copied from above, so negative values here again
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([-1.5, 2.5]);
        }
        else if (expressed =="Infant Mortality"){
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 11]);
        }
        else if (expressed =="Life Expectancy"){
            yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 110]);
        }

        //position bars
        bars.attr("x", function(d, i){////Set the bar locations
                return i * (chartInnerWidth / n) + leftPadding;
            })
            //size/resize bars
            .attr("height", function(d, i){
                return 463 - yScale(parseFloat(d[expressed])); ////Make bars grow up, determine their size in the chart
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function(d){////Determine the new colors of the bars based on the color scale
                return choropleth(d, colorScale);
            });
        
        /* Once more, use if/else to customize the chart title text to better describe the attributes to the user */
        if (expressed == "Parliament Seats") {////This should allow for custom chart title text
            var chartTitle = d3.select(".chartTitle")
        .text("Number of EU" + expressed + " held by each country");
        }
        else if (expressed == "Population") {
            var chartTitle = d3.select(".chartTitle")
        .text( expressed + " (millions) of each EU country");////Explain pop data is in millions to allow for proper understanding
        }
        else if (expressed == "GDP") {
            var chartTitle = d3.select(".chartTitle")
        .text(expressed + " (tens of billions USD) of each EU country"); ////Axis only wanted to use 3 digits, so had to scale everything appropriately
        }
        else if (expressed == "Unemployment") {
            var chartTitle = d3.select(".chartTitle")
        .text(expressed + " percent in each EU country");
        }
        else if (expressed == "Growth Rate") {
            var chartTitle = d3.select(".chartTitle")
        .text(expressed + " percent of each EU country");
        }
        else if (expressed == "Infant Mortality") {
            var chartTitle = d3.select(".chartTitle")
        .text(expressed + " in each EU country");
        }
        else if (expressed == "Life Expectancy") {
            var chartTitle = d3.select(".chartTitle")
        .text("Average " + expressed + " for each EU country");
        }
    };

    //function to highlight enumeration units and bars
    function highlight(props){////Allow user to see just what polygon they are currently hovering over
    //change stroke
    var selected = d3.selectAll("." + props.NAME)
        .style("stroke", "blue")
        .style("stroke-width", "2");////Style the outline of the polygon
    setLabel(props)
    };
    function dehighlight(props){
        var selected = d3.selectAll("." + props.NAME)
            .style("stroke", function(){
                return getStyle(this, "stroke")////Remove the highlight, return the polygon outline to its natural color/style
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName){
            var styleText = d3.select(element)////acquire the original style for the polygon outline
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        };
        d3.select(".infolabel")////Remove the info box upon mousing out of the polygon to prevent clutter
        .remove();
    };

    //function to create dynamic label
    function setLabel(props){
        //label content
    /* One last time lol. Customize the info panel/label to better explain the data to the user for the individual attributes */    
        var labelAttribute = "<h1>" + props.NAME +
            ": "+ props[expressed] +" " + expressed + "</h1>";
        if (expressed == "Parliament Seats") {
            var labelAttribute = "<h1>" + props.NAME +
            ": "+ props[expressed] +" seats</h1>";
        }
        else if (expressed == "Population") {
        var labelAttribute = "<h1>" + props.NAME +
        ": "+ props[expressed] +" Million</h1>";
        }
        else if (expressed == "GDP") {
            var labelAttribute = "<h1>" + props.NAME +
            ": "+ props[expressed]*10 +" Billion</h1>";////Round here to better display the actual GDP, get around the axis 3 digit limitation earlier
        }
        else if (expressed == "Unemployment") {
            var labelAttribute = "<h1>" + props.NAME +
            ": "+ props[expressed] +"% Unemployment</h1>";
        }
        else if (expressed == "Growth Rate") {
            var labelAttribute = "<h1>" + props.NAME +
            ": "+ props[expressed] +"% Growth</h1>";
        }
        else if (expressed == "Infant Mortality") {
            var labelAttribute = "<h1>" + props.NAME +
            ": "+ props[expressed] +" infant deaths per 1000 births</h1>";
        }
        else if (expressed == "Life Expectancy") {
            var labelAttribute = "<h1>" + props.NAME +
            ": "+ props[expressed] +" Years</h1>";
        }
        //create info label div
        var infolabel = d3.select("body")////Use selected label attribute from above checks to populate the info label here
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.NAME + "_label")
            .html(labelAttribute);

        var regionName = infolabel.append("div")
            .attr("class", "labelname")////Define class of info label, 
            .html(props.name);
    };
    //function to move info label with mouse
    function moveLabel(){////Move the label with the mouse for easier reading
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()////Determine width of label to fit the text
            .getBoundingClientRect()
            .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 75,////avoid overflow, info panel leaving visible screen
            x2 = d3.event.clientX - labelWidth - 10,
            y2 = d3.event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; ////Test for overflow
        //vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1; 

        d3.select(".infolabel")
            .style("left", x + "px") ////set style of info panel
            .style("top", y + "px");
    };
})(); //last line of main.js