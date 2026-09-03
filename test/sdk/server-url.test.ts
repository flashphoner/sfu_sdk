import { resolveServerTemplate, resolveServerUrl } from "../../src/sdk/server-url";

/* A node published through a single entry point: signalling carries no port, so neither does anything else. */
const PROXIED = "wss://media.example.com/";
/* A node addressed directly: signalling on its own port, http on whatever port the server reported. */
const DIRECT = "wss://media.example.com:8443/";

const setPageProtocol = (protocol: string): void => {
    Object.defineProperty(window, "location", {
        value: { protocol },
        writable: true,
        configurable: true
    });
};

describe("resolveServerUrl", () => {
    afterEach(() => {
        setPageProtocol("http:");
    });

    it("should replace an IPv4 host with the host of the connection", () => {
        expect(resolveServerUrl("https://192.168.1.10:8444/icon/space", DIRECT))
            .toEqual("https://media.example.com:8444/icon/space");
    });

    it("should replace an IPv6 host with the host of the connection", () => {
        expect(resolveServerUrl("https://[2001:db8::1]:8444/icon/space", DIRECT))
            .toEqual("https://media.example.com:8444/icon/space");
    });

    it("should keep the scheme, port, path and query issued by a directly addressed server", () => {
        expect(resolveServerUrl("https://10.0.0.5:8444/icon?id=42&icon=a.png&sig=abc", DIRECT))
            .toEqual("https://media.example.com:8444/icon?id=42&icon=a.png&sig=abc");
    });

    it("should collapse the url onto the entry point when the connection carries no port", () => {
        expect(resolveServerUrl("http://10.0.0.5:8081/icon?id=42&icon=a.png&sig=abc", PROXIED))
            .toEqual("https://media.example.com/icon?id=42&icon=a.png&sig=abc");
    });

    it("should collapse a url the server issued under its own public name", () => {
        expect(resolveServerUrl("http://media.example.com:8081/icon/space", PROXIED))
            .toEqual("https://media.example.com/icon/space");
    });

    it("should collapse to plain http when the connection itself is insecure", () => {
        expect(resolveServerUrl("http://10.0.0.5:8081/icon/space", "ws://media.example.com/"))
            .toEqual("http://media.example.com/icon/space");
    });

    it("should leave a named host of another node untouched", () => {
        expect(resolveServerUrl("https://node2.example.org:8081/icon/space", DIRECT))
            .toEqual("https://node2.example.org:8081/icon/space");
        expect(resolveServerUrl("https://localhost:8081/icon/space", DIRECT))
            .toEqual("https://localhost:8081/icon/space");
    });

    it("should leave an out of range IPv4 host untouched", () => {
        expect(resolveServerUrl("https://999.1.1.1/icon/space", DIRECT))
            .toEqual("https://999.1.1.1/icon/space");
    });

    it("should leave urls without a host untouched", () => {
        expect(resolveServerUrl("blob:http://localhost:1212/8f1e-uuid", DIRECT))
            .toEqual("blob:http://localhost:1212/8f1e-uuid");
        expect(resolveServerUrl("data:image/png;base64,AAAA", DIRECT))
            .toEqual("data:image/png;base64,AAAA");
    });

    it("should return empty and malformed values as is", () => {
        expect(resolveServerUrl("", DIRECT)).toEqual("");
        expect(resolveServerUrl("not an url", DIRECT)).toEqual("not an url");
        expect(resolveServerUrl("https://192.168.1.10/icon/space", "not an url"))
            .toEqual("https://192.168.1.10/icon/space");
    });

    it("should not touch the url while the connection is unknown", () => {
        expect(resolveServerUrl("https://192.168.1.10/icon/space", ""))
            .toEqual("https://192.168.1.10/icon/space");
    });

    it("should upgrade a plain http url that an https page would refuse anyway", () => {
        setPageProtocol("https:");

        expect(resolveServerUrl("http://10.0.0.5:8081/icon/space", DIRECT))
            .toEqual("https://media.example.com:8081/icon/space");
    });

    it("should leave the issued scheme alone on a page that allows plain http", () => {
        expect(resolveServerUrl("http://10.0.0.5:8081/icon/space", DIRECT))
            .toEqual("http://media.example.com:8081/icon/space");
    });
});

describe("resolveServerTemplate", () => {
    const RECORD = "/download-record/{meetingId}/{record}{?auth}";

    it("should keep placeholders and the optional query untouched", () => {
        expect(resolveServerTemplate("http://10.0.0.5:8081" + RECORD, DIRECT))
            .toEqual("http://media.example.com:8081" + RECORD);
    });

    it("should collapse the origin onto the entry point the same way a plain url is collapsed", () => {
        expect(resolveServerTemplate("http://10.0.0.5:8081" + RECORD, PROXIED))
            .toEqual("https://media.example.com" + RECORD);
    });

    it("should not percent-encode the braces the way whole-url parsing would", () => {
        const resolved = resolveServerTemplate("http://10.0.0.5:8081" + RECORD, PROXIED);

        expect(resolved).not.toContain("%7B");
        expect(resolved).toContain("{meetingId}");
        expect(resolved).toContain("{?auth}");
    });

    it("should return templates it cannot place as they are", () => {
        expect(resolveServerTemplate("", DIRECT)).toEqual("");
        expect(resolveServerTemplate("/download-record/{record}", DIRECT)).toEqual("/download-record/{record}");
        expect(resolveServerTemplate("http://10.0.0.5:8081" + RECORD, "")).toEqual("http://10.0.0.5:8081" + RECORD);
    });
});
