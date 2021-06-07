[![NPM](https://img.shields.io/npm/v/@reactiff/sampling-buffer.svg)](https://www.npmjs.com/package/@reactiff/sampling-buffer) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
# @reactiff/sampling-buffer

An awesome Real-Time data capture lib with Closed-circuit buffers, providing infinite, seamless recording and processing.
  
## Why

You are building a real-time high frequency data processing app that does something along the lines of:
- IOT data collection / Sensor monitoring / Real-time analytics
- Algorithmic Trading / Real-time Risk analysis / Data Aggregation
- Audio / Video / Real-time Digital Signal Processing
- AI / ML Prediction / Classification / Regression
- Real-time Data Science
  

## What

This library will easily do the following for you:
- Capture and allocate real-time sporadic data into periodic, interval based samples
- Map data to custom fields (Series) 
- Perform spot, rolling and cumulative calculations e.g. min, max, mean, sum, stdev, etc.
- Interpolate and impute values across any number of axes
- Bifurcate/segregate data into tracks based on attributes
- Capture and synchronize data from multiple sources
  

## Flyweight Pattern

The lib offers several important advantages in Performance and Memory utilization, as it records data into Closed-circuit buffers caleld Tracks, similar to the way CCTV works.  
You may also know this Design Pattern as [Flyweight](https://en.wikipedia.org/wiki/Flyweight_pattern).  Each track is essentially an array of fixed length, 
containing empty placeholders in the shape of your data.   


## How
All you need to do is:
1. Set the sampling rate - the time interval in milliseconds between each sample.
2. Add fields with formulas

<br>

--- 

## Install 

```bash
yarn add @reactiff/sampling-buffer
```

<br>

## Basic usage

```ts
const sampler = new SamplingBuffer({ 
    interval:       1000, // 1000 ms == 1 second
    bufferLength:   3600,         
    fields:         [ 'time', 'price', 'qty' ],     
});

sampler.onTrackStart = (track) => {
    track.onUpdate = () => {
        const samples = [];
        track.fifo((pos, track) => {
            items[pos.ordinal] = track[pos.index];
        });
        // analyze samples...
    }
};

sampler.startSampling();
```

<details>
<summary>Click to expand the Full Example 1 - Readout</summary>

```tsx
// EXAMPLE 1 - SIMPLE READOUT

import { SamplingBuffer } from '@reactiff/sampling-buffer';

const INTERVAL = 1000;  // ms
const LENGTH   = 3600;  // this means one hour

const sampler  = new SamplingBuffer({
    interval:     INTERVAL,   
    bufferLength: LENGTH,             
    fields:       [ 'time', 'price', 'qty' ],
});

// declare once and read values in each time
const items    = new Array(LENGTH);

// THE READOUT FUNCTION
function readOut(track) {
    track.fifo((pos, track) => {
        items[pos.ordinal] = track[pos.index];
    });
};

sampler.onTrackStart = (t) => t.onUpdate = () => readOut(t);
sampler.startSampling();

// --------------------------------------------------------
// EMULATE INCOMING DATA

const date = new Date();    // for gettine time
const data = {              // reusable data placeholder
    time:  0,
    price: 100,
    qty:   0,
};

const emulateDataEvent = () => {
    data.price = data.price + (Math.random() - 0.5);
    data.qty   = Math.round(Math.random() * 100 - 50);
    data.time  = date.getTime();

    // PASS IT TO SAMPLER
    sampler.capture(data);

    // repeat
    setTimeout(emulateDataEvent, 0);
};

emulateDataEvent();
```
</details>

<br>

---

## fifo() / lifo()

These methods facilitate reading data from the Closed-circuit buffer, 
taking care of complicated cursor and offset positions.  

They both accept a callback of form:

```ts
(pos, track) => void
```

| Param | Description |
| ----- | ----------- |
| track | internal array of samples |
| pos   | indexer: { index, ordinal, relative } |

<br>

**pos props**

| Prop | Purpose |
| ---- | ------- |
| pos.index | <sup>1</sup> Sample index in the Track |
| pos.ordinal | **True** iteration number (always zero based) |
| pos.relative | Relative offset from cursor |

<br>

> <sup>1</sup>  Sample index should only be used for accessing the Sample in the Track.
> It doesn't always start with zero, rather it starts with internal cursor position 
> within the Closed-circuit loop.

<br>

---

## Custom fields and spot calculations

In previous example we used an array of field names corresponding to data fields.
You can define your own fields and how they should be calculated.

```ts
const sampleFields = {            
    time:       (d, curr) => value(curr, d.time), 

    _buy:       (d) => when(d.qty > 0, () => d.buy  = 1),  // [^4]
    _sell:      (d) => when(d.qty < 0, () => d.sell = 1),

                    // From a single price field we can create
                    // Open High Low and Close (candlestick)
    open:       {   fn: (d, curr) => value(curr, d.price), 
                    fill: p => p.close },                  // [^5]

    high:       {   fn: (d, curr) => Math.max(d.price, value(curr, d.price)), 
                    fill: p => p.close }, 

    low:        {   fn: (d, curr) => Math.min(d.price, value(curr, d.price)), 
                    fill: p => p.close },

    close:      {   fn: (d) => d.price, 
                    fill: p => p.close },
    
    buyVol:     {   fn: (d, curr) => when(d.buy, value(curr, 0) + d.qty), 
                    fill: () => 0 },

    sellVol:    {   fn: (d, curr) => when(d.sell, value(curr, 0) + d.qty), 
                    fill: () => 0 },
    
    cumNetVol:  { fn: (d, curr) => value(curr, 0) + d.qty, 
                    cumulative: true  // [^6]
                },
};
```

[^4] - Underscore fields are special
        - they are run first
        - they do not get added to sample (hidden)
        - they perform some operation e.g. here they set a value on the data object itself
        <br>

[^5] - The fill() callback defines how the field's value should be calculated for empty Samples

[^6] - Cumulative fields do not get reset with each new sample, rather their values are rolled forward

<br>

---


## Expressions and Rolling Calculations

```ts
// Simple Moving Average over 10:
buffer.addExpression('sma10', (series) => {
    // get closing price Serie
    return series.close.mean(10);
})
```

Once an expression is added, it can be accessed as a Serie in other calculations.  Here is such an example.  EMA uses SMA in its first observation:
```ts
// Exponential Moving Average of 10
buffer.addExpression('ema10', (series) => {

    const sma10 = series.sma10; 
    const ema10 = series.ema10; // reference this serie  
  
    if (ema10.availableLength < 11) {
        return undefined;
    }

    // get previous value
    let prev = ema10.value(-1);
    if (!prev) {
        prev = sma10.value(-1);
        // or calculate on the fly:
        prev = series.price.mean(n, -1);
    }

    const k = 2 / (n + 1);
    const ema = series.price.value() * k + prev * (1 - k);

    return ema;
})
```   


## License

MIT © [Rick Ellis](https://github.com/reactiff)
