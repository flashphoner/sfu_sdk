import {TEST_USER_0, TEST_USER_1, UPDATED_PMI_SETTINGS, url} from "../../../util/constants";
import {connect, waitForUser} from "../../../util/utils";
import {SfuExtended} from "../../../../src";
import {UserInfoError} from "../../../../src/sdk/constants";

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
        await bob.changeUserEmail(TEST_USER_0.email);
        expect(bob.user().email).toEqual(TEST_USER_0.email);
    });
    it("Should reject when user is trying to use for changing email that already taken", async () => {
        await expect(bob.changeUserEmail(TEST_USER_1.username)).rejects.toHaveProperty("error", UserInfoError.EMAIL_ADDRESS_ALREADY_TAKEN)
    });
    it("Should change password and reconnect", async () => {
        const newPassword = "11111111";
        await bob.changeUserPassword(TEST_USER_0.password, newPassword);
        await bob.disconnect();

        const bobWithNewPass = await connect({username: TEST_USER_0.username, email: TEST_USER_0.email, password: newPassword, nickname: TEST_USER_0.nickname});
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

        bob = await connect({
            email: newEmail,
            password: TEST_USER_0.password,
            nickname: TEST_USER_0.nickname
        });
        const userInfo = await bob.getUserInfo();
        expect(userInfo.email).toEqual(newEmail);
        expect(userInfo.nickname).toEqual(newNickname);
        expect(userInfo.phoneNumber).toEqual(newPhoneNumber);
        expect(userInfo.hostKey).toEqual(newHostKey);
        expect(userInfo.timezone).toEqual(newTimezone);

        await bob.changeUserEmail(TEST_USER_0.email);
        await bob.changeUserNickname(TEST_USER_0.nickname);
        await bob.changeUserPhoneNumber("");
        await bob.changeUserHostKey("");
        await bob.changeUserTimezone("");
    });
});
