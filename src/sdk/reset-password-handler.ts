
export class ResetPasswordHandler {


    #resetPassword: (password: string) => Promise<void>


    constructor(resetPassword: (password: string) => Promise<void>) {
        this.#resetPassword = resetPassword;
    }

    public resetPassword(newPassword: string) {
        return this.#resetPassword(newPassword);
    }
}