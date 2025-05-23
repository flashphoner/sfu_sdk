import {SfuEvent, SfuExtended} from "../../../src";
import {waitForUsers} from "../../util/utils";
import {TEST_ROOM} from "../../util/constants";
import {ConferenceType, MeetingAddedToHistory, MeetingHistoryItem} from "../../../src/sdk/constants";

const wrtc = require("wrtc");

describe("history", () => {
    let bob: SfuExtended;
    let alice: SfuExtended;
    beforeEach(async () => {
        const users = await waitForUsers();
        bob = users.bob;
        alice = users.alice;
    })
    afterEach(async () => {
        await bob.disconnect();
        await alice.disconnect();
    })

    it('meeting should be added to history after ending and users should be able to delete meeting from history', async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        await bobRoom.join(bobPc);

        const room = await alice.roomAvailable({
            id: bobRoom.id(),
            pin: bobRoom.pin(),
        });

        const alicePc = new wrtc.RTCPeerConnection();
        await room.join(alicePc);

        const waitEvents = async () => {
            return new Promise<void>(resolve => {
                let eventsCount = 0;
                const checkEventsAndResolve = () => {
                    if (eventsCount === 2) {
                        resolve();
                    }
                }
                const eventHandler = (msg) => {
                    const historyItem: MeetingHistoryItem = (msg as MeetingAddedToHistory).meeting;
                    expect(historyItem.meetingId).toEqual(room.id());
                    expect(historyItem.owner).toEqual(bob.user().username);
                    expect(historyItem.startedBy).toEqual(bob.user().username);
                    expect(historyItem.participants.length).toBe(2);
                    expect(historyItem.endedAt).toBeGreaterThan(historyItem.startedAt);
                    expect(historyItem.type).toEqual(ConferenceType.GLOBAL);
                    eventsCount++;
                    checkEventsAndResolve();
                }
                bob.on(SfuEvent.MEETING_ADDED_TO_HISTORY, eventHandler);
                alice.on(SfuEvent.MEETING_ADDED_TO_HISTORY, eventHandler);
            })
        }
        bobRoom.destroyRoom();
        await waitEvents();

        let bobMeetingsHistory = await bob.loadMeetingsHistory({
            pageRequest: {
                page: 1,
                pageSize: 5
            }
        });
        let bobMeeting = bobMeetingsHistory.meetings.find((item) => item.meetingId === bobRoom.id());
        expect(bobMeeting).toBeTruthy();

        let aliceMeetingsHistory = await bob.loadMeetingsHistory({
            pageRequest: {
                page: 1,
                pageSize: 5
            }
        });
        let aliceMeeting = aliceMeetingsHistory.meetings.find((item) => item.meetingId === bobRoom.id());
        expect(aliceMeeting).toBeTruthy();

        await bob.removeMeetingFromHistory(bobMeeting.id);
        await alice.removeMeetingFromHistory(aliceMeeting.id);

        bobMeetingsHistory = await bob.loadMeetingsHistory({
            pageRequest: {
                page: 1,
                pageSize: 5
            }
        });
        bobMeeting = bobMeetingsHistory.meetings.find((item) => item.meetingId === bobRoom.id());
        expect(bobMeeting).toBeFalsy();

        aliceMeetingsHistory = await bob.loadMeetingsHistory({
            pageRequest: {
                page: 1,
                pageSize: 5
            }
        });
        aliceMeeting = aliceMeetingsHistory.meetings.find((item) => item.meetingId === bobRoom.id());
        expect(aliceMeeting).toBeFalsy();
    });
});
