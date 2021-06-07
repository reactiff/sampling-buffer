
import { value, when } from '.';
import { SampleFields } from './types';

const { min, max, abs } = Math;

const time = {
    dataFields: [ 'time' ],
    fields: {
        time:           (d, curr) => value(curr, d.time), 
    } as SampleFields,
};

const ohlc = {
    dataFields: [ 'price'],
    fields: {
        open:           { fn: (d, curr) => value(curr, d.price), fill: p => p.close }, 
        high:           { fn: (d, curr) => max(d.price, value(curr, d.price)), fill: p => p.close }, 
        low:            { fn: (d, curr) => min(d.price, value(curr, d.price)), fill: p => p.close },
        close:          { fn: (d) => d.price, fill: p => p.close },
    } as SampleFields,
};

const side = {
    dataFields: [ 'buy', 'sell' ],
    fields: {
        // Underscore fields are special:
        // - they are run first
        // - they do not get added to sample (hidden)
        // - they perform some operation 
        //   e.g. here they set a value on the data object itself
        _buy:           (d) => when(d.qty > 0, () => d.buy  = 1),
        _sell:          (d) => when(d.qty < 0, () => d.sell = 1),
    } as SampleFields,
};


const volume = {
    dataFields: [ 'qty' ],
    fields: {
        // volume
        buyVol:         { fn: (d, curr) => when(d.buy, value(curr, 0) + d.qty), fill: () => 0 },
        sellVol:        { fn: (d, curr) => when(d.sell, value(curr, 0) + d.qty), fill: () => 0 },
        ttlVol:         { fn: (d, curr) => value(curr, 0) + abs(d.qty), fill: () => 0 },
        netVol:         { fn: (d, curr) => value(curr, 0) + d.qty, fill: () => 0 },
        cumNetVol:      { 
                            fn: (d, curr) => value(curr, 0) + d.qty, 
                            cumulative: true 
                        },
    } as SampleFields,
};


const mv = {
    dataFields: [ 'buy', 'sell', 'price', 'qty', 'ttlMv', 'ttlVol' ],
    fields: {
        // mv
        buyMv:          { fn: (d, curr) => when(d.buy, value(curr, 0) + d.price * d.qty), fill: () => 0 },
        sellMv:         { fn: (d, curr) => when(d.sell, value(curr, 0) + d.price * d.qty), fill: () => 0 },
        ttlMv:          { fn: (d, curr) => value(curr, 0) + d.price * abs(d.qty), fill: () => 0 },
        netMv:          { fn: (d, curr) => value(curr, 0) + d.price * d.qty, fill: () => 0 },

        // volume weighted
        volWtdPrice:    { fn: (d, curr, acc) => acc.ttlMv / acc.ttlVol, fill: () => 0 },
    } as SampleFields,
};

const stats = {
    dataFields: [ 'buy', 'sell' ],
    fields: {
        // counts
        ttlTradeCount:  { fn: (d, curr) => value(curr, 0) + 1, fill: () => 0 },
        buyTradeCount:  { fn: (d, curr) => when(d.buy, value(curr, 0) + 1), fill: () => 0 },
        sellTradeCount: { fn: (d, curr) => when(d.sell, value(curr, 0) + 1), fill: () => 0 },
    } as SampleFields,
};


export default {
    cryptoTrade: {
        time,
        ohlc,    
        side,
        volume,
        mv,
        stats,
    },
};

    
