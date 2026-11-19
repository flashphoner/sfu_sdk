(function () {
    const element = (id) => document.getElementById(id);
    const errorText = (error) => {
        if (!error) return "Unknown error";
        if (error.operation && error.error) return error.operation + " failed: " + error.error;
        if (error.status && error.statusText) return error.status + " " + error.statusText;
        if (error.type && error.info) return error.type + ": " + error.info;
        return error.message || error.info || String(error);
    };

    class ExampleSession {
        constructor(options) {
            this.options = options;
            this.current = null;
            element(options.prefix + "Btn").addEventListener("click", () => {
                if (this.current) this.stop();
                else this.start();
            });
            this.render();
        }

        active() {
            return Boolean(this.current);
        }

        render() {
            const active = this.active();
            element(this.options.prefix + "Btn").textContent = active ? "Stop" : this.options.label;
            for (const id of this.options.fields || []) element(id).disabled = active;
            if (this.options.onChange) this.options.onChange();
        }

        status(text, kind) {
            SfuExample.status(this.options.prefix + "Status", text, kind || "info");
        }

        error(error) {
            SfuExample.status(this.options.prefix + "ErrorInfo", error ? errorText(error) : "", "error");
        }

        fail(attempt, error) {
            if (!attempt.isCurrent()) return;
            this.error(error);
            this.stop("Failed", "error");
        }

        async start() {
            if (this.current) return;
            const fields = [...(this.options.fields || []), ...(this.options.sharedFields || [])];
            let invalid = null;
            for (const id of fields) {
                const input = element(id);
                const valid = Boolean(input.value.trim());
                input.setAttribute("aria-invalid", String(!valid));
                if (!valid && !invalid) invalid = input;
            }
            if (invalid) {
                this.error("Fill in the required fields.");
                invalid.focus();
                return;
            }
            if (this.options.validate && !this.options.validate()) return;
            this.error(null);
            const attempt = {
                pc: null,
                session: null,
                room: null,
                display: null,
                streams: new Set(),
                isCurrent: () => this.current === attempt,
                listen: (source, event, callback) => source.on(event, (...args) => {
                    if (attempt.isCurrent()) callback(...args);
                }),
                keepStream: (stream) => {
                    if (attempt.isCurrent()) attempt.streams.add(stream);
                    else stream.getTracks().forEach((track) => track.stop());
                    return attempt.isCurrent();
                }
            };
            this.current = attempt;
            this.render();
            this.status("Connecting…");
            try {
                const roomConfig = this.options.roomConfig();
                if (this.options.unlockAudio && Browser().isSafariWebRTC()) {
                    await playFirstSound(element("main"), "../../commons/media/silence.mp3");
                }
                if (!attempt.isCurrent()) return;
                attempt.pc = new RTCPeerConnection();
                const session = await SFU.createRoom(roomConfig);
                if (!attempt.isCurrent()) {
                    await session.disconnect();
                    return;
                }
                attempt.session = session;
                attempt.room = session.room();
                const events = SFU.constants;
                attempt.listen(session, events.SFU_EVENT.FAILED, (error) => this.fail(attempt, error));
                attempt.listen(session, events.SFU_EVENT.DISCONNECTED, () => this.stop("Disconnected"));
                attempt.listen(attempt.room, events.SFU_ROOM_EVENT.FAILED, (error) => this.fail(attempt, error));
                attempt.listen(attempt.room, events.SFU_ROOM_EVENT.OPERATION_FAILED, (error) => this.fail(attempt, error));
                attempt.listen(attempt.room, events.SFU_ROOM_EVENT.ENDED, () => this.fail(attempt, this.options.endedMessage || "The room has ended."));
                attempt.listen(attempt.room, events.SFU_ROOM_EVENT.DROPPED, () => this.fail(attempt, "Dropped from the room due to network issues."));
                await this.options.join(attempt);
                if (attempt.isCurrent()) this.status("Established", "success");
            } catch (error) {
                this.fail(attempt, error);
            }
        }

        stop(text, kind) {
            const attempt = this.current;
            if (!attempt) return;
            this.current = null;
            const cleanup = (action) => {
                try { action(); } catch (error) { console.warn("Media cleanup failed", error); }
            };
            if (attempt.display) cleanup(() => attempt.display.stop());
            for (const stream of attempt.streams) {
                for (const track of stream.getTracks()) cleanup(() => track.stop());
            }
            if (attempt.pc) cleanup(() => attempt.pc.close());
            if (attempt.session) {
                try {
                    Promise.resolve(attempt.session.disconnect()).catch((error) => console.warn("Disconnect failed", error));
                } catch (error) { console.warn("Disconnect failed", error); }
            }
            this.render();
            this.status(text || "Stopped", kind);
        }

        static async loadConfig(fallback) {
            const config = new URLSearchParams(window.location.search).get("config") || "./config.json";
            try {
                const response = await fetch(config);
                if (!response.ok) throw new Error("HTTP " + response.status);
                const value = await response.json();
                if (!value || !value.room) throw new Error("Missing room configuration");
                return value;
            } catch (error) {
                console.warn("Cannot load " + config + "; using the default configuration", error);
                return JSON.parse(JSON.stringify(fallback));
            }
        }
    }

    window.SfuExampleSession = ExampleSession;
}());
