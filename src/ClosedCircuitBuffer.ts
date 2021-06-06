import Serie from './Serie';
import {
    IteratorCallback,
    IteratorPosition,
    NewSamplePredicate,
    Sampler,
    SerieFactory,
} from './types';

class ClosedCircuitBuffer {
    
    key: string;
    tags: any = {};

    array: any[] = [];
    cursor: number = 0;
    counter = 0;

    shouldAdvance: NewSamplePredicate;

    // prevSample: any;
    lastPeriodTime: number;
    sampler: Sampler;

    onUpdate?: () => void;
    lastAdvanceTime?: number;

    serieInstances: any = {};
    series: { [index: string]: SerieFactory } = {};

    constructor(length: number, sampler: Sampler) {
        const arrayLike = { length }; 
        this.sampler = sampler!;
        this.array = Array.from(arrayLike).map(this.sampler.createSample);
        this.cursor = length ? 0 : -1;
        this.shouldAdvance = this.sampler.newSamplePredicate;
        this.createSeries();
    }
    
    getOffsetAdjAvailableLength(offset: number) {
        return Math.max(
            0,
            Math.min(this.array.length, this.counter + 1) - Math.abs(offset)
        );
    }

    get length() {
        return this.array.length;
    }

    get current() {
        return this.array[this.cursor];
    }

    get(offset = 0) {
        return this.array[this.getIndex(offset)];
    }

    getIndex(offset = 0) {
        let index = this.cursor + offset
        if (offset > 0) {
            return index  % this.array.length;
        }
        while (index < 0) {
            index = this.array.length + index;
        }
        return index;
    }

    createSeries() {
        const keys = [
            ...this.sampler.fields.publicKeys,
            ...this.sampler.fields.expressionKeys,
        ];

        this.serieInstances = {};
        const series = {};

        const _instance = this;
        keys.forEach(key => {
            series[key] = () => {
                if (!_instance.serieInstances[key]) {
                    _instance.serieInstances[key] = Serie.createSerie(key, _instance);
                }
                return _instance.serieInstances[key];
            }
        })

        const seriesHandler = {
            get: (target, prop, receiver) => {
                return target[prop]();
            }
        };
        
        this.series = new Proxy(series, seriesHandler);
    }
    
    nextSample(caller: string) {
        
        const currentTime = this.current[this.sampler.timeKey];
        this.lastAdvanceTime = currentTime;

        // see if the current slot hasn't received any data and fill forward from last slot
        if (this.current.__count === 0) {    
            const prevSlot = this.get(-1);
            if (prevSlot.__count) {
                this.sampler.ffill(this.current, prevSlot);                          
            }
        }  

        this.counter++;
        this.cursor++;
        if (this.cursor === this.array.length) {
            this.cursor = 0;
        }
        
        Object.assign(this.array[this.cursor], this.sampler.blank);

        this.array[this.cursor][this.sampler.timeKey] = currentTime + this.sampler.interval;
    };

    fillMissingSamples(time: number) {
        // when loading from history, we need to account for missing data
        // and insert missing samples, something that would normally
        // be taken care of by the timer

        let normallySkippedMax = 1;
        if (this.sampler.suppressAutoSampling) {
            normallySkippedMax = 0;
        }

        if (this.sampler.interval > 0 && this.lastPeriodTime) {
            const elapsed = time - this.lastPeriodTime;
            const missingSamples = elapsed / this.sampler.interval - normallySkippedMax;
            if (missingSamples > 0) {
                for (let i = 0; i<missingSamples; i++) {
                    const offset = this.sampler.interval;
                    const insertedTime = this.lastPeriodTime + offset;
                    this.nextSample('fillMissingSamples');
                    this.lastPeriodTime = insertedTime;
                }
            }
        }
    }

    /**
     * Preload buffer with history data
     * @param data 
     */
    preload(data: any) {

        const sampleTime = this.sampler.getSampleTime(data.time);
        
        this.fillMissingSamples(sampleTime)

        this.sampler.collect(this, this.current, data, sampleTime);
        
        if (this.shouldAdvance(this.current, data, sampleTime, this.lastPeriodTime)) {
            this.nextSample('preload'); 
            this.lastPeriodTime = sampleTime;
        }
    }

    /**
     * Record real-time data from a stream
     * @param data 
     * @returns 
     */
    capture(data: any, time?: number) {
        const captureTime = time || data[this.sampler.timeKey];
        const sampleTime = this.sampler.getSampleTime(captureTime);

        if (!this.lastPeriodTime) {
            this.lastPeriodTime = sampleTime;
        }
        // if any samples were skipped, fill them before capturing
        if (this.sampler.interval > 0 && this.sampler.suppressAutoSampling) {
            this.fillMissingSamples(sampleTime);
        }

        this.sampler.collect(this, this.current, data, sampleTime);

        if (this.sampler.interval === 0) {
            this.nextSample('capture'); 
            this.lastPeriodTime = sampleTime;
        }
        
        this.onUpdate && this.onUpdate();
    }
    
    lifo(callback: IteratorCallback, offset: number, limit = -1) {
        const absOffset     = Math.abs(offset || 0);
        const requestedLmt  = limit >= 0 ? Math.abs(limit) : 0;
        const offsetAdjLmt  = this.array.length - absOffset;
        
        const pos: IteratorPosition = {
            index: this.cursor - absOffset, // starting position (adjusted for offset)
            relative: 0,                    
            ordinal: 0,                     // zero based iteration number
        };

        let j   = this.array.length;
        while (j--) {

            if (absOffset  && pos.ordinal >= offsetAdjLmt) {
                break;
            }
            if (limit >= 0 && pos.ordinal >= requestedLmt) {
                break;
            }

            // loop around
            if (pos.index < 0) {
                pos.index = this.array.length - 1; 
            }

            callback(
                pos,
                this.array
            );

            pos.ordinal++;
            pos.index--;
            pos.relative--;
        }
    }

    fifo(callback: IteratorCallback, limit = -1) {
        const arrlen = this.array.length;
        let lmt = limit >= 0 ? limit : arrlen;

        const pos: IteratorPosition = {
            index: 0,                   
            relative: -(arrlen - 1),                    
            ordinal: 0,                 
        };

        let j = arrlen;
        let i = 0;
        while (j-- && lmt--) {
            pos.index = (arrlen + this.cursor - j) % arrlen;

            callback(
                pos,
                this.array
            );

            pos.ordinal++;
            pos.relative++;
        }
    }
    
    

}

export default ClosedCircuitBuffer;