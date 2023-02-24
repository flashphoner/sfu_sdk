import {SfuEvent, SfuExtended} from "../../../../src";
import {TEST_SIGN_UP_USER_1, TEST_SIGN_UP_USER_2, TEST_USER_0, url} from "../../../util/constants";
import {SignUpStatus, UserManagementError, UserState} from "../../../../src/sdk/constants";
import {waitForUser} from "../../../util/utils";

describe("management", () => {

    const sfu = new SfuExtended();

    it('should sign up', async () => {
        const waitStatus = () => {
            return new Promise<SignUpStatus>((resolve) => {
                sfu.on(SfuEvent.SIGN_UP_STATUS, (msg) => {
                   const status = msg as SignUpStatus;
                   if (status.id === TEST_SIGN_UP_USER_1.email) {
                       resolve(status);
                   }
                });
            });
        }

        expect(sfu.signUp({
            url: url,
            ...TEST_SIGN_UP_USER_1
        })).rejects.toEqual(new Error(UserManagementError.OPERATION_FAILED_BY_DISCONNECT));
        await waitStatus();
        const sfu1 = await waitForUser();
        let userList = await sfu1.getUserList();
        let newUser = userList.find((user) => user.id === TEST_SIGN_UP_USER_1.email);
        expect(newUser).toBeTruthy();
        expect(newUser.state).toBe(UserState.PENDING_REGISTRATION);
        await sfu.removeUser({url: url, id: TEST_SIGN_UP_USER_1.email});
        userList = await sfu1.getUserList();
        newUser = userList.find((user) => user.id === TEST_SIGN_UP_USER_1.email);
        expect(newUser).toBeFalsy();
        await sfu1.disconnect();
    });
    it('two users should sign up', async () => {
        const waitStatus = (email: string) => {
            return new Promise<SignUpStatus>((resolve) => {
                sfu.on(SfuEvent.SIGN_UP_STATUS, (msg) => {
                    const status = msg as SignUpStatus;
                    if (status.id === email) {
                        resolve(status);
                    }
                });
            });
        }

        expect(sfu.signUp({
            url: url,
            ...TEST_SIGN_UP_USER_1
        })).rejects.toEqual(new Error(UserManagementError.EMAIL_IS_NOT_VERIFIED));
        await waitStatus(TEST_SIGN_UP_USER_1.email);
        expect(sfu.signUp({
            url: url,
            ...TEST_SIGN_UP_USER_2
        })).rejects.toEqual(new Error(UserManagementError.OPERATION_FAILED_BY_DISCONNECT));
        await waitStatus(TEST_SIGN_UP_USER_2.email);
        const sfu1 = await waitForUser();
        let userList = await sfu1.getUserList();
        let newUser1 = userList.find((user) => user.id === TEST_SIGN_UP_USER_1.email);
        let newUser2 = userList.find((user) => user.id === TEST_SIGN_UP_USER_2.email);
        expect(newUser1).toBeTruthy();
        expect(newUser1.state).toBe(UserState.PENDING_REGISTRATION);
        expect(newUser2).toBeTruthy();
        expect(newUser2.state).toBe(UserState.PENDING_REGISTRATION);
        await sfu.removeUser({url: url, id: TEST_SIGN_UP_USER_1.email});
        await sfu.removeUser({url: url, id: TEST_SIGN_UP_USER_2.email});
        userList = await sfu1.getUserList();
        newUser1 = userList.find((user) => user.id === TEST_SIGN_UP_USER_1.email);
        newUser2 = userList.find((user) => user.id === TEST_SIGN_UP_USER_2.email);
        expect(newUser1).toBeFalsy();
        expect(newUser2).toBeFalsy();
        await sfu1.disconnect();
    });
    it('should reject when user is signing up with email that already taken', async () => {
        await expect(sfu.signUp({
            url: url,
            email: TEST_USER_0.username,
            password: TEST_USER_0.password
        })).rejects.toHaveProperty("error", UserManagementError.EMAIL_ADDRESS_ALREADY_TAKEN);
    });
});