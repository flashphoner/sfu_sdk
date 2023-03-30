import {waitForUser} from "../../util/utils";
import {User} from "./User";
import {SfuExtended} from "../../../src";
import {RoomExtended} from "../../../src/sdk/room-extended";
import {add} from "../../../src/sdk/promises";
const RTCAudioSourceSineWave = require("../../lib/rtcaudiosourcesinewave");

const wrtc = require("wrtc");

const users: Array<User> = [];
const USERS = 1;
const ROOM_NAME = "100001";

let bob: SfuExtended;
let roomId;
let bobSettings;

beforeAll(async () => {
    bob = await waitForUser();
    bobSettings = await bob.getUserPmiSettings();
    // Disable waiting room
    await bob.updateUserPmiSettings({...bobSettings.pmiSettings, useWaitingRoom: false});
    // Create users
    for (let i = 0; i < USERS; i++) {
        const nickname = "user" + i;
        const username = "user" + i + "@example.com";
        users.push(new User({username: username, password: "123456", nickname: nickname}));
        await bob.inviteContact({to: username});
    }
    const room = await bob.createRoom({
        name: ROOM_NAME,
        id: ROOM_NAME,
        pin:"p@ssw0rd"
    });
    roomId = room.id();
    await room.configureWaitingRoom(false);
    await room.join(new wrtc.RTCPeerConnection());
}, 120000)

afterAll(async () => {
    await bob.updateUserPmiSettings({...bobSettings.pmiSettings});
    users.forEach((user) => user.stop());
})

async function addRemoveTrackLoop(room: RoomExtended, interval: number = 1000) {
    let aSender: RTCRtpTransceiver;

    function sleep(millis: number) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

    async function addTrack() {
        const aSource = new RTCAudioSourceSineWave();
        const aTrack = aSource.createTrack();
        aSender = room.pc().addTransceiver(aTrack, {
            direction: "sendonly"
        });
        try {
            await room.updateState({});
        } catch (e) {
            room.pc().removeTrack(aSender.sender);
            aSender = null;
        }
    }

    async function removeTrack() {
        if (aSender) {
            room.pc().removeTrack(aSender.sender);
            aSender = null;
            return room.updateState({});
        }
    }

    while (true) {
        try {
            if (aSender) {
                await removeTrack();
            } else {
                await addTrack();
            }
        } catch (e) {
            console.log("got exception", e);
        }
        await sleep(interval);
    }
}

describe("Stress test", () => {
    it("Should test server under many users", async (done) => {
        for (const user of users) {
            await user.connect();
            await user.joinWithAudio(roomId);
            user.start();
        }
        setTimeout(() => {
            done();
        }, 999999999)
    }, 999999999)

    it("Should test server under one user", async () => {
        await addRemoveTrackLoop(bob.getRoom({id: roomId}));
    }, 999999999)
})
