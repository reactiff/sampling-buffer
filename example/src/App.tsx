import React, { useCallback, useEffect, useState } from "react";
import DataTable from './DataTable';

import { SamplingBuffer, ClosedCircuitBuffer } from "@reactiff/sampling-buffer";
import tradeSampleFields from "./tradeSampleFields";
import RandomWalk from './RandomWalk';

const rndWalk = new RandomWalk(1, 1000, 500, 10, 10);

const buffer = new SamplingBuffer({
  interval:       1000,               // in milliseconds
  bufferLength:   30,                 // total samples in closed circuit buffer
  trackKeys:      ['exch'],           // create track for each unique combination of these data fields
  fields:         tradeSampleFields,
});

buffer.addExpression('sma10', (series: any) => {
  return series.close.mean(10)
})

buffer.addExpression('ema10', (series: any) => {
  
  const n = 10;
  const key = `ema${n}`;
  
  const price = series.close;
  const calcSerie = series[key];
  
  if (calcSerie.availableLength < n + 1) {
    return undefined;
  }

  let prev = calcSerie.value(-1);
  if (!prev) {
    prev = price.mean(n, -1);
  }

  const k = 2 / (n + 1);
  const ema = price.value() * k + prev * (1 - k);

  return ema;
})

buffer.addExpression('cross', (_: any) => {

  // check cross to the up side
  if (_.ema10.value( 0) > _.sma10.value( 0) &&
      _.ema10.value(-1) < _.sma10.value(-1)) {
        return 1;
  }

  // check cross to the down side
  if (_.ema10.value( 0) < _.sma10.value( 0) &&
      _.ema10.value(-1) > _.sma10.value(-1)) {
        return -1;
  }
  
  return undefined;
});

function simulateTradeEvent(time: number) {
  const trade = {
    time,
    exch:   'RNDWALK',
    price:  Math.round(rndWalk.next()),
    qty:    Math.round(Math.random() * 100 - 50),
  };
  buffer.capture( trade , 
    (name, track) => track.tags.exch === trade.exch
  );
}

export default () => {

  const m = React.useRef({ index: 0, time: 0, clickIndex: 0, periods: 5, tickCount: 0, initialized: false, stopped: false }).current;
  const [columns, setColumns] = useState<string[]>([]);
  const [fifoData, setFifoData] = useState<any[]>([]);

  const readTrackData = React.useCallback((track: ClosedCircuitBuffer) => {
    let cols: string[] = [];
    const fifos = new Array(track.length);
    track.fifo((pos, buffer) => {
      fifos[pos.ordinal] = buffer[pos.index];
      cols = Object.keys(fifos[pos.ordinal]);
    });
    setColumns(cols);
    setFifoData(fifos);
  }, []);


  useEffect(() => {
    
    buffer.onTrackStart = (track) => {
      track.onUpdate = () => {
        readTrackData(track);
      }
    };

    buffer.onInterval = () => {
      const track = Object.values(buffer.tracks)[0];
      readTrackData(track);
    }

    

    buffer.startSampling();

  }, [readTrackData]);


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

  // read data
  // useEffect(() => {
  //   for (let i = 0; i < data.items.length; i++) {
  //     const trade = {
  //       time:   data.items[i][0],
  //       price:  data.items[i][2],
  //       vema10: data.items[i][4],
  //     };
  //     buffer.capture(trade);
  //   }
  // }, []);

  const handleClick = useCallback(() => {
    
  }, []);

  return (
    <>
      <div className="flex row justify-center align-center fill" onClick={handleClick}>
        <div className="flex column"> 
          <div style={{marginBottom: 15}}>
            {
              <DataTable cols={columns} items={fifoData} />
            }
          </div>
        </div>
      </div>
  </>
  )
};
