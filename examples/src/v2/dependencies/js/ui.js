(function (global) {
    "use strict";

    function serverUrl() {
        if (global.WCS_SERVER_URL !== undefined && global.WCS_SERVER_URL !== null) {
            const value = String(global.WCS_SERVER_URL).trim();
            const url = new URL(value);
            if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password ||
                url.pathname !== '/' || url.search || url.hash) {
                throw new Error('Invalid embedded WCS server URL');
            }
            return url.origin;
        }
        const secure = global.location.protocol === 'https:';
        const host = global.location.hostname;
        const hostname = host.includes(':') && !host.startsWith('[') ? '[' + host + ']' : host;
        return (secure ? 'wss://' : 'ws://') + hostname + (secure ? ':8443' : ':8080');
    }

    function status(id, value, kind) {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = value instanceof Error ? value.message : String(value ?? '');
        element.dataset.kind = kind || 'info';
        element.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    }

    global.SfuExample = Object.freeze({ serverUrl, status });
})(window);
