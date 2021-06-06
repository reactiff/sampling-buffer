import ClosedCircuitBuffer from "./ClosedCircuitBuffer";

import Serie from "./Serie";
import { Sampler, SamplerOptions, FieldDict, Expression, SampleFieldDictEntry, SampleFieldArrayItem } from "./types";

function deleteKeys(object: any, keysToDelete: string[]) {
    const obj: any = {...object};
    keysToDelete.forEach(key => delete obj[key]);
    return obj;
}

function parseField(fieldDict: FieldDict, key: string, value: any) {

    fieldDict.keys.push(key);
    
    // hidden
    if (key[0] === '_' && key[1] !== '_') {
        fieldDict.hidden[key] = true;
        fieldDict.hiddenKeys.push(key);
    } else {
        fieldDict.publicKeys.push(key);
    }

    if (typeof value === 'function') {
        fieldDict.fn[key] = value;
    } 
    else if (typeof value === 'object') {
        if (!!value.cumulative) {
            fieldDict.cumulative[key] = true;
        }
        fieldDict.fn[key] = value.fn;
        fieldDict.fill[key] = value.fill;
    } 
    else { // number
        fieldDict.fn[key] = () => value;
    }
}

function parseFieldsAsArray(fieldDict: FieldDict, options: SamplerOptions) {
    const fields = options.fields as SampleFieldArrayItem[];
    fields.forEach(field => {
        switch (typeof field) {
            case 'string':
                parseField(fieldDict, field, d => d[field] )
                break;
            default: // must be of type SampleFieldNamed
                parseField(fieldDict, field.name, field)
                break;
        }
    });
}

function parseFieldsAsDictionary(fieldDict: FieldDict, options: SamplerOptions) {
    Object.entries(options.fields).forEach(([key, value]) => {
        parseField(fieldDict, key, value);
    });
}

function getFields(options: SamplerOptions, expressions: any[]) {
    const fieldDict: FieldDict = {
        keys: [],
        publicKeys: [],
        hiddenKeys: [],
        expressionKeys: [],
        hidden: {},
        cumulative: {},
        fn: {},
        fill: {},
    };

    if (Array.isArray(options.fields)) {
        parseFieldsAsArray(fieldDict, options);
    } else {
        parseFieldsAsDictionary(fieldDict, options);
    }

    expressions.forEach((expr: any) => {
        fieldDict.expressionKeys.push(expr.name);
    });

    return fieldDict;
}

function createSampleFactory(fields: FieldDict) {
    const sample = { __count: 0 };
    fields.publicKeys.forEach(key => {
        sample[key] = undefined;
    });
    fields.expressionKeys.forEach(key => {
        sample[key] = undefined;
    });
    return () => ({ ...sample });
}

const fnOrValue = (value: any, ...params: any[]) => {
    if (typeof value === 'function') return value(...params);
    return value;
}

export function createSampler(options: SamplerOptions) {

    const fields = getFields(options, []);

    const sampler: Sampler = {
        addExpression,          // hoisted funciton
        blank:                  {},
        bufferLength:           options.bufferLength,
        collect,                // hoisted funciton
        createSample:           createSampleFactory(fields),
        cumulatives:            [],
        expressionDict:         {},
        expressions:            [],
        ffill,                  // hoisted funciton
        fields,
        getSampleTime,          // hoisted funciton
        interval:               options.interval || 0,
        newSamplePredicate,     // hoisted funciton
        series:                 {},
        suppressAutoSampling:   options.suppressAutoSampling,
        timeKey:                fnOrValue(options.timeKey)  || 'time',
        trackKeys:              options.trackKeys || [],
        tracks:                 [],
    };

    const initSeries = () => {
        sampler.fields          = getFields(options, sampler.expressions);
        sampler.createSample    = createSampleFactory(sampler.fields);
        sampler.cumulatives     = sampler.fields.keys.filter(k => sampler.fields.cumulative[k]);
        sampler.blank           = deleteKeys(sampler.createSample(), sampler.cumulatives);
    }

    function getSampleTime(time: number) {
        if (sampler.interval) return time - (time % sampler.interval); 
        return time;
    }

    function calculateExpressions(currSlot: any, track: ClosedCircuitBuffer) {
        sampler.expressions.forEach(expr => {
            const result = expr.expression(track.series);
            if (typeof result !== 'undefined') {
                currSlot[expr.name] = result;
            }
        })
    }

    function aggregateSample(currSlot: any, data: any, time: number) {
        currSlot.__count++;
        sampler.fields.hiddenKeys.forEach(key => {
            sampler.fields.fn[key](data, currSlot[key], currSlot);
        });
        sampler.fields.publicKeys.forEach(key => {
            if (key === sampler.timeKey) {
                const origTime = time || data[key];
                const sampleTime = getSampleTime(origTime);
                data[key] = sampleTime
            }
            const result = sampler.fields.fn[key](data, currSlot[key], currSlot);
            if (typeof result !== 'undefined') {
                currSlot[key] = result;
            }
        });
    }

    function ffill(currSlot: any, prevSlot: any) {
        sampler.fields.publicKeys
            .filter(key => !!sampler.fields.fill[key])
            .forEach(key => {
                currSlot[sampler.timeKey] = prevSlot[sampler.timeKey] + sampler.interval;
                currSlot[key] = sampler.fields.fill[key](prevSlot);
            });
        currSlot.__count = 1;
    };

    function collect(track: ClosedCircuitBuffer, currSlot: any, data: any, time: number) {     
        aggregateSample(currSlot, data, time);
        calculateExpressions(currSlot, track);
    };
    
    function newSamplePredicate(currSlot: any, data: any, time: number, lastPeriodTime: number) {
        const sampleTime = getSampleTime(time);
        // compare elapsed time since last period time
        if (typeof lastPeriodTime === 'undefined') return true;
        if (sampler.interval === 0) return true;
        if (sampleTime - lastPeriodTime >= sampler.interval) return true; 
        return false;
    };
    
    function addExpression(name: string, expression: Expression) {
        if (sampler.expressionDict[name]) throw new Error(`A field with the name '${name}' already exists.`)
        sampler.expressionDict[name] = expression;
        sampler.expressions.push({ name, expression });
        initSeries();
        sampler.tracks.forEach(t => t.createSeries());
    }

    return sampler;
}


    
