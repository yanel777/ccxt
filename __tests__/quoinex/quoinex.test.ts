import 'isomorphic-fetch';
import {developExchangeKeys} from '../../../kript-rn/src/_.local/DevelopExchangeKeys';
import {Exchange} from "ccxt";
import * as ccxt from "ccxt";


const exchangeId = 'quoinex';
const timeout = 60000 * 5;
jest.setTimeout(timeout);


describe(exchangeId, () => {
    let keys;
    let exchange: Exchange;
    let since;

    beforeAll(() => {
        keys = developExchangeKeys[exchangeId];
        const options = {
            apiKey: keys ? keys.apiKey : null,
            secret: keys ? keys.secret : null,
            timeout,
            verbose: true
        };
        exchange = new ccxt[exchangeId](options);
    });

    it('Ключи', () => {
        expect(keys).toBeTruthy();
    });

    it('Объект биржи', () => {
        expect(exchange).toBeTruthy();
    });

    xdescribe('fetchOpenOrders без указания символа', () => {

        it('fetchOpenOrders', async () => {
            const result = await exchange.fetchOpenOrders();
            console.log('fetchOpenOrders result', result);

            expect(result).toBeTruthy();
        });

    });

    describe('fetchMyTrades без указания символа', () => {

        it('fetchMyTrades', async () => {
            const result = await exchange.fetchMyTrades();
            // const result = await exchange.fetchTrades('abt/btc');
            console.log('fetchMyTrades result', result);

            expect(result).toBeTruthy();
        });

    });

});
