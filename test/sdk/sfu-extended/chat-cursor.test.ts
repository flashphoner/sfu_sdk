import {SfuExtended} from "../../../src";
import {waitForUsers} from "../../util/utils";
import {TEST_USER_1} from "../../util/constants";
import {MessageTargetEntityType, SfuEvent, UserSpecificChatInfo} from "../../../src/sdk/constants";

describe("chat cursor", () => {
    let bob: SfuExtended;
    let alice: SfuExtended;
    let chat: UserSpecificChatInfo;

    const inChat = () => ({
        targetEntityType: MessageTargetEntityType.CHAT,
        targetEntityId: {chatId: chat.id}
    });

    const summaryCursor = async () => {
        const summary = await bob.getChatsSyncSummary();
        return summary.cursors.find((cursor) => cursor.targetEntityId && cursor.targetEntityId.chatId === chat.id).currentCursor;
    };

    beforeEach(async () => {
        const users = await waitForUsers();
        bob = users.bob;
        alice = users.alice;
        chat = await bob.createChat({members: [TEST_USER_1.username]});
    });

    afterEach(async () => {
        try {
            await bob.deleteChat({id: chat.id});
        } catch (e) {
        }
        await bob.disconnect();
        await alice.disconnect();
    });

    it("should return the cursor the summary reports", async () => {
        await bob.sendMessage({...inChat(), body: "first"});

        const cursor = await bob.getChatCursor(inChat());

        expect(cursor.type).toEqual(SfuEvent.CHAT_CURSOR);
        expect(cursor.targetEntityType).toEqual(MessageTargetEntityType.CHAT);
        expect(cursor.targetEntityId.chatId).toEqual(chat.id);
        expect(cursor.currentCursor).toBeGreaterThan(0);
        expect(cursor.currentCursor).toEqual(await summaryCursor());
    });

    it("should move forward with every change", async () => {
        await bob.sendMessage({...inChat(), body: "first"});
        const before = await bob.getChatCursor(inChat());

        await bob.sendMessage({...inChat(), body: "second"});
        const after = await bob.getChatCursor(inChat());

        expect(after.currentCursor).toBeGreaterThan(before.currentCursor);
    });

    it("should reject a request without an entity", async () => {
        await expect(bob.getChatCursor({
            targetEntityType: MessageTargetEntityType.CHAT,
            targetEntityId: undefined
        })).rejects.toBeTruthy();
    });
});
