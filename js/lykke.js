'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');

//  ---------------------------------------------------------------------------

module.exports = class lykke extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'lykke',
            'name': 'Lykke',
            'countries': 'CH',
            'version': 'v1',
            'rateLimit': 200,
            'has': {
                'CORS': false,
                'fetchOHLCV': false,
                'fetchTrades': false,
                'fetchOpenOrders': true,
                'fetchClosedOrders': true,
                'fetchOrder': true,
                'fetchOrders': true,
                'fetchMyTrades': true,
            },
            'requiredCredentials': {
                'apiKey': true,
                'secret': false,
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/34487620-3139a7b0-efe6-11e7-90f5-e520cef74451.jpg',
                'api': {
                    'mobile': 'https://api.lykkex.com/api',
                    'public': 'https://hft-api.lykke.com/api',
                    'private': 'https://hft-api.lykke.com/api',
                    'test': {
                        'mobile': 'https://api.lykkex.com/api',
                        'public': 'https://hft-service-dev.lykkex.net/api',
                        'private': 'https://hft-service-dev.lykkex.net/api',
                    },
                },
                'www': 'https://www.lykke.com',
                'doc': [
                    'https://hft-api.lykke.com/swagger/ui/',
                    'https://www.lykke.com/lykke_api',
                ],
                'fees': 'https://www.lykke.com/trading-conditions',
            },
            'api': {
                'mobile': {
                    'get': [
                        'AllAssetPairRates/{market}',
                    ],
                },
                'public': {
                    'get': [
                        'AssetPairs',
                        'AssetPairs/{id}',
                        'IsAlive',
                        'OrderBooks',
                        'OrderBooks/{AssetPairId}',
                    ],
                },
                'private': {
                    'get': [
                        'Orders',
                        'Orders/{id}',
                        'Wallets',
                        'History/trades',
                    ],
                    'post': [
                        'Orders/limit',
                        'Orders/market',
                        'Orders/{id}/Cancel',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'maker': 0.0, // as of 7 Feb 2018, see https://github.com/ccxt/ccxt/issues/1863
                    'taker': 0.0, // https://www.lykke.com/cp/wallet-fees-and-limits
                },
                'funding': {
                    'tierBased': false,
                    'percentage': false,
                    'withdraw': {
                        'BTC': 0.001,
                    },
                    'deposit': {
                        'BTC': 0,
                    },
                },
            },
        });
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        let balances = await this.privateGetWallets ();
        let result = { 'info': balances };
        for (let i = 0; i < balances.length; i++) {
            let balance = balances[i];
            let currency = balance['AssetId'];
            let total = balance['Balance'];
            let used = balance['Reserved'];
            let free = total - used;
            result[currency] = {
                'free': free,
                'used': used,
                'total': total,
            };
        }
        return this.parseBalance (result);
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        return await this.privatePostOrdersIdCancel ({ 'id': id });
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let query = {
            'AssetPairId': market['id'],
            'OrderAction': this.capitalize (side),
            'Volume': amount,
        };
        if (type === 'market') {
            query['Asset'] = (side === 'buy') ? market['base'] : market['quote'];
        } else if (type === 'limit') {
            query['Price'] = price;
        }
        let method = 'privatePostOrders' + this.capitalize (type);
        let result = await this[method] (this.extend (query, params));
        return {
            'id': undefined,
            'info': result,
        };
    }

    async fetchMarkets () {
        let markets = await this.publicGetAssetPairs ();
        let result = [];
        for (let i = 0; i < markets.length; i++) {
            let market = markets[i];
            let id = market['Id'];
            let base = market['BaseAssetId'];
            let quote = market['QuotingAssetId'];
            base = this.commonCurrencyCode (base);
            quote = this.commonCurrencyCode (quote);
            let symbol = market['Name'];
            let precision = {
                'amount': market['Accuracy'],
                'price': market['InvertedAccuracy'],
            };
            result.push ({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'active': true,
                'info': market,
                'lot': Math.pow (10, -precision['amount']),
                'precision': precision,
                'limits': {
                    'amount': {
                        'min': Math.pow (10, -precision['amount']),
                        'max': Math.pow (10, precision['amount']),
                    },
                    'price': {
                        'min': Math.pow (10, -precision['price']),
                        'max': Math.pow (10, precision['price']),
                    },
                },
            });
        }
        return result;
    }

    parseTicker (ticker, market = undefined) {
        let timestamp = this.milliseconds ();
        let symbol = undefined;
        if (market) {
            symbol = market['symbol'];
        }
        ticker = ticker['Result'];
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': undefined,
            'low': undefined,
            'bid': parseFloat (ticker['Rate']['Bid']),
            'bidVolume': undefined,
            'ask': parseFloat (ticker['Rate']['Ask']),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': undefined,
            'last': undefined,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': undefined,
            'quoteVolume': undefined,
            'info': ticker,
        };
    }

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let ticker = await this.mobileGetAllAssetPairRatesMarket (this.extend ({
            'market': market['id'],
        }, params));
        return this.parseTicker (ticker, market);
    }

    parseOrderStatus (status) {
        if (status === 'Pending') {
            return 'open';
        } else if (status === 'InOrderBook') {
            return 'open';
        } else if (status === 'Processing') {
            return 'open';
        } else if (status === 'Matched') {
            return 'closed';
        } else if (status === 'Cancelled') {
            return 'canceled';
        } else if (status === 'NotEnoughFunds') {
            return 'NotEnoughFunds';
        } else if (status === 'NoLiquidity') {
            return 'NoLiquidity';
        } else if (status === 'UnknownAsset') {
            return 'UnknownAsset';
        } else if (status === 'LeadToNegativeSpread') {
            return 'LeadToNegativeSpread';
        }
        return status;
    }

    parseOrder (order, market = undefined) {
        let status = this.parseOrderStatus (order['Status']);
        let symbol = undefined;
        if (!market) {
            if ('AssetPairId' in order) {
                if (order['AssetPairId'] in this.markets_by_id) {
                    market = this.markets_by_id[order['AssetPairId']];
                }
            }
        }
        if (market) {
            symbol = market['symbol'];
        }
        let timestamp = undefined;
        if (('LastMatchTime' in order) && (order['LastMatchTime'])) {
            timestamp = this.parse8601 (order['LastMatchTime']);
        } else if (('Registered' in order) && (order['Registered'])) {
            timestamp = this.parse8601 (order['Registered']);
        } else if (('CreatedAt' in order) && (order['CreatedAt'])) {
            timestamp = this.parse8601 (order['CreatedAt']);
        }
        let price = this.safeFloat (order, 'Price');
        let amount = this.safeFloat (order, 'Volume');
        let remaining = this.safeFloat (order, 'RemainingVolume');
        let filled = amount - remaining;
        let cost = filled * price;
        let result = {
            'info': order,
            'id': order['Id'],
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': undefined,
            'symbol': symbol,
            'type': undefined,
            'side': undefined,
            'price': price,
            'cost': cost,
            'average': undefined,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'status': status,
            'fee': undefined,
        };
        return result;
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        let response = await this.privateGetOrdersId (this.extend ({
            'id': id,
        }, params));
        return this.parseOrder (response);
    }

    async fetchOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let response = await this.privateGetOrders ();
        return this.parseOrders (response, undefined, since, limit);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let response = await this.privateGetOrders (this.extend ({
            'status': 'InOrderBook',
        }, params));
        return this.parseOrders (response, undefined, since, limit);
    }

    async fetchClosedOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let response = await this.privateGetOrders (this.extend ({
            'status': 'Matched',
        }, params));
        return this.parseOrders (response, undefined, since, limit);
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let response = await this.publicGetOrderBooksAssetPairId (this.extend ({
            'AssetPairId': this.marketId (symbol),
        }, params));
        let orderbook = {
            'timestamp': undefined,
            'bids': [],
            'asks': [],
        };
        let timestamp = undefined;
        for (let i = 0; i < response.length; i++) {
            let side = response[i];
            if (side['IsBuy']) {
                orderbook['bids'] = this.arrayConcat (orderbook['bids'], side['Prices']);
            } else {
                orderbook['asks'] = this.arrayConcat (orderbook['asks'], side['Prices']);
            }
            let sideTimestamp = this.parse8601 (side['Timestamp']);
            timestamp = (typeof timestamp === 'undefined') ? sideTimestamp : Math.max (timestamp, sideTimestamp);
        }
        if (!timestamp) {
            timestamp = this.milliseconds ();
        }
        return this.parseOrderBook (orderbook, orderbook['timestamp'], 'bids', 'asks', 'Price', 'Volume');
    }

    parseBidAsk (bidask, priceKey = 0, amountKey = 1) {
        let price = parseFloat (bidask[priceKey]);
        let amount = parseFloat (bidask[amountKey]);
        if (amount < 0) {
            amount = -amount;
        }
        return [price, amount];
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + '/' + this.implodeParams (path, params);
        let query = this.omit (params, this.extractParams (path));
        if (api === 'public') {
            if (Object.keys (query).length) {
                url += '?' + this.urlencode (query);
            }
        } else if (api === 'private') {
            if (method === 'GET') {
                if (Object.keys (query).length) {
                    url += '?' + this.urlencode (query);
                }
            }
            this.checkRequiredCredentials ();
            headers = {
                'api-key': this.apiKey,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            };
            if (method === 'POST') {
                if (Object.keys (params).length) {
                    body = this.json (params);
                }
            }
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let request = {
            // 'type': 'all', // any position, closed position, closing position, no position
            // 'trades': false, // whether or not to include trades related to position in output
            // 'start': 1234567890, // starting unix timestamp or trade tx id of results (exclusive)
            // 'end': 1234567890, // ending unix timestamp or trade tx id of results (inclusive)
            // 'ofs' = result offset
        };
        if (typeof since !== 'undefined') {
            request['start'] = parseInt (since / 1000);
        }
        let response = await this.privateGetHistoryTrades (this.extend (request, params));
        console.log ('[privateGetHistorTtrades] response', response);

        /*
            let trades = response['result']['trades'];
            let ids = Object.keys (trades);
            for (let i = 0; i < ids.length; i++) {
              trades[ids[i]]['id'] = ids[i];
            }
            return this.parseTrades (trades, undefined, since, limit);
        */

        return this.parseTrades (response, undefined, since, limit);
    }

    parseTrade (trade, market = undefined) {
        /*
            {
              "Id": "string",
              "DateTime": "2018-03-21T16:10:43.056Z",
              "State": "InProgress",
              "Amount": 0,
              "Asset": "string",
              "AssetPair": "string",
              "Price": 0
            }
        */
        let timestamp = this.parse8601 (trade['DateTime']);
        let side = undefined;
        let type = undefined;
        let price = parseFloat (trade['Price']);
        let amount = parseFloat (trade['Amount']);
        let id = trade['Id'];
        let order = undefined;
        let fee = undefined;

        let symbol = (market) ? market['symbol'] : undefined;

        return {
            'id': id,
            'order': order,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'type': type,
            'side': side,
            'price': price,
            'amount': amount,
            'fee': fee,
        };

    }

    parseTrade_bitfinex (trade, market) {
        let timestamp = parseInt (parseFloat (trade['timestamp'])) * 1000;
        let side = trade['type'].toLowerCase ();
        let orderId = this.safeString (trade, 'order_id');
        let price = parseFloat (trade['price']);
        let amount = parseFloat (trade['amount']);
        let cost = price * amount;
        let fee = undefined;
        if ('fee_amount' in trade) {
            let feeCost = this.safeFloat (trade, 'fee_amount');
            let feeCurrency = this.safeString (trade, 'fee_currency');
            if (feeCurrency in this.currencies_by_id)
                feeCurrency = this.currencies_by_id[feeCurrency]['code'];
            fee = {
                'cost': feeCost,
                'currency': feeCurrency,
            };
        }
        return {
            'id': trade['tid'].toString (),
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': market['symbol'],
            'type': undefined,
            'order': orderId,
            'side': side,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
        };
    }


    parseTrade_kraken (trade, market = undefined) {
        let timestamp = undefined;
        let side = undefined;
        let type = undefined;
        let price = undefined;
        let amount = undefined;
        let id = undefined;
        let order = undefined;
        let fee = undefined;
        if (!market) {
            market = this.findMarketByAltnameOrId (trade['pair']);
        }
        if ('ordertxid' in trade) {
            order = trade['ordertxid'];
            id = trade['id'];
            timestamp = parseInt (trade['time'] * 1000);
            side = trade['type'];
            type = trade['ordertype'];
            price = parseFloat (trade['price']);
            amount = parseFloat (trade['vol']);
            if ('fee' in trade) {
                let currency = undefined;
                if (market) {
                    currency = market['quote'];
                }
                fee = {
                    'cost': parseFloat (trade['fee']),
                    'currency': currency,
                };
            }
        } else {
            timestamp = parseInt (trade[2] * 1000);
            side = (trade[3] === 's') ? 'sell' : 'buy';
            type = (trade[4] === 'l') ? 'limit' : 'market';
            price = parseFloat (trade[0]);
            amount = parseFloat (trade[1]);
            let tradeLength = trade.length;
            if (tradeLength > 6) {
                id = trade[6];
            } // artificially added as per #1794
        }
        let symbol = (market) ? market['symbol'] : undefined;
        return {
            'id': id,
            'order': order,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'type': type,
            'side': side,
            'price': price,
            'amount': amount,
            'fee': fee,
        };
    }

}
