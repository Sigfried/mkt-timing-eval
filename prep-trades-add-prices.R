library(tidyverse)
#library(rstack)
#library(ggplot2)
library(quantmod)

remove(daily)
remove(dailyplus)
remove(trades)
remove(prices)
remove(everything)
remove(first_price)

qm <- new.env()
# http://statmath.wu.ac.at/~hornik/QFS1/quantmod-vignette.pdf
# The package quantmod works with a variety of sources. Current src methods available are: yahoo,
# google, MySQL, FRED, csv, RData, and oanda. For example, FRED (Federal Reserve Economic Data),
# is a database of 20,070 U.S. economic time series (see http://research.stlouisfed.org/fred2/).

demo.symbols <- c('AMZN','BTSC','CNCR','DATA','UBIA')

trades <- read_csv('./trades.csv')  %>%
  filter(Symbol %in% demo.symbols) %>%
  select(date=`Run Date`, Action, symbol = Symbol,
         Quantity, Price, Commission, Fees, Amount) %>%
  mutate(date = as.Date(date, "%m/%d/%Y"),
         Action = Action %>% str_replace("YOU SOLD","sell") %>% str_replace("YOU BOUGHT", "buy")) %>%
  filter(!is.na(symbol)) %>% # not sure why these are in there
  replace_na(list(Quantity=0, Price=0, Commission=0, Fees=0, Amount = 0)) %>%
  group_by(symbol) %>%
  arrange(symbol, date) %>%
  mutate(pos = cumsum(Quantity), curcost = cumsum(Amount), trdnum = 1:n()) %>%
  ungroup()

bysym <- trades %>% 
  group_by(symbol) %>% 
  summarise(first_trade=min(date),
            last_trade=max(date),
            maxpos=max(pos), 
            mincurcost=min(curcost)) %>%
  inner_join(
    trades %>% 
      group_by(symbol, Action) %>% 
      summarise(qty=sum(Quantity)) %>% 
      spread(Action, qty) %>%
      select(symbol, buy.qty=buy, sell.qty = sell)
  ) %>%
  inner_join(
    trades %>% 
      group_by(symbol, Action) %>% 
      summarise(amt=sum(Amount)) %>% 
      spread(Action, amt) %>%
      select(symbol, buy.amt=buy, sell.amt = sell)
  )

getQmPrices <- function(symbol, from, to, e) {
  a <- paste0(symbol, '.a')
  ua <- paste0(symbol, '.ua')
  
  getSymbols(symbol, from=from, to=to, src="yahoo", env=e)
  e[[a]] <- adjustOHLC(e[[symbol]], symbol.name=symbol)
  e[[ua]] <- adjustOHLC(e[[symbol]], use.Adjusted=TRUE, symbol.name=symbol)
}

bysym %>%
  filter(!symbol %in% names(qm)) %>% # don't fetch symbols already fetched because it's slow
  select('symbol','first_trade') %>% 
  pmap(function(symbol, first_trade) {
    prices <- getQmPrices(symbol, first_trade, '2019-05-14', qm)
  })

price.stuff <- function(symbol, e) {
  x <- e[[symbol]]
  prices <- x %>% .[,c(4,5,6)] %>% as.tibble()
  names(prices) <- c('close', 'vol', 'adj')
  prices$date <- index(x)
  prices <- prices %>% transmute(symbol=symbol, date, close, adj, vol)
  return(prices)
}
prices <- bysym %>%
  # head(5) %>%
  select('symbol','first_trade') %>% 
  pmap(function(symbol, first_trade) {
    prices <- price.stuff(symbol, qm)
    return(prices)
  }) %>%
  bind_rows()

bysym <- bysym  %>% 
  inner_join(
    prices %>% 
      filter(weekdays(date) == "Wednesday") %>%
      group_by(symbol) %>% 
      summarise(tradingweeks = n())
  )

join.trades.to.prices <- function(trades, prices, csvname=NULL) {
  daily <- trades %>% right_join(prices) %>%
    replace_na(list(Quantity=0, Price=0, Commission=0, Fees=0, Amount = 0)) %>%
    group_by(symbol) %>%
    arrange(symbol, date) %>%
    mutate(pos = cumsum(Quantity), curcost = cumsum(Amount)) %>%
    ungroup() %>%
    arrange(symbol, date) %>%
    mutate(curval = pos * close) %>%
    mutate(curpl = curcost + curval) %>%
    select(date, Action, symbol, Quantity, Price, close, adj, vol, pos, curval, curcost, curpl, trdnum)
  if(!is.null(csvname)) {
    write_csv(daily, paste0('./d3_code/src/data/', csvname))
  }
  return(daily)
}

dailyplus <- join.trades.to.prices(trades, prices, 'daily.csv')

dca <- prices %>% filter(weekdays(date) == "Wednesday") %>% 
  inner_join(bysym) %>%
  transmute(date, Action="buy", symbol, 
            Quantity=-mincurcost/tradingweeks/adj, Price=adj, Commission=0, 
            Amount=mincurcost/tradingweeks) %>%
  group_by(symbol) %>%
  arrange(symbol, date) %>%
  mutate(trdnum=1:n())

dcadailyplus <- join.trades.to.prices(dca, prices, 'dcadaily.csv')


