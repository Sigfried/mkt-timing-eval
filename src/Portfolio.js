import React, { Component } from "react";
import * as d3 from "d3";
import daily from "./data/daily.csv";
import dcadaily from "./data/dcadaily.csv";
import _ from "supergroup";
import Chart from "./Chart";
window.d3 = d3;

const dtfmt = d3.timeFormat("%m/%d/%Y");
const cfmt = d3.format(",");
const SYMBOL_FILTER = bysym => {
  return bysym;
  // return bysym.slice(0, 1); // debugging filter, just keep first 2
  // some symbols with sells from zero positions -- doing this in R code now
  // let bad = ['HACK', 'IUSG', 'IVE']
  // return bysym.filter(sym => !bad.includes(sym.toString()))
};

window.global = {
  status: null,
  datasets: {}
};
var dataReadyEvt = new CustomEvent("dataReady", global);
//const datasets = { daily, dcadaily }
Promise.all([d3.csv(daily), d3.csv(dcadaily)]).then(([daily, dcadaily]) => {
  global.status = "ready";
  global.datasets = { daily, dcadaily }; // make sure === returns false for previous global.datasets
  document.dispatchEvent(dataReadyEvt);
});

const accessors = {
  x: d => d["date"],
  y0: d => d["curcost"],
  y1: d => d["curval"],
  date: d => d["date"],
  curcost: d => d["curcost"],
  curval: d => d["curval"],
  price: d => d["price"],
  curpl: d => d["curpl"],
  close: d => d["close"],
  realpl: d => d["realpl"],
  symbol: d => d["symbol"]
};
const tradesAndDailyPricesCsvPrep = daily => {
  daily = daily.map(d => {
    d.date = new Date(d.date);
    d.Price = parseFloat(d.Price);
    d.price = d.Price;
    d.Quantity = parseFloat(d.Quantity);
    d.close = parseFloat(d.close);
    d.curcost = parseFloat(d.curcost);
    d.curval = parseFloat(d.curval);
    d.curpl = parseFloat(d.curpl);
    d.pos = parseFloat(d.pos);
    d.trdnum = parseInt(d.trdnum);
    return d;
  });
  let bysym = _.supergroup(daily, "symbol").sort();

  if (SYMBOL_FILTER) {
    bysym = SYMBOL_FILTER(bysym);
  }
  /* moved to R code
  bysym = mungeRecsAndRegroup(
    bysym, 
    sym => {  // tnoss daily price recs more than 5 days before first trade
      let idx = sym.records.findIndex(d => d.pos !== 0)
      idx = Math.max(0, idx - 5)
      return sym.records.slice(idx)
    },
    ["symbol"])
  debugger
  */
  mungeRecsInGroups(bysym, calcAndPopulatePL);
  daily = bysym.flatMap(d => d.records);
  //debugger
  return { daily, bysym, accessors };
};

const mungeRecsAndRegroup = (sg, mungeFunc, sgParams) => {
  // might be worth adding to supergroup module
  return _.supergroup(sg.flatMap(mungeFunc), ...sgParams);
};
const mungeRecsInGroups = (sg, mungeFunc) => {
  // also might be worth adding to supergroup module, but better version that
  // doesn't mutate its input
  sg.forEach(g => {
    g.records = mungeFunc(g);
  });
  return sg;
};
const calcAndPopulatePL = sym => {
  let justTrades = sym.records.filter(d => d.Action !== "NA");
  //if (sym+'' === 'SLVP') debugger
  plcalc(justTrades); // adds closingPL to sell trades
  let realpl = 0;
  // sym.records.filter(d=>d.Action !== 'NA')
  //    .map(d => {return _.pick(d, ['Action','Price','Quantity','curcost','curpl','curval','realpl'])})
  //    .map(d=>_.values(d).map(d=>isFinite(d) ? Math.round(d) : d))
  let wrealpl = sym.records.map(d => {
    //if (d.Action === 'sell') debugger
    if (typeof d.closingPL !== "undefined") {
      // should also be a sell trade, but not bothering to check
      realpl += d.closingPL;
      //debugger
    }
    d.realpl = realpl;
    return d;
  });
  return wrealpl;
};
const plcalc = trades => {
  // adds closingPL to sell trades
  let remainingBuyStack = trades.reduce((acc, cur, idx, src) => {
    if (cur.Action === "buy") {
      acc.push(cur);
    } else {
      cur.closingPL = closepos(acc, cur);
    }
    return acc;
  }, []);
  // don't need to return remainingBuyStack, results stored in sell trades
};
const closepos = (stack, sell) => {
  let sharesToClose = -sell.Quantity;
  let pl = 0;

  while (sharesToClose) {
    if (sharesToClose < 0) throw new Error("that's not supposed to happen");
    let buy = stack.pop();
    if (buy.Quantity > sharesToClose) {
      let remainder = _.cloneDeep(buy);
      remainder.Quantity -= sharesToClose;
      stack.push(remainder);
      buy.Quantity = sharesToClose;
    }
    pl += buy.Quantity * sell.Price - buy.Quantity * buy.Price;
    sharesToClose -= buy.Quantity;
  }
  return pl;
};

const pageConf = () => ({
  width: window.innerWidth * 0.9
});
const dataColConf = () => {
  let pc = pageConf();
  let conf = {
    width: pc.width * 0.45
  };
  return conf;
};

const chartGroupColData = (dailyData, dsname) => {
  let dcc = dataColConf();
  let { daily, bysym, accessors } = tradesAndDailyPricesCsvPrep(dailyData);
  let conf = {
    cgcName: dsname,
    width: dcc.width,
    daily,
    bysym,
    accessors
  };
  window.global[dsname] = { conf };
  return conf;
};
const chartGroupConf = () => ({
  height: 500
});
export default class Container extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  componentDidMount() {
    document.addEventListener("dataReady", evt => this.setState({ global }));
  }
  componentDidUpdate(prevProps, prevState) {
    this.handleData(prevProps, prevState);
  }
  handleData(prevProps, prevState) {
    let status = _.get(this.state, "global.status");
    let datasets = _.get(this.state, "global.datasets");
    if (status !== "ready") {
      return;
    }
    if (datasets === _.get(prevState, "global.datasets")) {
      return;
    }
    this.setState({ status, datasets });
  }
  render() {
    if (this.state.status !== "ready") return null;
    return <Portfolio datasets={this.state.datasets} />;
  }
}
export class Portfolio extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  componentDidMount() {
    this.handleData({}, {});
  }
  componentDidUpdate(prevProps, prevState) {
    this.handleData(prevProps, prevState);
  }
  handleData(prevProps, prevState) {
    let { datasets } = this.props;
    if (datasets === prevProps.datasets) {
      return;
    }
    // two datasets right now (regular portfolio and dollar cost avg)
    //    make two chartGroupCols
    //    each chartGroupCol has a chartGroup for each symbol
    let chartGroupCols = _.mapValues(datasets, (dailyData, dsname) => {
      let cgcData = chartGroupColData(dailyData, dsname);
      let { cgcName, daily, bysym, accessors, width } = cgcData;

      let lasttrades = bysym.map(s => _.last(s.records));
      lasttrades = _.sortBy(lasttrades, d => d.realpl);
      //lasttrades = _.sortBy(lasttrades, d => d.curpl);
      //let cols = ['Symbol', 'P&L', 'Gains', 'Value', 'Cost', 'Close']
      let cols = {
        Symbol: trd => accessors.symbol(trd),
        "P&L": trd => Math.floor(accessors.curpl(trd)),
        Gains: trd => Math.floor(accessors.realpl(trd)),
        Value: trd => Math.floor(accessors.curval(trd)),
        Cost: trd => Math.floor(accessors.curcost(trd)),
        Close: trd => Math.floor(accessors.close(trd))
      };
      let colnames = _.keys(cols);
      let hoverMsg = trd => _.map(cols, (v, k) => v(trd));
      /*
      (`${dtfmt(accessors.date(d))}
        P&L: ${Math.floor(accessors.curpl(d))} Gains: ${Math.floor(
          accessors.realpl(d)
        )} Value: ${Math.floor(accessors.curval(d))} Cost: ${Math.floor(
          accessors.curcost(d)
        )}  Close: ${Math.floor(accessors.close(d))}`);
      */
      let tbl = (
        <div className="hovtbl">
          <div
            className="hovwrapper"
            //style={{ display: "grid", gridTemplateColumns: `repeat(${colnames.length}, 1fr)` }}
          >
            {colnames.map((d, idx) => (
              <div key={idx} style={{ gridColumn: idx + 1 }}>
                {d}
              </div>
            ))}
          </div>
          {lasttrades.map((trd, idx) => {
            let hoverVals = hoverMsg(trd);
            return (
              // 1 row per (last) trade
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${colnames.length}, 1fr)`
                }}
              >
                {hoverVals.map((d, idx) => (
                  <div key={idx} style={{ gridColumn: idx + 1 }}>
                    {isFinite(d) ? cfmt(d) : d}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      );

      let chartGroups = bysym.map(sym => {
        let key = `${cgcName}-${sym}`;
        return (
          <div key={key}>
            <h4>{sym + ""}</h4>
            <ChartGroup sym={sym} cgcData={cgcData} />
          </div>
        );
      });
      return (
        <div key={cgcName} className={`chart-group-col ${cgcName}`}>
          <h2>
            {bysym.length} symbols, {cgcName}
          </h2>
          {tbl}
          {chartGroups}
        </div>
      );
      //return chartGroups;
    });
    this.setState({ chartGroupCols });
  }
  render() {
    let { chartGroupCols = {} } = this.state;
    //let cols = _.values(chartGroupCols);
    return <div>{_.values(chartGroupCols)}</div>;
  }
}
const PortfolioCss = {
  textAlign: "left",
  color: "darkgreen"
};
class ChartGroup extends Component {
  constructor(props) {
    super(props);
    this.state = { drewChart: false, hoverMsg: "" };
    //this.enterChart = this.enterChart.bind(this);
    this.leaveChart = this.leaveChart.bind(this);
    this.hoverChart = this.hoverChart.bind(this);
  }
  componentDidMount() {
    this.handleData({}, {});
  }
  componentDidUpdate(prevProps, prevState) {
    let { drewChart, selectedDate } = this.state;
    if (selectedDate && selectedDate !== prevState.selectedDate) {
      let { sym, cgcData } = this.props;
      let { cgcName, daily, bysym, accessors, width } = cgcData;
      this.setSelectedDate(selectedDate);
      return;
    }
    this.handleData(prevProps, prevState);
  }
  handleData(prevProps, prevState) {
    let { sym } = this.props;
    let { drewChart, selectedDate } = this.state;
    if (!drewChart) {
      this.makeSvg();
      this.setState({ drewChart: true });
      return;
    }
    if (sym !== prevProps.sym) {
      this.makeSvg();
      return;
    }
  }
  /*
  enterChart(evt) {
    this.setState({ hoverMsg: "in chart" });
  }
  */
  leaveChart(evt) {
    let { xScale } = this.state.cgCharts;
    let selectedDate = xScale.domain()[1];
    this.setSelectedDate(selectedDate);
  }
  hoverChart(evt) {
    let { xScale } = this.state.cgCharts;
    let selectedDate = xScale.invert(evt.clientX);
    this.setSelectedDate(selectedDate);
  }
  setSelectedDate(selectedDate) {
    let { sym, cgcData } = this.props;
    let { accessors } = cgcData;
    let data = sym.records;
    let selectedTrade = data.find(
      d =>
        accessors.date(d).toLocaleDateString() ===
        selectedDate.toLocaleDateString()
    );
    if (selectedTrade) {
      let { cgCharts } = this.state;
      let { xScale, cgHeight, cHeight, margin, height } = cgCharts;
      cgCharts.forEach(chart => {
        let { yScale, ckey } = chart;
        d3.select(`circle#trade-dot-${ckey}`)
          .attr("cx", xScale(selectedDate))
          // which accessor to use for y dimension???? depends on line...put something
          // in cgChart def, but not sure what....
          .attr("cy", yScale(accessors[chart.fixedProps.type](selectedTrade)));
      });
      this.setState({
        hoverMsg: `${dtfmt(accessors.date(selectedTrade))}
          P&L: $${Math.floor(
            accessors.curpl(selectedTrade)
          )} Gains: $${Math.floor(
          accessors.realpl(selectedTrade)
        )} Value: $${Math.floor(
          accessors.curval(selectedTrade)
        )} Cost: $${Math.floor(
          accessors.curcost(selectedTrade)
        )}  Close: $${Math.floor(accessors.close(selectedTrade))}`
      });
    }
  }
  makeCgCharts() {
    let { sym, cgcData } = this.props;
    let { cgcName, daily, accessors, width } = cgcData;
    let xScale = d3
      .scaleTime()
      .range([0, width])
      .domain(d3.extent(sym.records.map(accessors.x)));
    let cgCharts = [
      {
        Comp: Chart,
        fixedProps: {
          xScale,
          title: "Current value - current cost (unrealized P&L)",
          type: "curpl", // type should also be the name of the accessor?
          makeYScale: (height, data, accessors) =>
            d3
              .scaleLinear()
              .range([height, 0])
              .domain(d3.extent(data.map(accessors.curpl))),
          doToChart: (chart, data, xScale, yScale) => {
            var simpleLine = d3
              .line()
              .x(function(d) {
                //return xScale(accessors.x(d))
                return xScale(accessors.date(d));
              })
              .y(function(d) {
                //return yScale(accessors.y(d))
                return yScale(accessors.curpl(d));
              });
            chart
              .append("path")
              .data([data])
              .attr("class", "blue")
              .attr("d", simpleLine);
          }
          /*
          tradeDot: (chart, data, xScale, yScale) => {
            debugger
          }
          */
        }
      },
      {
        Comp: Chart,
        fixedProps: {
          xScale,
          title: "Realized P&L",
          type: "realpl",
          makeYScale: (height, data, accessors) =>
            d3
              .scaleLinear()
              .range([height, 0])
              .domain(d3.extent(data.map(accessors.realpl))),
          doToChart: (chart, data, xScale, yScale) => {
            var plLine = d3
              .line()
              .x(function(d) {
                return xScale(accessors.date(d));
              })
              .y(function(d) {
                return yScale(accessors.realpl(d));
              });
            chart
              .append("path")
              .data([data])
              .attr("stroke", "purple")
              .attr("stroke-width", 3)
              //.attr("class", "zero") // fix this to some appropriate color
              .attr("d", plLine);
          }
        }
      },
      {
        Comp: Chart,
        fixedProps: {
          xScale,
          title: "Current cost + Current value",
          type: "curval",
          description: `
            current value = current position * current price;
            current cost = cost of shares bought - cost of shares sold
          `,
          makeYScale: (height, data) =>
            d3
              .scaleLinear()
              .range([height, 0])
              .domain(
                d3.extent(data.map(accessors.y0).concat(data.map(accessors.y1)))
              ),
          doToChart: (chart, data, xScale, yScale) => {
            var area = d3
              .area()
              .x(function(d) {
                return xScale(accessors.date(d));
              })
              .y0(function(d) {
                return yScale(-accessors.curcost(d));
              })
              .y1(function(d) {
                return yScale(accessors.curval(d));
              });
            var blueLine = d3
              .line()
              .x(function(d) {
                return xScale(accessors.date(d));
              })
              .y(function(d) {
                return yScale(accessors.curval(d));
              });

            // define the blue line
            var redLine = d3
              .line()
              .x(function(d) {
                return xScale(accessors.date(d));
              })
              .y(function(d) {
                return yScale(-accessors.curcost(d));
              });
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
            let showArea = false;
            if (showArea) {
              var green = false;
              var red = false;
              var greenData = [];
              var redData = [];
              var allRed = [];
              var allGreen = [];
              data.forEach(function(d, idx, data) {
                // console.log("here", d, conf)

                if (accessors.curval(d) >= -accessors.curcost(d)) {
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
            }

            /*   for debugging some NaNs in line, fix it for now
               *   but leaving code in case it comes back
              .attr("d", d => {
                let l = redLine(d)
                if (l.match(/^M0,NaN/)) {
                  let x = d.map(p => xScale(accessors.date(p)))
                  let y = d.map(p => yScale(accessors.curcost(p)))
                  console.log({x,y,l})
                  debugger
                }
                return l
              })
              */
          }
          /*
          blueLine: d3
      .line()
      .x(d => xScale(accessors.x(d)))
      .y(d => yScale(accessors.y1(d)))
        */
        }
      },
      {
        Comp: Chart,
        fixedProps: {
          xScale,
          title: "daily closing price",
          type: "close",
          makeYScale: (height, data, accessors) =>
            d3
              .scaleLinear()
              .range([height, 0])
              .domain([0, d3.max(data.map(accessors.close))]),
          doToChart: (chart, data, xScale, yScale) => {
            var simpleLine = d3
              .line()
              .x(function(d) {
                return xScale(accessors.date(d));
              })
              .y(function(d) {
                return yScale(accessors.close(d));
              });
            chart
              .append("path")
              .data([data])
              .attr("class", "blue")
              .attr("d", simpleLine);
          }
        }
      }
    ];
    cgCharts.xScale = xScale;
    return cgCharts;
  }
  tradeLines({ cgCharts }) {
    let { cgHeight, yScale, xScale } = cgCharts;
    let { sym, cgcData } = this.props;
    let { cgcName, daily, accessors } = cgcData;
    let data = sym.records;
    let trades = data.filter(d => d.Action !== "NA");
    return (
      <g>
        {trades.map((d, idx) => (
          <g key={idx} transform={`translate(${xScale(d.date)}, 0)`}>
            <line
              x1={0}
              x2={0}
              y1={0}
              y2={cgHeight}
              className={`trade-line ${d.Action}`}
            />
          </g>
        ))}
      </g>
    );
  }
  makeSvg() {
    // per symbol processing
    let { sym, cgcData } = this.props;
    if (!sym) {
      return;
    }
    let data = sym.records;
    let { cgcName, daily, accessors, width } = cgcData;

    let cgCharts = this.makeCgCharts();
    let xScale = cgCharts.xScale;

    let selectedDate = xScale.domain()[1];
    let cgHeight = chartGroupConf().height; // height of chart group
    let cHeight = cgHeight / cgCharts.length; // height of each chart in it
    let key = `${cgcName}-${sym}`;
    //console.log("making svg", key);
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    let height = cHeight - margin.top - margin.bottom;
    width = width - margin.left - margin.right;
    // need a way to hold on to height!!!
    // ok, pretty kludgy, but here it is:
    Object.assign(cgCharts, { cgHeight, cHeight, key, margin, height, width });

    let charts = cgCharts.map((chart, idx) => {
      let ckey = `${key}-${chart.fixedProps.type}`;
      let yScale = chart.fixedProps.makeYScale(height, data, accessors);
      chart.ckey = ckey;
      chart.yScale = yScale;
      return (
        <g
          key={ckey}
          className="chart"
          transform={`translate(0, ${cHeight * idx})`}
        >
          <chart.Comp
            {...chart.fixedProps}
            sym={sym + ""}
            data={data}
            width={width}
            height={height}
            yScale={yScale}
          />
          <line
            x1={0}
            x2={width + margin.left + margin.right}
            y1={yScale(0)}
            y2={yScale(0)}
            className="zero"
          />
          <circle
            id={`trade-dot-${ckey}`}
            cx={-100}
            cy={-100}
            stroke="green"
            strokeWidth="3px"
            fillOpacity={0.5}
            fill="white"
            r={8}
          />
          {/*this.blueLine({xScale, yScale, data, height, width, accessors})*/}
        </g>
      );
    });
    let svg = (
      <svg
        key={key}
        width={width + margin.left + margin.right}
        height={cgHeight}
        //onMouseEnter={this.enterChart}
        onMouseLeave={this.leaveChart}
        onMouseMove={this.hoverChart}
      >
        {this.tradeLines({ cgCharts })}
        {charts}
      </svg>
    );
    this.setState({ svg, selectedDate, cgCharts });
  }
  render() {
    let { cgcData } = this.props;
    let { daily, accessors, width, height } = cgcData;
    let { svg = null, hoverMsg, selectedDate } = this.state;
    return (
      <div className="chart-group">
        <div className="info-box">{hoverMsg}</div>
        {svg}
      </div>
    );
  }
}

const Legend = props => {};
