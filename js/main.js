//main.js

window.onload = setMap();////Create the map

//set up choropleth map
function setMap(){////Function that contains all the map creation code
    //map frame dimensions
    var width = 960,////Set dimensions for appearing on screen
        height = 600;

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
    .scale(1000)
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

        var europeCountries = topojson.feature(europe, europe.objects.EuropeCountries),////create vars for topojson datasets
        //translate europe TopoJSON////translate eu countries topojson
            euCountries = topojson.feature(eu, eu.objects.EU_Countries).features;////add .features to pull array data
        //create graticule generator ////Create graticule above countries so it's drawn first
            var graticule = d3.geoGraticule()
          .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")////create background to entire map, give it some contrast and (preferably) ocean feel
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

        //create graticule lines////Helps give context to the projection, parameters. Helps user understand distortion, how the map lies in relation to the rest of the world
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling////Allow modification in css stylesheet
        .attr("d", path); //project graticule lines
    
        //add Europe countries to map ////Add countries after graticule or else the graticule covers them
        var countries = map.append("path")////append countries to map to serve as a basemap of sorts
            .datum(europeCountries)////Use europeCountries var (based on europe var) to create countries var, base map
            .attr("class", "countries")
            .attr("d", path);

        ////Add EU countries to map, primary enumeration units
        var europeanUnion = map.selectAll(".country")////NOT PROJECTING? NOT APPENDING/filling array. Fixed: Forgot to add .features above, rip me
        .data(euCountries)////MALTA MISSING FROM SHAPEFILE. Apparently it wasn't. I think I over-simplified in mapshaper, it was removed. Should be in now, less simplification/prevent shape removal was necessary
        .enter()
        .append("path")
        .attr("class", function(d){
            return "country " + d.properties.NAME;////Use NAME from file attribute table to properly identify countries
        })
        .attr("d", path);
    };
};