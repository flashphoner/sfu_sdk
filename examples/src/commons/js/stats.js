const Threshold = function(parameter, maxLeap) {
    const threshold = {
        parameter: parameter,
        maxLeap: maxLeap,
        filter: SFU.createFilter(),
        previousValue: -1,
        isReached: function(stats) {
            let hasLeap = false;
            if (stats && parameter in stats) {
                let value = threshold.filter.filter(stats[parameter]);
                if (threshold.previousValue > -1) {
                    if (Math.round(Math.abs(value - threshold.previousValue)) > maxLeap) {
                        hasLeap = true;
                    }
                }
                threshold.previousValue = value;
            }
            return hasLeap;
        }
    }
    return threshold;
}

const Thresholds = function () {
    const thresholds = {
        thresholds: {},
        add: function(parameter, maxLeap) {
            if (!thresholds.thresholds[parameter]) {
                thresholds.thresholds[parameter] = new Threshold(parameter, maxLeap);
            }
        },
        remove: function(parameter) {
            if (thresholds.thresholds[parameter]) {
                delete thresholds.thresholds[parameter];
            }
        },
        isReached: function(stats) {
            let result = false;
            Object.keys(thresholds.thresholds).forEach((key) => {
                result = result || thresholds.thresholds[key].isReached(stats);
            });
            return result;
        }
    }
    return thresholds;
}