'use strict';

// ---------------------------------------------------------------------------

const qryptos = require ('./qryptos.js');
const { ExchangeError } = require ('./base/errors');

// ---------------------------------------------------------------------------

module.exports = class quoinex extends qryptos {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'quoinex',
            'name': 'QUOINEX',
            'countries': ['JP', 'SG', 'VN'],
            'version': '2',
            'rateLimit': 1000,
            'has': {
                'CORS': false,
                'fetchTickers': true,
                'fetchMyTrades': true,
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/35047114-0e24ad4a-fbaa-11e7-96a9-69c1a756083b.jpg',
                'api': 'https://api.quoine.com',
                'www': 'https://quoinex.com/',
                'doc': [
                    'https://developers.quoine.com',
                    'https://developers.quoine.com/v2',
                ],
                'fees': 'https://news.quoinex.com/fees/',
            },
        });
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (symbol)
            throw new ExchangeError (this.id + 'fetchMyTrades not supported for any symbol');
        await this.loadMarkets ();
        // let market = this.market (symbol);
        let market = undefined;
        let request = {
            // 'product_id': market['id'],
            'status': 'closed', // open
        };
        if (typeof limit !== 'undefined')
            request['limit'] = limit;
        const response = await this.privateGetTrades (this.extend (request, params));
        return this.parseTrades (response['models'], market, since, limit);
    }

};
