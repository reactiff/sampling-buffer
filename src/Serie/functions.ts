export const sum = (array) => {
    return array.reduce((sum, value) => sum + value, 0);
}

export const average = (array) => {
    return sum(array) / array.length;
}

export const movingAverage = (array, n) => {
    return average(array.slice(array.length - n));
}

/**
 * Uses Bessel's correction of bias.
 * @param {array} array 
 */
export const stDev = (array) => {
    if (array.length < 2) return 0;
    const mean = average(array);
    const avgSquare = sum(array.map(value => (value - mean) ** 2)) / (array.length - 1);
    return Math.sqrt(avgSquare);
}

export default {
    sum,
    stDev,
    average,
    movingAverage,
}