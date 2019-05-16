import React, { Component } from "react";
import * as d3 from "d3";
import _ from "supergroup";

const ChartCss = {
  textAlign: "left",
  color: "darkgreen",
  marginLeft: 20,
  marginTop: 100
};

export default class Chart extends Component {
  constructor(props) {
    super(props);
    this.state = { drewChart: false };
    this.gRef = React.createRef();
  }
  componentDidMount() {
    let { sym, data } = this.props;
    this.setup({}, {});
  }
  componentDidUpdate(prevProps, prevState) {
    this.setup(prevProps, prevState);
  }
  setup(prevProps, prevState) {
    let { sym, data } = this.props;
    let { drewChart } = this.state;
    if (data && this.gRef.current) {
      if (!drewChart || data !== prevProps.data) {
        let g = d3.select(this.gRef.current);
        let drawChart = this.chartSetup(g) || (() => {});
        drawChart(data);
        this.setState({ drewChart: true });
      }
    }
  }
  render() {
    let { sym, data, type, title } = this.props;
    return <g id={`${sym}-${type}`} ref={this.gRef} style={ChartCss} />;
  }
  chartSetup(g) {
    let {
      sym,
      data,
      type,
      width,
      height,
      xScale,
      yScale,
      title,
      doToChart
    } = this.props;
    try {
      var xAxis = d3.axisBottom(xScale);
      g.append("g")
        .attr("class", "x axis x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);
    } catch (e) {
      console.log(e);
      debugger;
    }

    // add the Y Axis
    var yAxis = d3.axisRight(yScale).ticks(3);
    //.tickFormat(d3.formatPrefix("1.0", 1e3));
    g.append("g")
      .attr("class", "y axis y-axis")
      .attr("transform", `translate(0,0)`)
      .call(yAxis);

    drawLegend(g, width, height, title);

    var chart = g; //.append("g");
    doToChart(chart, data, xScale, yScale);
    return;
    // define the area

    // from Chart
    /*
    g.attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      */
    return function drawChart(data) {
      // format the data

      const area = () => {}; // moved to BarChart doToChart props

      // add the X Axis
      var green = false;
      var red = false;
      var greenData = [];
      var redData = [];
      var allRed = [];
      var allGreen = [];
      data.forEach(function(d, idx, data) {
        // console.log("here", d, conf)

        if (d.blueValue >= d.redValue) {
          if (red) {
            redData.push(d);
            allRed.push(redData);
            redData = [];
            red = false;
          }
          green = true;
          greenData.push(d);
        } else {
          if (green) {
            greenData.push(d);
            allGreen.push(greenData);
            greenData = [];
            green = false;
          }
          red = true;
          redData.push(d);
        }
        if (Object.is(data.length - 1, idx)) {
          if (green) {
            greenData.push(d);
            allGreen.push(greenData);
          } else {
            redData.push(d);
            allRed.push(redData);
          }
        }
      });

      // add the area
      var chart = g.append("g");
      allGreen.forEach(greenD => {
        chart
          .append("path")
          .data([greenD])
          .attr("class", "greenArea")
          //.style("opacity", .2)

          .attr("d", area);
      });
      allRed.forEach(redA => {
        chart
          .append("path")
          .data([redA])
          .attr("class", "redArea")
          .attr("d", area);
      });
      // add the blueLine path.

      // THIS IS THE ZOOM CODE
      // var zoom = d3
      //   .zoom()
      //   .scaleExtent([1, 10])
      //   .on("zoom", () => {
      //     var scaleX = d3.event.transform.rescaleX(x);
      //     var scaleY = d3.event.transform.rescaleY(y);
      //     g.selectAll(".red, .redArea, .greenArea, .blue").attr(
      //       "transform",
      //       d3.event.transform
      //     );
      //     g.select(".x.axis").call(xAxis.scale(scaleX));
      //     g.select(".y.axis").call(yAxis.scale(scaleY));

      //     // g.attr("transform", d3.event.transform)
      //   });
      // chart.call(zoom);
      // chart
      //   .append("defs")
      //   .append("clipPath")
      //   .attr("id", "clip")
      //   .append("rect")
      //   .attr("width", width)
      //   .attr("height", height);
      // chart.attr("clip-path", "url(#clip)");
    };
  }
}
const drawLegend = (g, width, height, title) => {
  var legend = g
    .append("svg")
    .attr("width", width)
    .attr("height", height - 50);

  var dataL = 0;
  var offset = 150;
  var legendVals2 = ["Current Cost", "Sunk Cost"];
  var color = [d3.rgb("#ff00ea"), d3.rgb("#5201a8")];
  // from SimpleChart
  var legendVals2 = title.includes("+") ? title.split("+") : [title];
  // var color = [d3.rgb("steelblue")];

  var legend4 = legend
    .selectAll(".legends4")
    .data(legendVals2)
    .enter()
    .append("g")
    .attr("class", "legends4")
    .attr("transform", function(d, i) {
      if (i === 0) {
        dataL = d.length + offset;
        return "translate(30,2)";
      } else {
        var newdataL = dataL;
        dataL += d.length + offset;
        return `translate(${d.length + i * offset}, 2)`;
      }
    });

  legend4
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 10)
    .attr("height", 10)
    .style("fill", function(d, i) {
      return color[i];
    });

  legend4
    .append("text")
    .attr("x", 20)
    .attr("y", 10)
    //.attr("dy", ".35em")
    .text(function(d, i) {
      return d;
    })
    .attr("class", "textselected")
    .style("text-anchor", "start")
    .style("font-size", 15);
};
/*
const BarChartCss = {
  textAlign: "left",
  color: "darkgreen",
  marginLeft: 20
};

class BarChart extends Component {
  constructor(props) {
    super(props);
    this.state = { drewChart: false };
    this.gRef = React.createRef();
  }
  componentDidMount() {
    let { sym, data } = this.props;
    this.setup({}, {});
  }
  componentDidUpdate(prevProps, prevState) {
    this.setup(prevProps, prevState);
  }
  setup(prevProps, prevState) {
    let { sym, data } = this.props;
    let { drewChart } = this.state;
    if (data && this.gRef.current) {
      if (!drewChart || data !== prevProps.data) {
        let g = d3.select(this.gRef.current);
        let drawChart = this.chartSetup(g);
        drawChart(data);
        this.setState({ drewChart: true });
      }
    }
  }
  render() {
    let { sym, data } = this.props;
    return <g id={`g-${sym}`} ref={this.gRef} style={BarChartCss} />;
  }
  chartSetup(g) {
    let { sym, data, type, width, height, xScale, yScale } = this.props;
    // set the dimensions and margins of the graph
    // const margin = { top: 20, right: 20, bottom: 30, left: 50 };

    // set the dimensions and margins of the graph
    // width = width - margin.left - margin.right;
    // height = height - margin.top - margin.bottom;

    // set the ranges
    //let x = d3.scaleTime().range([0, width])
    //let y = d3.scaleLinear().range([height, 0])

    // define the area
    var area = d3
      .area()
      .x(function(d) {
        // console.log(d)
        return xScale(d.date);
      })
      .y0(function(d) {
        return yScale(d.redValue);
      })
      .y1(function(d) {
        return yScale(d.blueValue);
      });

    // define the blue line
    var blueLine = d3
      .line()
      .x(function(d) {
        return xScale(d.date);
      })
      .y(function(d) {
        return yScale(d.blueValue);
      });

    // define the blue line
    var redLine = d3
      .line()
      .x(function(d) {
        return xScale(d.date);
      })
      .y(function(d) {
        return yScale(d.redValue);
      });

    return function drawChart(data) {
      // format the data

      data.forEach(function(d) {
        //d.date = parseTime(d.year)
        //d.blueValue = +d.blueValue
        //d.redValue = +d.redValue
        d.date = new Date(d.date);
        d.blueValue = d.curval;
        d.redValue = -d.curcost;
      });
      // scale the range of the data
      /*
      xScale.domain(
        d3.extent(data, function(d) {
          return d.date;
        })
      );
      yScale.domain([
        0,
        d3.max(data, function(d) {
          return d.blueValue;
        })
      ]);
      * /
      // add the X Axis
      var xAxis = d3.axisBottom(xScale);
      g.append("g")
        .attr("class", "x axis x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

      // add the Y Axis
      var yAxis = d3
        .axisRight(yScale)
        .ticks(3)
        .tickFormat(d3.formatPrefix("1.0", 1e3));
      g.append("g")
        .attr("class", "y axis y-axis")
        .attr("transform", `translate(0,0)`)
        .call(yAxis);

      var legend = g
        .append("svg")
        .attr("width", width)
        .attr("height", height - 50);

      var dataL = 0;
      var offset = 150;
      var legendVals2 = ["Current Cost", "Sunk Cost"];
      var color = [d3.rgb("steelblue"), d3.rgb("black")];
      var legend4 = legend
        .selectAll(".legends4")
        .data(legendVals2)
        .enter()
        .append("g")
        .attr("class", "legends4")
        .attr("transform", function(d, i) {
          if (i === 0) {
            dataL = d.length + offset;
            return "translate(30,2)";
          } else {
            var newdataL = dataL;
            dataL += d.length + offset;
            return `translate(${d.length + i * offset}, 2)`;
          }
        });

      legend4
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 10)
        .attr("height", 10)
        .style("fill", function(d, i) {
          return color[i];
        });

      legend4
        .append("text")
        .attr("x", 20)
        .attr("y", 10)
        //.attr("dy", ".35em")
        .text(function(d, i) {
          return d;
        })
        .attr("class", "textselected")
        .style("text-anchor", "start")
        .style("font-size", 15);

      var green = false;
      var red = false;
      var greenData = [];
      var redData = [];
      var allRed = [];
      var allGreen = [];
      data.forEach(function(d, idx, data) {
        // console.log("here", d, conf)

        if (d.blueValue >= d.redValue) {
          if (red) {
            redData.push(d);
            allRed.push(redData);
            redData = [];
            red = false;
          }
          green = true;
          greenData.push(d);
        } else {
          if (green) {
            greenData.push(d);
            allGreen.push(greenData);
            greenData = [];
            green = false;
          }
          red = true;
          redData.push(d);
        }
        if (Object.is(data.length - 1, idx)) {
          if (green) {
            greenData.push(d);
            allGreen.push(greenData);
          } else {
            redData.push(d);
            allRed.push(redData);
          }
        }
      });

      // add the area
      var chart = g.append("g");
      allGreen.forEach(greenD => {
        chart
          .append("path")
          .data([greenD])
          .attr("class", "greenArea")
          //.style("opacity", .2)

          .attr("d", area);
      });
      allRed.forEach(redA => {
        chart
          .append("path")
          .data([redA])
          .attr("class", "redArea")
          .attr("d", area);
      });
      // add the blueLine path.
      chart
        .append("path")
        .data([data])
        .attr("class", "blue")
        .attr("d", blueLine);

      chart
        .append("path")
        .data([data])
        .attr("class", "red")
        .attr("d", redLine);

      // THIS IS THE ZOOM CODE
      // var zoom = d3
      //   .zoom()
      //   .scaleExtent([1, 10])
      //   .on("zoom", () => {
      //     var scaleX = d3.event.transform.rescaleX(x);
      //     var scaleY = d3.event.transform.rescaleY(y);
      //     g.selectAll(".red, .redArea, .greenArea, .blue").attr(
      //       "transform",
      //       d3.event.transform
      //     );
      //     g.select(".x.axis").call(xAxis.scale(scaleX));
      //     g.select(".y.axis").call(yAxis.scale(scaleY));

      //     // g.attr("transform", d3.event.transform)
      //   });
      // chart.call(zoom);
      // chart
      //   .append("defs")
      //   .append("clipPath")
      //   .attr("id", "clip")
      //   .append("rect")
      //   .attr("width", width)
      //   .attr("height", height);
      // chart.attr("clip-path", "url(#clip)");
    };
  }
}
*/
