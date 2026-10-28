import {RoomExtended} from "../../../src/sdk/room-extended";
import {Connection} from "../../../src/sdk/connection";
import {
    ParticipantAVSMutedEvent,
    RoomConfigEvent,
    RoomEvent,
    RoomExtendedConfig,
    RoomExtendedParticipantsConfig
} from "../../../src/sdk/constants";

const ROOM_ID = "room-id";
const OWNER = "kiri";
/* Somebody who was in the room before the local participant, so no PARTICIPANT_CONFIG was received for them. */
const UNKNOWN_PARTICIPANT = "alice";

type SentMessage = { message: string, data: any };

const roomConfig = (): RoomExtendedConfig => ({
    locked: false,
    initialAudioMuted: false,
    initialVideoMuted: false,
    initialScreenSharingMuted: false,
    audioMuted: false,
    videoMuted: false,
    screenSharingMuted: false,
    chatMuted: false,
    canChangeNickname: true,
    screenSharingConfig: {
        multipleShares: true,
        everyoneCanShare: true,
        everyoneCanDoSubsequentShare: true
    }
});

const createRoom = (sent: SentMessage[]): RoomExtended => {
    const connection = {
        send: (message: string, data: any) => {
            sent.push({message, data});
        }
    } as unknown as Connection;
    return new RoomExtended(connection, ROOM_ID, OWNER, "room", "", OWNER, OWNER, 0, roomConfig(), false);
};

const configEvent = (participantsConfig?: RoomExtendedParticipantsConfig): RoomConfigEvent => ({
    type: RoomEvent.ROOM_CONFIG,
    roomId: ROOM_ID,
    internalMessageId: "not-a-pending-request",
    config: {...roomConfig(), participantsConfig}
} as RoomConfigEvent);

const mutedEvent = (type: RoomEvent, internalMessageId: string, value: boolean): ParticipantAVSMutedEvent => ({
    type,
    roomId: ROOM_ID,
    internalMessageId,
    userId: UNKNOWN_PARTICIPANT,
    value
});

/* #zapp-847 — setParticipant*Muted() resolves from the very event the server echoes back, so losing
 * the event loses the acknowledgement too, and the muting side never learns its mute was applied. */
describe("participant config of a participant that joined earlier", () => {
    const cases: Array<{ event: RoomEvent, flag: "audioMuted" | "videoMuted" | "screenSharingMuted" }> = [
        {event: RoomEvent.PARTICIPANT_AUDIO_MUTED, flag: "audioMuted"},
        {event: RoomEvent.PARTICIPANT_VIDEO_MUTED, flag: "videoMuted"},
        {event: RoomEvent.PARTICIPANT_SCREEN_SHARING_MUTED, flag: "screenSharingMuted"}
    ];

    cases.forEach(({event, flag}) => {
        it(`Should notify ${event} and record ${flag} without a config entry`, async () => {
            const room = createRoom([]);
            const notified: Array<ParticipantAVSMutedEvent> = [];
            room.on(event, (e: ParticipantAVSMutedEvent) => {
                notified.push(e);
            });

            await room.processEvent(mutedEvent(event, "not-a-pending-request", true));

            expect(notified.length).toEqual(1);
            expect(notified[0].userId).toEqual(UNKNOWN_PARTICIPANT);
            expect(room.config().participantsConfig[UNKNOWN_PARTICIPANT][flag]).toBe(true);
        });
    });

    it("Should resolve setParticipantAudioMuted without a config entry", async () => {
        const sent: SentMessage[] = [];
        const room = createRoom(sent);

        const muted = room.setParticipantAudioMuted(UNKNOWN_PARTICIPANT, true);
        expect(sent.length).toEqual(1);
        const {internalMessageId} = sent[0].data;

        await room.processEvent(mutedEvent(RoomEvent.PARTICIPANT_AUDIO_MUTED, internalMessageId, true));

        await expect(muted).resolves.toBe(true);
        expect(room.config().participantsConfig[UNKNOWN_PARTICIPANT].audioMuted).toBe(true);
    });

    it("Should keep the other flags of a participant untouched", async () => {
        const room = createRoom([]);

        await room.processEvent(mutedEvent(RoomEvent.PARTICIPANT_VIDEO_MUTED, "not-a-pending-request", true));

        expect(room.config().participantsConfig[UNKNOWN_PARTICIPANT]).toEqual({
            audioMuted: false,
            videoMuted: true,
            screenSharingMuted: false
        });
    });
});

describe("a room event that cannot be processed", () => {
    it("Should be reported instead of rejecting on nobody", async () => {
        const room = createRoom([]);
        const logged: Array<any> = [];
        jest.spyOn(console, "error").mockImplementation((...args: Array<any>) => {
            logged.push(args);
        });

        /* No config in a ROOM_CONFIG event: whatever the branch does with it has to throw. */
        const malformed = {type: RoomEvent.ROOM_CONFIG, roomId: ROOM_ID, internalMessageId: "irrelevant"};

        await expect(room.processEvent(malformed as any)).resolves.toBeUndefined();
        expect(logged.length).toBeGreaterThan(0);
        expect(JSON.stringify(logged)).toContain(RoomEvent.ROOM_CONFIG);

        jest.restoreAllMocks();
    });
});

/* #zapp-1348 — the forced mutes of the people who were already in the room arrive in ROOM_CONFIG
 * on join and nowhere else, so dropping them left an owner who joined later unable to see, and
 * therefore unable to lift, a mute that had been set before. */
describe("participants config of ROOM_CONFIG", () => {
    it("Should be adopted on join", async () => {
        const room = createRoom([]);

        await room.processEvent(configEvent({
            [UNKNOWN_PARTICIPANT]: {audioMuted: true, videoMuted: false, screenSharingMuted: false}
        }));

        expect(room.config().participantsConfig[UNKNOWN_PARTICIPANT]).toEqual({
            audioMuted: true,
            videoMuted: false,
            screenSharingMuted: false
        });
    });

    it("Should replace what the room knew before", async () => {
        const room = createRoom([]);
        await room.processEvent(mutedEvent(RoomEvent.PARTICIPANT_AUDIO_MUTED, "not-a-pending-request", true));

        await room.processEvent(configEvent({
            [UNKNOWN_PARTICIPANT]: {audioMuted: false, videoMuted: true, screenSharingMuted: false}
        }));

        expect(room.config().participantsConfig[UNKNOWN_PARTICIPANT]).toEqual({
            audioMuted: false,
            videoMuted: true,
            screenSharingMuted: false
        });
    });

    it("Should leave a map behind when the event carries none", async () => {
        const room = createRoom([]);

        await room.processEvent(configEvent(undefined));
        /* The other branches index participantsConfig directly, so an undefined here would throw
         * on the next forced mute and lose that event the way #zapp-847 did. */
        await room.processEvent(mutedEvent(RoomEvent.PARTICIPANT_AUDIO_MUTED, "not-a-pending-request", true));

        expect(room.config().participantsConfig[UNKNOWN_PARTICIPANT].audioMuted).toBe(true);
    });
});
