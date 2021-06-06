# @reactiff/sampling-buffer

Real-Time and Streaming data loop-recording, resampling, calculation, transformation.

<br>

[![NPM](https://img.shields.io/npm/v/@reactiff/sampling-buffer.svg)](https://www.npmjs.com/package/@reactiff/sampling-buffer) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

<br>

- Efficiently record and consume real-time data with loop recording
- Define custom fields (Series) and calculations
- Define rolling-window calculations e.g. moving averages, cumsum, etc.
- Bifurcate/segregate data into separate parallel tracks
- Automatically aggregate data into periodic samples

<br>


## Install

```bash
yarn add @reactiff/sampling-buffer
```

---

## Usage

Here is an example of usage inside React function component:

```ts
import React, { useState, useEffect } from 'react';
import { SamplingBuffer, ClosedCircuitBuffer } from '@reactiff/sampling-buffer';

const buffer = new SamplingBuffer({
    interval:       1000,             // [^1] milliseconds
    bufferLength:   3600,             // [^2] total samples per track
    trackKeys:      ['exch'],         // [^3] unique track key 
    fields:         sampleFields,
});

/**
[^1] - Time interval between each sample<br>
[^2] - Total samples in the loop (Closed Circuit Buffer)<br>
[^3] - Combination of fields that makes up unique track key<br>
*/

export default const DataComponent = (props: any) => {

    const [tracks, setTracks] = useState([]);
    const [data, setData]     = useState();
    
    
    const readData = (track) => {
        const data = {
            cols  = Object.keys(track.series),
            items = new Array(track.length),
        };
        // read items in FIFO or LIFO order
        track.fifo((pos, buffer) => {
            data.items[pos.ordinal] = buffer[pos.index];
        });
        setData(data);
    };


    useEffect(() => {
        
        // handle each track's updates
        buffer.onTrackStart = (track) => {
            track.onUpdate = () => readData(track);
            setTracks(tt => tt.concat(track));
        };
        
        // handle synchronized interval ticks
        buffer.onInterval = () => {
            const track = Object.values(buffer.tracks)[0];
            readTrackData(track);
        }

        // start sampling
        buffer.startSampling();


        let lastPrice = 100;
        const simulateDataEvent = () => {
            
            // generate new random price
            lastPrice = lastPrice + (Math.random() - 0.5);
            
            buffer.capture({
                time:   new Date().getTime(),
                exch:   'KRAKEN',
                price:  lastPrice,
                qty:    Math.round(Math.random() * 100 - 50),
            });

            // repeat
            setTimeout(simulateDataEvent, 0);
        };

        simulateDataEvent();

        /** NOTE:
        *   Once the buffer starts sampling, it will produce interval samples
        *   even if no data is coming in.
        */
    }, [tracks, readData]);


  // simulate trade events
  useEffect(() => {
    const delayCapture = () => {
      simulateTradeEvent(new Date().getTime());
      if (!m.stopped) {
        setTimeout(delayCapture, 0);
      }
    };
    delayCapture();
  }, [m.stopped]);
}

```


<br>

## Field definitions
Defining the fields for each sample in circular track.

```ts
import { value, when } from '@reactiff/sampling-buffer'

const sampleFields = {            
    time:           (d, curr) => value(curr, d.time), 

                    [^4]
    _buy:           (d) => when(d.qty > 0, () => d.buy  = 1),
    _sell:          (d) => when(d.qty < 0, () => d.sell = 1),

                    // From a single price field we can create
                    // Open High Low and Close (candlestick)
    open:           {   fn: (d, curr) => value(curr, d.price), 
                        fill: p => p.close }, 

    high:           {   fn: (d, curr) => Math.max(d.price, value(curr, d.price)), 
                        fill: p => p.close }, 

    low:            {   fn: (d, curr) => Math.min(d.price, value(curr, d.price)), 
                        fill: p => p.close },

    close:          {   fn: (d) => d.price, 
                        fill: p => p.close },

                    ...
    
    buyVol:         {   fn: (d, curr) => when(d.buy, value(curr, 0) + d.qty), 
                        fill: () => 0 },

    sellVol:        {   fn: (d, curr) => when(d.sell, value(curr, 0) + d.qty), 
                        fill: () => 0 },
    
    cumNetVol:      {   fn: (d, curr) => value(curr, 0) + d.qty, 
                        cumulative: true    [^4]
                    },

                    ...

};
```

[^4] - Underscore fields are special
        - they are run first
        - they do not get added to sample (hidden)
        - they perform some operation e.g. here they set a value on the data object itself
        <br>

[^5] - Cumulative fields do not get reset with each new sample, rather their values are rolled forward.

<br>

---


## Custom Calculation Expressions

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
