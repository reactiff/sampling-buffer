import ClosedCircuitBuffer from "../ClosedCircuitBuffer";
import { SerieOptions, AggregateFn1Def, AggregateFn1, CustomAggregateFnDef, CustomAggregateFn, CustomAggregateVoidCallback } from '../types';


const fnMin: AggregateFn1Def = (serie: Serie, options: SerieOptions, n: number, offset: number) => {
    const availLength = options.track.getOffsetAdjAvailableLength(offset);
    if (availLength < n) return undefined;

    const elements  = new Array(availLength);
    options.track.lifo((pos, buffer) => {
        elements[pos.ordinal] = buffer[pos.index][options.field];
    }, offset, availLength)
    
    return Math.min(...elements);
}

const fnMax: AggregateFn1Def = (serie: Serie, options: SerieOptions, n: number, offset: number) => {
    const availLength = options.track.getOffsetAdjAvailableLength(offset);
    if (availLength < n) return undefined;

    const elements  = new Array(availLength);
    options.track.lifo((pos, buffer) => {
        elements[pos.ordinal] = buffer[pos.index][options.field];
    }, offset, availLength)
    
    return Math.max(...elements);
}


const fnSum: AggregateFn1Def = (serie: Serie, options: SerieOptions, n: number, offset: number) => {
    const availLength = options.track.getOffsetAdjAvailableLength(offset);
    if (availLength < n) return undefined;
    
    let sum = 0;
    options.track.lifo((pos, buffer) => {
        sum += buffer[pos.index][options.field];
    }, offset, availLength)
    
    return sum;
}

const fnMean: AggregateFn1Def = (serie: Serie, options: SerieOptions, n: number, offset: number) => {
    const availLength = options.track.getOffsetAdjAvailableLength(offset);
    if (availLength < n) return undefined;
    
    let sum = 0;
    let cnt = 0;

    options.track.lifo((pos, buffer) => {
        sum += buffer[pos.index][options.field];
        cnt++;
    }, offset, availLength)
    
    return sum / cnt;
}

const fnCustom = (serie: Serie, options: SerieOptions, n: number, offset: number, callback: CustomAggregateVoidCallback) => {
    const availLength = options.track.getOffsetAdjAvailableLength(offset);
    if (availLength < n) return undefined;
    options.track.lifo((pos, buffer) => {
        callback(pos, buffer[pos.index][options.field])
    }, offset, availLength);
    return undefined;
}

/**
 * Uses Bessel's correction of bias.
 * @param {array} array 
 */
 
const fnStDev: AggregateFn1Def = (serie: Serie, options: SerieOptions, n: number, offset: number) => {
    const availLength = options.track.getOffsetAdjAvailableLength(offset);
    if (availLength === 0) return undefined;

    const mean = serie.mean(n, offset)!;

    let sumOfSq = 0;
    let cnt = 0;
    serie.fn(n, offset, (pos, val) => {
        sumOfSq += (val - mean) ** 2;
        cnt++;
    });

    return Math.sqrt(sumOfSq / cnt);
}

function attachAggregateFn(serie: Serie, options: SerieOptions, fn: AggregateFn1Def) {
    return (n: number, offset = 0) => {
        if (offset > 0) throw new Error('offset must be negative');
        return fn(serie, options, n, offset);
    };
}
function attachCustomAggregateFn(serie: Serie, options: SerieOptions, fn: CustomAggregateFnDef) {
    return (n: number, offset = 0, callback: CustomAggregateVoidCallback) => {
        if (offset > 0) throw new Error('offset must be negative');
        return fn(serie, options, n, offset, callback);
    };
}

export default class Serie {
    
    fn:  CustomAggregateFn;
    min: AggregateFn1;
    max: AggregateFn1;

    mean: AggregateFn1;
    
    stDev: AggregateFn1;

    value: (offset?: number) => number | undefined;

    track: ClosedCircuitBuffer;
    field: string;

    constructor(options: SerieOptions) {
        Object.assign(this, options);

        this.min = attachAggregateFn(this, options, fnMin);
        this.max = attachAggregateFn(this, options, fnMax);
        this.mean = attachAggregateFn(this, options, fnMean);
        
        this.fn  = attachCustomAggregateFn(this, options, fnCustom);

        this.stDev = attachAggregateFn(this, options, fnStDev);

        this.value = (offset = 0) => {
            const availLength = this.track.getOffsetAdjAvailableLength(offset);
            if (availLength === 0) return undefined;
            return this.track.get(offset)[this.field];
        }
    }

    get availableLength() {
        const availLength = this.track.getOffsetAdjAvailableLength(0);
        return availLength;
    }

    

    static createSerie(field: string, track: ClosedCircuitBuffer) {
        return new Serie({
            field,
            track,
        });
    }
}