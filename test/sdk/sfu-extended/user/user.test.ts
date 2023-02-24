import {TEST_USER_0, TEST_USER_1, UPDATED_PMI_SETTINGS, url} from "../../../util/constants";
import {connect, waitForUser} from "../../../util/utils";
import {SfuEvent, SfuExtended} from "../../../../src";
import {User, UserInfoError, SignUpStatus} from "../../../../src/sdk/constants";

describe("user", () => {
    let bob: SfuExtended;
    beforeEach(async () => {
        bob = await waitForUser();
    })
    afterEach(async () => {
        await bob.disconnect();
    })
    it("Should load user PMI settings", async () => {
        const pmiSettings = await bob.getUserPmiSettings();
        expect(pmiSettings).toBeTruthy();
    })
    it("Should update user PMI settings", async () => {
        const pmiSettings = await bob.getUserPmiSettings();
        expect(pmiSettings).toBeTruthy();
        await bob.updateUserPmiSettings(UPDATED_PMI_SETTINGS);
        const updatedSettings = await bob.getUserPmiSettings();
        expect(updatedSettings.pmiSettings.accessCode).toBe(UPDATED_PMI_SETTINGS.accessCode);
    });
    it("Should get user info", async () => {
        const info = await bob.getUserInfo();
        expect(bob.user().email).toEqual(info.email);
        expect(bob.user().nickname).toEqual(info.nickname);
    });
    it("Should change email", async () => {
        const newEmail = "newEmail@flashphoner.com";
        await bob.changeUserEmail(newEmail);
        expect(bob.user().email).toEqual(newEmail);
        await bob.changeUserEmail(TEST_USER_0.username);
        expect(bob.user().email).toEqual(TEST_USER_0.username);
    });
    it("Should reject when user is trying to use for changing email that already taken", async () => {
        await expect(bob.changeUserEmail(TEST_USER_1.username)).rejects.toHaveProperty("error", UserInfoError.EMAIL_ADDRESS_ALREADY_TAKEN)
    });
    it("Should change password and reconnect", async () => {
        const newPassword = "11111111";
        await bob.changeUserPassword(TEST_USER_0.password, newPassword);
        await bob.disconnect();

        const bobWithNewPass = await connect({username: TEST_USER_0.username, password: newPassword, nickname: TEST_USER_0.nickname});
        expect(bobWithNewPass.user().username).toEqual(TEST_USER_0.username);
        await bobWithNewPass.changeUserPassword(newPassword, TEST_USER_0.password);
        await bobWithNewPass.disconnect();
    });
    it("Should reject when user is trying to change password and entering incorrect current password", async () => {
        await expect(bob.changeUserPassword("123", "1111111")).rejects.toHaveProperty("error", UserInfoError.CURRENT_PASSWORD_IS_INCORRECT);
    });
    it("Should reject when user is trying to change password and new password is short", async () => {
        await expect(bob.changeUserPassword(TEST_USER_0.password, "11111")).rejects.toHaveProperty("error", UserInfoError.PASSWORD_POLICY_ERROR);
    });
    it("Should change nickname", async () => {
        const newNickname = "newNickname";
        await bob.changeUserNickname(newNickname);
        expect(bob.user().nickname).toEqual(newNickname);
        await bob.changeUserNickname(TEST_USER_0.nickname);
        expect(bob.user().nickname).toEqual(TEST_USER_0.nickname);
    });
    it("Should change phone number", async () => {
        const newPhoneNumber = "89999999999";
        await bob.changeUserPhoneNumber(newPhoneNumber);
        const userInfo = await bob.getUserInfo();
        expect(userInfo).toBeTruthy();
        expect(userInfo.phoneNumber).toEqual(newPhoneNumber);
        await bob.changeUserPhoneNumber("");
    });
    it("Should change host key", async () => {
        const newHostKey = "123123";
        await bob.changeUserHostKey(newHostKey);
        const userInfo = await bob.getUserInfo();
        expect(userInfo).toBeTruthy();
        expect(userInfo.hostKey).toEqual(newHostKey);
        await bob.changeUserHostKey("");
    });
    it("Should change timezone", async () => {
        const newTimezone = "Asia/Moscow, GMT +3:00";
        await bob.changeUserTimezone(newTimezone);
        const userInfo = await bob.getUserInfo();
        expect(userInfo).toBeTruthy();
        expect(userInfo.timezone).toEqual(newTimezone);
        await bob.changeUserTimezone("");
    });
    it("Should change user info and get it after reconnect", async () => {
        const newEmail = "newEmail@flashphoner.com";
        const newNickname = "newNickname";
        const newPhoneNumber = "89999999999";
        const newHostKey = "123123";
        const newTimezone = "Asia/Moscow, GMT +3:00";
        await bob.changeUserEmail(newEmail);
        await bob.changeUserNickname(newNickname);
        await bob.changeUserPhoneNumber(newPhoneNumber);
        await bob.changeUserHostKey(newHostKey);
        await bob.changeUserTimezone(newTimezone);
        await bob.disconnect();

        bob = await waitForUser();
        const userInfo = await bob.getUserInfo();
        expect(userInfo.email).toEqual(newEmail);
        expect(userInfo.nickname).toEqual(newNickname);
        expect(userInfo.phoneNumber).toEqual(newPhoneNumber);
        expect(userInfo.hostKey).toEqual(newHostKey);
        expect(userInfo.timezone).toEqual(newTimezone);

        await bob.changeUserEmail(TEST_USER_0.username);
        await bob.changeUserNickname(TEST_USER_0.nickname);
        await bob.changeUserPhoneNumber("");
        await bob.changeUserHostKey("");
        await bob.changeUserTimezone("");
    });
    describe("secondUser", () => {
        it("Second user should get user list with updated email of first user", async () => {
            const newEmail = "newEmail@flashphoner.com";
            await bob.changeUserEmail(newEmail);

            const alice = await connect(TEST_USER_1);
            const userList = await alice.getUserList();
            const bobUser = userList.find((user) => user.id === TEST_USER_0.username);
            expect(bobUser).toBeTruthy();
            expect(bobUser.email).toEqual(newEmail);
            await bob.changeUserEmail(TEST_USER_0.username);
            await alice.disconnect();
        });
        it("Second user should be notified after first user changed email", async () => {
            const newEmail = "newEmail@flashphoner.com";
            const alice = await connect(TEST_USER_1);

            function waitForSfuEvent(event: SfuEvent, sfu: SfuExtended) {
                return new Promise((resolve, reject) => {
                    sfu.on(event, function(msg) {
                        const user = msg as User;
                        if (user && user.id === TEST_USER_0.username && user.email === newEmail) {
                            resolve(event);
                        }
                    });
                });
            }

            const changePromise = bob.changeUserEmail(newEmail);
            await waitForSfuEvent(SfuEvent.CONTACT_UPDATE, alice);
            await changePromise;
            expect(bob.user().email).toEqual(newEmail);

            await bob.changeUserEmail(TEST_USER_0.username);
            await alice.disconnect();
        });
        it("Second user should get user list with updated nickname of first user", async () => {
            const newNickname = "newNickname";
            await bob.changeUserNickname(newNickname);

            const alice = await connect(TEST_USER_1);
            const userList = await alice.getUserList();
            const bobUser = userList.find((user) => user.id === TEST_USER_0.username);
            expect(bobUser).toBeTruthy();
            expect(bobUser.nickname).toEqual(newNickname);
            await bob.changeUserNickname(TEST_USER_0.nickname);
            await alice.disconnect();
        });
        it("Second user should be notified after first user changed nickname", async () => {
            const newNickname = "newNickname";
            const alice = await connect(TEST_USER_1);

            function waitForSfuEvent(event: SfuEvent, sfu: SfuExtended) {
                return new Promise((resolve, reject) => {
                    sfu.on(event, function(msg) {
                        const user = msg as User;
                        if (user.id === TEST_USER_0.username && user.nickname === newNickname) {
                            resolve(event);
                        }
                    });
                });
            }

            const changePromise = bob.changeUserNickname(newNickname);
            await waitForSfuEvent(SfuEvent.CONTACT_UPDATE, alice);
            await changePromise;
            expect(bob.user().nickname).toEqual(newNickname);

            await bob.changeUserNickname(TEST_USER_0.nickname);
            await alice.disconnect();
        });
    });
});