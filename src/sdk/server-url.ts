const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/* URL.hostname keeps IPv6 addresses wrapped in square brackets */
function isIpHost(hostname: string): boolean {
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
        return true;
    }

    const octets = IPV4_PATTERN.exec(hostname);

    return !!octets && octets.slice(1).every((octet) => Number(octet) <= 255);
}

/**
 * Replaces the host of a url issued by the server with the host the client is connected to.
 *
 * The server builds icon urls from its own configured address and cannot know the public name the
 * client used to reach it, so such a url may carry a bare IP: unreachable from another network and
 * rejected by TLS validation, since the certificate is issued for the name.
 *
 * Only a bare IP is replaced. A named host is left untouched: it may point elsewhere on purpose.
 * The scheme, port, path and query are preserved, and icon link signatures cover the query only,
 * so replacing the host keeps them valid.
 */
export function resolveServerUrl(url: string, host: string): string {
    if (!url || !host) {
        return url;
    }

    try {
        const parsed = new URL(url);

        if (!isIpHost(parsed.hostname)) {
            return url;
        }

        parsed.hostname = host;

        return parsed.toString();
    } catch {
        return url;
    }
}
