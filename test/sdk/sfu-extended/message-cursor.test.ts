import {
    AddedRemovedReactionOnMessage,
    InternalApi,
    Message,
    MessageCursorEvent,
    MessageDeleted,
    MessageEdited,
    MessageState,
    MessageTargetEntityId,
    MessageTargetEntityType,
    MessageType,
    SfuEvent
} from "../../../src/sdk/constants";

/**
 * Live events are parsed by SfuExtended itself, so the transport is replaced by a stub that hands the events
 * over directly. Nothing here needs a server: the point is the parsing, not the delivery.
 */
const mockConnection: {
    onMessage?: (name: string, data: Array<any>) => void,
    sent: Array<{ action: string, data: any }>
} = {sent: []};

jest.mock("../../../src/sdk/connection", () => ({
    Connection: class {
        constructor(onMessage: (name: string, data: Array<any>) => void) {
            mockConnection.onMessage = onMessage;
        }

        connect() {
            return Promise.resolve({
                sipLogin: "bob",
                email: "bob@flashphoner.com",
                sipVisibleName: "Bob",
                authToken: "token",
                pmi: "pmi"
            });
        }

        send(action: string, data: any) {
            mockConnection.sent.push({action, data});
        }

        close() {
            return Promise.resolve();
        }
    }
}));

import {SfuExtended} from "../../../src/sdk/sfu-extended";

const CHAT_ID = "chat-1";
const TARGET_ENTITY_ID: MessageTargetEntityId = {chatId: CHAT_ID};
const MESSAGE_ID = "m1";

const message = (id = MESSAGE_ID): Message => ({
    id,
    type: MessageType.REGULAR,
    targetEntityType: MessageTargetEntityType.CHAT,
    targetEntityId: TARGET_ENTITY_ID,
    date: 1,
    from: "alice",
    status: MessageState.FULL_DELIVERY_FULL_READ,
    body: "body",
    attachments: [],
    deliveryStatus: {},
    privateMessage: false,
    edited: false,
    dateOfEdit: 0,
    reactions: []
});

const event = (type: any, cursor: number | undefined, rest: object = {}) => ({
    type,
    roomId: "",
    internalMessageId: "not-a-pending-one",
    ...(cursor === undefined ? {} : {cursor}),
    ...rest
});

//the entity of a new message is in the message, the rest of the events carry it on their top level
const newMessage = (cursor?: number) => event(InternalApi.MESSAGE, cursor, {message: message()});
const messageSync = (cursor?: number) => event(SfuEvent.SEND_MESSAGE_SYNC, cursor, {message: message()});
const entity = {targetEntityType: MessageTargetEntityType.CHAT, targetEntityId: TARGET_ENTITY_ID};
const edited = (cursor?: number) => event(SfuEvent.CHAT_MESSAGE_EDITED, cursor, {...entity, message: message()});
const deleted = (cursor?: number) => event(SfuEvent.CHAT_MESSAGE_DELETED, cursor, {
    ...entity,
    messageId: MESSAGE_ID,
    state: MessageState.DELETED
});
const reaction = (type: SfuEvent, cursor?: number) => event(type, cursor, {
    ...entity,
    messageId: MESSAGE_ID,
    reactedUser: "alice",
    reaction: "👍"
});
//an own send and an own edit are answered with a state, the entity of the change lives in that state
const messageState = (cursor?: number) => event(InternalApi.MESSAGE_STATE, cursor, {
    status: {
        id: MESSAGE_ID,
        ...entity,
        delivered: true,
        state: MessageState.FULL_DELIVERY_FULL_READ,
        date: 1
    },
    waitingUploadingAttachments: false
});

describe("message cursor", () => {
    let sfu: SfuExtended;
    let cursors: Array<MessageCursorEvent>;

    const dispatch = (live: object) => mockConnection.onMessage(InternalApi.DEFAULT_METHOD, [live]);

    beforeEach(async () => {
        mockConnection.sent = [];
        sfu = new SfuExtended();
        await sfu.connect({url: "wss://localhost:8888", username: "bob", password: "password"});
        cursors = [];
        sfu.on(SfuEvent.MESSAGE_CURSOR, (arg) => cursors.push(arg as MessageCursorEvent));
    });

    describe("emitting", () => {
        it("Should emit a cursor of a new message", () => {
            dispatch(newMessage(44));

            expect(cursors.length).toEqual(1);
            expect(cursors[0].targetEntityType).toEqual(MessageTargetEntityType.CHAT);
            expect(cursors[0].targetEntityId).toEqual(TARGET_ENTITY_ID);
            expect(cursors[0].messageId).toEqual(MESSAGE_ID);
            expect(cursors[0].cursor).toEqual(44);
            expect(cursors[0].sourceEvent).toEqual(SfuEvent.MESSAGE);
        });

        it("Should emit a cursor of a message sent from another device", () => {
            dispatch(messageSync(45));

            expect(cursors.length).toEqual(1);
            expect(cursors[0].targetEntityId).toEqual(TARGET_ENTITY_ID);
            expect(cursors[0].messageId).toEqual(MESSAGE_ID);
            expect(cursors[0].cursor).toEqual(45);
            expect(cursors[0].sourceEvent).toEqual(SfuEvent.SEND_MESSAGE_SYNC);
        });

        it("Should emit a cursor of an edit", () => {
            dispatch(edited(43));

            expect(cursors.length).toEqual(1);
            expect(cursors[0].targetEntityId).toEqual(TARGET_ENTITY_ID);
            expect(cursors[0].messageId).toEqual(MESSAGE_ID);
            expect(cursors[0].cursor).toEqual(43);
            expect(cursors[0].sourceEvent).toEqual(SfuEvent.CHAT_MESSAGE_EDITED);
        });

        it("Should emit a cursor of a deletion", () => {
            dispatch(deleted(46));

            expect(cursors.length).toEqual(1);
            expect(cursors[0].messageId).toEqual(MESSAGE_ID);
            expect(cursors[0].cursor).toEqual(46);
            expect(cursors[0].sourceEvent).toEqual(SfuEvent.CHAT_MESSAGE_DELETED);
        });

        it("Should emit a cursor of an added reaction", () => {
            dispatch(reaction(SfuEvent.REACTION_ON_MESSAGE_ADDED, 47));

            expect(cursors.length).toEqual(1);
            expect(cursors[0].messageId).toEqual(MESSAGE_ID);
            expect(cursors[0].cursor).toEqual(47);
            expect(cursors[0].sourceEvent).toEqual(SfuEvent.REACTION_ON_MESSAGE_ADDED);
        });

        it("Should emit a cursor of a removed reaction", () => {
            dispatch(reaction(SfuEvent.REACTION_ON_MESSAGE_REMOVED, 48));

            expect(cursors.length).toEqual(1);
            expect(cursors[0].messageId).toEqual(MESSAGE_ID);
            expect(cursors[0].cursor).toEqual(48);
            expect(cursors[0].sourceEvent).toEqual(SfuEvent.REACTION_ON_MESSAGE_REMOVED);
        });

        it("Should emit a cursor of an own send or edit", () => {
            //the answer to an own sendMessage and editMessage comes back as a state rather than as the change itself
            dispatch(messageState(49));

            expect(cursors.length).toEqual(1);
            expect(cursors[0].targetEntityType).toEqual(MessageTargetEntityType.CHAT);
            expect(cursors[0].targetEntityId).toEqual(TARGET_ENTITY_ID);
            expect(cursors[0].messageId).toEqual(MESSAGE_ID);
            expect(cursors[0].cursor).toEqual(49);
            expect(cursors[0].sourceEvent).toEqual(SfuEvent.MESSAGE_STATE);
        });

        it("Should not emit a cursor of a state that carries no journal record", () => {
            //a state of anything the server did not journal, a delivery status among them
            dispatch(messageState());
            dispatch(messageState(0));

            expect(cursors.length).toEqual(0);
        });

        it("Should not emit a cursor when the change was not journaled", () => {
            //0 is what the server sends when writing the journal record failed, or the storage has no journal
            dispatch(newMessage(0));
            dispatch(edited(0));
            dispatch(deleted(0));
            dispatch(reaction(SfuEvent.REACTION_ON_MESSAGE_ADDED, 0));

            expect(cursors.length).toEqual(0);
        });

        it("Should not emit a cursor for an event of an older server", () => {
            dispatch(newMessage());
            dispatch(messageSync());
            dispatch(edited());
            dispatch(deleted());
            dispatch(reaction(SfuEvent.REACTION_ON_MESSAGE_REMOVED));

            expect(cursors.length).toEqual(0);
        });

        it("Should not emit a cursor for an event that carries no journal record", () => {
            //statuses are not journaled at all, whatever else they carry
            dispatch(event(SfuEvent.LAST_READ_MESSAGE_UPDATED, 49, {
                ...entity,
                updateInfo: {oldLastReadMessageDate: 0, lastReadMessageDate: 1, lastReadMessageId: MESSAGE_ID}
            }));

            expect(cursors.length).toEqual(0);
        });
    });

    describe("existing payloads", () => {
        it("Should keep delivering a Message to the subscribers of MESSAGE", () => {
            const delivered: Array<Message> = [];
            sfu.on(SfuEvent.MESSAGE, (arg) => delivered.push(arg as Message));

            dispatch(newMessage(44));

            expect(delivered.length).toEqual(1);
            expect(delivered[0].id).toEqual(MESSAGE_ID);
            expect(delivered[0].body).toEqual("body");
            //the cursor stays out of the message, it belongs to the journal and not to the cache
            expect((delivered[0] as any).cursor).toBeUndefined();
        });

        it("Should keep delivering a Message to the subscribers of SEND_MESSAGE_SYNC", () => {
            const delivered: Array<Message> = [];
            sfu.on(SfuEvent.SEND_MESSAGE_SYNC, (arg) => delivered.push(arg as Message));

            dispatch(messageSync(45));

            expect(delivered.length).toEqual(1);
            expect(delivered[0].id).toEqual(MESSAGE_ID);
        });

        it("Should keep delivering the whole event to the subscribers of the changes", () => {
            const edits: Array<MessageEdited> = [];
            const deletions: Array<MessageDeleted> = [];
            const reactions: Array<AddedRemovedReactionOnMessage> = [];
            sfu.on(SfuEvent.CHAT_MESSAGE_EDITED, (arg) => edits.push(arg as MessageEdited));
            sfu.on(SfuEvent.CHAT_MESSAGE_DELETED, (arg) => deletions.push(arg as MessageDeleted));
            sfu.on(SfuEvent.REACTION_ON_MESSAGE_ADDED, (arg) => reactions.push(arg as AddedRemovedReactionOnMessage));

            dispatch(edited(43));
            dispatch(deleted(46));
            dispatch(reaction(SfuEvent.REACTION_ON_MESSAGE_ADDED, 47));

            expect(edits.length).toEqual(1);
            expect(edits[0].message.id).toEqual(MESSAGE_ID);
            expect(deletions.length).toEqual(1);
            expect(deletions[0].messageId).toEqual(MESSAGE_ID);
            expect(reactions.length).toEqual(1);
            expect(reactions[0].messageId).toEqual(MESSAGE_ID);
        });
    });

    describe("own changes", () => {
        /**
         * An event answering an own request goes to the pending promise and never reaches the subscribers,
         * so hanging the cursor on a subscription would miss every change the user makes in their own chats.
         */
        it("Should emit a cursor of an own edit and still resolve the pending promise", async () => {
            const notified: Array<MessageEdited> = [];
            sfu.on(SfuEvent.CHAT_MESSAGE_EDITED, (arg) => notified.push(arg as MessageEdited));

            const pending = sfu.editMessage({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: TARGET_ENTITY_ID,
                messageId: MESSAGE_ID,
                body: "edited body"
            });
            const request = mockConnection.sent[mockConnection.sent.length - 1];
            expect(request.action).toEqual(InternalApi.EDIT_MESSAGE);

            dispatch({...edited(43), internalMessageId: request.data.internalMessageId});

            await expect(pending).resolves.toBeTruthy();
            expect(cursors.length).toEqual(1);
            expect(cursors[0].cursor).toEqual(43);
            //the payload of the event went to the caller of editMessage, not to the subscribers
            expect(notified.length).toEqual(0);
        });

        it("Should emit a cursor of an own reaction and still resolve the pending promise", async () => {
            const notified: Array<AddedRemovedReactionOnMessage> = [];
            sfu.on(SfuEvent.REACTION_ON_MESSAGE_ADDED, (arg) => notified.push(arg as AddedRemovedReactionOnMessage));

            const pending = sfu.addReactionOnMessage({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: TARGET_ENTITY_ID,
                messageId: MESSAGE_ID,
                reaction: "👍"
            });
            const request = mockConnection.sent[mockConnection.sent.length - 1];

            dispatch({
                ...reaction(SfuEvent.REACTION_ON_MESSAGE_ADDED, 47),
                internalMessageId: request.data.internalMessageId
            });

            await expect(pending).resolves.toBeTruthy();
            expect(cursors.length).toEqual(1);
            expect(cursors[0].cursor).toEqual(47);
            expect(notified.length).toEqual(0);
        });

        it("Should emit a cursor of an own deletion and still resolve the pending promise", async () => {
            const notified: Array<MessageDeleted> = [];
            sfu.on(SfuEvent.CHAT_MESSAGE_DELETED, (arg) => notified.push(arg as MessageDeleted));

            const pending = sfu.deleteMessage({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: TARGET_ENTITY_ID,
                messageId: MESSAGE_ID
            });
            const request = mockConnection.sent[mockConnection.sent.length - 1];

            dispatch({...deleted(46), internalMessageId: request.data.internalMessageId});

            await expect(pending).resolves.toBeTruthy();
            expect(cursors.length).toEqual(1);
            expect(cursors[0].cursor).toEqual(46);
            expect(notified.length).toEqual(0);
        });
    });
});
