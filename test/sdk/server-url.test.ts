import { resolveServerUrl } from "../../src/sdk/server-url";

const HOST = "media.example.com";

describe("resolveServerUrl", () => {
    it("should replace an IPv4 host with the host of the connection", () => {
        expect(resolveServerUrl("https://192.168.1.10/icon/space", HOST))
            .toEqual("https://media.example.com/icon/space");
    });

    it("should replace an IPv6 host with the host of the connection", () => {
        expect(resolveServerUrl("https://[2001:db8::1]/icon/space", HOST))
            .toEqual("https://media.example.com/icon/space");
    });

    it("should keep the scheme, port, path and query of the original url", () => {
        expect(resolveServerUrl("https://10.0.0.5:8081/icon?id=42&icon=a.png&sig=abc", HOST))
            .toEqual("https://media.example.com:8081/icon?id=42&icon=a.png&sig=abc");
    });

    it("should leave a named host untouched", () => {
        expect(resolveServerUrl("https://node2.example.org:8081/icon/space", HOST))
            .toEqual("https://node2.example.org:8081/icon/space");
        expect(resolveServerUrl("https://localhost:8081/icon/space", HOST))
            .toEqual("https://localhost:8081/icon/space");
    });

    it("should leave an out of range IPv4 host untouched", () => {
        expect(resolveServerUrl("https://999.1.1.1/icon/space", HOST))
            .toEqual("https://999.1.1.1/icon/space");
    });

    it("should leave urls without a host untouched", () => {
        expect(resolveServerUrl("blob:http://localhost:1212/8f1e-uuid", HOST))
            .toEqual("blob:http://localhost:1212/8f1e-uuid");
        expect(resolveServerUrl("data:image/png;base64,AAAA", HOST))
            .toEqual("data:image/png;base64,AAAA");
    });

    it("should return empty and malformed values as is", () => {
        expect(resolveServerUrl("", HOST)).toEqual("");
        expect(resolveServerUrl("not an url", HOST)).toEqual("not an url");
    });

    it("should not touch the url while the connection host is unknown", () => {
        expect(resolveServerUrl("https://192.168.1.10/icon/space", ""))
            .toEqual("https://192.168.1.10/icon/space");
    });
});
