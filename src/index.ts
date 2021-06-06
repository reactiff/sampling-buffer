import SamplingBuffer from './SamplingBuffer';
import ClosedCircuitBuffer from './ClosedCircuitBuffer';
import Serie from './Serie';

import { ConditionalOp } from "./types";

export function value(value: any, defaultValue: any) {
    return typeof value !== 'undefined' ? value : defaultValue;
}

export function when(condition: boolean, value: number | undefined | ConditionalOp) {
    if (condition) {
        if (typeof value === 'function') {
            return value();
        }
        return value;
    }
    return undefined;
}

export { SamplingBuffer, ClosedCircuitBuffer, Serie };