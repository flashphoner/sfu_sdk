import {SfuEvent, SfuExtended} from "../../../../src";
import {TEST_SIGN_UP_USER_1, TEST_SIGN_UP_USER_2, TEST_USER_1, url} from "../../../util/constants";
import {SignUpStatus, UserManagementError} from "../../../../src/sdk/constants";
import {connect} from "../../../util/utils";

describe("management", () => {

    const sfu = new SfuExtended();

    describe("signUp", () => {
        it('should sign up', async () => {
            const waitStatus = () => {
                return new Promise<SignUpStatus>((resolve) => {
                    sfu.on(SfuEvent.SIGN_UP_STATUS, (msg) => {
                        const status = msg as SignUpStatus;
                        if (status.email === TEST_SIGN_UP_USER_1.email && status.id === TEST_SIGN_UP_USER_1.username) {
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
            await sfu.removeUser({url: url, id: TEST_SIGN_UP_USER_1.username});
        });
        it('two users should sign up', async () => {
            const waitStatus = (email: string, username: string) => {
                return new Promise<SignUpStatus>((resolve) => {
                    sfu.on(SfuEvent.SIGN_UP_STATUS, (msg) => {
                        const status = msg as SignUpStatus;
                        if (status.email === email && status.id === username) {
                            resolve(status);
                        }
                    });
                });
            }

            expect(sfu.signUp({
                url: url,
                ...TEST_SIGN_UP_USER_1
            })).rejects.toEqual(new Error(UserManagementError.EMAIL_IS_NOT_VERIFIED));
            await waitStatus(TEST_SIGN_UP_USER_1.email, TEST_SIGN_UP_USER_1.username);
            expect(sfu.signUp({
                url: url,
                ...TEST_SIGN_UP_USER_2
            })).rejects.toEqual(new Error(UserManagementError.OPERATION_FAILED_BY_DISCONNECT));
            await waitStatus(TEST_SIGN_UP_USER_2.email, TEST_SIGN_UP_USER_2.username);
            await sfu.removeUser({url: url, id: TEST_SIGN_UP_USER_1.username});
            await sfu.removeUser({url: url, id: TEST_SIGN_UP_USER_2.username});
        });
        it('should reject when user is signing up with email that already taken', async () => {
            await expect(sfu.signUp({
                url: url,
                email: TEST_USER_1.email,
                username: TEST_USER_1.username,
                password: TEST_USER_1.password
            })).rejects.toHaveProperty("error", UserManagementError.EMAIL_ADDRESS_ALREADY_TAKEN);
        });
        it('should check username', async () => {
            await sfu.ensureUsernameAvailable({
                url: url,
                username: TEST_SIGN_UP_USER_1.username,
            });
        });
        it('should reject when checking username that already in use', async () => {
            await expect(sfu.ensureUsernameAvailable({
                url: url,
                username: TEST_USER_1.username,
            })).rejects.toHaveProperty("error", UserManagementError.USERNAME_ALREADY_IN_USE);
        });
    });
    describe.skip("resetPassword", () => {

        beforeEach(async () => {
            jest.setTimeout(60000);
        })

        const emailForTest = "fillInYourEmail";
        const usernameForTest = "username";
        const changedPass = "111111";

        it('should sign up and reset password', async () => {
            await sfu.signUp({url: url, email: emailForTest, username: usernameForTest, password: "123456"});
            const handler = await sfu.resetPassword({url: url, email: emailForTest});
            await handler.resetPassword(changedPass);
            const sfu1 = await connect({
                username: emailForTest,
                email: emailForTest,
                password: changedPass,
                nickname: ""
            });
            await sfu1.disconnect();
            await sfu.removeUser({url: url, id: emailForTest});
        });
        it('should reject when email not found', async () => {
            await expect(sfu.resetPassword({url: url, email: "randomEmail@flashphoner.com"})).rejects.toHaveProperty("error", UserManagementError.EMAIL_NOT_FOUND);
        });
        it('should reset password from second try', async () => {
            await sfu.signUp({url: url, email: emailForTest, username: usernameForTest, password: "123456"});
            expect(sfu.resetPassword({url: url, email: emailForTest})).rejects.toEqual(new Error(UserManagementError.EMAIL_IS_NOT_VERIFIED));
            const handler = await sfu.resetPassword({url: url, email: emailForTest});
            await handler.resetPassword(changedPass);
            const sfu1 = await connect({
                username: emailForTest,
                email: emailForTest,
                password: changedPass,
                nickname: ""
            });
            await sfu1.disconnect();
            await sfu.removeUser({url: url, id: usernameForTest});
        });
    })
});
