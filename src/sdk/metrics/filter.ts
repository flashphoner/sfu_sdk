/**
 * Interface describing a filter for RTC stats reports.
 * Implementations decide whether a given report should pass
 * further processing.
 */
export interface IRTCStatsReportFilter {
    /**
     * Determines whether the given stats report should pass the filter.
     *
     * @param report Any RTC stats report object.
     * @returns true if the report is accepted, false otherwise.
     */
    allowed(report): boolean;
}

/**
 * Filter that rejects RTP stats reports belonging to inactive tracks.
 * A track is considered inactive if its mediaSourceId is missing,
 * empty, or marked as "(removed)".
 */
export class InactiveOutboundTrackRTCStatsReportFilter implements IRTCStatsReportFilter {

    /**
     * Checks whether the provided report represents an active RTP track.
     * Only applies to "outbound-rtp" type.
     *
     * @param report RTC stats report.
     * @returns true if the track is active or if the report type is unrelated,
     *          false if the track is inactive.
     */
    public allowed(report): boolean {
        if (report.type === "outbound-rtp") {
            return report.mediaSourceId
                && report.mediaSourceId !== ""
                && report.mediaSourceId !== "(removed)";
        }
        return true;
    }
}

/**
 * Filter that rejects RTP stats reports belonging to inactive tracks.
 * A track is considered inactive if its framesPerSecond is missing,
 * or marked as "(removed)".
 */
export class InactiveInboundTrackRTCStatsReportFilter implements IRTCStatsReportFilter {

    /**
     * Checks whether the provided report represents an active RTP track.
     * Only applies to "inbound-rtp" type.
     *
     * @param report RTC stats report.
     * @returns true if the track is active or if the report type is unrelated,
     *          false if the track is inactive.
     */
    public allowed(report): boolean {
        if (report.type === "inbound-rtp") {
            return report.framesPerSecond
                && report.framesPerSecond !== "(removed)";
        }
        return true;
    }
}