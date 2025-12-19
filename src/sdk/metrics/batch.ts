import {RTCMetricsDelimiter} from "./constants";

/**
 * Utility class for working with metrics batches
 */
export class RTCMetricsBatch {
    private _data: string[][];
    private readonly _size: number;

    constructor(size: number) {
        this._size = size;
        this._data = [];
    }

    /**
     * Add array of values
     * @example ["SV78", "0","74.659"]
     * @param metrics
     */
    public addMetrics(metrics: string[]): void {
        this._data.push(metrics);
    }

    /**
     * @returns `true` if the number of array values is greater than the batch size
     */
    public fulfilled(): boolean {
        return this._data.length >= this._size;
    }

    /**
     * @returns `true` if the batch is empty
     */
    public empty(): boolean {
        return this._data.length === 0;
    }

    /**
     * @returns batch data and flush current batch
     */
    public release(): string[][] {
        const metrics = this._data;
        this._data = [];
        return metrics;
    }

    /**
     * @returns the batch in the representation the protocol expects it to have WCS-4566
     * @example ["SV78;0;74.659", "SV78;4;72.11"]
     */
    public flat(): string[] {
        return this._data.map(line => line.join(RTCMetricsDelimiter.VALUES));
    }

    /**
     * @returns size of batch
     */
    public get size(): number {
        return this._size;
    }

    /**
     * @returns data of batch
     */
    public get data(): string[][] {
        return this._data;
    }

    /**
     * Since a batch can store more than one line, some lines may contain duplicate values compared to previous lines,
     * so the duplicates are erased and assigned an empty value.
     */
    public deduplicate(): void {
        if (this._size <= 1) {
            return;
        }

        let previousLine = this._data[0];
        for (let row = 1; row < this._data.length; ++row) {
            let currentLine = this._data[row];
            for (let col = 0; col < this._data[row].length; col++) {
                if (this._data[row][col] == previousLine[col]) {
                    this._data[row][col] = "";
                }
            }
            previousLine = currentLine;
        }
    }
}
