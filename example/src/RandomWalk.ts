export default class RandomWalk {

    min: number;
    max: number;
    maxTrend: number;
    maxStep: number;
    value: number;
    trendRem: number;
    trendDir: number;

    constructor(min: number, max: number, start: number, maxTrend: number, maxStep: number) {
        this.min = min;
        this.max = max;
        this.maxTrend = maxTrend;
        this.maxStep = maxStep;
        this.value = start || Math.random() * ((max - min)/2) + min;
        this.trendRem = 0;
        this.trendDir = 0;
    }

    createTrend() {
        this.trendDir = Math.round(Math.random() * 2 - 1); // -1, 0, 1
        this.trendRem = Math.random() * this.maxTrend;
    }

    next() {
        if (this.trendRem<=0) {
            this.createTrend();
        }
        const step = Math.random() * this.maxStep;
        this.trendRem -= step;
        this.value += step * this.trendDir;

        //cap at max and reverse trend
        if (this.value >=this.max) {
            this.createTrend();
            this.trendDir = -1;
            this.value -= step;
        }

        //cap at min and reverse trend
        if (this.value <=this.min) {
            this.createTrend();
            this.trendDir = 1;
            this.value += step;
        }

        return this.value;
    }
}