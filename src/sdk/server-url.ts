const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/* URL.hostname keeps IPv6 addresses wrapped in square brackets */
function isIpHost(hostname: string): boolean {
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
        return true;
    }

    const octets = IPV4_PATTERN.exec(hostname);

    return !!octets && octets.slice(1).every((octet) => Number(octet) <= 255);
}

function isSecureConnection(connection: URL): boolean {
    return connection.protocol === "wss:" || connection.protocol === "https:";
}

function isSecurePage(): boolean {
    return typeof window !== "undefined" && window.location?.protocol === "https:";
}

/**
 * Rebuilds a url issued by the server against the connection this client actually holds.
 *
 * The server composes such urls from its own address and listener and cannot know how the client
 * reached it: the address may be a bare IP, unreachable from another network and rejected by TLS
 * validation, and behind a reverse proxy the listener is plain http on an internal port while the
 * public entry point is https on 443.
 *
 * Applied in order:
 *  - a bare IP host, or the host of the connection itself, is pointed at the connection host; any
 *    other named host is left alone, it may be another node on purpose;
 *  - a connection without an explicit port means a single public entry point, so the url is
 *    collapsed onto that origin: scheme from the connection, no port;
 *  - otherwise scheme and port stay as issued, the server having reported its own listener, except
 *    that an https page upgrades a leftover http url, which it would refuse to load anyway.
 *
 * Path and query survive every rule, so icon link signatures, which cover the query only, stay valid.
 */
export function resolveServerUrl(url: string, connectionUrl: string): string {
    if (!url || !connectionUrl) {
        return url;
    }

    let connection: URL;
    let resolved: URL;
    try {
        connection = new URL(connectionUrl);
        resolved = new URL(url);
    } catch {
        return url;
    }

    if (!isIpHost(resolved.hostname) && resolved.hostname !== connection.hostname) {
        return url;
    }

    resolved.hostname = connection.hostname;

    if (!connection.port) {
        resolved.protocol = isSecureConnection(connection) ? "https:" : "http:";
        resolved.port = "";
    } else if (resolved.protocol === "http:" && isSecurePage()) {
        resolved.protocol = "https:";
    }

    return resolved.toString();
}

/**
 * The same rules applied to a url template, of which only the origin is rebuilt.
 *
 * The rest is carried over verbatim: URL parsing percent-encodes the braces of a {name} placeholder
 * and mistakes a trailing {?name} for a query string, so a template must never go through it whole.
 */
export function resolveServerTemplate(template: string, connectionUrl: string): string {
    if (!template || !connectionUrl) {
        return template;
    }

    const authorityStart = template.indexOf("//");
    if (authorityStart < 0) {
        return template;
    }

    const pathStart = template.indexOf("/", authorityStart + 2);
    if (pathStart < 0) {
        return resolveServerUrl(template, connectionUrl);
    }

    const origin = resolveServerUrl(`${template.slice(0, pathStart)}/`, connectionUrl);

    return origin.replace(/\/$/, "") + template.slice(pathStart);
}
