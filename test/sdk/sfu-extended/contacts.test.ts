import {TEST_EMAIL_INVITE, TEST_USER_0, TEST_USER_1} from "../../util/constants";
import {ContactError, Invite, SfuEvent, User} from "../../../src/sdk/constants";
import {SfuExtended} from "../../../src";
import {waitForUsers} from "../../util/utils";

describe("contacts", () => {
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
    it("Should load contacts", async () => {
        const list = await bob.getUserList();
        expect(list.length).toBeGreaterThan(0);
        const user = list[0];
        expect(user.id).toBeTruthy();
    });
    it("Should invite contact", async () => {
        const list = await bob.getUserList();
        const user = list.find((user) => user.id === TEST_USER_1.username);
        const invitedUser = await bob.inviteContact({to: user.id});
        expect(invitedUser.invite).toBeTruthy();
        expect(invitedUser.invite.id).toBeTruthy();
        expect(invitedUser.invite.from).toEqual(TEST_USER_0.username);
        expect(invitedUser.invite.to).toEqual(user.id);
        await bob.removeContact({id: user.id});
    });
    it("Should fail on user self-invitation", async () => {
        await expect(bob.inviteContact({to: TEST_USER_0.username})).rejects.toHaveProperty("error", ContactError.USER_CAN_NOT_SEND_INVITE_TO_HIMSELF);
    });
    it("Should remove contact", async () => {
        const list = await bob.getUserList();
        const user = list.find(user => user.id === TEST_USER_1.username);
        const invitedUser = await bob.inviteContact({to: user.id});
        expect(invitedUser.id).toEqual(user.id);
        expect(invitedUser.invite).toBeTruthy();
        const removedUser = await bob.removeContact({id: user.id});
        expect(removedUser.id).toEqual(user.id);
        expect(removedUser.invite).toBeFalsy();
        const freshList = await bob.getUserList();
        const freshUser = list.find(user => user.id === TEST_USER_1.username);
        expect(freshUser.id).toEqual(user.id);
        expect(freshUser.invite).toBeFalsy();
    });
    it("Should invite non existent contact", async () => {
        const list = await bob.getUserList();
        const invitedUser = await bob.inviteContact({to: TEST_EMAIL_INVITE});
        expect(invitedUser.email).toEqual(TEST_EMAIL_INVITE);
        expect(invitedUser.invite).toBeTruthy();
        expect(invitedUser.invite.id).toBeTruthy();
        expect(invitedUser.invite.from).toEqual(TEST_USER_0.username);
        expect(invitedUser.invite.to).toEqual(TEST_EMAIL_INVITE);
        await bob.removeContact({id: TEST_EMAIL_INVITE});
    });
    describe("notifications", () => {
        test("Invited contact should receive invite", async (done) => {
            alice.on(SfuEvent.CONTACT_INVITE, async (msg) => {
                const invite = msg as Invite;
                await bob.removeContact({id: TEST_USER_1.username});
                done();
            });
            await bob.inviteContact({to: TEST_USER_1.username});
        });
        test("Invited contact should confirm invite", async (done) => {
            alice.on(SfuEvent.CONTACT_INVITE, async (msg) => {
                const invite = msg as Invite;
                alice.confirmContact(invite);
            });
            bob.on(SfuEvent.CONTACT_UPDATE, async (msg) => {
                const user = msg as User;
                expect(user.confirmed).toEqual(true);
                expect(user.id).toEqual(TEST_USER_1.username);
                await bob.removeContact(user);
                done();
            })
            await bob.inviteContact({to: TEST_USER_1.username});
        });
        test("Should be able to add contact to favourites", async (done) => {
            alice.on(SfuEvent.CONTACT_INVITE, async (msg) => {
                const invite = msg as Invite;
                await alice.confirmContact(invite);
            });
            bob.on(SfuEvent.CONTACT_UPDATE, async (msg) => {
                const user = msg as User;
                const userState = await bob.addContactToFavourites(user);
                expect(userState).toBeTruthy();
                expect(userState.favourite).toBeTruthy();
                await bob.removeContact(user);
                done();
            })
            await bob.inviteContact({to: TEST_USER_1.username});
        });
        test("Should be able to remove contact from favourites", async (done) => {
            alice.on(SfuEvent.CONTACT_INVITE, async (msg) => {
                const invite = msg as Invite;
                await alice.confirmContact(invite);
            });
            bob.on(SfuEvent.CONTACT_UPDATE, async (msg) => {
                const user = msg as User;
                let userState = await bob.addContactToFavourites(user);
                expect(userState).toBeTruthy();
                expect(userState.favourite).toBeTruthy();
                userState = await bob.removeContactFromFavourites(user);
                expect(userState).toBeTruthy();
                expect(userState.favourite).toBeFalsy();
                await bob.removeContact(user);
                done();
            })
            await bob.inviteContact({to: TEST_USER_1.username});
        });
    });
});