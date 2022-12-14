import {CALENDAR_EVENT} from "../../util/constants";
import {SfuEvent, SfuExtended} from "../../../src";
import {waitForUser} from "../../util/utils";

//TODO(naz): add/remove should return object, add should return id that was created at server side
describe("calendar", () => {
    let sfu: SfuExtended;
    beforeEach(async () => {
        sfu = await waitForUser();
    })
    afterEach(async () => {
        await sfu.disconnect();
    })
    it("Should load calendar", async () => {
        const calendar = await sfu.getUserCalendar();
        expect(calendar).toBeTruthy();
        expect(calendar.events).toBeTruthy();
    });
    it("Should add event", async () => {
        const calendarEvent = await sfu.addCalendarEvent(CALENDAR_EVENT);
        const calendar = await sfu.getUserCalendar();
        expect(calendar.events).toHaveProperty(calendarEvent.id);
        await sfu.removeCalendarEvent(calendarEvent);
    });
    it("Should update event", async () => {
        let calendarEvent = await sfu.addCalendarEvent(CALENDAR_EVENT);
        expect(calendarEvent.usePMI).toBe(true);
        calendarEvent.usePMI = false;
        calendarEvent = await sfu.updateCalendarEvent(calendarEvent);
        expect(calendarEvent.usePMI).toBe(false);
        await sfu.removeCalendarEvent(calendarEvent);
    });
    it("Should remove event", async () => {
        const calendarEvent = await sfu.addCalendarEvent(CALENDAR_EVENT);
        let calendar = await sfu.getUserCalendar();
        expect(calendar.events).toHaveProperty(calendarEvent.id);
        await sfu.removeCalendarEvent(calendarEvent);
        calendar = await sfu.getUserCalendar();
        expect(calendar.events[calendarEvent.id]).toBeFalsy();
    });
    it("Should create room based on event", async (done) => {
        let room;
        sfu.on(SfuEvent.NEW_CHAT, async (msg) => {
            if (room) {
                await room.destroyRoom();
                await sfu.removeCalendarEvent(calendarEvent);
                done();
            }
        })
        const calendarEvent = await sfu.addCalendarEvent(CALENDAR_EVENT);
        room = await sfu.createRoomFromEvent(calendarEvent);
        expect(room).toBeTruthy();
        expect(room.id()).toBe(sfu.user().pmi);
    });
});