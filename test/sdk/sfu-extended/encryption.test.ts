import {v4 as uuidv4} from 'uuid';
import {SfuEvent, SfuExtended} from "../../../src";
import {connect, waitForUsers} from "../../util/utils";
import {
    decryptPrivateKey,
    decryptWithPrivateKey,
    encryptPrivateKey,
    encryptWithPublicKey,
    generateAESKey,
    generateKeyPair
} from "../../util/encryption";
import {
    ChatError,
    ChatType,
    ContactUpdated, UserEncryptionInfoEvent,
    UserSpecificChatInfo
} from "../../../src/sdk/constants";
import {MASTER_PASSWORD_HASH, TEST_USER_0, TEST_USER_1} from "../../util/constants";

describe("encryption", () => {
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
    describe("user", () => {
        it('should add user encryption keys', async () => {
            const keyPair = await generateKeyPair();
            const info = await bob.addUserEncryptionInfo({
                privateKey: keyPair.privateKey,
                publicKey: keyPair.publicKey,
                verificationHash: MASTER_PASSWORD_HASH
            });
            expect(info.privateKey).toEqual(keyPair.privateKey);
            expect(info.publicKey).toEqual(keyPair.publicKey);
            expect(info.encryptionEnabled).toBeTruthy();
        });
        it('should get user encryption keys', async () => {
            const keyPair = await generateKeyPair();
            await bob.addUserEncryptionInfo({
                privateKey: keyPair.privateKey,
                publicKey: keyPair.publicKey,
                verificationHash: MASTER_PASSWORD_HASH
            });
            const info = await bob.getUserEncryptionInfo();
            expect(info.privateKey).toEqual(keyPair.privateKey);
            expect(info.publicKey).toEqual(keyPair.publicKey);
            expect(info.encryptionEnabled).toBeTruthy();
        });
    });
    describe("chat", () => {
        it("Should create encrypted chat", async () => {
            const bobKeyPair = await generateKeyPair();
            const aliceKeyPair = await generateKeyPair();
            const chatKeyPair = await generateKeyPair();
            const chatPassword = uuidv4();
            const encryptedChatPrivateKey = await encryptPrivateKey(chatKeyPair.privateKey, chatPassword);
            const bobEncryptedChatPassword = await encryptWithPublicKey(bobKeyPair.publicKey, chatPassword);
            const aliceEncryptedChatPassword = await encryptWithPublicKey(aliceKeyPair.publicKey, chatPassword);
            const encryptedChatPasswords = [];
            encryptedChatPasswords.push({
                userId: bob.user().username,
                password: bobEncryptedChatPassword
            });
            encryptedChatPasswords.push({
                userId: alice.user().username,
                password: aliceEncryptedChatPassword
            });

            const attachmentsKey = await generateAESKey();

            const chat = await bob.createChat({
                isEncryptionEnabled: true,
                publicKey: chatKeyPair.publicKey,
                encryptedPrivateKey: encryptedChatPrivateKey,
                encryptedChatPasswords,
                encryptedAttachmentsSecretKey: attachmentsKey
            });
            expect(chat).toBeTruthy();
            expect(chat.encryptionEnabled).toBeTruthy();
            expect(chat.publicKey).toEqual(chatKeyPair.publicKey);
            expect(chat.encryptedPrivateKey).toEqual(encryptedChatPrivateKey);
            expect(chat.encryptedAttachmentsSecretKey).toEqual(attachmentsKey);

            const decryptedBobChatPassword = await decryptWithPrivateKey(bobKeyPair.privateKey, chat.encryptedChatPassword);
            expect(chatPassword).toEqual(decryptedBobChatPassword);
            const decryptedChatPrivateKey = await decryptPrivateKey(chat.encryptedPrivateKey, decryptedBobChatPassword);
            expect(decryptedChatPrivateKey).toEqual(chatKeyPair.privateKey);

            const aliceChats = await alice.getUserChats();
            const aliceChat = await aliceChats[chat.id];
            expect(aliceChat).toBeTruthy();
            const decryptedAliceChatPassword = await decryptWithPrivateKey(aliceKeyPair.privateKey, aliceChat.encryptedChatPassword);
            expect(decryptedAliceChatPassword).toEqual(chatPassword);

            await bob.deleteChat(chat);
        });
        it("Should receive error when trying to create encrypted chat without keys", async () => {
            await expect(bob.createChat({
                isEncryptionEnabled: true
            })).rejects.toHaveProperty("error", ChatError.INCORRECT_CHAT_ENCRYPTION_SETTINGS);
        });
        it("Should add member to encrypted chat", async () => {
            const bobKeyPair = await generateKeyPair();
            const aliceKeyPair = await generateKeyPair();
            const chatKeyPair = await generateKeyPair();
            const chatPassword = uuidv4();
            const encryptedChatPrivateKey = await encryptPrivateKey(chatKeyPair.privateKey, chatPassword);
            const bobEncryptedChatPassword = await encryptWithPublicKey(bobKeyPair.publicKey, chatPassword);
            const aliceEncryptedChatPassword = await encryptWithPublicKey(aliceKeyPair.publicKey, chatPassword);
            const encryptedChatPasswords = [
                {
                    userId: bob.user().username,
                    password: bobEncryptedChatPassword
                }
            ];

            const attachmentsKey = await generateAESKey();

            let chat = await bob.createChat({
                type: ChatType.PUBLIC,
                isEncryptionEnabled: true,
                publicKey: chatKeyPair.publicKey,
                encryptedPrivateKey: encryptedChatPrivateKey,
                encryptedChatPasswords,
                encryptedAttachmentsSecretKey: attachmentsKey
            });

            chat = await bob.addMemberToChat({
                id: chat.id,
                member: TEST_USER_1.username,
                encryptedChatPassword: aliceEncryptedChatPassword
            });
            expect(chat.members).toContain(TEST_USER_1.username);

            await bob.deleteChat(chat);
        });
        it("user should be notified when added to encrypted chat", async () => {
            const bobKeyPair = await generateKeyPair();
            const aliceKeyPair = await generateKeyPair();
            const chatKeyPair = await generateKeyPair();
            const chatPassword = uuidv4();
            const encryptedChatPrivateKey = await encryptPrivateKey(chatKeyPair.privateKey, chatPassword);
            const bobEncryptedChatPassword = await encryptWithPublicKey(bobKeyPair.publicKey, chatPassword);
            const aliceEncryptedChatPassword = await encryptWithPublicKey(aliceKeyPair.publicKey, chatPassword);
            const encryptedChatPasswords = [
                {
                    userId: bob.user().username,
                    password: bobEncryptedChatPassword
                }
            ];
            const attachmentsKey = await generateAESKey();

            let chat = await bob.createChat({
                type: ChatType.PUBLIC,
                isEncryptionEnabled: true,
                publicKey: chatKeyPair.publicKey,
                encryptedPrivateKey: encryptedChatPrivateKey,
                encryptedChatPasswords,
                encryptedAttachmentsSecretKey: attachmentsKey
            });

            const waitNewChatEvent = (): Promise<void> => {
                return new Promise<void>((resolve) => {
                    alice.on(SfuEvent.NEW_CHAT, async (msg) => {
                        const chatInfo = msg as UserSpecificChatInfo;
                        expect(chatInfo.encryptionEnabled).toBeTruthy();
                        expect(chatInfo.publicKey).toEqual(chatKeyPair.publicKey);
                        const decryptedAliceChatPassword = await decryptWithPrivateKey(aliceKeyPair.privateKey, chatInfo.encryptedChatPassword);
                        expect(decryptedAliceChatPassword).toEqual(chatPassword);
                        const decryptedChatPrivateKey = await decryptPrivateKey(chatInfo.encryptedPrivateKey, decryptedAliceChatPassword);
                        expect(decryptedChatPrivateKey).toEqual(chatKeyPair.privateKey);
                        resolve();
                    })
                })
            }

            bob.addMemberToChat({
                id: chat.id,
                member: TEST_USER_1.username,
                encryptedChatPassword: aliceEncryptedChatPassword
            });
            await waitNewChatEvent();

            await bob.deleteChat(chat);
        });
    });
    describe("contacts", () => {
        let bobKeyPair;
        let aliceKeyPair;
        beforeEach(async () => {
            bobKeyPair = await generateKeyPair();
            aliceKeyPair = await generateKeyPair();
            await bob.addUserEncryptionInfo({
                publicKey: bobKeyPair.publicKey,
                privateKey: bobKeyPair.privateKey,
                verificationHash: MASTER_PASSWORD_HASH
            });
            await alice.addUserEncryptionInfo({
                publicKey: aliceKeyPair.publicKey,
                privateKey: aliceKeyPair.privateKey,
                verificationHash: MASTER_PASSWORD_HASH
            });
        })
        it('should receive friend public key', async () => {
            await bob.addFriend({userId: TEST_USER_1.username});

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.incomingFriendInvites.length).toBe(1);
            const incomingInvite = aliceContacts.incomingFriendInvites[0];

            const friend = await alice.acceptFriendInvite({inviteId: incomingInvite.inviteId});
            expect(friend.userId).toEqual(bob.user().username);
            expect(friend.nickname).toEqual(bob.user().nickname);
            expect(friend.publicKey).toEqual(bobKeyPair.publicKey);
            expect(friend.encryptionEnabled).toBeTruthy();

            await bob.removeFriend({userId: TEST_USER_1.username});
        });
        it('contact should be notified when user added encryption keys', async () => {
            await bob.addFriend({userId: TEST_USER_1.username});

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.incomingFriendInvites.length).toBe(1);
            const incomingInvite = aliceContacts.incomingFriendInvites[0];

            await alice.acceptFriendInvite({inviteId: incomingInvite.inviteId});

            const keyPair = await generateKeyPair();

            const waitContactUpdatedEvent = (): Promise<void> => {
                return new Promise<void>((resolve) => {
                    bob.on(SfuEvent.CONTACT_UPDATED, async (msg) => {
                       const event = msg as ContactUpdated;
                       expect(event.contact.publicKey).toEqual(keyPair.publicKey);
                       expect(event.contact.encryptionEnabled).toBeTruthy();
                       resolve();
                    });
                })
            }
            alice.addUserEncryptionInfo({
                privateKey: keyPair.privateKey,
                publicKey: keyPair.publicKey,
                verificationHash: MASTER_PASSWORD_HASH
            });
            await waitContactUpdatedEvent();

            await bob.removeFriend({userId: TEST_USER_1.username});
        });
    });
    describe("multiple-sync", () => {
        let bobSecondInstance: SfuExtended;
        beforeEach(async () => {
            bobSecondInstance = await connect(TEST_USER_0);
        });
        afterEach(async () => {
            await bobSecondInstance.disconnect();
        })
        it('second instance should be notified when user added encryption keys from first instance', async () => {
            const keyPair = await generateKeyPair();
            const waitEvent = (): Promise<void> => {
                return new Promise<void>((resolve) => {
                   bobSecondInstance.on(SfuEvent.USER_ENCRYPTION_INFO_ADDED, async (msg) => {
                      const event = msg as UserEncryptionInfoEvent;
                      expect(event.info.publicKey).toEqual(keyPair.publicKey);
                      expect(event.info.privateKey).toEqual(keyPair.privateKey);
                      resolve();
                   });
                });
            }
            bob.addUserEncryptionInfo({
                privateKey: keyPair.privateKey,
                publicKey: keyPair.publicKey,
                verificationHash: MASTER_PASSWORD_HASH
            });
            await waitEvent();
        });
    });
});
