import Logger from "../logger";
import {RTCMetricsBatch} from "./batch";
import {GzipRTCMetricsCompressor, IRTCMetricsCompressor, NoneRTCMetricsCompressor} from "./compressor";
import {IRTCMetricsSender, RTCMetricsHttpSender, RTCMetricsWebsocketSender} from "./sender";
import {Connection} from "../connection";
import {Mutex} from "async-mutex";
import {
    CONNECTION_STATUS,
    CONNECTION_TYPE,
    LOG_PREFIX,
    RTCMetricsCollect,
    RTCMetricsCompressionType,
    RTCMetricsDelimiter,
    RTCMetricsServerDescription,
    RTCStatsType
} from "./constants";
import {IRTCStatsReportFilter} from "./filter";

/**
 * Collects WebRTC statistics from an RTCPeerConnection and sends them
 * to a backend system according to the provided server description.
 *
 * Responsibilities:
 * - Extract valid metrics based on server-defined rules
 * - Batch and compress metrics before sending
 * - Apply report filters
 * - Detect header changes and notify the server
 * - Schedule periodic metric collection
 */
export class RTCMetricsCollector {
    private _mediaSessionId: string;
    private _logger: Logger;
    private _headers: string;
    private _mutex: Mutex;
    private _batch: RTCMetricsBatch;
    private _maxErrors: number;
    private _errorsCount: number;
    private _connection: Connection;
    private _metricsScheduler: NodeJS.Timer;
    private _metricsSender: IRTCMetricsSender;
    private _reportFilters: IRTCStatsReportFilter[];
    private _peerConnection: RTCPeerConnection;
    private _compressor: IRTCMetricsCompressor;
    private _description: RTCMetricsServerDescription;

    /**
     * Creates a metrics collector instance.
     *
     * @param id media session identifier
     * @param webRTCMetricsServerDescription collection and transport rules
     * @param peerConnection WebRTC peer connection source of stats
     * @param connection WebSocket connection (if used)
     * @param logger logging facility
     * @param maxErrors max allowed send errors (legacy argument)
     */
    constructor(
        id: string,
        webRTCMetricsServerDescription: RTCMetricsServerDescription,
        peerConnection: RTCPeerConnection,
        connection: Connection,
        logger: Logger,
        maxErrors: number
    ) {
        this._logger = logger;
        this._connection = connection;
        this._description = webRTCMetricsServerDescription;
        this._mediaSessionId = id;
        this._peerConnection = peerConnection;

        this._headers = "";
        this._errorsCount = 0;
        this._maxErrors = maxErrors;
        this._reportFilters = [];
        this._mutex = new Mutex();

        this._collectMetrics = this._collectMetrics.bind(this);
    }

    /**
     * Starts collecting and sending metrics.
     * Validates server description and initializes internal fields.
     */
    public async start(): Promise<void> {
        this._logger.info(LOG_PREFIX, "Startup collecting metrics");
        this._validateBeforeStartup();
        await this._initializeFields();
        await this._sendHeaders();
        if (this._description.collect === RTCMetricsCollect.on) {
            this.collect(true);
        }
    }

    /**
     * Stops periodic metrics collection and resets internal state.
     */
    public stop(): void {
        this._logger.info(LOG_PREFIX, "Stopping collecting metrics");
        this.collect(false);
        this._resetFields();
    }

    /**
     * Enables or disables periodic stats sampling.
     *
     * @param enable whether sampling should be active
     */
    public collect(enable: boolean) {
        this._logger.info(LOG_PREFIX, "Collecting state changed: ", enable ? "enabled" : "disabled");
        if (enable) {
            if (this._metricsScheduler == null) {
                this._metricsScheduler = setInterval(this._collectMetrics, this._description.sampling);
            }
        } else {
            if (this._metricsScheduler != null) {
                clearInterval(this._metricsScheduler);
                this._metricsScheduler = null;
            }
        }
    }

    /**
     * Adds a custom report filter.
     * A report is ignored if any filter rejects it.
     *
     * @param filter filter instance
     */
    public addStatsReportFilter(filter: IRTCStatsReportFilter) {
        this._reportFilters.push(filter);
    }

    /**
     * Ensures required fields are present before collector startup.
     * Throws descriptive errors if configuration is incomplete.
     */
    private _validateBeforeStartup(): void {
        let error = "Can't collect WebRTC stats to send: ";
        if (!this._description.types) {
            throw new Error(error + "no report types defined");
        }
        if (!this._description.sampling) {
            throw new Error(error + "no sampling interval defined");
        }
        if (!this._description.batchSize) {
            throw new Error(error + "no metrics batch size defined");
        }
        if (!this._peerConnection) {
            throw new Error(error + "no RTCPeerConnection available");
        }
    }

    /**
     * Initializes sender, compressor, batch and header structure.
     */
    private async _initializeFields(): Promise<void> {
        if (this._description.ingestPoint) {
            if (this._description.ingestPoint.startsWith(CONNECTION_TYPE.HTTP)) {
                this._metricsSender = new RTCMetricsHttpSender(
                    this._description.ingestPoint,
                    this._description.authorization
                        ? {Authorization: this._description.authorization}
                        : null
                );
            } else {
                throw new Error("Unsupported connection type for collector described in ingestPoint");
            }
        } else {
            this._metricsSender = new RTCMetricsWebsocketSender(this._connection);
        }

        if (
            this._description.compression &&
            this._description.compression.includes(RTCMetricsCompressionType.gzip)
        ) {
            this._compressor = new GzipRTCMetricsCompressor();
        } else {
            this._compressor = new NoneRTCMetricsCompressor();
        }

        this._batch = new RTCMetricsBatch(this._description.batchSize);
        this._headers = await this._extractHeaders(
            await this._peerConnection.getStats(),
            this._description
        );
    }

    /**
     * Extracts all valid metrics headers from the RTCStatsReport,
     * respecting type constraints, filters and "contains" conditions.
     *
     * @returns serialized header string
     */
    private async _extractHeaders(
        stats: RTCStatsReport,
        description: RTCMetricsServerDescription
    ): Promise<string> {
        return Object.entries(description.types).reduce((accumulator, [typename, descriptor]) => {
            stats.forEach((report) => {
                if (this._mismatchTypename(report, typename) ||
                    this._mismatchContains(report, descriptor.contains) ||
                    this._mismatchFilters(report)) {
                    return;
                }

                accumulator = descriptor.metrics
                    .split(RTCMetricsDelimiter.HEADERS)
                    .reduce((acc, metricName) => {
                        if (this._isNullOrUndefined(report[metricName])) {
                            return acc;
                        }
                        return (acc + (acc.length ? RTCMetricsDelimiter.HEADERS : "") + `${report.type}.${report.id}.${metricName}`);
                    }, accumulator);
            });
            return accumulator;
        }, "");
    }

    /**
     * Periodic sampling routine:
     * - extracts stats
     * - checks for header changes
     * - accumulates metrics
     * - flushes on mismatch or batch size reached
     */
    private async _collectMetrics() {
        const unlock = await this._mutex.acquire();

        try {
            let stats = await this._peerConnection.getStats();
            let headers = await this._extractHeaders(stats, this._description);

            if (this._headers != headers) {
                this._headers = headers;
                await this._sendMetricsAndFlushBatch();
                await this._sendHeaders();
            }

            if (!this._headers.length) {
                return;
            }

            let metrics = [];
            let lostMetrics = [];

            this._headers.split(RTCMetricsDelimiter.HEADERS).forEach((header) => {
                let components = header.split(".");
                if (components.length != 3) {
                    return;
                }
                let descriptor: RTCStatsType = {
                    type: components[0],
                    id: components[1],
                    name: components[2]
                };

                let value = undefined;

                stats.forEach((report) => {
                    if (report.id == descriptor.id) {
                        value = report[descriptor.name];
                    }
                });

                if (this._isNullOrUndefined(value)) {
                    lostMetrics.push(descriptor);
                } else {
                    metrics.push(this._stringifyValue(value));
                }
            });

            if (lostMetrics.length) {
                this._logger.error(LOG_PREFIX,
                    "Failed to fully collect the stated metrics. Send correctly accumulated metrics ahead of time"
                );
                await this._sendMetricsAndFlushBatch();
            } else {
                this._batch.addMetrics(metrics);
                if (this._batch.fulfilled()) {
                    await this._sendMetricsAndFlushBatch();
                }
            }
        } finally {
            unlock();
        }

        if (this._errorsCount > this._maxErrors) {
            this.stop();
        }
    }

    /**
     * Sends the current header structure to the server.
     */
    private async _sendHeaders(): Promise<void> {
        this._logger.info(LOG_PREFIX, "Send headers:", this._headers);
        await this._metricsSender.sendDescription({
            headers: this._headers,
            compression: this._compressor.type.toString(),
            mediaSessionId: this._mediaSessionId
        });
    }

    /**
     * Compresses, deduplicates and sends the current metrics batch.
     * Resets batch afterwards.
     */
    private async _sendMetricsAndFlushBatch(): Promise<void> {
        if (this._batch.empty()) {
            return;
        }

        this._batch.deduplicate();

        const status = await this._metricsSender.sendBatch({
            mediaSessionId: this._mediaSessionId,
            metrics: this._compressor.compress(this._batch)
        });

        if (status == CONNECTION_STATUS.OK) {
            this._logger.debug(LOG_PREFIX, "Successfully sent metrics batch");
            this._errorsCount = 0;
        } else {
            this._logger.error(LOG_PREFIX, "Failed to send metrics batch with status:", status);
            this._errorsCount++;
        }

        this._batch.release();
    }

    /**
     * Converts metric values to string form.
     */
    private _stringifyValue(value: any): string {
        if (typeof value === "object") {
            return JSON.stringify(value);
        }
        return value.toString();
    }

    /**
     * Checks if stats report type matches required type.
     */
    private _mismatchTypename(report: any, typename: string): boolean {
        return report.type !== typename;
    }

    /**
     * Checks "contains" rules within metric type description.
     */
    private _mismatchContains(report: any, contains?: Record<string, any[]>): boolean {
        return (
            contains &&
            Object.entries(contains).some(([field, desiredValues]) => {
                if (!report[field]) {
                    return true;
                }
                return !desiredValues.includes(report[field]);
            })
        );
    }

    /**
     * Applies custom filters to the stats report.
     */
    private _mismatchFilters(report: any): boolean {
        return this._reportFilters.some((filter) => !filter.allowed(report));
    }

    /**
     * Checks for null or undefined values.
     */
    private _isNullOrUndefined(value: any): boolean {
        return value === undefined || value === null;
    }

    /**
     * Reset fields
     */
    private _resetFields(): void {
        this._headers = "";
        this._batch.release();
        this._errorsCount = 0;
    }
}
