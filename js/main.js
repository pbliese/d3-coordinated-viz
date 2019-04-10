//main.js

//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){////Rework the code layout, wrap everything together for referencing, etc

    //pseudo-global variables
    var attrArray = ["Parliament_Seats", "Population", "GDP", "Unemployment", "Growth_Rate", "Infant_Mortality", "Life_Expectancy"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute////Name to join the csv data and country tables
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
        });
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
        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.425,////Dynamic width, same as map frame
            chartHeight = 473,
            leftPadding = 25,
            rightPadding = 2,
            topBottomPadding = 5,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")////Append chart to svg
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")////Give a backdrop to distinguish chart box from rest of webpage
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //create a scale to size bars proportionally to frame and for axis
        var yScale = d3.scaleLinear()////Scale bars to fit frame
            .range([463, 0])
            .domain([0, 100]);////Y value max here is 100, depends on data range (i.e. population)

        //set bars for each country
        var bars = chart.selectAll(".bar")
            .data(csvData)////Obtain csv data to determine bar height
            .enter()
            .append("rect")
            .sort(function(a, b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bar " + d.NAME;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)////Scale so all countries fit in chart frame
            .attr("x", function(d, i){
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            .attr("height", function(d, i){
                return 463 - yScale(parseFloat(d[expressed]));////Make sure bars grow up from bottom of chart, not drop down from top
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            .style("fill", function(d){////Set bar color to same as enumeration unit color
                return choropleth(d, colorScale);
            });

        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 40)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Number of Variable " + expressed + " in each country")////Dynamic Title for expressed variable (need to try and remove underscores, can't figure out keywords that work)
        
        //create vertical axis generator
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
    };
})(); //last line of main.js